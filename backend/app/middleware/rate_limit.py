"""Rate limiting middleware (in-memory fallback for development).

Provides a simple sliding-window in-memory rate limiter.  In production
this should be replaced with a Redis-backed token-bucket implementation
(SDD §4.5 — Security).  The current implementation is suitable for dev
and small-scale self-hosted deployments.

References:
  - SDD §4.5: Security / Rate limiting (100 req/min/IP on auth endpoints)
  - CODE_STYLE.md §6: Security Guidelines
"""
import time
from collections import defaultdict

from fastapi import Request, Response, status
from starlette.middleware.base import BaseHTTPMiddleware


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Simple in-memory rate limiter: N requests/minute per IP.

    Uses a sliding-window counter per client IP.  Old entries (>60 s)
    are purged on every request so the window is always accurate.
    When the limit is exceeded a 429 response is returned with a
    JSON body that follows the standard error-contract from SDD §3.3.
    """

    def __init__(self, app, requests_per_minute: int = 100):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        self._buckets: dict[str, list[float]] = defaultdict(list)

    async def dispatch(self, request: Request, call_next) -> Response:
        client_ip = request.client.host if request.client else "unknown"
        now = time.time()

        # Purge entries older than the 60-second window
        self._buckets[client_ip] = [
            t for t in self._buckets[client_ip] if now - t < 60
        ]

        if len(self._buckets[client_ip]) >= self.requests_per_minute:
            return Response(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content=(
                    '{"error":{"code":"SYS-429","message":"Rate limit exceeded",'
                    '"details":{}}}'
                ),
                media_type="application/json",
                headers={"Retry-After": "60"},
            )

        self._buckets[client_ip].append(now)
        return await call_next(request)


def setup_rate_limit_middleware(app):
    """Register rate limit middleware on FastAPI app."""
    app.add_middleware(RateLimitMiddleware, requests_per_minute=100)
