"""Pydantic request/response schemas for the Billing API (SDD §3.3, §2.3).

These schemas mirror the real ``Invoice``/``MeterReading``/``Payment`` models
(UUID primary keys, ``billing_month``/``billing_year`` fields) and the
frontend's ``API.*`` type definitions in ``frontend/src/types/api.d.ts`` —
keep both in sync when either side changes.
"""

import uuid
from datetime import UTC
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator

from app.modules.billing.constants import PaymentMethod


def _iso_utc(value) -> str:
    """Serialize a (possibly tz-naive) datetime with an explicit UTC offset.

    The ``MeterReading.created_at`` column is stored as a naive UTC value, so
    we attach ``tzinfo=UTC`` on the way out to satisfy anti-pattern #19
    (timestamps must carry an explicit offset, never a bare date).
    """
    if value is None:
        return ""
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    return value.isoformat()


# ── Meter Readings ──────────────────────────────────────────────────────


class MeterReadingRequest(BaseModel):
    room_id: uuid.UUID = Field(..., description="Room ID to record meter reading for")
    billing_month: int = Field(..., ge=1, le=12, description="Billing month (1-12)")
    billing_year: int = Field(..., ge=2020, description="Billing year")
    electric_previous: int = Field(..., ge=0, description="Previous electric meter reading")
    electric_current: int = Field(..., ge=0, description="Current electric meter reading")
    water_previous: int = Field(..., ge=0, description="Previous water meter reading")
    water_current: int = Field(..., ge=0, description="Current water meter reading")

    @field_validator("electric_current")
    @classmethod
    def check_electric_reading(cls, v: int, info) -> int:
        previous = info.data.get("electric_previous")
        if previous is not None and v <= previous:
            raise ValueError("Current electric reading must be greater than previous")
        return v

    @field_validator("water_current")
    @classmethod
    def check_water_reading(cls, v: int, info) -> int:
        previous = info.data.get("water_previous")
        if previous is not None and v <= previous:
            raise ValueError("Current water reading must be greater than previous")
        return v


class MeterReadingResponse(BaseModel):
    id: uuid.UUID
    room_id: uuid.UUID
    billing_month: int
    billing_year: int
    electric_previous: int
    electric_current: int
    electric_used: int
    water_previous: int
    water_current: int
    water_used: int
    read_date: str

    @classmethod
    def from_model(cls, reading) -> MeterReadingResponse:
        return cls(
            id=reading.id,
            room_id=reading.room_id,
            billing_month=reading.billing_month,
            billing_year=reading.billing_year,
            electric_previous=reading.electric_previous,
            electric_current=reading.electric_current,
            electric_used=reading.electric_used,
            water_previous=reading.water_previous,
            water_current=reading.water_current,
            water_used=reading.water_used,
            read_date=_iso_utc(reading.created_at),
        )


# ── Invoices ─────────────────────────────────────────────────────────────


class GenerateInvoiceRequest(BaseModel):
    property_id: uuid.UUID = Field(..., description="Property to generate invoices for")
    billing_month: int = Field(..., ge=1, le=12, description="Billing month (1-12)")
    billing_year: int = Field(..., ge=2020, description="Billing year")


class InvoiceResponse(BaseModel):
    id: uuid.UUID
    invoice_number: str
    contract_id: uuid.UUID
    room_id: uuid.UUID
    tenant_id: uuid.UUID
    property_id: uuid.UUID
    billing_month: int
    billing_year: int
    due_date: str
    status: str
    total_amount: Decimal
    paid_amount: Decimal
    notes: str | None = None
    created_at: str | None = None

    @classmethod
    def from_model(cls, invoice) -> InvoiceResponse:
        return cls(
            id=invoice.id,
            invoice_number=invoice.invoice_number,
            contract_id=invoice.contract_id,
            room_id=invoice.room_id,
            tenant_id=invoice.tenant_id,
            property_id=invoice.property_id,
            billing_month=invoice.billing_month,
            billing_year=invoice.billing_year,
            due_date=invoice.due_date.isoformat() if invoice.due_date else "",
            status=invoice.status,
            total_amount=invoice.total_amount,
            paid_amount=invoice.paid_amount,
            notes=None,
            created_at=invoice.created_at.isoformat() if invoice.created_at else None,
        )


class InvoiceListResponse(InvoiceResponse):
    """Same shape as InvoiceResponse — kept as a distinct type for the list
    endpoint in case list-specific fields (e.g. pagination cursors) are
    added later without widening the detail response."""


class InvoiceLineItemResponse(BaseModel):
    id: uuid.UUID
    invoice_id: uuid.UUID
    line_type: str
    description: str
    quantity: float
    unit_price: float
    amount: Decimal

    @classmethod
    def from_model(cls, item) -> InvoiceLineItemResponse:
        return cls(
            id=item.id,
            invoice_id=item.invoice_id,
            line_type=item.line_type,
            description=item.description,
            quantity=float(item.quantity),
            unit_price=float(item.unit_price),
            amount=item.amount,
        )


class InvoiceDetailResponse(BaseModel):
    invoice: InvoiceResponse
    line_items: list[InvoiceLineItemResponse]

    @classmethod
    def from_model(cls, invoice) -> InvoiceDetailResponse:
        return cls(
            invoice=InvoiceResponse.from_model(invoice),
            line_items=[InvoiceLineItemResponse.from_model(li) for li in invoice.line_items],
        )


# ── Payments ─────────────────────────────────────────────────────────────


class RecordPaymentRequest(BaseModel):
    invoice_id: uuid.UUID = Field(..., description="Invoice ID to record payment for")
    amount: Decimal = Field(..., ge=0, description="Payment amount")
    method: PaymentMethod = Field(..., description="Payment method")
    reference_number: str | None = Field(None, description="Transaction ID / slip number")
    slip_image_url: str | None = Field(None, description="Uploaded payment slip URL")
    notes: str | None = Field(None, description="Free-text notes")


class PaymentResponse(BaseModel):
    id: uuid.UUID
    invoice_id: uuid.UUID
    amount: Decimal
    payment_date: str
    method: str
    reference_number: str | None = None
    slip_image_url: str | None = None
    notes: str | None = None

    @classmethod
    def from_model(cls, payment) -> PaymentResponse:
        return cls(
            id=payment.id,
            invoice_id=payment.invoice_id,
            amount=payment.amount,
            payment_date=payment.payment_date.isoformat() if payment.payment_date else "",
            method=payment.method,
            reference_number=payment.reference,
            slip_image_url=None,
            notes=None,
        )


# ── Response Wrappers (SDD §3.1 — every response is {data, meta}) ────────


class MeterReadingCreateResponse(BaseModel):
    data: MeterReadingResponse
    meta: None = None


class MeterReadingHistoryWrapperResponse(BaseModel):
    data: list[MeterReadingResponse]
    meta: dict | None = None


class InvoiceCreateResponse(BaseModel):
    data: InvoiceResponse
    meta: None = None


class InvoiceListWrapperResponse(BaseModel):
    data: list[InvoiceResponse]
    meta: dict | None = None


class InvoiceDetailWrapperResponse(BaseModel):
    data: InvoiceDetailResponse
    meta: None = None


class PaymentCreateResponse(BaseModel):
    data: PaymentResponse
    meta: None = None
