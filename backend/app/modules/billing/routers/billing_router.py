"""Billing API routes (FastAPI).

References:
- SDD.md §3.3: API Contract
- SDD.md §2.3: Billing Module Specification
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.shared.database import get_db
from app.modules.billing.schemas import (
    MeterReadingRequest,
    GenerateInvoiceRequest,
    RecordPaymentRequest,
    InvoiceResponse,
    InvoiceLineItemResponse,
    MeterReadingResponse,
    InvoiceListResponse,
)
from app.modules.billing.services import BillingService

router = APIRouter(prefix="/api/v1/billing", tags=["billing"])


@router.post(
    "/meter-readings",
    response_model=MeterReadingResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_meter_reading(
    request: MeterReadingRequest,
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
        )
        return MeterReadingResponse(
            id=reading.id,
            room_id=reading.room_id,
            billing_month=reading.billing_month,
            billing_year=reading.billing_year,
            electric_previous=reading.electric_previous,
            electric_current=reading.electric_current,
            water_previous=reading.water_previous,
            water_current=reading.water_current,
            created_at=reading.created_at.isoformat() if reading.created_at else "",
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get(
    "/meter-readings/{room_id}/history",
    response_model=List[MeterReadingResponse],
)
async def get_meter_reading_history(
    room_id: int,
    limit: int = 12,
    db: AsyncSession = Depends(get_db),
):
    """Get meter reading history for a room."""
    service = BillingService(db)
    readings = await service.get_meter_reading_history(room_id, limit)
    return [
        MeterReadingResponse(
            id=r.id,
            room_id=r.room_id,
            billing_month=r.billing_month,
            billing_year=r.billing_year,
            electric_previous=r.electric_previous,
            electric_current=r.electric_current,
            water_previous=r.water_previous,
            water_current=r.water_current,
            created_at=r.created_at.isoformat() if r.created_at else "",
        )
        for r in readings
    ]


@router.post(
    "/invoices/generate",
    response_model=InvoiceResponse,
    status_code=status.HTTP_201_CREATED,
)
async def generate_invoice(
    request: GenerateInvoiceRequest,
    db: AsyncSession = Depends(get_db),
):
    """Generate monthly invoice for a room."""
    try:
        service = BillingService(db)
        invoice = await service.generate_monthly_invoice(
            room_id=request.room_id,
            billing_month=request.billing_month,
            billing_year=request.billing_year,
        )
        return InvoiceResponse(
            id=invoice.id,
            tenant_id=invoice.tenant_id,
            invoice_month=invoice.invoice_month,
            invoice_year=invoice.invoice_year,
            total_amount=float(invoice.total_amount),
            status=invoice.status,
            line_items=[
                InvoiceLineItemResponse(
                    description=item.description,
                    amount=float(item.amount),
                )
                for item in invoice.line_items
            ],
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post(
    "/payments",
    response_model=InvoiceResponse,
    status_code=status.HTTP_200_OK,
)
async def record_payment(
    request: RecordPaymentRequest,
    db: AsyncSession = Depends(get_db),
):
    """Record payment for an invoice."""
    try:
        service = BillingService(db)
        updated_invoice = await service.record_payment(
            invoice_id=request.invoice_id,
            amount=request.amount,
            method=request.method,
        )
        return InvoiceResponse(
            id=updated_invoice.id,
            tenant_id=updated_invoice.tenant_id,
            invoice_month=updated_invoice.invoice_month,
            invoice_year=updated_invoice.invoice_year,
            total_amount=float(updated_invoice.total_amount),
            status=updated_invoice.status,
            line_items=[
                InvoiceLineItemResponse(
                    description=item.description,
                    amount=float(item.amount),
                )
                for item in updated_invoice.line_items
            ],
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get(
    "/invoices",
    response_model=List[InvoiceListResponse],
)
async def list_invoices(
    db: AsyncSession = Depends(get_db),
):
    """List all invoices."""
    # TODO: Add pagination and filtering
    # For now, return empty list
    return []