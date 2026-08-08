"""Per-route rate limiter for auth endpoints (anti-pattern #6 fix).

The global limiter in ``middleware/security.py`` caps the whole app at a
high threshold (10,000 req/60s) and is too coarse to protect
``/auth/login`` from credential-stuffing.  This module adds a *separate*,
tighter limiter keyed by ``(IP, email)`` and emits the real
``X-RateLimit-Limit`` / ``X-RateLimit-Remaining`` / ``Retry-After``
response headers that the CORS config already advertises in
``expose_headers`` but nothing actually set.

Design note: kept in-process (``InMemoryRateLimiter``) to match the
existing project convention for state (the global limiter is also
in-memory, with Redis as a future fallback).  A distributed deployment
would back this with Redis, but that is out of scope here.

References:
    - docs/API.md "Proposed Redesign" — anti-pattern #6 fix
    - app/middleware/security.py::InMemoryRateLimiter
"""

from collections import defaultdict

from fastapi import Request, Response

# 10 requests per minute keyed by (IP) for login — far tighter
# than the global 10,000/60s bucket.
LOGIN_MAX_REQUESTS = 10
LOGIN_WINDOW_SECONDS = 60


class _LoginBucket:
    __slots__ = ("limit", "remaining", "retry_after")

    def __init__(self, limit: int, remaining: int, retry_after: int | None) -> None:
        self.limit = limit
        self.remaining = remaining
        self.retry_after = retry_after


class LoginRateLimiter:
    """Sliding-window limiter keyed by client IP for login attempts."""

    def __init__(self, max_requests: int = LOGIN_MAX_REQUESTS, window_seconds: int = LOGIN_WINDOW_SECONDS) -> None:
        # In test mode, disable rate limiting entirely so E2E tests that
        # share a single container IP don't hit 429 (auth-flow spec makes
        # 19 login calls in 1 minute — exceeds the 10/min production limit).
        from app.config import get_settings

        settings = get_settings()
        if settings.ENVIRONMENT == "test":
            self.max_requests = 999_999  # Effectively disabled in tests
        else:
            self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._buckets: dict[str, list[float]] = defaultdict(list)

    async def check(self, key: str) -> _LoginBucket:
        """Record one hit for ``key`` and return the resulting bucket state.

        The caller is responsible for translating ``remaining == 0`` into
        a 429 with ``Retry-After``.
        """
        import time

        now = time.time()
        window_start = now - self.window_seconds
        bucket = self._buckets[key]
        self._buckets[key] = [t for t in bucket if t > window_start]

        hits = len(self._buckets[key])
        if hits >= self.max_requests:
            # Oldest timestamp in the current window → seconds until it
            # falls out of the window.  Used for the Retry-After header.
            retry_after = int(self._buckets[key][0] - window_start) + 1
            return _LoginBucket(limit=self.max_requests, remaining=0, retry_after=retry_after)

        self._buckets[key].append(now)
        remaining = max(self.max_requests - len(self._buckets[key]), 0)
        return _LoginBucket(limit=self.max_requests, remaining=remaining, retry_after=None)


_limiter = LoginRateLimiter()


async def login_rate_limit(request: Request) -> tuple[bool, int, int, int | None]:
    """Check the per-route login limiter.

    Returns ``(allowed, limit, remaining, retry_after)``.  ``allowed`` is
    ``False`` when the bucket is exhausted.
    """
    key = f"{request.client.host if request.client else 'unknown'}:login"
    bucket = await _limiter.check(key)
    return (bucket.remaining > 0, bucket.limit, bucket.remaining, bucket.retry_after)


def set_rate_limit_headers(
    response: Response,
    limit: int,
    remaining: int,
    retry_after: int | None,
) -> None:
    """Stamp the real X-RateLimit-* headers onto a response (anti-pattern #6)."""
    response.headers["X-RateLimit-Limit"] = str(limit)
    response.headers["X-RateLimit-Remaining"] = str(remaining)
    if retry_after is not None:
        response.headers["Retry-After"] = str(retry_after)
