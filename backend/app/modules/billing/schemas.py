from pydantic import BaseModel, Field, validator
from datetime import datetime
from typing import List, Optional


class MeterReadingRequest(BaseModel):
    room_id: int = Field(..., description="Room ID to record meter reading for")
    billing_month: int = Field(..., ge=1, le=12, description="Billing month (1-12)")
    billing_year: int = Field(..., ge=2020, description="Billing year")
    electric_previous: int = Field(..., ge=0, description="Previous electric meter reading")
    electric_current: int = Field(..., ge=0, description="Current electric meter reading")
    water_previous: int = Field(..., ge=0, description="Previous water meter reading")
    water_current: int = Field(..., ge=0, description="Current water meter reading")

    @validator('electric_current')
    def check_electric_reading(cls, v, values):
        if 'electric_previous' in values and v <= values['electric_previous']:
            raise ValueError('Current electric reading must be greater than previous')
        return v

    @validator('water_current')
    def check_water_reading(cls, v, values):
        if 'water_previous' in values and v <= values['water_previous']:
            raise ValueError('Current water reading must be greater than previous')
        return v


class GenerateInvoiceRequest(BaseModel):
    room_id: int = Field(..., description="Room ID to generate invoice for")
    billing_month: int = Field(..., ge=1, le=12, description="Billing month (1-12)")
    billing_year: int = Field(..., ge=2020, description="Billing year")


class InvoiceResponse(BaseModel):
    id: int = Field(..., description="Invoice ID")
    tenant_id: int = Field(..., description="Tenant ID")
    invoice_month: int = Field(..., description="Billing month")
    invoice_year: int = Field(..., description="Billing year")
    total_amount: float = Field(..., description="Total amount due")
    status: str = Field(..., description="Invoice status (pending, paid, overdue)")
    line_items: List['InvoiceLineItemResponse'] = Field(..., description="Line items in invoice")


class InvoiceLineItemResponse(BaseModel):
    description: str = Field(..., description="Description of line item")
    amount: float = Field(..., description="Amount for this line item")


class RecordPaymentRequest(BaseModel):
    invoice_id: int = Field(..., description="Invoice ID to record payment for")
    amount: float = Field(..., ge=0, description="Payment amount")
    method: str = Field(..., pattern="^(credit_card|bank_transfer|cash)$", description="Payment method")


# Response models for the router
class MeterReadingResponse(BaseModel):
    id: int
    room_id: int
    billing_month: int
    billing_year: int
    electric_previous: int
    electric_current: int
    water_previous: int
    water_current: int
    created_at: str


class InvoiceListResponse(BaseModel):
    id: int
    tenant_id: int
    invoice_month: int
    invoice_year: int
    total_amount: float
    status: str
    created_at: str