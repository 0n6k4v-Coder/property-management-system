"""Pydantic v2 request/response schemas for Maintenance module (SDD §2.5, §3.1).

References:
    - SDD.md §2.5: Maintenance Module Specification
    - SDD.md §3.1: API Conventions
    - BR-08: Request tied to room + user (audit)
    - BR-09: Status workflow validation
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.modules.maintenance.constants import MaintenanceStatus, Priority

# ── Request Schemas ────────────────────────────────────────────────────


class CreateMaintenanceRequest(BaseModel):
    """Request body for POST /api/v1/maintenance-requests.

    Validation:
        - ``title``: min 3 characters.
        - ``description``: min 10 characters.
        - ``priority``: must be a valid Priority enum value.
        - ``room_id``: must be a valid UUID.
        - ``images``: max 5 (future).
    """

    model_config = ConfigDict(extra="forbid")

    room_id: uuid.UUID
    property_id: uuid.UUID
    title: str = Field(..., min_length=3, max_length=255)
    description: str = Field(..., min_length=10)
    priority: Priority = Priority.MEDIUM


class UpdateMaintenanceStatusRequest(BaseModel):
    """Request body for PATCH /api/v1/maintenance-requests/{id}/status.

    Validation:
        - ``status``: must be a valid MaintenanceStatus enum value.
        - BR-09 enforced in service layer.
    """

    model_config = ConfigDict(extra="forbid")

    status: MaintenanceStatus


class AssignMaintenanceRequest(BaseModel):
    """Request body for PATCH /api/v1/maintenance-requests/{id}/assign."""

    model_config = ConfigDict(extra="forbid")

    assigned_to: uuid.UUID


# ── Response Schemas ───────────────────────────────────────────────────


class MaintenanceResponse(BaseModel):
    """Response body for a single MaintenanceRequest resource (SDD §3.1)."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    property_id: uuid.UUID
    room_id: uuid.UUID
    title: str
    description: str
    priority: Priority
    status: MaintenanceStatus
    assigned_to: uuid.UUID | None = None
    created_by: uuid.UUID | None = None
    created_at: datetime
    updated_at: datetime


class MaintenanceCreateResponse(BaseModel):
    """Wrapper for 201 CREATED response (SDD §3.1)."""

    data: MaintenanceResponse
    meta: None = None


class MaintenanceListResponse(BaseModel):
    """List wrapper for maintenance requests (SDD §3.1)."""

    data: list[MaintenanceResponse]
    meta: dict | None = None
