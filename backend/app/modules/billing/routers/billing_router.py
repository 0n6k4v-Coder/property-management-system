"""Billing API routes (FastAPI).

References:
- SDD.md §3.3: API Contract
- SDD.md §2.3: Billing Module Specification
"""

import uuid
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.shared.database import get_db
from app.shared.deps import get_current_user
from app.shared.exceptions import APIError
from app.modules.billing.schemas import (
    MeterReadingRequest,
    GenerateInvoiceRequest,
    RecordPaymentRequest,
    MeterReadingResponse,
    MeterReadingCreateResponse,
    MeterReadingHistoryWrapperResponse,
    InvoiceResponse,
    InvoiceCreateResponse,
    InvoiceListWrapperResponse,
    InvoiceDetailWrapperResponse,
    PaymentResponse,
    PaymentCreateResponse,
)
from app.modules.billing.services import BillingService

router = APIRouter(tags=["billing"], redirect_slashes=False)


@router.post(
    "/meter-readings",
    response_model=MeterReadingCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_meter_reading(
    request: MeterReadingRequest,
    current_user: Annotated[dict, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """Create a new meter reading."""
    try:
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
        return {"data": MeterReadingResponse.from_model(reading), "meta": None}
    except APIError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message) from e


@router.get(
    "/meter-readings/{room_id}/history",
    response_model=MeterReadingHistoryWrapperResponse,
)
async def get_meter_reading_history(
    room_id: uuid.UUID,
    limit: int = 12,
    db: AsyncSession = Depends(get_db),
):
    """Get meter reading history for a room."""
    service = BillingService(db)
    readings = await service.get_meter_reading_history(room_id, limit)
    return {
        "data": [MeterReadingResponse.from_model(r) for r in readings],
        "meta": None,
    }


@router.post(
    "/invoices/generate",
    response_model=InvoiceCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
async def generate_invoice(
    request: GenerateInvoiceRequest,
    current_user: Annotated[dict, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """Generate monthly invoices for all occupied rooms in a property (BR-12)."""
    try:
        service = BillingService(db)
        invoice = await service.generate_monthly_invoice(
            property_id=request.property_id,
            billing_month=request.billing_month,
            billing_year=request.billing_year,
            created_by=uuid.UUID(current_user["user_id"]),
        )
        return {"data": InvoiceResponse.from_model(invoice), "meta": None}
    except APIError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message) from e


@router.get(
    "/invoices",
    response_model=InvoiceListWrapperResponse,
)
async def list_invoices(
    property_id: uuid.UUID | None = Query(None, description="Filter by property"),
    db: AsyncSession = Depends(get_db),
):
    """List invoices, optionally filtered by property."""
    service = BillingService(db)
    invoices = await service.list_invoices(property_id)
    return {"data": [InvoiceResponse.from_model(inv) for inv in invoices], "meta": None}


@router.get(
    "/invoices/{invoice_id}",
    response_model=InvoiceDetailWrapperResponse,
)
async def get_invoice_detail(
    invoice_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get a single invoice with its line items."""
    service = BillingService(db)
    invoice = await service.get_invoice_by_id(invoice_id)
    if invoice is None:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return {
        "data": {
            "invoice": InvoiceResponse.from_model(invoice),
            "line_items": [
                {
                    "id": li.id,
                    "invoice_id": li.invoice_id,
                    "line_type": li.line_type,
                    "description": li.description,
                    "quantity": float(li.quantity),
                    "unit_price": float(li.unit_price),
                    "amount": float(li.amount),
                }
                for li in invoice.line_items
            ],
        },
        "meta": None,
    }


@router.post(
    "/payments",
    response_model=PaymentCreateResponse,
    status_code=status.HTTP_200_OK,
)
async def record_payment(
    request: RecordPaymentRequest,
    current_user: Annotated[dict, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """Record payment for an invoice."""
    try:
        service = BillingService(db)
        payment = await service.record_payment(
            invoice_id=request.invoice_id,
            amount=Decimal(str(request.amount)),
            method=request.method,
            recorded_by=uuid.UUID(current_user["user_id"]),
            reference_number=request.reference_number,
        )
        return {"data": PaymentResponse.from_model(payment), "meta": None}
    except APIError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message) from e
