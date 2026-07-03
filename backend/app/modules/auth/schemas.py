"""Pydantic request/response schemas for auth module (SDD.md §2.1, §3.3)."""

import re
import uuid

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class AuthRequest(BaseModel):
    """Payload for ``POST /api/v1/auth/login`` (SDD §3.3).

    Validates that the password meets minimum length and complexity
    requirements before reaching the service layer.
    """

    model_config = ConfigDict(strict=True, extra="forbid")

    email: EmailStr = Field(..., max_length=255)
    password: str = Field(..., min_length=8)

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        """Ensure password contains at least one uppercase letter and one digit."""
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one digit")
        return v


class RegisterRequest(BaseModel):
    """Payload for ``POST /api/v1/auth/register`` (SDD §3.3).

    Carries the invite token alongside the new user's profile data.
    """

    model_config = ConfigDict(strict=True, extra="forbid")

    invite_token: str
    full_name: str = Field(..., min_length=2, max_length=255)
    password: str = Field(..., min_length=8)
    phone: str = Field(..., min_length=10, max_length=15)

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        """Ensure password contains at least one uppercase letter and one digit."""
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one digit")
        return v


class InviteRequest(BaseModel):
    """Payload for ``POST /api/v1/auth/invite`` (SDD §3.3).

    An admin sends an invitation for a specific email address and property.

    .. note::
       Not strict so that string-encoded UUIDs from JSON deserialisation
       are automatically coerced to ``uuid.UUID``.
    """

    model_config = ConfigDict(extra="forbid")

    email: EmailStr = Field(..., max_length=255)
    property_id: uuid.UUID


class UserResponse(BaseModel):
    """Standardised user payload returned in API responses (SDD §3.3).

    Built from the ORM model via ``from_attributes``.  Sensitive fields
    such as ``password_hash`` are intentionally excluded.
    """

    model_config = ConfigDict(from_attributes=True, strict=True)

    id: uuid.UUID
    email: EmailStr
    full_name: str
    property_scopes: list[uuid.UUID]
    is_active: bool


class TokenResponse(BaseModel):
    """Response body for ``POST /api/v1/auth/login`` and ``/refresh`` (SDD §3.3).

    Contains the access token, a refresh token for rotation, and the
    serialised user object.
    """

    model_config = ConfigDict(strict=True)

    access_token: str
    refresh_token: str
    user: UserResponse
