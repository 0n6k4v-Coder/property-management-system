"""Structured JSON logging middleware (CODE_STYLE.md §6.4).

Provides a drop-in Middleware class that adds request-id correlation,
latency tracking, and structured metadata to every request log line.
Used as an *alternative* to the inline @app.middleware("http") — pick one.

References:
  - CODE_STYLE.md §6.4: Logging
  - SDD.md §4.5: Security / Audit
"""
import time
import uuid

import structlog
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = structlog.get_logger()


class LoggingMiddleware(BaseHTTPMiddleware):
    """Add request_id, log request/response metadata in JSON format.

    Binds a unique request_id into structlog's context-vars so that all
    downstream log calls (services, repository, audit) automatically carry
    the same correlation token — no manual plumbing required.
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        start_time = time.time()

        try:
            response = await call_next(request)
            duration_ms = (time.time() - start_time) * 1000

            logger.info(
                "http.request",
                request_id=request_id,
                method=request.method,
                path=request.url.path,
                status_code=response.status_code,
                duration_ms=round(duration_ms, 2),
                client_ip=request.client.host if request.client else None,
            )
            response.headers["X-Request-ID"] = request_id
            return response
        except Exception as e:
            logger.error(
                "http.error",
                request_id=request_id,
                method=request.method,
                path=request.url.path,
                error=str(e),
                exc_info=True,
            )
            raise


def setup_logging_middleware(app):
    """Register logging middleware on FastAPI app."""
    app.add_middleware(LoggingMiddleware)
