"""DB-free unit tests for the Maintenance Module redesign fixes.

The existing ``test_maintenance_api.py`` and ``test_maintenance_service.py``
require a live Postgres (they use the ``db_session`` fixture and exercise the
real ORM models) — those files are tagged ``@pytest.mark.integration``/``unit``
but are NOT DB-free, so they must not be run Docker-free (see
``SELF_CRITIC.md`` SESSION H's I1 lesson).  These tests mock all DB
access and validate the redesign's security/contract logic in isolation,
mirroring ``tests/modules/billing/test_billing_security.py`` and
``tests/modules/auth/test_auth_security.py``.

Covers anti-patterns #5 (authn + property-scope on all 5 endpoints),
#1 (``Idempotency-Key`` header on POST /), and #20
(``Cache-Control: private, no-store`` on GET /pending and GET /{id}).

References:
    - CODE_STYLE.md §7.2: Unit-test pattern (AsyncMock, no real Postgres)
    - docs/API.md "Proposed Redesign — Maintenance Module"
"""

import uuid
from datetime import UTC, datetime
from typing import Any
from unittest.mock import AsyncMock

import pytest
from fastapi import status
from fastapi.testclient import TestClient

from app.main import app
from app.modules.auth.constants import AUTH_005
from app.modules.maintenance.constants import MaintenanceStatus
from app.modules.maintenance.routers import maintenance_router
from app.modules.maintenance.schemas import (
    AssignMaintenanceRequest,
    UpdateMaintenanceStatusRequest,
)
from app.shared.deps import get_current_user
from app.shared.exceptions import APIError

# ── Shared stubs (no DB) ──────────────────────────────────────────────


class _FakeResponse:
    """Minimal FastAPI ``Response`` stand-in carrying mutable headers."""

    def __init__(self) -> None:
        self.headers: dict[str, str] = {}


def _make_stub_service(**overrides: Any) -> type:
    """Build a stub ``MaintenanceService`` whose methods return ``overrides``."""

    class _StubMaintenanceService:
        def __init__(self, db: Any) -> None:
            self.db = db

        async def create_request(self, **kwargs):
            return overrides.get("request")

        async def get_pending_by_property(self, property_id=None, *args, **kwargs):
            return overrides.get("pending_requests", [])

        async def get_request(self, request_id):
            return overrides.get("request")

        async def update_status(self, **kwargs):
            return overrides.get("request")

        async def assign_to(self, **kwargs):
            return overrides.get("request")

        @property
        def repo(self):
            return overrides.get("repo") or _StubRepo()

    return _StubMaintenanceService


class _StubRepo:
    """Stub ``MaintenanceRepository`` for the router's resolve-then-check calls."""

    def __init__(
        self,
        request_property_id: uuid.UUID | None = None,
        pending_requests: list | None = None,
    ) -> None:
        self._request_property_id = request_property_id
        self._pending_requests = pending_requests or []

    async def get_request_property_id(self, request_id: uuid.UUID):
        return self._request_property_id

    async def get_pending_by_property(self, property_id: uuid.UUID):
        return self._pending_requests


class _FakeRequest:
    """Concrete stand-in for a ``MaintenanceRequest`` ORM row (no DB)."""

    def __init__(
        self,
        property_id: uuid.UUID | None = None,
        room_id: uuid.UUID | None = None,
        title: str = "Fix AC",
        description: str = "Air conditioner not cooling",
        priority: str = "high",
        status: str = "pending",
        assigned_to: uuid.UUID | None = None,
        created_by: uuid.UUID | None = None,
    ) -> None:
        self.id = uuid.uuid4()
        self.property_id = property_id or uuid.uuid4()
        self.room_id = room_id or uuid.uuid4()
        self.title = title
        self.description = description
        self.priority = priority
        self.status = status
        self.assigned_to = assigned_to
        self.created_by = created_by or uuid.uuid4()
        self.created_at = datetime(2026, 1, 15, 10, 30, 0, tzinfo=UTC)
        self.updated_at = datetime(2026, 1, 15, 10, 30, 0, tzinfo=UTC)


# ── #5: authentication required on every endpoint (no auth → 401) ────


@pytest.mark.unit
class TestAuthenticationRequired:
    """All 5 endpoints must reject an unauthenticated caller with 401."""

    def test_post_create_requires_auth(self) -> None:
        with TestClient(app) as client:
            r = client.post(
                "/api/v1/maintenance/",
                json={
                    "room_id": str(uuid.uuid4()),
                    "property_id": str(uuid.uuid4()),
                    "title": "Fix AC",
                    "description": "AC not cooling at all.",
                    "priority": "high",
                },
            )
        assert r.status_code == status.HTTP_401_UNAUTHORIZED
        assert r.json()["error"]["code"] == "AUTH-009"

    def test_get_pending_requires_auth(self) -> None:
        with TestClient(app) as client:
            r = client.get(f"/api/v1/maintenance/pending?property_id={uuid.uuid4()}")
        assert r.status_code == status.HTTP_401_UNAUTHORIZED
        assert r.json()["error"]["code"] == "AUTH-009"

    def test_get_by_id_requires_auth(self) -> None:
        with TestClient(app) as client:
            r = client.get(f"/api/v1/maintenance/{uuid.uuid4()}")
        assert r.status_code == status.HTTP_401_UNAUTHORIZED
        assert r.json()["error"]["code"] == "AUTH-009"

    def test_patch_status_requires_auth(self) -> None:
        with TestClient(app) as client:
            r = client.patch(
                f"/api/v1/maintenance/{uuid.uuid4()}/status",
                json={"status": "in_progress"},
            )
        assert r.status_code == status.HTTP_401_UNAUTHORIZED
        assert r.json()["error"]["code"] == "AUTH-009"

    def test_patch_assign_requires_auth(self) -> None:
        with TestClient(app) as client:
            r = client.patch(
                f"/api/v1/maintenance/{uuid.uuid4()}/assign",
                json={"assigned_to": str(uuid.uuid4())},
            )
        assert r.status_code == status.HTTP_401_UNAUTHORIZED
        assert r.json()["error"]["code"] == "AUTH-009"


# ── #5: property-scope enforcement (resolve-then-check) ──────────────


@pytest.mark.unit
class TestPropertyScopeEnforcement:
    """Un-scoped callers are denied (403 AUTH-005) on the 3 resolve-then-check
    endpoints and on the query-sourced GET /pending."""

    async def _run_get_by_id(self, request_property_id, has_scope):
        request = _FakeRequest(property_id=request_property_id)
        stub_service = _make_stub_service(request=request)
        stub_repo = _StubRepo(request_property_id=request_property_id)
        with pytest.MonkeyPatch().context() as mp:
            mp.setattr(maintenance_router, "MaintenanceService", stub_service)
            mp.setattr(maintenance_router, "MaintenanceRepository", lambda db: stub_repo)
            mp.setattr(maintenance_router, "user_has_property_scope", AsyncMock(return_value=has_scope))
            response = _FakeResponse()
            if has_scope:
                await maintenance_router.get_maintenance_request(
                    response=response,
                    request_id=uuid.uuid4(),
                    current_user={"user_id": str(uuid.uuid4())},
                    db=AsyncMock(),
                )
                return None  # success
            with pytest.raises(APIError) as exc:
                await maintenance_router.get_maintenance_request(
                    response=response,
                    request_id=uuid.uuid4(),
                    current_user={"user_id": str(uuid.uuid4())},
                    db=AsyncMock(),
                )
            return exc.value

    async def test_get_by_id_denied_without_scope(self) -> None:
        exc = await self._run_get_by_id(uuid.uuid4(), has_scope=False)
        assert isinstance(exc, APIError)
        assert exc.code == "AUTH-005"
        assert exc.status_code == status.HTTP_403_FORBIDDEN
        assert exc.message == AUTH_005

    async def test_get_by_id_allowed_with_scope(self) -> None:
        assert await self._run_get_by_id(uuid.uuid4(), has_scope=True) is None

    async def _run_patch_status(self, request_property_id, has_scope):
        request = _FakeRequest(property_id=request_property_id, status="pending")
        stub_service = _make_stub_service(request=request)
        stub_repo = _StubRepo(request_property_id=request_property_id)
        with pytest.MonkeyPatch().context() as mp:
            mp.setattr(maintenance_router, "MaintenanceService", stub_service)
            mp.setattr(maintenance_router, "MaintenanceRepository", lambda db: stub_repo)
            mp.setattr(maintenance_router, "user_has_property_scope", AsyncMock(return_value=has_scope))
            if has_scope:
                await maintenance_router.update_maintenance_status(
                    request_id=uuid.uuid4(),
                    body=UpdateMaintenanceStatusRequest(status=MaintenanceStatus.IN_PROGRESS),
                    current_user={"user_id": str(uuid.uuid4())},
                    db=AsyncMock(),
                )
                return None
            with pytest.raises(APIError) as exc:
                await maintenance_router.update_maintenance_status(
                    request_id=uuid.uuid4(),
                    body=UpdateMaintenanceStatusRequest(status=MaintenanceStatus.IN_PROGRESS),
                    current_user={"user_id": str(uuid.uuid4())},
                    db=AsyncMock(),
                )
            return exc.value

    async def test_patch_status_denied_without_scope(self) -> None:
        exc = await self._run_patch_status(uuid.uuid4(), has_scope=False)
        assert isinstance(exc, APIError)
        assert exc.code == "AUTH-005"
        assert exc.status_code == status.HTTP_403_FORBIDDEN

    async def test_patch_status_allowed_with_scope(self) -> None:
        assert await self._run_patch_status(uuid.uuid4(), has_scope=True) is None

    async def _run_patch_assign(self, request_property_id, has_scope):
        request = _FakeRequest(property_id=request_property_id)
        stub_service = _make_stub_service(request=request)
        stub_repo = _StubRepo(request_property_id=request_property_id)
        with pytest.MonkeyPatch().context() as mp:
            mp.setattr(maintenance_router, "MaintenanceService", stub_service)
            mp.setattr(maintenance_router, "MaintenanceRepository", lambda db: stub_repo)
            mp.setattr(maintenance_router, "user_has_property_scope", AsyncMock(return_value=has_scope))
            if has_scope:
                await maintenance_router.assign_maintenance_request(
                    request_id=uuid.uuid4(),
                    body=AssignMaintenanceRequest(assigned_to=uuid.uuid4()),
                    current_user={"user_id": str(uuid.uuid4())},
                    db=AsyncMock(),
                )
                return None
            with pytest.raises(APIError) as exc:
                await maintenance_router.assign_maintenance_request(
                    request_id=uuid.uuid4(),
                    body=AssignMaintenanceRequest(assigned_to=uuid.uuid4()),
                    current_user={"user_id": str(uuid.uuid4())},
                    db=AsyncMock(),
                )
            return exc.value

    async def test_patch_assign_denied_without_scope(self) -> None:
        exc = await self._run_patch_assign(uuid.uuid4(), has_scope=False)
        assert isinstance(exc, APIError)
        assert exc.code == "AUTH-005"
        assert exc.status_code == status.HTTP_403_FORBIDDEN

    async def test_patch_assign_allowed_with_scope(self) -> None:
        assert await self._run_patch_assign(uuid.uuid4(), has_scope=True) is None

    async def _run_get_pending(self, has_scope):
        """Run the GET /pending endpoint testing the require_property_scope dependency."""
        prop_id = uuid.uuid4()

        # Create stub service instance with proper mock responses
        stub_service = _make_stub_service(pending_requests=[])

        # Override MaintenanceService
        import app.modules.maintenance.routers.maintenance_router as maintenance_router_module
        original_maintenance_service = maintenance_router_module.MaintenanceService
        maintenance_router_module.MaintenanceService = lambda db: stub_service(db)

        # Test the require_property_scope dependency directly like auth tests do
        from app.shared.deps import require_property_scope
        dep = require_property_scope(query_param="property_id")
        enforce = dep.dependency

        # Mock user_has_property_scope via UserRepository.get_property_scopes
        import app.modules.auth.repository as auth_repo
        original_class = auth_repo.UserRepository

        if has_scope:
            class MockRepo:
                async def get_property_scopes(self, user_id):
                    scope = MagicMock()
                    scope.property_id = prop_id
                    return [scope]
        else:
            class MockRepo:
                async def get_property_scopes(self, user_id):
                    return []

        auth_repo.UserRepository = lambda db: MockRepo()

        try:
            # Create a mock request with query_params containing property_id
            from unittest.mock import MagicMock

            from starlette.datastructures import QueryParams
            mock_request = MagicMock()
            mock_request.query_params = QueryParams(f"property_id={prop_id}")
            mock_request.path_params = {}

            current_user = {"user_id": str(uuid.uuid4()), "is_owner": False}
            db = AsyncMock()

            # Call the enforce function directly to test scope enforcement
            await enforce(current_user, mock_request, db)

            # Now call the actual endpoint function (scope check passed)
            response = _FakeResponse()
            await maintenance_router.list_pending_requests(
                response=response,
                property_id=prop_id,
                current_user={"user_id": str(uuid.uuid4())},
                db=AsyncMock(),
            )
            return None  # success
        except APIError as exc:
            # Return the exception so tests can assert on it (like billing tests do)
            return exc
        finally:
            # Restore
            import app.modules.auth.repository as auth_repo
            auth_repo.UserRepository = original_class
            maintenance_router_module.MaintenanceService = original_maintenance_service

    async def test_get_pending_denied_without_scope(self) -> None:
        exc = await self._run_get_pending(has_scope=False)
        assert isinstance(exc, APIError)
        assert exc.code == "AUTH-005"
        assert exc.status_code == status.HTTP_403_FORBIDDEN
        assert exc.message == AUTH_005

    async def test_get_pending_allowed_with_scope(self) -> None:
        assert await self._run_get_pending(has_scope=True) is None


# ── #1: Idempotency-Key header declared in OpenAPI on POST / ────────


@pytest.mark.unit
class TestIdempotencyHeader:
    """OpenAPI must declare the ``Idempotency-Key`` header on POST /maintenance/."""

    def test_openapi_declares_idempotency_key_on_post(self) -> None:
        schema = app.openapi()
        path = schema["paths"]["/api/v1/maintenance/"]["post"]
        headers = path.get("parameters", [])
        idempotency_param = next((p for p in headers if p.get("name") == "Idempotency-Key"), None)
        assert idempotency_param is not None, "Idempotency-Key header missing from OpenAPI"
        assert idempotency_param["in"] == "header"
        # The schema uses anyOf with string and null types
        param_schema = idempotency_param["schema"]
        if "anyOf" in param_schema:
            types = [opt.get("type") for opt in param_schema["anyOf"]]
            assert "string" in types
        else:
            assert param_schema["type"] == "string"


# ── #20: Cache-Control: private, no-store on GET /pending, GET /{id} ───


@pytest.mark.unit
class TestCacheControl:
    """GET /pending and GET /{id} must set ``Cache-Control: private, no-store``."""

    async def _test_endpoint_cache_control(self, endpoint_fn, **endpoint_kwargs):
            """Helper to test cache control on an endpoint with proper mocking."""
            prop_id = uuid.uuid4()

            # Patch MaintenanceService at the router module level (where it's imported)
            import app.modules.maintenance.routers.maintenance_router as maintenance_router_module
            original_maintenance_service = maintenance_router_module.MaintenanceService

            # Create stub service with proper mock responses
            stub_service = _make_stub_service(
                pending_requests=[],
                request=_FakeRequest(property_id=prop_id),
            )
            stub_instance = stub_service(None)

            original_maintenance_service = maintenance_router_module.MaintenanceService
            maintenance_router_module.MaintenanceService = lambda db: stub_instance

            # Override require_property_scope
            async def mock_require_property_scope():
                return None  # Allow scope

            app.dependency_overrides[maintenance_router_module.require_property_scope] = mock_require_property_scope

            # Override CurrentUser (get_current_user)
            async def mock_get_current_user():
                return {"user_id": str(uuid.uuid4())}

            app.dependency_overrides[get_current_user] = mock_get_current_user

            # Mock _check_scope to avoid DB access
            with pytest.MonkeyPatch().context() as mp:
                async def mock_check_scope(*args, **kwargs):
                    return None
                mp.setattr(maintenance_router_module, "_check_scope", mock_check_scope)

                try:
                    response = _FakeResponse()
                    if endpoint_fn == maintenance_router.list_pending_requests:
                        await endpoint_fn(
                            response=response,
                            property_id=prop_id,
                            current_user={"user_id": str(uuid.uuid4())},
                            db=AsyncMock(),
                        )
                    elif endpoint_fn == maintenance_router.get_maintenance_request:
                        await endpoint_fn(
                            response=response,
                            request_id=endpoint_kwargs.get("request_id"),
                            current_user={"user_id": str(uuid.uuid4())},
                            db=AsyncMock(),
                        )
                    else:
                        raise ValueError(f"Unknown endpoint function: {endpoint_fn}")
                finally:
                    if maintenance_router_module.require_property_scope in app.dependency_overrides:
                        del app.dependency_overrides[maintenance_router_module.require_property_scope]
                    if get_current_user in app.dependency_overrides:
                        del app.dependency_overrides[get_current_user]
                    maintenance_router_module.MaintenanceService = original_maintenance_service

                return response
    async def test_pending_sets_no_store(self) -> None:
        response = await self._test_endpoint_cache_control(
            maintenance_router.list_pending_requests,
            property_id=uuid.uuid4()
        )
        assert response.headers.get("Cache-Control") == "private, no-store"

    async def test_get_by_id_sets_no_store(self) -> None:
        response = await self._test_endpoint_cache_control(
            maintenance_router.get_maintenance_request,
            request_id=uuid.uuid4()
        )
        assert response.headers.get("Cache-Control") == "private, no-store"
