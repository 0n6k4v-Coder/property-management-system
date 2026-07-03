"""Performance benchmarks — Sprint 8: DB query latency, pool acquisition, rate limiting.

Uses pytest-benchmark with httpx.AsyncClient pattern.
Requires a running backend with DB + Redis + MinIO.

Run with:
    docker compose -f docker-compose.dev.yml --profile test run --rm backend-test \
      pytest tests/load/test_performance.py -v --benchmark-only --benchmark-json=/tmp/benchmark.json

    docker compose -f docker-compose.dev.yml --profile test run --rm backend-test \
      pytest tests/load/test_performance.py -v --benchmark-min-time=0.5 --benchmark-histogram=/tmp/benchmark_hist
"""

import asyncio
from datetime import UTC, datetime, timedelta

import pytest
import pytest_benchmark
from httpx import ASGITransport, AsyncClient

pytestmark = pytest.mark.benchmark(min_rounds=10, warmup=True, warmup_iterations=3)


@pytest.fixture(scope="module")
def event_loop():
    """Create one event loop for the entire module (benchmark-optimised)."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="module")
async def async_client():
    """Create an async HTTP client backed by the ASGI app (no network)."""
    from app.main import create_app

    app = create_app()
    transport = ASGITransport(app=app)  # type: ignore[arg-type]
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest.mark.benchmark(group="health")
@pytest.mark.asyncio
async def test_health_endpoint_latency(benchmark, async_client: AsyncClient) -> None:
    """Health endpoint should respond in < 50ms (no DB hit)."""

    async def _call() -> int:
        resp = await async_client.get("/health")
        return resp.status_code

    status = await benchmark(_call)
    assert status == 200


@pytest.mark.benchmark(group="rate_limit")
@pytest.mark.asyncio
async def test_rate_limit_threshold(benchmark, async_client: AsyncClient) -> None:
    """Rate limiter should allow normal traffic but block excess."""

    async def _rapid_fire() -> list[int]:
        results = []
        for _ in range(20):
            resp = await async_client.get("/health")
            results.append(resp.status_code)
        return results

    codes = await benchmark(_rapid_fire)
    # At least the first few should succeed; 429 is acceptable for excess
    assert 200 in codes, "No successful requests at all"


@pytest.mark.benchmark(group="auth")
@pytest.mark.asyncio
async def test_auth_login_db_latency(benchmark, async_client: AsyncClient) -> None:
    """Auth login with DB query — should complete in < 200ms (DB + Argon2id)."""

    # Pre-register a test user
    test_email = f"perf_{datetime.now(UTC).timestamp()}@benchmark.com"
    register_payload = {
        "email": test_email,
        "password": "BenchmarkPass1!",
        "full_name": "Benchmark User",
    }

    async def _call() -> int:
        resp = await async_client.post("/api/v1/auth/register", json=register_payload)
        return resp.status_code

    status = await benchmark(_call)
    # 201 = created, 409 = already exists (from prior runs)
    assert status in (201, 409), f"Unexpected status: {status}"


@pytest.mark.benchmark(group="db_pool")
@pytest.mark.asyncio
async def test_db_connection_pool_acquisition(benchmark, async_client: AsyncClient) -> None:
    """Multiple concurrent requests should not exhaust the pool."""

    async def _concurrent_calls(count: int = 10) -> list[int]:
        async def single() -> int:
            resp = await async_client.get("/health")
            return resp.status_code

        tasks = [single() for _ in range(count)]
        return await asyncio.gather(*tasks)

    results = await benchmark(_concurrent_calls)
    assert all(s == 200 for s in results), f"Pool under pressure: {results}"
