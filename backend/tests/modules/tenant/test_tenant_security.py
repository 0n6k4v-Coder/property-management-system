"""DB-free unit tests for the Tenant Module redesign fixes.

The existing ``test_tenant_service.py`` requires a live Postgres (it connects
on the ``db_session`` fixture for some cases and exercises the real model).
These tests mock all DB access so they validate the redesign's
security/contract logic in isolation, mirroring
``tests/modules/auth/test_auth_security.py`` and
``tests/modules/property/test_property_security.py``.

Covers anti-patterns #5 (query-sourced property-scope enforcement +
regression guards for the pre-existing body/path usages), #7 (``search_by``
rejected at the type level → clean 422, no silent name fallback), and #20
(``Cache-Control: private, no-store`` on the search endpoint).

References:
    - CODE_STYLE.md §7.2: Unit-test pattern (AsyncMock, no real Postgres)
    - docs/API.md "Proposed Redesign — Tenant Module"
"""

import uuid
from typing import Any
from unittest.mock import AsyncMock

import pytest
from fastapi import status
from fastapi.testclient import TestClient

from app.modules.auth.constants import AUTH_005
from app.modules.tenant.routers import tenant_router
from app.modules.tenant.repository import TenantRepository
from app.shared.deps import require_property_scope
from app.shared.exceptions import APIError


class _FakeRequest:
    """Stand-in for a FastAPI ``Request`` with path/query params + body."""

    def __init__(
        self,
        *,
        path_params: dict | None = None,
        query_params: dict | None = None,
        body: dict | None = None,
    ) -> None:
        self.path_params = path_params or {}
        self.query_params = query_params or {}
        self._body = body or {}

    async def json(self) -> dict:
        return self._body


class _ScopeRow:
    """Lightweight stand-in for a ``user_property_scopes`` row."""

    def __init__(self, property_id: uuid.UUID) -> None:
        self.user_id = uuid.uuid4()
        self.property_id = property_id
        self.role = "staff"


# ── #5: require_property_scope() with query-param source ──────────────


@pytest.mark.unit
class TestRequirePropertyScopeQueryParam:
    """Query-sourced ``require_property_scope(query_param="property_id")``."""

    async def test_owner_bypasses_query_scope_check(self) -> None:
        """A global owner passes regardless of scope rows (query source)."""
        dep = require_property_scope(query_param="property_id")
        enforce = dep.dependency  # type: ignore[attr-defined]

        current_user = {"user_id": str(uuid.uuid4()), "is_owner": True}
        request = _FakeRequest(query_params={"property_id": str(uuid.uuid4())})

        await enforce(current_user, request, AsyncMock())  # must not raise

    async def test_staff_with_query_scope_row_passes(self) -> None:
        """Staff holding the query property's scope row is allowed."""
        dep = require_property_scope(query_param="property_id")
        enforce = dep.dependency  # type: ignore[attr-defined]

        property_id = uuid.uuid4()
        current_user = {
            "user_id": str(uuid.uuid4()),
            "is_owner": False,
            "is_superuser": False,
        }
        request = _FakeRequest(query_params={"property_id": str(property_id)})

        fake = AsyncMock()
        fake.get_property_scopes.return_value = [_ScopeRow(property_id)]
        with pytest.MonkeyPatch().context() as mp:
            mp.setattr(UserRepository := __import__(
                "app.modules.auth.repository", fromlist=["UserRepository"]
            ).UserRepository, "get_property_scopes", fake.get_property_scopes)
            await enforce(current_user, request, AsyncMock())  # must not raise

    async def test_staff_without_query_scope_row_denied(self) -> None:
        """Staff with no scope row for the query property gets AUTH-005 (403)."""
        dep = require_property_scope(query_param="property_id")
        enforce = dep.dependency  # type: ignore[attr-defined]

        property_id = uuid.uuid4()
        current_user = {
            "user_id": str(uuid.uuid4()),
            "is_owner": False,
            "is_superuser": False,
        }
        request = _FakeRequest(query_params={"property_id": str(property_id)})

        from app.modules.auth.repository import UserRepository

        fake = AsyncMock()
        fake.get_property_scopes.return_value = []  # no scope
        with pytest.MonkeyPatch().context() as mp:
            mp.setattr(UserRepository, "get_property_scopes", fake.get_property_scopes)
            with pytest.raises(APIError) as exc:
                await enforce(current_user, request, AsyncMock())

        assert exc.value.code == "AUTH-005"
        assert exc.value.status_code == status.HTTP_403_FORBIDDEN
        assert exc.value.message == AUTH_005

    async def test_missing_query_param_denied(self) -> None:
        """A query param that isn't a valid UUID is denied (AUTH-005)."""
        dep = require_property_scope(query_param="property_id")
        enforce = dep.dependency  # type: ignore[attr-defined]

        current_user = {"user_id": str(uuid.uuid4()), "is_owner": False}
        request = _FakeRequest(query_params={"property_id": "not-a-uuid"})

        with pytest.raises(APIError) as exc:
            await enforce(current_user, request, AsyncMock())
        assert exc.value.code == "AUTH-005"


@pytest.mark.unit
class TestRequirePropertyScopeRegressionGuards:
    """Generalizing the dependency must not regress body/path callers."""

    async def test_body_source_still_works_for_invite(self) -> None:
        """Default (no args) still reads property_id from the body.

        Regression guard for the Auth ``/invite`` usage (body-sourced).
        """
        dep = require_property_scope()  # body-sourced, as /invite uses it
        enforce = dep.dependency  # type: ignore[attr-defined]

        property_id = uuid.uuid4()
        current_user = {
            "user_id": str(uuid.uuid4()),
            "is_owner": False,
            "is_superuser": False,
        }
        request = _FakeRequest(body={"property_id": str(property_id)})

        from app.modules.auth.repository import UserRepository

        fake = AsyncMock()
        fake.get_property_scopes.return_value = [_ScopeRow(property_id)]
        with pytest.MonkeyPatch().context() as mp:
            mp.setattr(UserRepository, "get_property_scopes", fake.get_property_scopes)
            await enforce(current_user, request, AsyncMock())  # must not raise

    async def test_path_source_still_works_for_property(self) -> None:
        """Path-sourced form still reads property_id from the path.

        Regression guard for the Property & Rooms (``/{property_id}``) usage.
        """
        dep = require_property_scope("property_id")  # path-sourced
        enforce = dep.dependency  # type: ignore[attr-defined]

        property_id = uuid.uuid4()
        current_user = {
            "user_id": str(uuid.uuid4()),
            "is_owner": False,
            "is_superuser": False,
        }
        request = _FakeRequest(path_params={"property_id": str(property_id)})

        from app.modules.auth.repository import UserRepository

        fake = AsyncMock()
        fake.get_property_scopes.return_value = [_ScopeRow(property_id)]
        with pytest.MonkeyPatch().context() as mp:
            mp.setattr(UserRepository, "get_property_scopes", fake.get_property_scopes)
            await enforce(current_user, request, AsyncMock())  # must not raise


# ── #7: search_by constrained to a Literal at the type level ──────────


@pytest.mark.unit
class TestSearchByLiteralRejectsInvalid:
    """Invalid ``search_by`` must be rejected, not silently coerced (#7)."""

    async def test_repo_search_raises_on_unsupported_value(self) -> None:
        """The repository no longer silently falls back to a name search (#7)."""
        repo = TenantRepository(AsyncMock())
        with pytest.raises(ValueError):
            await repo.search(uuid.uuid4(), "abc", search_by="bogus")

    async def test_repo_count_search_raises_on_unsupported_value(self) -> None:
        """The count twin of search also rejects unsupported values (#7)."""
        repo = TenantRepository(AsyncMock())
        with pytest.raises(ValueError):
            await repo.count_search(uuid.uuid4(), "abc", search_by="bogus")

    def test_openapi_schema_constrains_search_by_to_enum(self) -> None:
        """FastAPI must declare ``search_by`` as an enum so bad values 422.

        The router-level 422 (and the absence of a silent name fallback) is
        driven entirely by the ``Literal`` type. We assert the OpenAPI schema
        (generated without any DB connection) advertises the closed set
        ``["name", "phone", "email"]`` — proving an out-of-set value is
        rejected with a clean 422 rather than coerced to a name search.
        """
        from app.main import create_app

        app = create_app()
        schema = app.openapi()
        params = schema["paths"]["/api/v1/tenants/search"]["get"]["parameters"]
        search_by = next(p for p in params if p["name"] == "search_by")
        assert search_by["schema"]["type"] == "string"
        assert search_by["schema"]["enum"] == ["name", "phone", "email"]


# ── #20: Cache-Control: private, no-store on search ───────────────────


@pytest.mark.unit
class TestSearchCacheControl:
    """The search endpoint must set a no-store cache policy on PII (#20)."""
    class TestSearchCacheControl:
        """GET /search must set ``Cache-Control: private, no-store`` (tenant PII)."""

        async def test_search_sets_no_store_cache_control(self) -> None:
            """Runs the handler directly with a stubbed service (no live DB) to
            prove the header wiring without a database connection.
            """
            captured: dict[str, Any] = {}

            class _FakeResponse:
                def __init__(self) -> None:
                    self.headers: dict[str, str] = {}

            class _StubTenantService:
                def __init__(self, db: Any) -> None:
                    pass

                async def search_tenants(self, **kwargs: Any) -> dict[str, Any]:
                    captured.update(kwargs)
                    return {
                        "data": [],
                        "meta": {
                            "page": kwargs["page"],
                            "limit": kwargs["limit"],
                            "total": 0,
                            "has_next": False,
                        },
                    }

            # Override the require_property_scope dependency to skip auth
            from app.modules.tenant.routers import tenant_router as tenant_router_module
            from app.shared.deps import require_property_scope
        
            with pytest.MonkeyPatch().context() as mp:
                mp.setattr(tenant_router_module, "TenantService", _StubTenantService)
                # Override the scope check to allow the request through
                mp.setattr(tenant_router_module, "require_property_scope", lambda *a, **k: lambda: None)
            
                response = _FakeResponse()
                result = await tenant_router.search_tenants(
                    response=response,
                    _=None,
                    property_id=str(uuid.uuid4()),
                    query="som",
                    search_by="email",
                    page=1,
                    limit=20,
                    db=AsyncMock(),
                )

            assert response.headers.get("Cache-Control") == "private, no-store"
            # Business value forwarded unchanged to the service.
            assert captured["search_by"] == "email"
            assert "data" in result and "meta" in result
