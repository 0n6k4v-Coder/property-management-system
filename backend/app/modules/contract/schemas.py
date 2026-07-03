"""Pydantic v2 request/response schemas for Contract module (SDD §2.5, §3.1).

References:
    - SDD.md §2.5: Contract Module Specification (FR-CONTRACT-01~05)
    - SDD.md §3.1: API Conventions (response format, validation rules)
    - SDD.md §3.3: Contract Endpoint Specifications
    - BR-01: One active contract per room (service layer)
    - BR-02: Deposit >= monthly_rent * min_deposit_months (service layer)
"""

import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.modules.contract.constants import ContractStatus, TerminationReason


# ── Request Schemas ────────────────────────────────────────────────────


class CreateContractRequest(BaseModel):
    """Request body for POST /api/v1/contracts (SDD §3.3).

    Validation:
        - ``end_date`` must be after ``start_date``.
        - ``monthly_rent`` must be positive.
        - ``deposit_amount`` must be >= 0.
        - ``start_date`` must not be in the past (service layer also checks).
        - BR-01/BR-02 enforced in service layer (not here).
    """

    model_config = ConfigDict(extra="forbid")

    room_id: uuid.UUID
    tenant_id: uuid.UUID
    property_id: uuid.UUID
    start_date: date
    end_date: date
    monthly_rent: Decimal = Field(..., gt=Decimal("0"))
    deposit_amount: Decimal = Field(..., ge=Decimal("0"))
    special_conditions: str | None = Field(None, max_length=2000)

    @field_validator("end_date")
    @classmethod
    def end_must_be_after_start(cls, v: date, info) -> date:
        start = info.data.get("start_date")
        if start and v <= start:
            raise ValueError("end_date must be after start_date")
        return v


class TerminateContractRequest(BaseModel):
    """Request body for POST /api/v1/contracts/{id}/terminate (SDD §3.3).

    Validation:
        - ``reason`` is required and must be non-empty.
        - ``termination_date`` defaults to today if not provided.
    """

    model_config = ConfigDict(extra="forbid")

    reason: TerminationReason
    termination_date: date | None = None
    notes: str | None = Field(None, max_length=2000)


class ExtendLeaseRequest(BaseModel):
    """Request body for POST /api/v1/contracts/{id}/extend.

    Validation:
        - ``new_end_date`` must be after the current end_date.
    """

    model_config = ConfigDict(extra="forbid")

    new_end_date: date
    reason: str | None = Field(None, max_length=1000)


class RenewContractRequest(BaseModel):
    """Request body for POST /api/v1/contracts/{id}/renew.

    Creates a new contract record based on the original.  The original
    contract must be in ``terminated`` or ``expired`` state (CONT-005).
    """

    model_config = ConfigDict(extra="forbid")

    new_start_date: date
    new_end_date: date
    new_monthly_rent: Decimal = Field(..., gt=Decimal("0"))
    new_deposit_amount: Decimal = Field(..., ge=Decimal("0"))

    @field_validator("new_end_date")
    @classmethod
    def end_must_be_after_start(cls, v: date, info) -> date:
        start = info.data.get("new_start_date")
        if start and v <= start:
            raise ValueError("new_end_date must be after new_start_date")
        return v


# ── Response Schemas ───────────────────────────────────────────────────


class ContractTerminationResponse(BaseModel):
    """Termination record embedded in ContractResponse (SDD §5.2)."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    reason: str
    termination_date: date
    notes: str | None = None
    terminated_by: uuid.UUID | None = None
    created_at: datetime


class LeaseExtensionResponse(BaseModel):
    """Lease extension record embedded in ContractResponse."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    previous_end_date: date
    extended_to: date
    reason: str | None = None
    extended_by: uuid.UUID | None = None
    created_at: datetime


class ContractResponse(BaseModel):
    """Response body for a single Contract resource (SDD §3.1 format)."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    room_id: uuid.UUID
    tenant_id: uuid.UUID
    property_id: uuid.UUID
    start_date: date
    end_date: date
    monthly_rent: Decimal
    deposit_amount: Decimal
    status: ContractStatus
    special_conditions: str | None = None
    is_renewal: bool = False
    renewed_from_id: uuid.UUID | None = None
    created_by: uuid.UUID | None = None
    created_at: datetime
    updated_at: datetime
    termination: ContractTerminationResponse | None = None
    extensions: list[LeaseExtensionResponse] = []


class ContractCreateResponse(BaseModel):
    """Wrapper for 201 CREATED response (SDD §3.1)."""

    data: ContractResponse
    meta: None = None


class ContractListResponse(BaseModel):
    """Paginated list response for contracts (SDD §3.1)."""

    data: list[ContractResponse]
    meta: dict | None = None


# ── Lease History ──────────────────────────────────────────────────────


class LeaseHistoryItem(BaseModel):
    """A single lease history entry for a room."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    start_date: date
    end_date: date
    monthly_rent: Decimal
    status: ContractStatus
    is_renewal: bool
    created_at: datetime
    termination_reason: str | None = None
    termination_date: date | None = None


class LeaseHistoryResponse(BaseModel):
    """Response for GET /api/v1/leases/{room_id}/history."""

    data: list[LeaseHistoryItem]
    meta: None = None