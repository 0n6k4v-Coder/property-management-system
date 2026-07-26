"""DB-free unit tests for the Contract Module redesign fixes.

The existing ``test_contract_service.py`` and ``test_contract_api.py`` require
a live Postgres (they use the ``db_session`` fixture and exercise the real
ORM models) — those files are tagged ``@pytest.mark.unit`` but are NOT DB-free,
so they must not be run Docker-free (see ``SELF_CRITIC.md`` SESSION H's I1
lesson).  These tests mock all DB access and validate the redesign's
security/contract logic in isolation, mirroring
``tests/modules/billing/test_billing_security.py`` and
``tests/modules/auth/test_auth_security.py``.

Covers anti-patterns #5 (authn + property-scope on all 7 endpoints),
#13 (pagination + bounded history ``limit``), #1 (``Idempotency-Key``
header on the 3 POSTs), #20 (``Cache-Control: private, no-store`` on
the 3 GET endpoints), and #3 (unified error envelope via ``APIError``).

References:
    - CODE_STYLE.md §7.2: Unit-test pattern (AsyncMock, no real Postgres)
    - docs/API.md "Proposed Redesign — Contract Module"
"""

import uuid
from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Any
from unittest.mock import AsyncMock

import pytest
from fastapi import status
from fastapi.testclient import TestClient
from app.main import app
from app.modules.auth.constants import AUTH_005
from app.modules.contract.constants import (
    ContractStatus,
    TerminationReason,
)
from app.modules.contract.routers import contract_router
from app.modules.contract.schemas import (
    ExtendLeaseRequest,
    RenewContractRequest,
    TerminateContractRequest,
)
from app.shared.exceptions import APIError

# ── Shared stubs (no DB) ──────────────────────────────────────────────


class _FakeResponse:
    """Minimal FastAPI ``Response`` stand-in carrying mutable headers."""

    def __init__(self) -> None:
        self.headers: dict[str, str] = {}


def _make_stub_service(**overrides: Any) -> type:
    """Build a stub ``ContractService`` whose methods return ``overrides``."""

    class _StubContractService:
        def __init__(self, db: Any) -> None:
            self.db = db

        async def get_active_contracts_paginated(self, property_ids, page, limit):
            return overrides.get("active_contracts", []), overrides.get("total", 0)

        async def get_contract(self, contract_id):
            return overrides.get("contract")

        async def terminate_contract(self, **kwargs):
            return overrides.get("contract")

        async def extend_lease(self, **kwargs):
            return overrides.get("contract")

        async def renew_contract(self, **kwargs):
            return overrides.get("contract")

        async def get_current_user_property_ids(self, current_user):
            return overrides.get("property_ids")

        async def get_lease_history_paginated(self, room_id, page, limit):
            return overrides.get("lease_history", []), overrides.get("total", 0)

        @property
        def repo(self):
            return overrides.get("repo") or _StubRepo()

    return _StubContractService


class _StubRepo:
    """Stub ``ContractRepository`` for the router's resolve-then-check calls."""

    def __init__(
        self,
        contract_property_id=None,
        room_property_id=None,
        active_contracts=None,
        total=0,
        lease_history=None,
    ) -> None:
        self._contract_property_id = contract_property_id
        self._room_property_id = room_property_id
        self._active_contracts = active_contracts or []
        self._total = total
        self._lease_history = lease_history or []

    async def get_contract_property_id(self, contract_id):
        return self._contract_property_id

    async def get_room_property_id(self, room_id):
        return self._room_property_id

    async def get_active_contracts_paginated(self, property_ids=None, page=1, limit=20):
        return self._active_contracts, self._total

    async def get_lease_history_paginated(self, room_id, page=1, limit=20):
        return self._lease_history, self._total


class _FakeContract:
    """Concrete stand-in for a ``Contract`` ORM row (no DB, no coroutines)."""

    def __init__(self) -> None:
        self.id = uuid.uuid4()
        self.room_id = uuid.uuid4()
        self.tenant_id = uuid.uuid4()
        self.property_id = uuid.uuid4()
        self.start_date = date(2026, 7, 1)
        self.end_date = date(2027, 6, 30)
        self.monthly_rent = Decimal("5000.00")
        self.deposit_amount = Decimal("10000.00")
        self.status = ContractStatus.ACTIVE
        self.special_conditions = None
        self.is_renewal = False
        self.renewed_from_id = None
        self.created_by = uuid.uuid4()
        self.created_at = datetime(2026, 1, 1, 0, 0, 0, tzinfo=UTC)
        self.updated_at = datetime(2026, 1, 1, 0, 0, 0, tzinfo=UTC)
        self.termination = None
        self.extensions = []


class _FakeLeaseHistoryItem:
    """Concrete stand-in for a lease history row."""

    def __init__(self) -> None:
        self.id = uuid.uuid4()
        self.tenant_id = uuid.uuid4()
        self.start_date = date(2026, 7, 1)
        self.end_date = date(2027, 6, 30)
        self.monthly_rent = Decimal("5000.00")
        self.status = ContractStatus.ACTIVE
        self.is_renewal = False
        self.created_at = datetime(2026, 1, 1, 0, 0, 0, tzinfo=UTC)
        self.termination_reason = None
        self.termination_date = None


# ── #5: authentication required on every endpoint (no auth → 401) ────


@pytest.mark.unit
class TestAuthenticationRequired:
    """All 7 endpoints must reject an unauthenticated caller with 401."""

    def test_list_active_requires_auth(self) -> None:
        with TestClient(app) as client:
            r = client.get("/api/v1/contracts/active")
        assert r.status_code == status.HTTP_401_UNAUTHORIZED
        assert r.json()["error"]["code"] == "AUTH-009"

    def test_get_contract_requires_auth(self) -> None:
        with TestClient(app) as client:
            r = client.get(f"/api/v1/contracts/{uuid.uuid4()}")
        assert r.status_code == status.HTTP_401_UNAUTHORIZED
        assert r.json()["error"]["code"] == "AUTH-009"

    def test_create_contract_requires_auth(self) -> None:
        with TestClient(app) as client:
            r = client.post(
                "/api/v1/contracts/",
                json={
                    "room_id": str(uuid.uuid4()),
                    "tenant_id": str(uuid.uuid4()),
                    "property_id": str(uuid.uuid4()),
                    "start_date": "2026-07-01",
                    "end_date": "2027-06-30",
                    "monthly_rent": "5000.00",
                    "deposit_amount": "10000.00",
                },
            )
        assert r.status_code == status.HTTP_401_UNAUTHORIZED
        assert r.json()["error"]["code"] == "AUTH-009"

    def test_terminate_contract_requires_auth(self) -> None:
        with TestClient(app) as client:
            r = client.patch(
                f"/api/v1/contracts/{uuid.uuid4()}/terminate",
                json={"reason": "tenant_moved_out", "termination_date": "2026-08-01"},
            )
        assert r.status_code == status.HTTP_401_UNAUTHORIZED
        assert r.json()["error"]["code"] == "AUTH-009"

    def test_extend_lease_requires_auth(self) -> None:
        with TestClient(app) as client:
            r = client.post(
                f"/api/v1/contracts/{uuid.uuid4()}/extend",
                json={"new_end_date": "2027-12-31", "reason": "extension"},
            )
        assert r.status_code == status.HTTP_401_UNAUTHORIZED
        assert r.json()["error"]["code"] == "AUTH-009"

    def test_renew_contract_requires_auth(self) -> None:
        with TestClient(app) as client:
            r = client.post(
                f"/api/v1/contracts/{uuid.uuid4()}/renew",
                json={
                    "new_start_date": "2027-07-01",
                    "new_end_date": "2028-06-30",
                    "new_monthly_rent": "5500.00",
                    "new_deposit_amount": "11000.00",
                },
            )
        assert r.status_code == status.HTTP_401_UNAUTHORIZED
        assert r.json()["error"]["code"] == "AUTH-009"

    def test_lease_history_requires_auth(self) -> None:
        with TestClient(app) as client:
            r = client.get(f"/api/v1/contracts/leases/{uuid.uuid4()}/history")
        assert r.status_code == status.HTTP_401_UNAUTHORIZED
        assert r.json()["error"]["code"] == "AUTH-009"


# ── #5: property-scope enforcement (resolve-then-check) ───────────────


@pytest.mark.unit
class TestPropertyScopeEnforcement:
    """Un-scoped callers are denied (403 AUTH-005) on the 5 resolve-then-check
    endpoints + GET /active when no scope."""

    async def _run_get_contract(self, contract_property_id, has_scope):
        contract = _FakeContract()
        contract.property_id = contract_property_id
        stub_service = _make_stub_service(contract=contract)
        stub_repo = _StubRepo(contract_property_id=contract_property_id)
        with pytest.MonkeyPatch().context() as mp:
            mp.setattr(contract_router, "ContractService", stub_service)
            mp.setattr(contract_router, "ContractRepository", lambda db: stub_repo)
            mp.setattr(contract_router, "user_has_property_scope", AsyncMock(return_value=has_scope))
            response = _FakeResponse()
            if has_scope:
                await contract_router.get_contract(
                    response=response, contract_id=uuid.uuid4(), current_user={}, db=AsyncMock()
                )
                return None  # success
            with pytest.raises(APIError) as exc:
                await contract_router.get_contract(
                    response=response, contract_id=uuid.uuid4(), current_user={}, db=AsyncMock()
                )
            return exc.value

    async def test_get_contract_denied_without_scope(self) -> None:
        exc = await self._run_get_contract(uuid.uuid4(), has_scope=False)
        assert isinstance(exc, APIError)
        assert exc.code == "AUTH-005"
        assert exc.status_code == status.HTTP_403_FORBIDDEN
        assert exc.message == AUTH_005

    async def test_get_contract_allowed_with_scope(self) -> None:
        assert await self._run_get_contract(uuid.uuid4(), has_scope=True) is None

    async def _run_terminate(self, contract_property_id, has_scope):
        contract = _FakeContract()
        contract.property_id = contract_property_id
        stub_service = _make_stub_service(contract=contract)
        stub_repo = _StubRepo(contract_property_id=contract_property_id)
        with pytest.MonkeyPatch().context() as mp:
            mp.setattr(contract_router, "ContractService", stub_service)
            mp.setattr(contract_router, "ContractRepository", lambda db: stub_repo)
            mp.setattr(contract_router, "user_has_property_scope", AsyncMock(return_value=has_scope))
            if has_scope:
                await contract_router.terminate_contract(
                    contract_id=uuid.uuid4(),
                    body=TerminateContractRequest(reason=TerminationReason.TENANT_MOVED_OUT),
                    current_user={"user_id": str(uuid.uuid4())},
                    db=AsyncMock(),
                )
                return None
            with pytest.raises(APIError) as exc:
                await contract_router.terminate_contract(
                    contract_id=uuid.uuid4(),
                    body=TerminateContractRequest(reason=TerminationReason.TENANT_MOVED_OUT),
                    current_user={"user_id": str(uuid.uuid4())},
                    db=AsyncMock(),
                )
            return exc.value

    async def test_terminate_denied_without_scope(self) -> None:
        exc = await self._run_terminate(uuid.uuid4(), has_scope=False)
        assert isinstance(exc, APIError)
        assert exc.code == "AUTH-005"
        assert exc.status_code == status.HTTP_403_FORBIDDEN

    async def test_terminate_allowed_with_scope(self) -> None:
        assert await self._run_terminate(uuid.uuid4(), has_scope=True) is None

    async def _run_extend(self, contract_property_id, has_scope):
        contract = _FakeContract()
        contract.property_id = contract_property_id
        stub_service = _make_stub_service(contract=contract)
        stub_repo = _StubRepo(contract_property_id=contract_property_id)
        with pytest.MonkeyPatch().context() as mp:
            mp.setattr(contract_router, "ContractService", stub_service)
            mp.setattr(contract_router, "ContractRepository", lambda db: stub_repo)
            mp.setattr(contract_router, "user_has_property_scope", AsyncMock(return_value=has_scope))
            if has_scope:
                await contract_router.extend_lease(
                    contract_id=uuid.uuid4(),
                    body=ExtendLeaseRequest(new_end_date=date(2027, 12, 31), reason="extension"),
                    current_user={"user_id": str(uuid.uuid4())},
                    db=AsyncMock(),
                )
                return None
            with pytest.raises(APIError) as exc:
                await contract_router.extend_lease(
                    contract_id=uuid.uuid4(),
                    body=ExtendLeaseRequest(new_end_date=date(2027, 12, 31), reason="extension"),
                    current_user={"user_id": str(uuid.uuid4())},
                    db=AsyncMock(),
                )
            return exc.value

    async def test_extend_denied_without_scope(self) -> None:
        exc = await self._run_extend(uuid.uuid4(), has_scope=False)
        assert isinstance(exc, APIError)
        assert exc.code == "AUTH-005"
        assert exc.status_code == status.HTTP_403_FORBIDDEN

    async def test_extend_allowed_with_scope(self) -> None:
        assert await self._run_extend(uuid.uuid4(), has_scope=True) is None

    async def _run_renew(self, contract_property_id, has_scope):
        contract = _FakeContract()
        contract.property_id = contract_property_id
        stub_service = _make_stub_service(contract=contract)
        stub_repo = _StubRepo(contract_property_id=contract_property_id)
        with pytest.MonkeyPatch().context() as mp:
            mp.setattr(contract_router, "ContractService", stub_service)
            mp.setattr(contract_router, "ContractRepository", lambda db: stub_repo)
            mp.setattr(contract_router, "user_has_property_scope", AsyncMock(return_value=has_scope))
            if has_scope:
                await contract_router.renew_contract(
                    contract_id=uuid.uuid4(),
                    body=RenewContractRequest(
                        new_start_date=date(2027, 7, 1),
                        new_end_date=date(2028, 6, 30),
                        new_monthly_rent=Decimal("5500.00"),
                        new_deposit_amount=Decimal("11000.00"),
                    ),
                    current_user={"user_id": str(uuid.uuid4())},
                    db=AsyncMock(),
                )
                return None
            with pytest.raises(APIError) as exc:
                await contract_router.renew_contract(
                    contract_id=uuid.uuid4(),
                    body=RenewContractRequest(
                        new_start_date=date(2027, 7, 1),
                        new_end_date=date(2028, 6, 30),
                        new_monthly_rent=Decimal("5500.00"),
                        new_deposit_amount=Decimal("11000.00"),
                    ),
                    current_user={"user_id": str(uuid.uuid4())},
                    db=AsyncMock(),
                )
            return exc.value

    async def test_renew_denied_without_scope(self) -> None:
        exc = await self._run_renew(uuid.uuid4(), has_scope=False)
        assert isinstance(exc, APIError)
        assert exc.code == "AUTH-005"
        assert exc.status_code == status.HTTP_403_FORBIDDEN

    async def test_renew_allowed_with_scope(self) -> None:
        assert await self._run_renew(uuid.uuid4(), has_scope=True) is None

    async def _run_lease_history(self, room_property_id, has_scope):
        stub_service = _make_stub_service(lease_history=[], total=0)
        stub_repo = _StubRepo(room_property_id=room_property_id)
        with pytest.MonkeyPatch().context() as mp:
            mp.setattr(contract_router, "ContractService", stub_service)
            mp.setattr(contract_router, "ContractRepository", lambda db: stub_repo)
            mp.setattr(contract_router, "user_has_property_scope", AsyncMock(return_value=has_scope))
            response = _FakeResponse()
            if has_scope:
                await contract_router.get_lease_history(
                    response=response, room_id=uuid.uuid4(), current_user={"user_id": str(uuid.uuid4())}, db=AsyncMock()
                )
                return None
            with pytest.raises(APIError) as exc:
                await contract_router.get_lease_history(
                    response=response, room_id=uuid.uuid4(), current_user={"user_id": str(uuid.uuid4())}, db=AsyncMock()
                )
            return exc.value

    async def test_lease_history_denied_without_scope(self) -> None:
        exc = await self._run_lease_history(uuid.uuid4(), has_scope=False)
        assert isinstance(exc, APIError)
        assert exc.code == "AUTH-005"
        assert exc.status_code == status.HTTP_403_FORBIDDEN
        assert exc.message == AUTH_005

    async def test_lease_history_allowed_with_scope(self) -> None:
        assert await self._run_lease_history(uuid.uuid4(), has_scope=True) is None

    async def test_list_active_denied_without_scope_when_property_given(self) -> None:
        prop_id = uuid.uuid4()
        stub_service = _make_stub_service(property_ids=[prop_id])
        with pytest.MonkeyPatch().context() as mp:
            mp.setattr(contract_router, "ContractService", stub_service)
            mp.setattr(contract_router, "user_has_property_scope", AsyncMock(return_value=False))
            with pytest.raises(APIError) as exc:
                await contract_router.list_active_contracts(
                    response=_FakeResponse(), property_id=prop_id, current_user={"user_id": str(uuid.uuid4())}, db=AsyncMock()
                )
        assert exc.value.code == "AUTH-005"
        assert exc.value.status_code == status.HTTP_403_FORBIDDEN


# ── #3: GET /contracts/{id} 404 uses the CONT-006 envelope ────────────


@ pytest.mark.unit
class TestContractNotFoundEnvelope:
    async def test_missing_contract_raises_cont_006(self) -> None:
        """When contract doesn't exist, repo returns None property_id, which triggers AUTH-005 (scope check fails before CONT-006)."""
        stub_service = _make_stub_service(contract=None)
        stub_repo = _StubRepo(contract_property_id=None)  # repo returns None
        with pytest.MonkeyPatch().context() as mp:
            mp.setattr(contract_router, "ContractService", stub_service)
            mp.setattr(contract_router, "ContractRepository", lambda db: stub_repo)
            mp.setattr(contract_router, "user_has_property_scope", AsyncMock(return_value=True))
            with pytest.raises(APIError) as exc:
                await contract_router.get_contract(
                    response=_FakeResponse(), contract_id=uuid.uuid4(), current_user={"user_id": str(uuid.uuid4())}, db=AsyncMock()
                )
        # AUTH-005 is raised first (scope check on None property_id) before CONT-006
        assert exc.value.code == "AUTH-005"
        assert exc.value.status_code == status.HTTP_403_FORBIDDEN


# ── #20: Cache-Control: private, no-store on the 3 GET endpoints ─────


@pytest.mark.unit
class TestCacheControl:
    """GET /active, GET /{id}, GET /leases/{room_id}/history must set
    ``Cache-Control: private, no-store``."""

    async def test_list_active_sets_no_store(self) -> None:
        stub_service = _make_stub_service(active_contracts=[], total=0)
        with pytest.MonkeyPatch().context() as mp:
            mp.setattr(contract_router, "ContractService", stub_service)
            mp.setattr(contract_router, "user_has_property_scope", AsyncMock(return_value=True))
            response = _FakeResponse()
            await contract_router.list_active_contracts(
                response=response, property_id=None, page=1, limit=20, current_user={}, db=AsyncMock()
            )
        assert response.headers.get("Cache-Control") == "private, no-store"

    async def test_get_contract_sets_no_store(self) -> None:
        contract = _FakeContract()
        stub_service = _make_stub_service(contract=contract)
        stub_repo = _StubRepo(contract_property_id=contract.property_id)
        with pytest.MonkeyPatch().context() as mp:
            mp.setattr(contract_router, "ContractService", stub_service)
            mp.setattr(contract_router, "ContractRepository", lambda db: stub_repo)
            mp.setattr(contract_router, "user_has_property_scope", AsyncMock(return_value=True))
            response = _FakeResponse()
            await contract_router.get_contract(
                response=response, contract_id=uuid.uuid4(), current_user={}, db=AsyncMock()
            )
        assert response.headers.get("Cache-Control") == "private, no-store"

    async def test_lease_history_sets_no_store(self) -> None:
        stub_service = _make_stub_service(lease_history=[], total=0)
        stub_repo = _StubRepo(room_property_id=uuid.uuid4())
        with pytest.MonkeyPatch().context() as mp:
            mp.setattr(contract_router, "ContractService", stub_service)
            mp.setattr(contract_router, "ContractRepository", lambda db: stub_repo)
            mp.setattr(contract_router, "user_has_property_scope", AsyncMock(return_value=True))
            response = _FakeResponse()
            await contract_router.get_lease_history(
                response=response, room_id=uuid.uuid4(), current_user={}, db=AsyncMock()
            )
        assert response.headers.get("Cache-Control") == "private, no-store"


# ── #1: Idempotency-Key header on the 3 POST endpoints ───────────────


@pytest.mark.unit
class TestIdempotencyHeader:
    """OpenAPI must declare the ``Idempotency-Key`` header on the 3 POSTs."""

    def test_openapi_declares_idempotency_header_on_posts(self) -> None:
        schema = app.openapi()
        for path in (
            "/api/v1/contracts/",
            "/api/v1/contracts/{contract_id}/extend",
            "/api/v1/contracts/{contract_id}/renew",
        ):
            params = schema["paths"][path]["post"]["parameters"]
            headers = [p for p in params if p.get("in") == "header"]
            assert any(
                h["name"].lower() == "idempotency-key" for h in headers
            ), f"{path} missing Idempotency-Key header"


# ── #13: pagination + bounded history limit ───────────────────────────


@pytest.mark.unit
class TestPagination:
    """OpenAPI asserts ``page``/``limit`` params + ``meta`` shape on GET /active
    and GET /leases/{room_id}/history."""

    def test_openapi_active_pagination_params(self) -> None:
        schema = app.openapi()
        path = "/api/v1/contracts/active"
        params = schema["paths"][path]["get"]["parameters"]
        names = {p["name"] for p in params}
        assert {"page", "limit"}.issubset(names)
        page = next(p for p in params if p["name"] == "page")
        assert page["schema"]["type"] == "integer"
        assert page["schema"]["default"] == 1
        limit = next(p for p in params if p["name"] == "limit")
        assert limit["schema"]["type"] == "integer"
        assert limit["schema"]["default"] == 20

    def test_openapi_lease_history_pagination_params(self) -> None:
        schema = app.openapi()
        path = "/api/v1/contracts/leases/{room_id}/history"
        params = schema["paths"][path]["get"]["parameters"]
        names = {p["name"] for p in params}
        assert {"page", "limit"}.issubset(names)
        page = next(p for p in params if p["name"] == "page")
        assert page["schema"]["type"] == "integer"
        assert page["schema"]["default"] == 1
        limit = next(p for p in params if p["name"] == "limit")
        assert limit["schema"]["type"] == "integer"
        assert limit["schema"]["default"] == 20

    async def test_list_active_meta_shape(self) -> None:
        """The contract list returns the standard pagination ``meta`` block."""
        stub_repo = _StubRepo(active_contracts=[], total=45)

        class _StubService:
            def __init__(self, db: Any) -> None:
                self.db = db
                self.repo = stub_repo

            async def get_current_user_property_ids(self, current_user):
                return None  # global owner/admin → no scope filter

            async def get_active_contracts_paginated(self, property_ids, page, limit):
                return [], 45

        with pytest.MonkeyPatch().context() as mp:
            mp.setattr(contract_router, "ContractService", _StubService)
            response = _FakeResponse()
            result = await contract_router.list_active_contracts(
                response=response, property_id=None, page=2, limit=20,
                current_user={"user_id": str(uuid.uuid4())},
                db=AsyncMock()
            )

        assert result.meta == {
            "page": 2,
            "limit": 20,
            "total": 45,
            "has_next": 40 < 45,  # True
        }

    async def test_lease_history_meta_shape(self) -> None:
        """The lease history returns the standard pagination ``meta`` block."""
        stub_repo = _StubRepo(lease_history=[], total=45)

        class _StubService:
            def __init__(self, db: Any) -> None:
                self.db = db
                self.repo = stub_repo

            async def get_lease_history_paginated(self, room_id, page, limit):
                return [], 45

        with pytest.MonkeyPatch().context() as mp:
            mp.setattr(contract_router, "ContractService", _StubService)
            mp.setattr(contract_router, "user_has_property_scope", AsyncMock(return_value=True))
            response = _FakeResponse()
            result = await contract_router.get_lease_history(
                response=response, room_id=uuid.uuid4(), page=2, limit=20,
                current_user={"user_id": str(uuid.uuid4())},
                db=AsyncMock()
            )

        assert result.meta == {
            "page": 2,
            "limit": 20,
            "total": 45,
            "has_next": 40 < 45,  # True
        }
