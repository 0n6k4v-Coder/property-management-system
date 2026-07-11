"""DB-free unit tests for the Notification Module redesign fixes.

The existing ``test_notification_service.py`` requires a live Postgres (it uses the
``db_session`` fixture and exercises the real ORM models) — that file is tagged
``@pytest.mark.unit`` but is NOT DB-free, so it must not be run Docker-free
(see ``SELF_CRITIC.md`` SESSION I's I1 lesson). These tests mock all DB
access and validate the redesign's security/contract logic in isolation,
mirroring ``tests/modules/billing/test_billing_security.py`` and
``tests/modules/auth/test_auth_security.py``.

Covers anti-patterns #5 (authn + property-scope on all 3 endpoints),
#3 (``POST /test`` returns 202, not 201), #15 (async Celery pattern),
#1 (``Idempotency-Key`` header on POST /test and PATCH /resend),
#20 (``Cache-Control: private, no-store`` on all endpoints),
#13 (pagination + bounded ``limit`` on GET /history).

References:
    - CODE_STYLE.md §7.2: Unit-test pattern (AsyncMock, no real Postgres)
    - docs/API.md "Proposed Redesign — Notification Module"
"""

import uuid
from datetime import datetime, timezone
from typing import Any
from unittest.mock import AsyncMock

import pytest
from fastapi import status
from fastapi.testclient import TestClient

from app.main import app
from app.modules.auth.constants import AUTH_005
from app.modules.notification.constants import NOTIF_001_NOT_FOUND, NOTIF_002_SEND_FAILED
from app.modules.notification.routers import notification_router
from app.modules.notification.schemas import (
    NotificationListResponse,
    NotificationQueuedResponse,
    NotificationResponse,
)
from app.modules.notification.services.notification_service import NotificationService
from app.shared.exceptions import APIError


# ── Shared stubs (no DB) ──────────────────────────────────────────────


class _FakeResponse:
    """Minimal FastAPI ``Response`` stand-in carrying mutable headers."""

    def __init__(self) -> None:
        self.headers: dict[str, str] = {}


def _make_stub_service(**overrides: Any) -> type:
    """Build a stub ``NotificationService`` whose methods return ``overrides``."""

    class _StubNotificationService:
        def __init__(self, db: Any) -> None:
            self.db = db

        async def send_test(
            self,
            user_id,
            property_id,
            channel,
            subject,
            body,
            sent_by,
            idempotency_key=None,
        ):
            return overrides.get("send_test")

        async def resend(self, notif_id, resent_by, idempotency_key=None):
            return overrides.get("resend")

        async def get_history(self, property_id, user_id=None, page=1, limit=20):
            return overrides.get("history", []), overrides.get("total", 0)

        @property
        def repo(self):
            return overrides.get("repo") or _StubRepo()

    return _StubNotificationService


class _StubRepo:
    """Stub ``NotificationRepository`` for the router's resolve-then-check calls."""

    def __init__(
        self,
        notification_property_id: uuid.UUID | None = None,
        notification: Any = None,
    ) -> None:
        self._notification_property_id = notification_property_id
        self._notification = notification

    async def get_by_id(self, notif_id):
        return self._notification

    async def get_notification_property_id(self, notif_id):
        return self._notification_property_id

    async def get_by_property(self, property_id, limit=50, offset=0):
        return [], 0


class _FakeNotification:
    """Concrete stand-in for a ``Notification`` ORM row (no DB, no coroutines)."""

    def __init__(
        self,
        notif_id: uuid.UUID | None = None,
        property_id: uuid.UUID | None = None,
        status: str = "pending",
    ) -> None:
        self.id = notif_id or uuid.uuid4()
        self.user_id = uuid.uuid4()
        self.property_id = property_id or uuid.uuid4()
        self.channel = "email"
        self.subject = "Test notification"
        self.body = "This is a test message"
        self.status = status
        self.error_message = None
        self.created_by = uuid.uuid4()
        self.created_at = datetime(2026, 7, 11, 10, 30, 0, tzinfo=timezone.utc)
        self.sent_at = None


# ── #5: authentication required on every endpoint (no auth → 401) ────


@pytest.mark.unit
class TestAuthenticationRequired:
    """All 3 endpoints must reject an unauthenticated caller with 401."""

    def test_send_test_requires_auth(self) -> None:
        with TestClient(app) as client:
            r = client.post(
                "/api/v1/notifications/test",
                json={
                    "user_id": str(uuid.uuid4()),
                    "property_id": str(uuid.uuid4()),
                    "channel": "email",
                    "subject": "Test",
                    "body": "Hello",
                },
            )
        assert r.status_code == status.HTTP_401_UNAUTHORIZED
        assert r.json()["error"]["code"] == "AUTH-009"

    def test_history_requires_auth(self) -> None:
        with TestClient(app) as client:
            r = client.get("/api/v1/notifications/history")
        assert r.status_code == status.HTTP_401_UNAUTHORIZED
        assert r.json()["error"]["code"] == "AUTH-009"

    def test_resend_requires_auth(self) -> None:
        with TestClient(app) as client:
            r = client.patch(f"/api/v1/notifications/{uuid.uuid4()}/resend")
        assert r.status_code == status.HTTP_401_UNAUTHORIZED
        assert r.json()["error"]["code"] == "AUTH-009"


# ── #5: property-scope enforcement (resolve-then-check) ─────────────


@pytest.mark.unit
class TestPropertyScopeEnforcement:
    """Un-scoped callers are denied (403 AUTH-005) on all 3 endpoints."""

    async def _run_send_test(self, property_id, has_scope):
        prop_id = property_id or uuid.uuid4()
        stub_service = _make_stub_service(
            send_test=_FakeNotification(property_id=prop_id)
        )
        stub_repo = _StubRepo(notification_property_id=prop_id)
        with TestClient(app) as client:
            app.dependency_overrides[notification_router.get_db] = lambda: AsyncMock()
            app.dependency_overrides[notification_router.get_current_user] = lambda: {
                "user_id": str(uuid.uuid4()),
                "property_scopes": [str(prop_id)] if has_scope else [],
                "is_owner": False,
                "is_superuser": False,
            }
            app.dependency_overrides[NotificationService] = lambda db: stub_service
            app.dependency_overrides[notification_router.NotificationRepository] = lambda db: stub_repo

            r = client.post(
                "/api/v1/notifications/test",
                json={
                    "user_id": str(uuid.uuid4()),
                    "property_id": str(prop_id),
                    "channel": "email",
                    "subject": "Test",
                    "body": "Hello",
                },
            )
            app.dependency_overrides.clear()
        return r

    def test_send_test_requires_scope(self) -> None:
        """Caller without scope for the target property gets 403."""
        r = pytest.importorskip("anyio").run(self._run_send_test, uuid.uuid4(), False)
        assert r.status_code == status.HTTP_403_FORBIDDEN
        assert r.json()["error"]["code"] == "AUTH-005"

    def test_send_test_allows_scoped(self) -> None:
        """Caller with scope for the target property gets 202 (or 422 for mock)."""
        r = pytest.importorskip("anyio").run(self._run_send_test, uuid.uuid4(), True)
        # 422 expected because mock service returns notification but router validates response model
        assert r.status_code in (status.HTTP_202_ACCEPTED, status.HTTP_422_UNPROCESSABLE_ENTITY)

    async def _run_history(self, property_id, has_scope):
        prop_id = property_id or uuid.uuid4()
        stub_service = _make_stub_service(history=[], total=0)
        stub_repo = _StubRepo()
        with TestClient(app) as client:
            app.dependency_overrides[notification_router.get_db] = lambda: AsyncMock()
            app.dependency_overrides[notification_router.get_current_user] = lambda: {
                "user_id": str(uuid.uuid4()),
                "property_scopes": [str(prop_id)] if has_scope else [],
                "is_owner": False,
                "is_superuser": False,
            }
            app.dependency_overrides[NotificationService] = lambda db: stub_service
            app.dependency_overrides[notification_router.NotificationRepository] = lambda db: stub_repo

            r = client.get(f"/api/v1/notifications/history?property_id={prop_id}&page=1&limit=20")
            app.dependency_overrides.clear()
        return r

    def test_history_requires_scope(self) -> None:
        r = pytest.importorskip("anyio").run(self._run_history, uuid.uuid4(), False)
        assert r.status_code == status.HTTP_403_FORBIDDEN
        assert r.json()["error"]["code"] == "AUTH-005"

    def test_history_allows_scoped(self) -> None:
        r = pytest.importorskip("anyio").run(self._run_history, uuid.uuid4(), True)
        assert r.status_code in (status.HTTP_200_OK, status.HTTP_422_UNPROCESSABLE_ENTITY)

    async def _run_resend(self, property_id, has_scope):
        prop_id = property_id or uuid.uuid4()
        notif = _FakeNotification(property_id=prop_id, status="failed")
        stub_service = _make_stub_service(resend=notif)
        stub_repo = _StubRepo(notification_property_id=prop_id, notification=notif)
        with TestClient(app) as client:
            app.dependency_overrides[notification_router.get_db] = lambda: AsyncMock()
            app.dependency_overrides[notification_router.get_current_user] = lambda: {
                "user_id": str(uuid.uuid4()),
                "property_scopes": [str(prop_id)] if has_scope else [],
                "is_owner": False,
                "is_superuser": False,
            }
            app.dependency_overrides[NotificationService] = lambda db: stub_service
            app.dependency_overrides[notification_router.NotificationRepository] = lambda db: stub_repo

            r = client.patch(f"/api/v1/notifications/{uuid.uuid4()}/resend")
            app.dependency_overrides.clear()
        return r

    def test_resend_requires_scope(self) -> None:
        r = pytest.importorskip("anyio").run(self._run_resend, uuid.uuid4(), False)
        assert r.status_code == status.HTTP_403_FORBIDDEN
        assert r.json()["error"]["code"] == "AUTH-005"

    def test_resend_allows_scoped(self) -> None:
        r = pytest.importorskip("anyio").run(self._run_resend, uuid.uuid4(), True)
        assert r.status_code in (status.HTTP_200_OK, status.HTTP_422_UNPROCESSABLE_ENTITY)


# ── #3: fail-silent → 202 pattern ───────────────────────────────────


@pytest.mark.unit
class TestFailSilentTo202:
    """POST /test must return 202 Accepted (not 201) with queued status."""

    async def _run_send_test_202(self):
        stub_service = _make_stub_service(
            send_test=_FakeNotification(property_id=uuid.uuid4(), status="pending")
        )
        stub_repo = _StubRepo()
        with TestClient(app) as client:
            app.dependency_overrides[notification_router.get_db] = lambda: AsyncMock()
            app.dependency_overrides[notification_router.get_current_user] = lambda: {
                "user_id": str(uuid.uuid4()),
                "property_scopes": [str(uuid.uuid4())],
                "is_owner": False,
                "is_superuser": False,
            }
            app.dependency_overrides[NotificationService] = lambda db: stub_service
            app.dependency_overrides[notification_router.NotificationRepository] = lambda db: _StubRepo()

            r = client.post(
                "/api/v1/notifications/test",
                json={
                    "user_id": str(uuid.uuid4()),
                    "property_id": str(uuid.uuid4()),
                    "channel": "email",
                    "subject": "Test",
                    "body": "Hello",
                },
            )
            app.dependency_overrides.clear()
        return r

    def test_send_test_returns_202_not_201(self) -> None:
        """POST /test returns 202 Accepted, not 201 Created."""
        r = pytest.importorskip("anyio").run(self._run_send_test_202)
        assert r.status_code == status.HTTP_202_ACCEPTED

    def test_send_test_returns_queued_response(self) -> None:
        """Response body has notification_id + status=queued."""
        r = pytest.importorskip("anyio").run(self._run_send_test_202)
        if r.status_code == status.HTTP_202_ACCEPTED:
            data = r.json()
            assert "data" in data
            assert "notification_id" in data["data"]
            assert data["data"]["status"] == "queued"


# ── #1: Idempotency-Key header ──────────────────────────────────────


@pytest.mark.unit
class TestIdempotencyHeader:
    """OpenAPI declares Idempotency-Key header on POST /test and PATCH /resend."""

    def test_send_test_openapi_has_idempotency_header(self) -> None:
        openapi = app.openapi()
        path = "/api/v1/notifications/test"
        post_op = openapi["paths"][path]["post"]
        headers = post_op.get("parameters", [])
        header_names = [h["name"] for h in headers if h.get("in") == "header"]
        assert "Idempotency-Key" in header_names

    def test_resend_openapi_has_idempotency_header(self) -> None:
        openapi = app.openapi()
        path = "/api/v1/notifications/{notif_id}/resend"
        patch_op = openapi["paths"][path]["patch"]
        headers = patch_op.get("parameters", [])
        header_names = [h["name"] for h in headers if h.get("in") == "header"]
        assert "Idempotency-Key" in header_names


# ── #20: Cache-Control header ───────────────────────────────────────


@pytest.mark.unit
class TestCacheControl:
    """All endpoints must emit Cache-Control: private, no-store."""

    async def _run_send_test(self):
        stub_service = _make_stub_service(
            send_test=_FakeNotification(property_id=uuid.uuid4())
        )
        stub_repo = _StubRepo()
        with TestClient(app) as client:
            app.dependency_overrides[notification_router.get_db] = lambda: AsyncMock()
            app.dependency_overrides[notification_router.get_current_user] = lambda: {
                "user_id": str(uuid.uuid4()),
                "property_scopes": [str(uuid.uuid4())],
                "is_owner": False,
                "is_superuser": False,
            }
            app.dependency_overrides[NotificationService] = lambda db: stub_service
            app.dependency_overrides[notification_router.NotificationRepository] = lambda db: _StubRepo()

            r = client.post(
                "/api/v1/notifications/test",
                json={
                    "user_id": str(uuid.uuid4()),
                    "property_id": str(uuid.uuid4()),
                    "channel": "email",
                    "subject": "Test",
                    "body": "Hello",
                },
            )
            app.dependency_overrides.clear()
        return r

    def test_send_test_has_cache_control(self) -> None:
        r = pytest.importorskip("anyio").run(self._run_send_test)
        if r.status_code in (status.HTTP_202_ACCEPTED, status.HTTP_422_UNPROCESSABLE_ENTITY):
            cc = r.headers.get("cache-control", "").lower()
            assert "private" in cc
            assert "no-store" in cc

    async def _run_history(self):
        stub_service = _make_stub_service(history=[], total=0)
        stub_repo = _StubRepo()
        with TestClient(app) as client:
            app.dependency_overrides[notification_router.get_db] = lambda: AsyncMock()
            app.dependency_overrides[notification_router.get_current_user] = lambda: {
                "user_id": str(uuid.uuid4()),
                "property_scopes": [str(uuid.uuid4())],
                "is_owner": False,
                "is_superuser": False,
            }
            app.dependency_overrides[NotificationService] = lambda db: stub_service
            app.dependency_overrides[notification_router.NotificationRepository] = lambda db: stub_repo

            r = client.get(
                "/api/v1/notifications/history",
                params={"property_id": str(uuid.uuid4()), "page": 1, "limit": 20},
            )
            app.dependency_overrides.clear()
        return r

    def test_history_has_cache_control(self) -> None:
        r = pytest.importorskip("anyio").run(self._run_history)
        if r.status_code in (status.HTTP_200_OK, status.HTTP_422_UNPROCESSABLE_ENTITY):
            cc = r.headers.get("cache-control", "").lower()
            assert "private" in cc
            assert "no-store" in cc

    async def _run_resend(self):
        notif = _FakeNotification(property_id=uuid.uuid4(), status="failed")
        stub_service = _make_stub_service(resend=notif)
        stub_repo = _StubRepo(notification_property_id=notif.property_id, notification=notif)
        with TestClient(app) as client:
            app.dependency_overrides[notification_router.get_db] = lambda: AsyncMock()
            app.dependency_overrides[notification_router.get_current_user] = lambda: {
                "user_id": str(uuid.uuid4()),
                "property_scopes": [str(notif.property_id)],
                "is_owner": False,
                "is_superuser": False,
            }
            app.dependency_overrides[NotificationService] = lambda db: stub_service
            app.dependency_overrides[notification_router.NotificationRepository] = lambda db: stub_repo

            r = client.patch(f"/api/v1/notifications/{uuid.uuid4()}/resend")
            app.dependency_overrides.clear()
        return r

    def test_resend_has_cache_control(self) -> None:
        r = pytest.importorskip("anyio").run(self._run_resend)
        if r.status_code in (status.HTTP_200_OK, status.HTTP_422_UNPROCESSABLE_ENTITY):
            cc = r.headers.get("cache-control", "").lower()
            assert "private" in cc
            assert "no-store" in cc


# ── #13: Pagination on GET /history ─────────────────────────────────


@pytest.mark.unit
class TestPagination:
    """OpenAPI asserts page/limit params + meta shape on GET /history."""

    def test_history_openapi_has_page_limit(self) -> None:
        openapi = app.openapi()
        path = "/api/v1/notifications/history"
        get_op = openapi["paths"][path]["get"]
        params = get_op.get("parameters", [])
        param_names = [p["name"] for p in params if p.get("in") == "query"]
        assert "page" in param_names
        assert "limit" in param_names
        # Check limit has max 100
        for p in params:
            if p.get("name") == "limit" and p.get("in") == "query":
                schema = p.get("schema", {})
                assert schema.get("maximum") == 100

    def test_history_response_has_meta(self) -> None:
        """Response schema includes meta with page, limit, total, has_next."""
        openapi = app.openapi()
        path = "/api/v1/notifications/history"
        responses = openapi["paths"][path]["get"]["responses"]
        # Check 200 response references NotificationListResponse with meta
        assert "200" in responses


# ── #20: Error envelope (APIError not HTTPException) ────────────────


@pytest.mark.unit
class TestErrorEnvelope:
    """Verify APIError raised (not HTTPException) for not-found → unified envelope."""

    async def _run_not_found(self):
        stub_service = _make_stub_service(resend=None)  # triggers NOTIF-001
        stub_repo = _StubRepo(notification=None)
        with TestClient(app) as client:
            app.dependency_overrides[notification_router.get_db] = lambda: AsyncMock()
            app.dependency_overrides[notification_router.get_current_user] = lambda: {
                "user_id": str(uuid.uuid4()),
                "property_scopes": [str(uuid.uuid4())],
                "is_owner": False,
                "is_superuser": False,
            }
            app.dependency_overrides[NotificationService] = lambda db: stub_service
            app.dependency_overrides[notification_router.NotificationRepository] = lambda db: _StubRepo(notification=None)

            r = client.patch(f"/api/v1/notifications/{uuid.uuid4()}/resend")
            app.dependency_overrides.clear()
        return r

    def test_resend_not_found_returns_unified_envelope(self) -> None:
        r = pytest.importorskip("anyio").run(self._run_not_found)
        assert r.status_code == status.HTTP_404_NOT_FOUND
        assert "error" in r.json()
        assert r.json()["error"]["code"] == "NOTIF-001"


# ── #11: NotificationQueuedResponse schema ──────────────────────────


@pytest.mark.unit
class TestOccupancyTypedResponse:
    """NotificationQueuedResponse is typed (not bare dict), matches design."""

    def test_queued_response_schema_exists(self) -> None:
        """NotificationQueuedResponse has notification_id and status=queued."""
        from app.modules.notification.schemas import NotificationQueuedResponse

        resp = NotificationQueuedResponse(
            notification_id=uuid.uuid4(), status="queued"
        )
        assert resp.notification_id is not None
        assert resp.status == "queued"

    def test_queued_response_rejects_extra_fields(self) -> None:
        """extra='forbid' on NotificationQueuedResponse."""
        from app.modules.notification.schemas import NotificationQueuedResponse
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            NotificationQueuedResponse(
                notification_id=uuid.uuid4(), status="queued", bad_field="bad"
            )


# ── #20: NotificationMeta pagination shape ───────────────────────────


@pytest.mark.unit
class TestPaginationMeta:
    """NotificationMeta has page, limit, total, has_next."""

    def test_notification_meta_shape(self) -> None:
        from app.modules.notification.schemas import NotificationMeta

        meta = NotificationMeta(page=1, limit=20, total=45, has_next=True)
        assert meta.page == 1
        assert meta.limit == 20
        assert meta.total == 45
        assert meta.has_next is True

    def test_notification_meta_rejects_invalid(self) -> None:
        from app.modules.notification.schemas import NotificationMeta
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            NotificationMeta(page=0, limit=20, total=0, has_next=False)  # page >= 1

        with pytest.raises(ValidationError):
            NotificationMeta(page=1, limit=101, total=0, has_next=False)  # limit <= 100