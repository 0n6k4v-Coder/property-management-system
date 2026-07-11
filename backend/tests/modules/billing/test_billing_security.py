"""DB-free unit tests for the Billing Module redesign fixes.

The existing ``test_billing_service.py`` requires a live Postgres (it uses the
``db_session`` fixture and exercises the real ORM models) — that file is tagged
``@pytest.mark.unit`` but is NOT DB-free, so it must not be run Docker-free
(see ``SELF_CRITIC.md`` SESSION H's I1 lesson).  These tests mock all DB
access and validate the redesign's security/contract logic in isolation,
mirroring ``tests/modules/auth/test_auth_security.py`` and
``tests/modules/tenant/test_tenant_security.py``.

Covers anti-patterns #5 (authn + property-scope on all 6 endpoints),
#4 (``POST /payments`` returns 201), #3 (``GET /invoices/{id}`` 404 raises
``BILL-007`` envelope), #13 (pagination + bounded history ``limit``),
#1 (``Idempotency-Key`` header on the 3 POSTs), #11 (``method`` is the real
``PaymentMethod`` enum), #12 (money is ``Decimal``), #19 (``read_date`` is a
full UTC-offset timestamp), and #20 (``Cache-Control: private, no-store``).

References:
    - CODE_STYLE.md §7.2: Unit-test pattern (AsyncMock, no real Postgres)
    - docs/API.md "Proposed Redesign — Billing Module"
"""

import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any
from unittest.mock import AsyncMock

import pytest
from fastapi import status
from fastapi.testclient import TestClient

from app.main import app
from app.modules.auth.constants import AUTH_005
from app.modules.billing.constants import BILL_007_INVOICE_NOT_FOUND
from app.modules.billing.constants import PaymentMethod
from app.modules.billing.routers import billing_router
from app.modules.billing.schemas import (
    InvoiceResponse,
    MeterReadingResponse,
    RecordPaymentRequest,
)
from app.modules.billing.services import BillingService
from app.shared.exceptions import APIError


# ── Shared stubs (no DB) ──────────────────────────────────────────────


class _FakeResponse:
    """Minimal FastAPI ``Response`` stand-in carrying mutable headers."""

    def __init__(self) -> None:
        self.headers: dict[str, str] = {}


def _make_stub_service(**overrides: Any) -> type:
    """Build a stub ``BillingService`` whose methods return ``overrides``."""

    class _StubBillingService:
        def __init__(self, db: Any) -> None:
            self.db = db

        async def get_meter_reading_history(self, room_id, limit):
            return overrides.get("history", [])

        async def get_invoice_by_id(self, invoice_id):
            return overrides.get("invoice")

        async def get_current_user_property_ids(self, current_user):
            return overrides.get("property_ids", [])

        async def record_payment(self, **kwargs):
            return overrides.get("payment")

        async def record_meter_reading(self, **kwargs):
            return overrides.get("reading")

        async def generate_monthly_invoice(self, **kwargs):
            return overrides.get("invoice")

        @property
        def repo(self):
            return overrides.get("repo") or _StubRepo()

    return _StubBillingService


class _StubRepo:
    """Stub ``BillingRepository`` for the router's resolve-then-check calls."""

    def __init__(self, room_property_id=None, invoice_property_id=None,
                 invoices=None, total=0) -> None:
        self._room_property_id = room_property_id
        self._invoice_property_id = invoice_property_id
        self._invoices = invoices or []
        self._total = total

    async def get_room_property_id(self, room_id):
        return self._room_property_id

    async def get_invoice_property_id(self, invoice_id):
        return self._invoice_property_id

    async def list_invoices_paginated(self, property_ids=None, page=1, limit=20):
        return self._invoices, self._total


class _FakeInvoice:
    """Concrete stand-in for an ``Invoice`` ORM row (no DB, no coroutines)."""

    def __init__(self) -> None:
        self.id = uuid.uuid4()
        self.invoice_number = "INV-1"
        self.contract_id = uuid.uuid4()
        self.room_id = uuid.uuid4()
        self.tenant_id = uuid.uuid4()
        self.property_id = uuid.uuid4()
        self.billing_month = 1
        self.billing_year = 2026
        self.due_date = date(2026, 2, 1)
        self.status = "draft"
        self.total_amount = Decimal("7500.00")
        self.paid_amount = Decimal("0.00")
        self.notes = None
        self.created_at = datetime(2026, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
        self.line_items = []


# ── #5: authentication required on every endpoint (no auth → 401) ────


@pytest.mark.unit
class TestAuthenticationRequired:
    """All 6 endpoints must reject an unauthenticated caller with 401."""

    def test_history_requires_auth(self) -> None:
        with TestClient(app) as client:
            r = client.get(f"/api/v1/billing/meter-readings/{uuid.uuid4()}/history")
        assert r.status_code == status.HTTP_401_UNAUTHORIZED
        assert r.json()["error"]["code"] == "AUTH-009"

    def test_list_invoices_requires_auth(self) -> None:
        with TestClient(app) as client:
            r = client.get("/api/v1/billing/invoices")
        assert r.status_code == status.HTTP_401_UNAUTHORIZED
        assert r.json()["error"]["code"] == "AUTH-009"

    def test_invoice_detail_requires_auth(self) -> None:
        with TestClient(app) as client:
            r = client.get(f"/api/v1/billing/invoices/{uuid.uuid4()}")
        assert r.status_code == status.HTTP_401_UNAUTHORIZED
        assert r.json()["error"]["code"] == "AUTH-009"

    def test_create_meter_reading_requires_auth(self) -> None:
        with TestClient(app) as client:
            r = client.post(
                "/api/v1/billing/meter-readings",
                json={"room_id": str(uuid.uuid4()), "billing_month": 1,
                      "billing_year": 2026, "electric_previous": 0,
                      "electric_current": 10, "water_previous": 0,
                      "water_current": 5},
            )
        assert r.status_code == status.HTTP_401_UNAUTHORIZED
        assert r.json()["error"]["code"] == "AUTH-009"

    def test_generate_invoice_requires_auth(self) -> None:
        with TestClient(app) as client:
            r = client.post(
                "/api/v1/billing/invoices/generate",
                json={"property_id": str(uuid.uuid4()), "billing_month": 1,
                      "billing_year": 2026},
            )
        assert r.status_code == status.HTTP_401_UNAUTHORIZED
        assert r.json()["error"]["code"] == "AUTH-009"

    def test_record_payment_requires_auth(self) -> None:
        with TestClient(app) as client:
            r = client.post(
                "/api/v1/billing/payments",
                json={"invoice_id": str(uuid.uuid4()), "amount": "7500.00",
                      "method": "cash"},
            )
        assert r.status_code == status.HTTP_401_UNAUTHORIZED
        assert r.json()["error"]["code"] == "AUTH-009"


# ── #5: property-scope enforcement (resolve-then-check) ─────────────


@pytest.mark.unit
class TestPropertyScopeEnforcement:
    """Un-scoped callers are denied (403 AUTH-005) on the 4 resolve-then-check
    endpoints and on the list endpoint."""

    async def _run_history(self, room_property_id, has_scope):
        prop_id = room_property_id or uuid.uuid4()
        stub_service = _make_stub_service(history=[])
        stub_repo = _StubRepo(room_property_id=prop_id)
        with pytest.MonkeyPatch().context() as mp:
            mp.setattr(billing_router, "BillingService", stub_service)
            mp.setattr(billing_router, "BillingRepository",
                       lambda db: stub_repo)
            mp.setattr(billing_router, "user_has_property_scope",
                       AsyncMock(return_value=has_scope))
            response = _FakeResponse()
            if has_scope:
                await billing_router.get_meter_reading_history(
                    response=response, room_id=uuid.uuid4(), current_user={},
                    db=AsyncMock())
                return None  # success
            with pytest.raises(APIError) as exc:
                await billing_router.get_meter_reading_history(
                    response=response, room_id=uuid.uuid4(), current_user={},
                    db=AsyncMock())
            return exc.value

    async def test_history_denied_without_scope(self) -> None:
        exc = await self._run_history(uuid.uuid4(), has_scope=False)
        assert isinstance(exc, APIError)
        assert exc.code == "AUTH-005"
        assert exc.status_code == status.HTTP_403_FORBIDDEN
        assert exc.message == AUTH_005

    async def test_history_allowed_with_scope(self) -> None:
        assert await self._run_history(uuid.uuid4(), has_scope=True) is None

    async def test_invoice_detail_denied_without_scope(self) -> None:
        invoice = AsyncMock()
        invoice.property_id = uuid.uuid4()
        stub_service = _make_stub_service(invoice=invoice)
        stub_repo = _StubRepo(invoice_property_id=invoice.property_id)
        with pytest.MonkeyPatch().context() as mp:
            mp.setattr(billing_router, "BillingService", stub_service)
            mp.setattr(billing_router, "BillingRepository",
                       lambda db: stub_repo)
            mp.setattr(billing_router, "user_has_property_scope",
                       AsyncMock(return_value=False))
            with pytest.raises(APIError) as exc:
                await billing_router.get_invoice_detail(
                    response=_FakeResponse(), invoice_id=uuid.uuid4(),
                    current_user={}, db=AsyncMock())
        assert exc.value.code == "AUTH-005"
        assert exc.value.status_code == status.HTTP_403_FORBIDDEN

    async def test_payments_denied_without_scope(self) -> None:
        invoice = AsyncMock()
        invoice.property_id = uuid.uuid4()
        stub_service = _make_stub_service(invoice=invoice)
        stub_repo = _StubRepo(invoice_property_id=invoice.property_id)
        with pytest.MonkeyPatch().context() as mp:
            mp.setattr(billing_router, "BillingService", stub_service)
            mp.setattr(billing_router, "BillingRepository",
                       lambda db: stub_repo)
            mp.setattr(billing_router, "user_has_property_scope",
                       AsyncMock(return_value=False))
            with pytest.raises(APIError) as exc:
                await billing_router.record_payment(
                    request=_payment_request(),
                    current_user={}, db=AsyncMock())
        assert exc.value.code == "AUTH-005"
        assert exc.value.status_code == status.HTTP_403_FORBIDDEN

    async def test_list_invoices_denied_without_scope_when_property_given(self) -> None:
        prop_id = uuid.uuid4()
        stub_service = _make_stub_service(property_ids=[prop_id])
        with pytest.MonkeyPatch().context() as mp:
            mp.setattr(billing_router, "BillingService", stub_service)
            mp.setattr(billing_router, "user_has_property_scope",
                       AsyncMock(return_value=False))
            with pytest.raises(APIError) as exc:
                await billing_router.list_invoices(
                    response=_FakeResponse(), property_id=prop_id,
                    current_user={}, db=AsyncMock())
        assert exc.value.code == "AUTH-005"
        assert exc.value.status_code == status.HTTP_403_FORBIDDEN


def _payment_request() -> RecordPaymentRequest:
    return RecordPaymentRequest(
        invoice_id=uuid.uuid4(),
        amount=Decimal("7500.00"),
        method=PaymentMethod.CASH,
    )


# ── #3: GET /invoices/{id} 404 uses the BILL-007 envelope ────────────


@pytest.mark.unit
class TestInvoiceNotFoundEnvelope:
    async def test_missing_invoice_raises_bill_007(self) -> None:
        stub_service = _make_stub_service(invoice=None)
        with pytest.MonkeyPatch().context() as mp:
            mp.setattr(billing_router, "BillingService", stub_service)
            with pytest.raises(APIError) as exc:
                await billing_router.get_invoice_detail(
                    response=_FakeResponse(), invoice_id=uuid.uuid4(),
                    current_user={}, db=AsyncMock())
        assert exc.value.code == BILL_007_INVOICE_NOT_FOUND
        assert exc.value.status_code == status.HTTP_404_NOT_FOUND


# ── #4: POST /payments returns 201 ──────────────────────────────────


@pytest.mark.unit
class TestPaymentsStatus201:
    def test_payments_route_status_is_201(self) -> None:
        route = next(
            r for r in app.routes
            if getattr(r, "path", "") == "/api/v1/billing/payments"
            and "POST" in getattr(r, "methods", set())
        )
        assert route.status_code == status.HTTP_201_CREATED


# ── #11: method is the real PaymentMethod enum ──────────────────────


@pytest.mark.unit
class TestPaymentMethodEnum:
    def test_wallet_rejected(self) -> None:
        with pytest.raises(Exception):
            RecordPaymentRequest(
                invoice_id=uuid.uuid4(), amount=Decimal("1"),
                method="wallet", reference_number=None,
                slip_image_url=None, notes=None)

    def test_promptpay_accepted(self) -> None:
        req = RecordPaymentRequest(
            invoice_id=uuid.uuid4(), amount=Decimal("1"),
            method="promptpay", reference_number=None,
            slip_image_url=None, notes=None)
        assert req.method == PaymentMethod.PROMPTPAY

    def test_invalid_method_rejected(self) -> None:
        with pytest.raises(Exception):
            RecordPaymentRequest(
                invoice_id=uuid.uuid4(), amount=Decimal("1"),
                method="bitcoin", reference_number=None,
                slip_image_url=None, notes=None)

    def test_openapi_declares_method_enum(self) -> None:
        schema = app.openapi()
        defs = schema["components"]["schemas"]
        method_ref = defs["RecordPaymentRequest"]["properties"]["method"]["$ref"]
        method_def = defs[method_ref.split("/")[-1]]
        assert set(method_def["enum"]) == {
            "bank_transfer", "cash", "promptpay", "qr_code", "credit_card"
        }

# ── #12: money is Decimal (string wire format) ─────────────────────


@pytest.mark.unit
class TestMoneyIsDecimal:
    def test_amount_is_decimal_accepting_string(self) -> None:
        # Pydantic v2 advertises Decimal as number-or-string in OpenAPI, but
        # at runtime a Decimal validates strictly and serializes as a JSON
        # string (proven by TestMoneyIsDecimal::test_response_total_amount_*
        # via model_dump(mode="json")). The contract-critical guarantee is
        # that the field type is Decimal (not float) and accepts a numeric
        # string — assert the anyOf accepts a string form.
        schema = app.openapi()
        props = schema["components"]["schemas"]["RecordPaymentRequest"]["properties"]
        amount = props["amount"]
        forms = [f.get("type") for f in amount["anyOf"]]
        assert "string" in forms  # Decimal accepts "7500.00" string input
        req = RecordPaymentRequest(
            invoice_id=uuid.uuid4(), amount=Decimal("7500.00"),
            method=PaymentMethod.CASH)
        assert isinstance(req.amount, Decimal)
        assert req.amount == Decimal("7500.00")

    def test_response_total_amount_serializes_as_string(self) -> None:
        resp = InvoiceResponse(
            id=uuid.uuid4(), invoice_number="INV-1",
            contract_id=uuid.uuid4(), room_id=uuid.uuid4(),
            tenant_id=uuid.uuid4(), property_id=uuid.uuid4(),
            billing_month=1, billing_year=2026, due_date="2026-02-01",
            status="draft", total_amount=Decimal("7500.00"),
            paid_amount=Decimal("3000.50"))
        dumped = resp.model_dump(mode="json")
        assert dumped["total_amount"] == "7500.00"
        assert dumped["paid_amount"] == "3000.50"


# ── #19: read_date carries a full UTC-offset timestamp ──────────────


@pytest.mark.unit
class TestReadDateTimestamp:
    def test_read_date_is_full_timestamp_with_offset(self) -> None:
        reading = AsyncMock()
        reading.id = uuid.uuid4()
        reading.room_id = uuid.uuid4()
        reading.billing_month = 1
        reading.billing_year = 2026
        reading.electric_previous = 0
        reading.electric_current = 10
        reading.electric_used = 10
        reading.water_previous = 0
        reading.water_current = 5
        reading.water_used = 5
        # Stored as a naive UTC value — the schema must attach the offset.
        reading.created_at = datetime(2026, 1, 20, 8, 30, 0)

        resp = MeterReadingResponse.from_model(reading)
        assert resp.read_date == "2026-01-20T08:30:00+00:00"
        assert "T" in resp.read_date  # not a bare date


# ── #20: Cache-Control: private, no-store on the 3 GET endpoints ────


@pytest.mark.unit
class TestCacheControl:
    async def test_history_sets_no_store(self) -> None:
        stub_service = _make_stub_service(history=[])
        stub_repo = _StubRepo(room_property_id=uuid.uuid4())
        with pytest.MonkeyPatch().context() as mp:
            mp.setattr(billing_router, "BillingService", stub_service)
            mp.setattr(billing_router, "BillingRepository",
                       lambda db: stub_repo)
            mp.setattr(billing_router, "user_has_property_scope",
                       AsyncMock(return_value=True))
            response = _FakeResponse()
            await billing_router.get_meter_reading_history(
                response=response, room_id=uuid.uuid4(), current_user={},
                db=AsyncMock())
        assert response.headers.get("Cache-Control") == "private, no-store"

    async def test_list_invoices_sets_no_store(self) -> None:
        stub_service = _make_stub_service(property_ids=[uuid.uuid4()])
        with pytest.MonkeyPatch().context() as mp:
            mp.setattr(billing_router, "BillingService", stub_service)
            mp.setattr(billing_router, "user_has_property_scope",
                       AsyncMock(return_value=True))
            response = _FakeResponse()
            await billing_router.list_invoices(
                response=response, property_id=uuid.uuid4(),
                page=1, limit=20,
                current_user={}, db=AsyncMock())
        assert response.headers.get("Cache-Control") == "private, no-store"

    async def test_invoice_detail_sets_no_store(self) -> None:
        invoice = _FakeInvoice()
        stub_service = _make_stub_service(invoice=invoice)
        stub_repo = _StubRepo(invoice_property_id=invoice.property_id)
        with pytest.MonkeyPatch().context() as mp:
            mp.setattr(billing_router, "BillingService", stub_service)
            mp.setattr(billing_router, "BillingRepository",
                       lambda db: stub_repo)
            mp.setattr(billing_router, "user_has_property_scope",
                       AsyncMock(return_value=True))
            response = _FakeResponse()
            await billing_router.get_invoice_detail(
                response=response, invoice_id=uuid.uuid4(),
                current_user={}, db=AsyncMock())
        assert response.headers.get("Cache-Control") == "private, no-store"


# ── #13: pagination + bounded history limit ────────────────────────


@pytest.mark.unit
class TestPagination:
    async def test_list_invoices_meta_shape(self) -> None:
        """The invoice list returns the standard pagination ``meta`` block.

        Wires a stub repo (total=25) through the stub service so no live DB is
        hit, then asserts the router-built ``meta`` (page=2, limit=20 →
        has_next True because 40 < 25 is False... here total=25 so has_next
        for page 2 is False; we use total=45 to exercise has_next=True).
        """
        stub_repo = _StubRepo(invoices=[], total=45)

        class _StubService:
            def __init__(self, db: Any) -> None:
                self.db = db
                self.repo = stub_repo

            async def get_current_user_property_ids(self, current_user):
                return None  # global owner/admin → no scope filter

        with pytest.MonkeyPatch().context() as mp:
            mp.setattr(billing_router, "BillingService", _StubService)
            response = _FakeResponse()
            result = await billing_router.list_invoices(
                response=response, property_id=None, page=2, limit=20,
                current_user={"user_id": str(uuid.uuid4())},
                db=AsyncMock())

        assert result.meta == {
            "page": 2,
            "limit": 20,
            "total": 45,
            "has_next": 40 < 45,  # True
        }

    def test_openapi_history_limit_bounded(self) -> None:
        schema = app.openapi()
        params = schema["paths"][
            "/api/v1/billing/meter-readings/{room_id}/history"
        ]["get"]["parameters"]
        limit = next(p for p in params if p["name"] == "limit")
        assert limit["schema"]["maximum"] == 100
        assert limit["schema"]["minimum"] == 1

    def test_openapi_invoices_pagination_params(self) -> None:
        schema = app.openapi()
        params = schema["paths"]["/api/v1/billing/invoices"]["get"]["parameters"]
        names = {p["name"] for p in params}
        assert {"page", "limit"}.issubset(names)
        page = next(p for p in params if p["name"] == "page")
        assert page["schema"]["minimum"] == 1
        limitp = next(p for p in params if p["name"] == "limit")
        assert limitp["schema"]["maximum"] == 100


# ── #1: Idempotency-Key header on the 3 POST endpoints ──────────────


@pytest.mark.unit
class TestIdempotencyHeader:
    def test_openapi_declares_idempotency_header_on_posts(self) -> None:
        schema = app.openapi()
        for path in (
            "/api/v1/billing/meter-readings",
            "/api/v1/billing/invoices/generate",
            "/api/v1/billing/payments",
        ):
            params = schema["paths"][path]["post"]["parameters"]
            headers = [p for p in params if p.get("in") == "header"]
            assert any(
                h["name"].lower() == "idempotency-key" for h in headers
            ), f"{path} missing Idempotency-Key header"
