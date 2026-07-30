"""Pydantic v2 request/response schemas for Tenant module (SDD §2.4, §3.1).

References:
- SDD.md §2.4: Tenant Module Specification (FR-TENANT-01~04)
- SDD.md §3.1: API Conventions (response format)
- CODE_STYLE.md §6.3: Sensitive data must not be returned
"""

import re
import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

# Thai phone number pattern: 0XX-XXXXXXX (10 digits starting with 0)
_THAI_PHONE_RE = re.compile(r"^0\d{9}$")

# Thai ID card: 13 digits (basic structural check — checksum validation in service)
_THAI_ID_CARD_RE = re.compile(r"^\d{13}$")


class CreateTenantRequest(BaseModel):
    """Request body for POST /api/v1/tenants.

    Validation:
        - ``phone`` must be a valid Thai phone number (10 digits, starts with 0).
        - ``id_card_number`` must be 13 digits (Thai national ID format).
        - ``email`` is optional but must be valid if provided.
    """

    model_config = ConfigDict(strict=True, extra="forbid")

    # strict=False override: UUIDs always arrive as JSON strings over HTTP —
    # model-level strict=True would reject every request since Pydantic v2's
    # strict mode requires an already-parsed UUID instance, not a string.
    property_id: uuid.UUID = Field(strict=False)
    full_name: str = Field(..., min_length=1, max_length=255)
    id_card_number: str = Field(..., min_length=13, max_length=13)
    phone: str = Field(..., min_length=10, max_length=10)
    email: str | None = Field(None, max_length=255)
    emergency_contact_name: str | None = Field(None, max_length=255)
    emergency_contact_phone: str | None = Field(None, max_length=20)

    @field_validator("phone")
    @classmethod
    def validate_thai_phone(cls, v: str) -> str:
        if not _THAI_PHONE_RE.match(v):
            raise ValueError("Invalid Thai phone number format (expecting 0XXXXXXXXX)")
        return v

    @field_validator("id_card_number")
    @classmethod
    def validate_id_card(cls, v: str) -> str:
        if not _THAI_ID_CARD_RE.match(v):
            raise ValueError("Thai ID card must be exactly 13 digits")
        # Basic checksum validation (last digit is a check digit)
        if not cls._verify_id_card_checksum(v):
            raise ValueError("Invalid Thai ID card checksum")
        return v

    @staticmethod
    def _verify_id_card_checksum(card_id: str) -> bool:
        """Verify the 13th digit check digit of a Thai national ID card."""
        if len(card_id) != 13 or not card_id.isdigit():
            return False
        digits = [int(d) for d in card_id]
        total = sum((13 - i) * digits[i] for i in range(12))
        check_digit = (11 - (total % 11)) % 10
        return check_digit == digits[12]


class TenantResponse(BaseModel):
    """Response body for a single Tenant resource (SDD §3.1 format).

    **Security:** ``id_card_number_encrypted`` is deliberately omitted.
    Sensitive personal data is never returned through the API.
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    property_id: uuid.UUID
    full_name: str
    phone: str
    email: str | None = None
    emergency_contact_name: str | None = None
    emergency_contact_phone: str | None = None
    created_at: datetime


class TenantCreateResponse(BaseModel):
    """Wrapper for 201 CREATED response (SDD §3.1)."""

    data: TenantResponse
    meta: None = None


class TenantListResponse(BaseModel):
    """List wrapper for tenants (SDD §3.1)."""

    data: list[TenantResponse]
    meta: dict[str, Any] | None = None
