"""Billing API routes (FastAPI).

Implements the "Proposed Redesign — Billing Module" target design from
``docs/API.md`` fixing API anti-patterns #5, #4, #3, #13, #1, #11, #12,
#19, #20:

- #5  authorization: every endpoint requires ``get_current_user``; the 4
      "resolve-then-check" endpoints (history, invoice detail, payments,
      invoice list) resolve the entity's ``property_id`` and verify scope
      via ``user_has_property_scope`` (raising ``403 AUTH-005``), while the
      2 body/query-sourced endpoints reuse ``require_property_scope``.
- #4  ``POST /payments`` now returns 201 like every other create endpoint.
- #3  ``GET /invoices/{id}`` 404 raises ``APIError(code="BILL-007")`` — the
      same ``{"error": {...}}`` envelope as every other billing error path
      (the router no longer converts ``APIError`` to ``HTTPException``, so
      the global handler always emits the unified envelope).
- #13 pagination on ``GET /invoices``; bounded ``limit`` on the history
      endpoint.
- #1  optional ``Idempotency-Key`` header on the 3 POST endpoints.
- #11 ``RecordPaymentRequest.method`` is the real ``PaymentMethod`` enum.
- #12 money modelled as ``Decimal`` end-to-end (serialized as JSON strings).
- #19 ``read_date`` carries a full timestamp with an explicit UTC offset.
- #20 ``Cache-Control: private, no-store`` on the 3 GET endpoints.

References:
- SDD.md §3.3: API Contract
- SDD.md §2.3: Billing Module Specification
"""

import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Header, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.billing.constants import BILL_007_INVOICE_NOT_FOUND
from app.modules.billing.repository import BillingRepository
from app.modules.billing.schemas import (
    GenerateInvoiceRequest,
    InvoiceCreateResponse,
    InvoiceDetailResponse,
    InvoiceDetailWrapperResponse,
    InvoiceLineItemResponse,
    InvoiceListWrapperResponse,
    InvoiceResponse,
    MeterReadingCreateResponse,
    MeterReadingHistoryWrapperResponse,
    MeterReadingRequest,
    MeterReadingResponse,
    PaymentCreateResponse,
    PaymentResponse,
    RecordPaymentRequest,
)
from app.modules.billing.services import BillingService
from app.shared.database import get_db
from app.shared.deps import (
    CurrentUser,
    require_property_scope,
    user_has_property_scope,
)
from app.shared.exceptions import APIError
from app.shared.idempotency import check_idempotency, store_idempotency

router = APIRouter(tags=["billing"], redirect_slashes=False)

# Module-level constants for FastAPI dependencies (fixes B008 mutable default)
GET_DB = Depends(get_db)
QUERY_LIMIT_12 = Query(12, ge=1, le=100, description="Max readings to return (1-100)")
QUERY_PROPERTY_ID = Query(None, description="Filter by property")
QUERY_PAGE = Query(1, ge=1, description="Page number")
QUERY_LIMIT_20 = Query(20, ge=1, le=100, description="Items per page (1-100)")


async def _check_scope(
    current_user: dict[str, Any], db: AsyncSession, property_id: uuid.UUID | None
) -> None:
    """Resolve-then-check authorization helper.

    Raises ``AUTH-005`` (403) unless the caller is a global owner/admin or
    holds a scope row for ``property_id``. A ``None`` ``property_id`` (entity
    not found) is treated as "no scope" so the caller cannot read/guess
    non-existent resources across properties.
    """
    if property_id is None:
        raise APIError(
            code="AUTH-005",
            message="Insufficient property scope",
            status_code=status.HTTP_403_FORBIDDEN,
        )
    if not await user_has_property_scope(current_user, db, property_id):
        raise APIError(
            code="AUTH-005",
            message="Insufficient property scope",
            status_code=status.HTTP_403_FORBIDDEN,
        )


# ── POST /meter-readings ──────────────────────────────────────────────


@router.post(
    "/meter-readings",
    response_model=MeterReadingCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_meter_reading(
    request: MeterReadingRequest,
    current_user: dict[str, Any],
    db: AsyncSession = GET_DB,
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> MeterReadingCreateResponse:
    """Create a new meter reading (BR-07).

    Authorization (fixes #5): the room's ``property_id`` is resolved and
    checked via ``user_has_property_scope`` — callers without a scope row
    (or global owner/admin) get ``403 AUTH-005``.
    Idempotency (fixes #1): an optional ``Idempotency-Key`` header replays a
    prior 201 within the 24h dedupe window; reusing a key with a different
    body raises ``409 VAL-409``.
    """
    repo = BillingRepository(db)
    room_property_id: uuid.UUID | None = await repo.get_room_property_id(request.room_id)
    await _check_scope(current_user, db, room_property_id)

    if idempotency_key:
        cached = await check_idempotency(
            db,
            idempotency_key,
            "POST:/api/v1/billing/meter-readings",
            request.model_dump(mode="json"),
        )
        if cached is not None:
            return MeterReadingCreateResponse.model_validate(cached)

    service = BillingService(db)
    reading = await service.record_meter_reading(
        room_id=request.room_id,
        billing_month=request.billing_month,
        billing_year=request.billing_year,
        electric_previous=request.electric_previous,
        electric_current=request.electric_current,
        water_previous=request.water_previous,
        water_current=request.water_current,
        recorded_by=uuid.UUID(current_user["user_id"]),
    )
    response = MeterReadingCreateResponse(
        data=MeterReadingResponse.from_model(reading)
    )

    if idempotency_key:
        await store_idempotency(
            db,
            idempotency_key,
            "POST:/api/v1/billing/meter-readings",
            request.model_dump(mode="json"),
            response.model_dump(mode="json"),
            BillingRepository,
        )
    return response


# ── GET /meter-readings/{room_id}/history ─────────────────────────────


@router.get(
    "/meter-readings/{room_id}/history",
    response_model=MeterReadingHistoryWrapperResponse,
)
async def get_meter_reading_history(
    response: Response,
    current_user: dict[str, Any],
    room_id: uuid.UUID,
    limit: int = QUERY_LIMIT_12,
    db: AsyncSession = GET_DB,
) -> MeterReadingHistoryWrapperResponse:
    """Get meter reading history for a room (fixes #5, #13, #19, #20).

    Authorization (#5): the room's ``property_id`` is resolved and checked
    via ``user_has_property_scope``.
    Pagination (#13): ``limit`` is now bounded to ``le=100``.
    Timestamp (#19): ``read_date`` carries the full ``created_at`` timestamp
    with an explicit UTC offset.
    Caching (#20): ``Cache-Control: private, no-store``.
    """
    # Fixes #20: financial-adjacent history must never be cached/shared.
    response.headers["Cache-Control"] = "private, no-store"

    repo = BillingRepository(db)
    room_property_id: uuid.UUID | None = await repo.get_room_property_id(room_id)
    await _check_scope(current_user, db, room_property_id)

    service = BillingService(db)
    readings = await service.get_meter_reading_history(room_id, limit)
    return MeterReadingHistoryWrapperResponse(
        data=[MeterReadingResponse.from_model(r) for r in readings],
    )


# ── POST /invoices/generate ──────────────────────────────────────────


@router.post(
    "/invoices/generate",
    response_model=InvoiceCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
async def generate_invoice(
    request: GenerateInvoiceRequest,
    _: Annotated[None, require_property_scope()],
    current_user: CurrentUser,
    db: AsyncSession = GET_DB,
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> InvoiceCreateResponse:
    """Generate monthly invoices for all occupied rooms in a property (BR-12).

    Authorization (#5): ``property_id`` is in the body, so
    ``require_property_scope()`` (body-sourced form) enforces it directly.
    Idempotency (#1): optional ``Idempotency-Key`` header (24h dedupe).
    """
    if idempotency_key:
        cached = await check_idempotency(
            db,
            idempotency_key,
            "POST:/api/v1/billing/invoices/generate",
            request.model_dump(mode="json"),
        )
        if cached is not None:
            return InvoiceCreateResponse.model_validate(cached)

    service = BillingService(db)
    invoice = await service.generate_monthly_invoice(
        property_id=request.property_id,
        billing_month=request.billing_month,
        billing_year=request.billing_year,
        created_by=uuid.UUID(current_user["user_id"]),
    )
    response = InvoiceCreateResponse(
        data=InvoiceResponse.from_model(invoice)
    )

    if idempotency_key:
        await store_idempotency(
            db,
            idempotency_key,
            "POST:/api/v1/billing/invoices/generate",
            request.model_dump(mode="json"),
            response.model_dump(mode="json"),
            BillingRepository,
        )
    return response


# ── GET /invoices ────────────────────────────────────────────────────


@router.get(
    "/invoices",
    response_model=InvoiceListWrapperResponse,
)
async def list_invoices(
    response: Response,
    current_user: CurrentUser,
    property_id: uuid.UUID | None = QUERY_PROPERTY_ID,
    page: int = QUERY_PAGE,
    limit: int = QUERY_LIMIT_20,
    db: AsyncSession = GET_DB,
) -> InvoiceListWrapperResponse:
    """List invoices, scope-filtered and paginated (fixes #5, #13, #20).

    Authorization (#5): if ``property_id`` is supplied, it is scope-checked
    directly; if omitted, results are filtered to only the properties the
    caller holds a scope for (global owner/admin see everything). Never
    returns the unfiltered global invoice list to a non-owner/admin caller.
    Pagination (#13): ``page``/``limit`` query params; response ``meta``
    gains ``{"page", "limit", "total", "has_next"}``.
    Caching (#20): ``Cache-Control: private, no-store`` (financial data).
    """
    # Fixes #20.
    response.headers["Cache-Control"] = "private, no-store"

    service = BillingService(db)
    if property_id is not None:
        # Direct field: check the supplied property's scope directly.
        await _check_scope(current_user, db, property_id)
        allowed_property_ids: list[uuid.UUID] | None = [property_id]
    else:
        allowed_property_ids = await service.get_current_user_property_ids(current_user)

    invoices, total = await service.repo.list_invoices_paginated(
        property_ids=allowed_property_ids,
        page=page,
        limit=limit,
    )
    return InvoiceListWrapperResponse(
        data=[InvoiceResponse.from_model(inv) for inv in invoices],
        meta={
            "page": page,
            "limit": limit,
            "total": total,
            "has_next": page * limit < total,
        },
    )


# ── GET /invoices/{invoice_id} ───────────────────────────────────────


@router.get(
    "/invoices/{invoice_id}",
    response_model=InvoiceDetailWrapperResponse,
)
async def get_invoice_detail(
    response: Response,
    current_user: CurrentUser,
    invoice_id: uuid.UUID,
    db: AsyncSession = GET_DB,
) -> InvoiceDetailWrapperResponse:
    """Get a single invoice with its line items (fixes #5, #3, #20).

    Authorization (#5): the invoice's ``property_id`` is resolved and checked
    via ``user_has_property_scope``.
    Error envelope (#3): a missing invoice raises ``APIError(code="BILL-007")``
    — the unified ``{"error": {...}}`` envelope, not a bare ``HTTPException``.
    Caching (#20): ``Cache-Control: private, no-store``.
    """
    # Fixes #20.
    response.headers["Cache-Control"] = "private, no-store"

    service = BillingService(db)
    invoice = await service.get_invoice_by_id(invoice_id)
    if invoice is None:
        raise APIError(
            code=BILL_007_INVOICE_NOT_FOUND,
            message="Invoice not found",
            status_code=status.HTTP_404_NOT_FOUND,
        )

    await _check_scope(current_user, db, invoice.property_id)

    return InvoiceDetailWrapperResponse(
        data=InvoiceDetailResponse(
            invoice=InvoiceResponse.from_model(invoice),
            line_items=[
                InvoiceLineItemResponse(
                    id=li.id,
                    invoice_id=li.invoice_id,
                    line_type=li.line_type,
                    description=li.description,
                    quantity=float(li.quantity),
                    unit_price=float(li.unit_price),
                    amount=li.amount,
                )
                for li in invoice.line_items
            ],
        ),
    )


# ── POST /payments ───────────────────────────────────────────────────


@router.post(
    "/payments",
    response_model=PaymentCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
async def record_payment(
    request: RecordPaymentRequest,
    current_user: CurrentUser,
    db: AsyncSession = GET_DB,
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> PaymentCreateResponse:
    """Record payment for an invoice (fixes #5, #4, #1, #11, #12).

    Authorization (#5): the invoice's ``property_id`` is resolved and checked
    via ``user_has_property_scope`` (the request only carries ``invoice_id``).
    Status code (#4): returns 201 like every other create endpoint.
    Idempotency (#1): optional ``Idempotency-Key`` header (24h dedupe).
    Method (#11): validated against the real ``PaymentMethod`` enum.
    Money (#12): ``amount`` is a ``Decimal`` — no float round-trip needed.
    """
    repo = BillingRepository(db)
    invoice_property_id: uuid.UUID | None = await repo.get_invoice_property_id(
        request.invoice_id
    )
    await _check_scope(current_user, db, invoice_property_id)

    if idempotency_key:
        cached = await check_idempotency(
            db,
            idempotency_key,
            "POST:/api/v1/billing/payments",
            request.model_dump(mode="json"),
        )
        if cached is not None:
            return PaymentCreateResponse.model_validate(cached)

    service = BillingService(db)
    payment = await service.record_payment(
        invoice_id=request.invoice_id,
        amount=request.amount,
        method=request.method.value,
        recorded_by=uuid.UUID(current_user["user_id"]),
        reference_number=request.reference_number,
    )
    response = PaymentCreateResponse(
        data=PaymentResponse.from_model(payment)
    )

    if idempotency_key:
        await store_idempotency(
            db,
            idempotency_key,
            "POST:/api/v1/billing/payments",
            request.model_dump(mode="json"),
            response.model_dump(mode="json"),
            BillingRepository,
        )
    return response
