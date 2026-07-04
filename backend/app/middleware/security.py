# Security middleware - rate limiting, security headers, CORS hardening (SDD 4.5)
#
# References:
#     - SDD.md 4.5: Security & Access Control
#     - OWASP HTTP Security Headers

import time
from collections import defaultdict
from collections.abc import Awaitable, Callable

from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse

from app.config import get_settings


class InMemoryRateLimiter:
    """Simple in-memory rate limiter using a sliding window.

    Falls back to this when Redis is unavailable.
    """

    def __init__(self, max_requests: int = 1000, window_seconds: int = 60) -> None:
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._buckets: dict[str, list[float]] = defaultdict(list)

    async def check(self, key: str) -> bool:
        """Check if the key is within the rate limit. Returns True if allowed."""
        now = time.time()
        window_start = now - self.window_seconds
        bucket = self._buckets[key]
        self._buckets[key] = [t for t in bucket if t > window_start]
        if len(self._buckets[key]) >= self.max_requests:
            return False
        self._buckets[key].append(now)
        return True

    def reset(self) -> None:
        """Clear all rate limit buckets (for testing)."""
        self._buckets.clear()


_rate_limiter = InMemoryRateLimiter(max_requests=10000)


async def rate_limit_middleware(
    request: Request,
    call_next: Callable[[Request], Awaitable[Response]],
) -> Response:
    """Rate limiting middleware - applies to all routes."""
    # Skip rate limiting for health checks only
    if request.url.path == "/health":
        return await call_next(request)

    client_ip = request.client.host if request.client else "unknown"
    allowed = await _rate_limiter.check(f"ratelimit:{client_ip}")
    if not allowed:
        return JSONResponse(
            status_code=429,
            content={
                "error": {
                    "code": "SYS-429",
                    "message": "Too many requests. Please try again later.",
                    "details": {},
                }
            },
        )
    return await call_next(request)


async def security_headers_middleware(
    request: Request,
    call_next: Callable[[Request], Awaitable[Response]],
) -> Response:
    """Inject security headers into every response."""
    response = await call_next(request)
    settings = get_settings()
    if not settings.DEBUG:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Content-Security-Policy"] = "default-src 'self'"
    return response


def setup_cors_middleware(app: FastAPI) -> None:
    """Configure CORS with hardened settings."""
    from fastapi.middleware.cors import CORSMiddleware

    settings = get_settings()
    if settings.DEBUG:
        allow_origins = ["*"]
    else:
        raw = getattr(settings, "CORS_ORIGINS", "")
        allow_origins = [o.strip() for o in raw.split(",") if o.strip()] if raw else []

    app.add_middleware(
        CORSMiddleware,
        allow_origins=allow_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "Idempotency-Key"],
        expose_headers=["X-RateLimit-Limit", "X-RateLimit-Remaining", "Retry-After"],
        max_age=600,
    )


def register_security_middleware(app: FastAPI) -> None:
    """Register all security middleware. Must be called BEFORE routes."""
    app.middleware("http")(security_headers_middleware)
    app.middleware("http")(rate_limit_middleware)
    setup_cors_middleware(app)
