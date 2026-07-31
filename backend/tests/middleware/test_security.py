"""Unit tests for security middleware — headers, rate limiting, CORS.

References:
    - SDD.md §4.5: Security & Access Control
"""

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.middleware.security import (
    InMemoryRateLimiter,
    register_security_middleware,
)


@pytest.mark.unit
class TestSecurityHeaders:
    async def test_headers_injected(self):
        """Security headers are present in every response."""
        app = FastAPI()
        register_security_middleware(app)

        @app.get("/test")
        async def test_route():
            return {"ok": True}

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/test")

        assert response.headers.get("x-frame-options") == "DENY"
        assert response.headers.get("x-content-type-options") == "nosniff"
        assert response.headers.get("content-security-policy") == "default-src 'self'"

    async def test_rate_limit_allows_normal(self):
        """Rate limiter allows normal traffic."""
        limiter = InMemoryRateLimiter(max_requests=10, window_seconds=60)
        for _ in range(10):
            assert await limiter.check("test_key") is True

    async def test_rate_limit_blocks_excess(self):
        """Rate limiter blocks traffic exceeding the limit."""
        limiter = InMemoryRateLimiter(max_requests=5, window_seconds=60)
        for _ in range(5):
            await limiter.check("test_key_excess")
        assert await limiter.check("test_key_excess") is False
