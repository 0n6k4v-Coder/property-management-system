"""Pydantic v2 request/response schemas for Property module (SDD §2.2, §3.1).

References:
- SDD.md §2.2: Property Module Specification (FR-PROP-01~07)
- SDD.md §3.1: API Conventions (response format, validation rules)
"""

import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.modules.property.constants import RoomStatus, RoomType


# ── Request Schemas ────────────────────────────────────────────────────


class CreatePropertyRequest(BaseModel):
    """Request body for POST /api/v1/properties.

    Validation:
        - ``billing_due_day`` must be 1-28.
        - ``min_deposit_months`` >= 1.
        - ``name`` must not be empty.
    """

    model_config = ConfigDict(strict=True, extra="forbid")

    name: str = Field(..., min_length=1, max_length=255)
    address: str = Field(..., min_length=1)
    billing_due_day: int = Field(..., ge=1, le=28)
    min_deposit_months: int = Field(default=2, ge=1)

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("name must not be blank")
        return stripped


class UpdateRoomStatusRequest(BaseModel):
    """Request body for PATCH /api/v1/rooms/{id}/status."""

    model_config = ConfigDict(strict=True, extra="forbid")

    status: RoomStatus


# ── Response Schemas ───────────────────────────────────────────────────


class PropertyResponse(BaseModel):
    """Response body for a single Property resource (SDD §3.1 format)."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    address: str
    billing_due_day: int
    min_deposit_months: int
    created_by: uuid.UUID | None = None
    created_at: datetime
    updated_at: datetime


class RoomResponse(BaseModel):
    """Response body for a single Room resource (SDD §3.1 format).

    Note: ``images`` is omitted from the response if ``None``.
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    property_id: uuid.UUID
    building_id: uuid.UUID
    floor_id: uuid.UUID | None = None
    room_number: str
    room_type: str
    base_rent: Decimal
    status: str
    images: dict | None = None


class PropertyWithRoomsResponse(BaseModel):
    """Response for GET /api/v1/properties/{id}/rooms."""

    model_config = ConfigDict(from_attributes=True)

    property: PropertyResponse
    rooms: list[RoomResponse]


# ── Paginated list wrapper ─────────────────────────────────────────────


class RoomListResponse(BaseModel):
    """Paginated list response for rooms (SDD §3.1 pagination format)."""

    data: list[RoomResponse]
    meta: dict | None = None


class PropertyCreateResponse(BaseModel):
    """Wrapper for 201 CREATED response (SDD §3.1)."""
    data: PropertyResponse
    meta: None = None


class PropertyListResponse(BaseModel):
    """Response for GET /api/v1/properties — list all properties."""
    data: list[PropertyResponse]
    meta: None = None
