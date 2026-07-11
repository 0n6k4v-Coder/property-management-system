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

        async def get_pending_by_property(self, property_id):
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
                    current_user={},
                    db=AsyncMock(),
                )
                return None  # success
            with pytest.raises(APIError) as exc:
                await maintenance_router.get_maintenance_request(
                    response=response,
                    request_id=uuid.uuid4(),
                    current_user={},
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
                    current_user={},
                    db=AsyncMock(),
                )
                return None
            with pytest.raises(APIError) as exc:
                await maintenance_router.update_maintenance_status(
                    request_id=uuid.uuid4(),
                    body=UpdateMaintenanceStatusRequest(status=MaintenanceStatus.IN_PROGRESS),
                    current_user={},
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
                    current_user={},
                    db=AsyncMock(),
                )
                return None
            with pytest.raises(APIError) as exc:
                await maintenance_router.assign_maintenance_request(
                    request_id=uuid.uuid4(),
                    body=AssignMaintenanceRequest(assigned_to=uuid.uuid4()),
                    current_user={},
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
        stub_service = _make_stub_service(pending_requests=[])
        with pytest.MonkeyPatch().context() as mp:
            mp.setattr(maintenance_router, "MaintenanceService", stub_service)
            mp.setattr(maintenance_router, "user_has_property_scope", AsyncMock(return_value=has_scope))
            response = _FakeResponse()
            if has_scope:
                await maintenance_router.list_pending_requests(
                    response=response,
                    property_id=uuid.uuid4(),
                    current_user={},
                    db=AsyncMock(),
                )
                return None
            with pytest.raises(APIError) as exc:
                await maintenance_router.list_pending_requests(
                    response=response,
                    property_id=uuid.uuid4(),
                    current_user={},
                    db=AsyncMock(),
                )
            return exc.value

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
        assert idempotency_param["schema"]["type"] == "string"


# ── #20: Cache-Control: private, no-store on GET /pending, GET /{id} ───


@pytest.mark.unit
class TestCacheControl:
    """GET /pending and GET /{id} must set ``Cache-Control: private, no-store``."""

    async def test_get_pending_sets_no_store(self) -> None:
        stub_service = _make_stub_service(pending_requests=[])
        with pytest.MonkeyPatch().context() as mp:
            mp.setattr(maintenance_router, "MaintenanceService", stub_service)
            mp.setattr(maintenance_router, "user_has_property_scope", AsyncMock(return_value=True))
            response = _FakeResponse()
            await maintenance_router.list_pending_requests(
                response=response,
                property_id=uuid.uuid4(),
                current_user={},
                db=AsyncMock(),
            )
        assert response.headers.get("Cache-Control") == "private, no-store"

    async def test_get_by_id_sets_no_store(self) -> None:
        request = _FakeRequest()
        stub_service = _make_stub_service(request=request)
        stub_repo = _StubRepo(request_property_id=request.property_id)
        with pytest.MonkeyPatch().context() as mp:
            mp.setattr(maintenance_router, "MaintenanceService", stub_service)
            mp.setattr(maintenance_router, "MaintenanceRepository", lambda db: stub_repo)
            mp.setattr(maintenance_router, "user_has_property_scope", AsyncMock(return_value=True))
            response = _FakeResponse()
            await maintenance_router.get_maintenance_request(
                response=response,
                request_id=uuid.uuid4(),
                current_user={},
                db=AsyncMock(),
            )
        assert response.headers.get("Cache-Control") == "private, no-store"


# ── #3/#5 error envelope: not-found raises APIError (not HTTPException) ───


@pytest.mark.unit
class TestErrorEnvelope:
    """Missing resources must raise ``APIError`` so the global handler emits
    the unified ``{"error": {...}}`` envelope (not FastAPI's bare ``detail``)."""

    async def test_get_by_id_not_found_raises_maint_001(self) -> None:
        stub_service = _make_stub_service(request=None)
        with pytest.MonkeyPatch().context() as mp:
            mp.setattr(maintenance_router, "MaintenanceService", stub_service)
            with pytest.raises(APIError) as exc:
                await maintenance_router.get_maintenance_request(
                    response=_FakeResponse(),
                    request_id=uuid.uuid4(),
                    current_user={},
                    db=AsyncMock(),
                )
        assert exc.value.code == "MAINT-001"
        assert exc.value.status_code == status.HTTP_404_NOT_FOUND

    async def test_patch_status_not_found_raises_maint_001(self) -> None:
        stub_service = _make_stub_service(request=None)
        stub_repo = _StubRepo(request_property_id=uuid.uuid4())
        with pytest.MonkeyPatch().context() as mp:
            mp.setattr(maintenance_router, "MaintenanceService", stub_service)
            mp.setattr(maintenance_router, "MaintenanceRepository", lambda db: stub_repo)
            mp.setattr(maintenance_router, "user_has_property_scope", AsyncMock(return_value=True))
            with pytest.raises(APIError) as exc:
                await maintenance_router.update_maintenance_status(
                    request_id=uuid.uuid4(),
                    body=UpdateMaintenanceStatusRequest(status=MaintenanceStatus.IN_PROGRESS),
                    current_user={},
                    db=AsyncMock(),
                )
        assert exc.value.code == "MAINT-001"
        assert exc.value.status_code == status.HTTP_404_NOT_FOUND

    async def test_patch_assign_not_found_raises_maint_001(self) -> None:
        stub_service = _make_stub_service(request=None)
        stub_repo = _StubRepo(request_property_id=uuid.uuid4())
        with pytest.MonkeyPatch().context() as mp:
            mp.setattr(maintenance_router, "MaintenanceService", stub_service)
            mp.setattr(maintenance_router, "MaintenanceRepository", lambda db: stub_repo)
            mp.setattr(maintenance_router, "user_has_property_scope", AsyncMock(return_value=True))
            with pytest.raises(APIError) as exc:
                await maintenance_router.assign_maintenance_request(
                    request_id=uuid.uuid4(),
                    body=AssignMaintenanceRequest(assigned_to=uuid.uuid4()),
                    current_user={},
                    db=AsyncMock(),
                )
        assert exc.value.code == "MAINT-001"
        assert exc.value.status_code == status.HTTP_404_NOT_FOUND
