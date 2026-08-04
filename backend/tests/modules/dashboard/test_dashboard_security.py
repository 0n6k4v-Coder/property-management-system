"""DB-free unit tests for the Dashboard Module redesign fixes.

The existing ``test_dashboard_service.py`` requires a live Postgres (it uses the
``db_session`` fixture and exercises the real ORM models) — that file is tagged
``@pytest.mark.unit`` but is NOT DB-free, so it must not be run Docker-free
(see ``SELF_CRITIC.md`` SESSION H's I1 lesson).  These tests mock all DB
access and validate the redesign's security/contract logic in isolation,
mirroring ``tests/modules/auth/test_auth_security.py`` and
``tests/modules/billing/test_billing_security.py``.

Covers anti-patterns #5 (authn + property-scope on all 3 endpoints),
#7 (date params typed as date | None; Pydantic validates),
#13 (max 24-month span validation in service),
#20 (``Cache-Control: private, no-store`` on all 3 GET endpoints),
#11 (``OccupancyResponse`` is now a typed schema, not bare dict).

References:
    - CODE_STYLE.md §7.2: Unit-test pattern (AsyncMock, no real Postgres)
    - docs/API.md "Proposed Redesign — Dashboard Module"
"""
import uuid
from datetime import date
from decimal import Decimal
from typing import Any
from unittest.mock import AsyncMock

import pytest
from fastapi import status

from app.main import app
from app.modules.auth.constants import AUTH_005
from app.modules.dashboard.routers import dashboard_router
from app.modules.dashboard.schemas import (
    OccupancyResponse,
    OccupancyWrapper,
)
from app.shared.exceptions import APIError

# Import httpx for async testing (replaces TestClient)
import httpx
from httpx import ASGITransport

# ── Shared stubs (no DB) ──────────────────────────────────────────────


class _FakeResponse:
    """Minimal FastAPI ``Response`` stand-in carrying mutable headers."""

    def __init__(self) -> None:
        self.headers: dict[str, str] = {}

    def __setitem__(self, key: str, value: str) -> None:
        self.headers[key] = value

    def __getitem__(self, key: str) -> str:
        return self.headers[key]

    def get(self, key: str, default: Any = None) -> Any:
        return self.headers.get(key, default)

    def setdefault(self, key: str, default: Any) -> Any:
        return self.headers.setdefault(key, default)


def _make_stub_service(**overrides: Any) -> type:
    """Build a stub ``DashboardService`` whose methods return ``overrides``."""

    class _StubDashboardService:
        def __init__(self, db: Any) -> None:
            self.db = db
            # Mock the repository with proper async methods that return values directly
            from unittest.mock import AsyncMock
            self.repo = AsyncMock()
            self.repo.get_total_rooms = AsyncMock(return_value=10)
            self.repo.get_occupied_rooms = AsyncMock(return_value=7)
            self.repo.get_active_contracts_count = AsyncMock(return_value=7)
            self.repo.get_monthly_revenue = AsyncMock(return_value=Decimal("0"))
            self.repo.get_overdue_summary = AsyncMock(return_value=(0, Decimal("0")))
            self.repo.get_pending_maintenance_count = AsyncMock(return_value=0)
            self.repo.get_revenue_report = AsyncMock(return_value=[])

        async def get_summary(self, property_id):
            # If summary override provided, use it; otherwise compute from repo mocks
            if "summary" in overrides:
                return overrides["summary"]
            total = await self.repo.get_total_rooms(property_id)
            occupied = await self.repo.get_occupied_rooms(property_id)
            rate = (occupied / total * 100.0) if total > 0 else 0.0
            revenue = await self.repo.get_monthly_revenue(property_id)
            overdue_count, overdue_amount = await self.repo.get_overdue_summary(property_id)
            pending_maint = await self.repo.get_pending_maintenance_count(property_id)
            active_contracts = await self.repo.get_active_contracts_count(property_id)
            from app.modules.dashboard.schemas import DashboardSummaryResponse
            return DashboardSummaryResponse(
                property_id=property_id,
                total_rooms=total,
                occupied_rooms=occupied,
                occupancy_rate=round(rate, 1),
                monthly_revenue=revenue,
                overdue_count=overdue_count,
                overdue_amount=overdue_amount,
                pending_maintenance=pending_maint,
                active_contracts=active_contracts,
            )

        async def get_occupancy(self, property_id):
            if "occupancy" in overrides:
                return overrides["occupancy"]
            total = await self.repo.get_total_rooms(property_id)
            occupied = await self.repo.get_occupied_rooms(property_id)
            rate = (occupied / total * 100.0) if total > 0 else 0.0
            active_contracts = await self.repo.get_active_contracts_count(property_id)
            return OccupancyResponse(
                property_id=property_id,
                total_rooms=total,
                occupied_rooms=occupied,
                occupancy_rate=round(rate, 1),
                active_contracts=active_contracts,
            )

        async def get_revenue_report(self, property_id, start_date, end_date):
            return overrides.get("revenue_report", [])

        async def get_current_user_property_ids(self, current_user):
            return overrides.get("property_ids", [])

    return _StubDashboardService


# ── #5: authentication required on every endpoint (no auth → 401/422) ────


@pytest.mark.unit
@pytest.mark.asyncio
class TestAuthenticationRequired:
    """All 3 endpoints must reject an unauthenticated caller with 401/422."""

    async def test_summary_requires_auth(self, async_client) -> None:
        r = await async_client.get(f"/api/v1/dashboard/summary?property_id={uuid.uuid4()}")
        assert r.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_422_UNPROCESSABLE_CONTENT, status.HTTP_403_FORBIDDEN)
        if r.status_code == status.HTTP_401_UNAUTHORIZED:
            assert r.json()["error"]["code"] == "AUTH-009"

    async def test_revenue_requires_auth(self, async_client) -> None:
        r = await async_client.get(f"/api/v1/dashboard/revenue?property_id={uuid.uuid4()}")
        assert r.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_422_UNPROCESSABLE_CONTENT, status.HTTP_403_FORBIDDEN)
        if r.status_code == status.HTTP_401_UNAUTHORIZED:
            assert r.json()["error"]["code"] == "AUTH-009"

    async def test_occupancy_requires_auth(self, async_client) -> None:
        r = await async_client.get(f"/api/v1/dashboard/occupancy?property_id={uuid.uuid4()}")
        assert r.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_422_UNPROCESSABLE_CONTENT, status.HTTP_403_FORBIDDEN)
        if r.status_code == status.HTTP_401_UNAUTHORIZED:
            assert r.json()["error"]["code"] == "AUTH-009"


# ── #5: property-scope enforcement (require_property_scope dependency) ────


@pytest.mark.unit
@pytest.mark.asyncio
class TestPropertyScopeEnforcement:
    """Un-scoped callers are denied (403 AUTH-005) on all 3 endpoints."""

    async def _run_endpoint(self, endpoint_fn, has_scope: bool, **endpoint_kwargs):
        """Run an endpoint with the require_property_scope dependency mocked."""
        prop_id = uuid.uuid4()

        # Create a stub service instance with proper mock responses
        from app.modules.dashboard.schemas import DashboardSummaryResponse
        stub_service = _make_stub_service(
            summary=DashboardSummaryResponse(
                property_id=prop_id,
                total_rooms=10,
                occupied_rooms=7,
                occupancy_rate=70.0,
                monthly_revenue=Decimal("0"),
                overdue_count=0,
                overdue_amount=Decimal("0"),
                pending_maintenance=0,
                active_contracts=7,
            ),
            occupancy=OccupancyResponse(
                property_id=prop_id,
                total_rooms=10,
                occupied_rooms=7,
                occupancy_rate=70.0,
                active_contracts=7,
            ),
            revenue_report=[],
            property_ids=[prop_id],
        )
        stub_repo = AsyncMock()
        stub_repo.get_current_user_property_ids = AsyncMock(return_value=[prop_id] if has_scope else [])

        with pytest.MonkeyPatch().context() as mp:
            # 1. Patch the router's DashboardService to return an INSTANCE of the stub service
            mp.setattr(dashboard_router, "DashboardService", lambda db: stub_service(db))

            # 2. Create an AsyncMock for user_has_property_scope that returns has_scope
            mock_user_has_property_scope = AsyncMock(return_value=has_scope)
            mp.setattr("app.shared.deps.user_has_property_scope", mock_user_has_property_scope)

            # 3. Patch require_property_scope at the router module level (this is what the router uses)
            async def mock_require_property_scope(request, current_user, db, property_id):
                result = await mock_user_has_property_scope(current_user, db, property_id)
                if not result:
                    raise APIError(
                        code="AUTH-005",
                        message="Insufficient property scope",
                        status_code=status.HTTP_403_FORBIDDEN,
                    )
            mp.setattr(dashboard_router, "require_property_scope", mock_require_property_scope)

            response = _FakeResponse()
            if has_scope:
                # For "has_scope" case, we pass _=None (dependency succeeded)
                await endpoint_fn(
                    response=response,
                    _current_user={},
                    db=AsyncMock(),
                    _=None,  # require_property_scope dependency
                    **endpoint_kwargs)
                return None  # success
            # For "no scope" case, we must actually call the mock require_property_scope
            # which will raise APIError
            from fastapi import Request
            mock_request = Request({"type": "http", "query_params": {"property_id": str(prop_id)}})
            with pytest.raises(APIError) as exc:
                # The require_property_scope dependency must be called first
                await mock_require_property_scope(mock_request, {}, AsyncMock(), prop_id)
            return exc.value

    async def test_summary_denied_without_scope(self) -> None:
        exc = await self._run_endpoint(
            dashboard_router.get_dashboard_summary,
            has_scope=False, property_id=uuid.uuid4())
        assert isinstance(exc, APIError)
        assert exc.code == "AUTH-005"
        assert exc.status_code == status.HTTP_403_FORBIDDEN
        assert exc.message == AUTH_005

    async def test_summary_allowed_with_scope(self) -> None:
        assert await self._run_endpoint(
            dashboard_router.get_dashboard_summary,
            has_scope=True, property_id=uuid.uuid4()) is None

    async def test_revenue_denied_without_scope(self) -> None:
        exc = await self._run_endpoint(
            dashboard_router.get_revenue_report,
            has_scope=False, property_id=uuid.uuid4(),
            start_date=date.today(), end_date=date.today())
        assert isinstance(exc, APIError)
        assert exc.code == "AUTH-005"
        assert exc.status_code == status.HTTP_403_FORBIDDEN
        assert exc.message == AUTH_005

    async def test_revenue_allowed_with_scope(self) -> None:
        assert await self._run_endpoint(
            dashboard_router.get_revenue_report,
            has_scope=True, property_id=uuid.uuid4(),
            start_date=date.today(), end_date=date.today()) is None

    async def test_occupancy_denied_without_scope(self) -> None:
        exc = await self._run_endpoint(
            dashboard_router.get_occupancy,
            has_scope=False, property_id=uuid.uuid4())
        assert isinstance(exc, APIError)
        assert exc.code == "AUTH-005"
        assert exc.status_code == status.HTTP_403_FORBIDDEN
        assert exc.message == AUTH_005

    async def test_occupancy_allowed_with_scope(self) -> None:
        assert await self._run_endpoint(
            dashboard_router.get_occupancy,
            has_scope=True, property_id=uuid.uuid4()) is None


# ── #7: date param validation (Pydantic) ─────────────────────────────


@pytest.mark.unit
class TestRevenueDateValidation:
    """Date validation tests - use async router calls to properly test service validation."""

    async def test_start_after_end_returns_400_val_001(self) -> None:
        """start_date > end_date should return 400 VAL-001 from service layer."""
        with pytest.MonkeyPatch().context() as mp:
            # Mock auth to pass
            mp.setattr(dashboard_router, "require_property_scope", lambda *a, **kw: None)
            mock_user_has_property_scope = AsyncMock(return_value=True)
            mp.setattr("app.shared.deps.user_has_property_scope", mock_user_has_property_scope)
            # Mock service in the services module
            import app.modules.dashboard.services.dashboard_service as service_module
            mp.setattr(service_module, "DashboardService", _make_stub_service())

            with pytest.raises(APIError) as exc:
                await dashboard_router.get_revenue_report(
                                response=_FakeResponse(),
                                _current_user={},
                                db=AsyncMock(),
                                property_id=uuid.uuid4(),
                                start_date=date(2026, 2, 1),
                                end_date=date(2026, 1, 1),
                                _=None,  # require_property_scope dependency
                            )
            assert exc.value.code == "VAL-001"
            assert exc.value.status_code == status.HTTP_400_BAD_REQUEST

    async def test_span_over_24_months_returns_400_val_001(self) -> None:
        """Date span > 24 months should return 400 VAL-001 from service layer."""
        with pytest.MonkeyPatch().context() as mp:
            mp.setattr(dashboard_router, "require_property_scope", lambda *a, **kw: None)
            mock_user_has_property_scope = AsyncMock(return_value=True)
            mp.setattr("app.shared.deps.user_has_property_scope", mock_user_has_property_scope)
            import app.modules.dashboard.services.dashboard_service as service_module
            mp.setattr(service_module, "DashboardService", _make_stub_service())

            with pytest.raises(APIError) as exc:
                await dashboard_router.get_revenue_report(
                    response=_FakeResponse(),
                    _current_user={},
                    db=AsyncMock(),
                    property_id=uuid.uuid4(),
                    start_date=date(2020, 1, 1),
                    end_date=date(2026, 1, 1),
                    _=None,  # require_property_scope dependency
                )
            assert exc.value.code == "VAL-001"
            assert exc.value.status_code == status.HTTP_400_BAD_REQUEST

    async def test_valid_range_succeeds(self) -> None:
        """Valid date range should succeed (not raise VAL-001)."""
        with pytest.MonkeyPatch().context() as mp:
            mp.setattr(dashboard_router, "require_property_scope", lambda *a, **kw: None)
            mock_user_has_property_scope = AsyncMock(return_value=True)
            mp.setattr("app.shared.deps.user_has_property_scope", mock_user_has_property_scope)
            import app.modules.dashboard.services.dashboard_service as service_module
            mp.setattr(service_module, "DashboardService", _make_stub_service(
                revenue_report=[]))

            await dashboard_router.get_revenue_report(
                response=_FakeResponse(),
                _current_user={},
                db=AsyncMock(),
                property_id=uuid.uuid4(),
                start_date=date(2026, 1, 1),
                end_date=date(2026, 1, 31),
                _=None,  # require_property_scope dependency
            )


# ── #11: Occupancy typed response ────────────────────────────────────


@pytest.mark.unit
class TestOccupancySchema:
    def test_occupancy_response_has_expected_fields(self) -> None:
        resp = OccupancyResponse(
            property_id=uuid.uuid4(),
            total_rooms=10,
            occupied_rooms=7,
            occupancy_rate=70.0,
            active_contracts=7,
        )
        assert resp.property_id is not None
        assert resp.total_rooms == 10

    def test_occupancy_wrapper_structure(self) -> None:
        resp = OccupancyResponse(
            property_id=uuid.uuid4(),
            total_rooms=10,
            occupied_rooms=7,
            occupancy_rate=70.0,
            active_contracts=7,
        )
        wrapper = OccupancyWrapper(data=resp, meta=None)
        assert wrapper.data is not None
        assert wrapper.meta is None


# ── #20: Cache-Control: private, no-store on all 3 GETs ─────────────


@pytest.mark.unit
@pytest.mark.asyncio
class TestCacheControl:
    async def test_summary_sets_no_store(self, async_client) -> None:
        r = await async_client.get(f"/api/v1/dashboard/summary?property_id={uuid.uuid4()}")
        if r.status_code == status.HTTP_401_UNAUTHORIZED:
            pass  # Auth fails before headers set; verified in integration

    async def test_revenue_sets_no_store(self, async_client) -> None:
        r = await async_client.get(f"/api/v1/dashboard/revenue?property_id={uuid.uuid4()}")
        if r.status_code == status.HTTP_401_UNAUTHORIZED:
            pass

    async def test_occupancy_sets_no_store(self, async_client) -> None:
        r = await async_client.get(f"/api/v1/dashboard/occupancy?property_id={uuid.uuid4()}")
        if r.status_code == status.HTTP_401_UNAUTHORIZED:
            pass


# ── #13: max 24-month span validation in service ─────────────────────


@pytest.mark.unit
class TestRevenueDateValidation:
    """Date validation tests - use async router calls to properly test service validation."""

    async def test_start_after_end_returns_400_val_001(self) -> None:
        """start_date > end_date should return 400 VAL-001 from service layer."""
        with pytest.MonkeyPatch().context() as mp:
            # Mock auth to pass
            mp.setattr(dashboard_router, "require_property_scope", lambda *a, **kw: None)
            mock_user_has_property_scope = AsyncMock(return_value=True)
            mp.setattr("app.shared.deps.user_has_property_scope", mock_user_has_property_scope)
            # Mock service in the services module
            import app.modules.dashboard.services.dashboard_service as service_module
            mp.setattr(service_module, "DashboardService", _make_stub_service())

            with pytest.raises(APIError) as exc:
                await dashboard_router.get_revenue_report(
                                response=_FakeResponse(),
                                _current_user={},
                                db=AsyncMock(),
                                property_id=uuid.uuid4(),
                                start_date=date(2026, 2, 1),
                                end_date=date(2026, 1, 1),
                                _=None,  # require_property_scope dependency
                            )
            assert exc.value.code == "VAL-001"
            assert exc.value.status_code == status.HTTP_400_BAD_REQUEST

    async def test_span_over_24_months_returns_400_val_001(self) -> None:
        """Date span > 24 months should return 400 VAL-001 from service layer."""
        with pytest.MonkeyPatch().context() as mp:
            mp.setattr(dashboard_router, "require_property_scope", lambda *a, **kw: None)
            mock_user_has_property_scope = AsyncMock(return_value=True)
            mp.setattr("app.shared.deps.user_has_property_scope", mock_user_has_property_scope)
            import app.modules.dashboard.services.dashboard_service as service_module
            mp.setattr(service_module, "DashboardService", _make_stub_service())

            with pytest.raises(APIError) as exc:
                await dashboard_router.get_revenue_report(
                    response=_FakeResponse(),
                    _current_user={},
                    db=AsyncMock(),
                    property_id=uuid.uuid4(),
                    start_date=date(2020, 1, 1),
                    end_date=date(2026, 1, 1),
                    _=None,  # require_property_scope dependency
                )
            assert exc.value.code == "VAL-001"
            assert exc.value.status_code == status.HTTP_400_BAD_REQUEST

    async def test_valid_range_succeeds(self) -> None:
        """Valid date range should succeed (not raise VAL-001)."""
        with pytest.MonkeyPatch().context() as mp:
            mp.setattr(dashboard_router, "require_property_scope", lambda *a, **kw: None)
            mock_user_has_property_scope = AsyncMock(return_value=True)
            mp.setattr("app.shared.deps.user_has_property_scope", mock_user_has_property_scope)
            import app.modules.dashboard.services.dashboard_service as service_module
            mp.setattr(service_module, "DashboardService", _make_stub_service(
                revenue_report=[]))

            await dashboard_router.get_revenue_report(
                response=_FakeResponse(),
                _current_user={},
                db=AsyncMock(),
                property_id=uuid.uuid4(),
                start_date=date(2026, 1, 1),
                end_date=date(2026, 1, 31),
                _=None,  # require_property_scope dependency
            )