"""FastAPI app factory — registers routes, middleware, and error handlers."""

import asyncio
import os
import signal
import sys
from contextlib import asynccontextmanager
from typing import Any

# Configure structlog
import structlog
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.health import router as health_router
from app.middleware.auth import setup_auth_middleware
from app.middleware.cors import setup_cors_middleware
from app.middleware.logging import setup_logging_middleware
from app.middleware.security import register_security_middleware

# Router imports (lazy, all modules)
from app.modules.admin.routers.admin_router import router as admin_router
from app.modules.auth.routers.auth_router import router as auth_router
from app.modules.billing.routers.billing_router import router as billing_router
from app.modules.contract.routers.contract_router import router as contract_router
from app.modules.dashboard.routers.dashboard_router import router as dashboard_router
from app.modules.maintenance.routers.maintenance_router import router as maintenance_router
from app.modules.notification.routers.notification_router import router as notification_router
from app.modules.property.routers.property_router import router as property_router
from app.modules.tenant.routers.tenant_router import router as tenant_router
from app.shared.exceptions import APIError

structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.dev.ConsoleRenderer() if sys.stderr.isatty()
        else structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.stdlib.BoundLogger,
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    cache_logger_on_first_use=True,
)

# Graceful shutdown handler
_shutdown_event = asyncio.Event()


def _signal_handler(signum: int, _frame: Any) -> None:
    """Handle OS signals — set the shutdown event for graceful drain. """
    sig_name = signal.Signals(signum).name
    structlog.get_logger().warning("signal_received", signal=sig_name)
    _shutdown_event.set()


async def wait_for_shutdown(db_pool: Any, redis_client: Any | None = None) -> None:
    """ until shutdown signal received, then close resources gracefully. """
    logger = structlog.get_logger()
    await _shutdown_event.wait()
    logger.info("shutdown_initiated", component="app")

    # Close DB pool
    try:
        await db_pool.dispose()
        logger.info("db_pool_closed")
    except Exception as exc:
        logger.error("db_pool_close_failed", error=str(exc))

    # Close Redis
    if redis_client:
        try:
            await redis_client.close()
            logger.info("redis_closed")
        except Exception as exc:
            logger.error("redis_close_failed", error=str(exc))

    logger.info("shutdown_complete")


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Application lifespan — startup/shutdown hooks."""
    # Configure structured logging
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.stdlib.filter_by_level,
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.dev.ConsoleRenderer() if sys.stderr.isatty()
        else structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.stdlib.BoundLogger,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )
    logger = structlog.get_logger()
    settings = get_settings()

    # Register signal handlers
    if not (os.environ.get("PYTEST_VERSION") or os.environ.get("PYTEST_CURRENT_TEST")):
        signal.signal(signal.SIGTERM, _signal_handler)
        signal.signal(signal.SIGINT, _signal_handler)

    # Log startup
    logger.info(
        "app_startup",
        app_name=settings.APP_NAME,
        version=settings.APP_VERSION,
        debug=settings.DEBUG,
    )

    yield

    # Shutdown
    logger.info("app_shutdown", app_name=settings.APP_NAME, debug=settings.DEBUG)


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    settings = get_settings()

    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        debug=settings.DEBUG,
        lifespan=lifespan,
        docs_url="/docs" if settings.DEBUG else None,
        redoc_url="/redoc" if settings.DEBUG else None,
        openapi_url="/openapi.json" if settings.DEBUG else None,
    )

    # Register middleware (order matters)
    # CORS is set up exactly once, via the explicit-allowlist helper in
    # app/middleware/cors.py — never paired with a wildcard, even in DEBUG
    # (anti-pattern #23 fix).  The security middleware wires headers + the
    # global rate limiter (it no longer registers CORS itself).
    register_security_middleware(app)
    setup_cors_middleware(app, settings.CORS_ORIGINS)
    setup_auth_middleware(app)
    setup_logging_middleware(app)

    # Register exception handlers
    @app.exception_handler(APIError)
    async def api_error_handler(_: Request, exc: APIError):
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": {
                    "code": exc.code,
                    "message": exc.message,
                    "details": exc.details,
                }
            },
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(_: Request, exc: RequestValidationError):
        # Unified error envelope (anti-pattern #3 fix): a 422 on any
        # endpoint returns the same ``{"error": {...}}`` shape as every
        # domain error instead of FastAPI's default ``{"detail": [...]}``.
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "error": {
                    "code": "VAL-001",
                    "message": "Request validation failed",
                    "details": {"errors": exc.errors()},
                }
            },
        )

    # Register routers
    app.include_router(health_router, tags=["Health"])
    app.include_router(auth_router, prefix="/api/v1/auth", tags=["Auth"])
    app.include_router(property_router, prefix="/api/v1/properties", tags=["Properties"])
    app.include_router(tenant_router, prefix="/api/v1/tenants", tags=["Tenants"])
    app.include_router(billing_router, prefix="/api/v1/billing", tags=["Billing"])
    app.include_router(contract_router, prefix="/api/v1/contracts", tags=["Contracts"])
    app.include_router(maintenance_router, prefix="/api/v1/maintenance", tags=["Maintenance"])
    app.include_router(dashboard_router, prefix="/api/v1/dashboard", tags=["Dashboard"])
    app.include_router(notification_router, prefix="/api/v1/notifications", tags=["Notifications"])
    app.include_router(admin_router, prefix="/api/v1/admin", tags=["Admin"])

    return app


# Module-level app instance for ASGI servers (uvicorn, gunicorn)
app = create_app()
