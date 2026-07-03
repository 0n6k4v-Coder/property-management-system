"""Maintenance REST API endpoints — 4 routes (SDD §2.5, §3.3).

References:
    - SDD.md §3.3: Critical Endpoint Specifications
    - CODE_STYLE.md §3.4: Router layer responsibility
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.maintenance.schemas import (
    MaintenanceCreateResponse,
    MaintenanceListResponse,
    MaintenanceResponse,
    CreateMaintenanceRequest,
    UpdateMaintenanceStatusRequest,
    AssignMaintenanceRequest,
)
from app.modules.maintenance.services.maintenance_service import MaintenanceService
from app.shared.deps import get_current_user, get_db

router = APIRouter(prefix="/api/v1", tags=["maintenance"])


@router.post(
    "/maintenance-requests",
    response_model=MaintenanceCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a maintenance request",
)
async def create_maintenance_request(
    body: CreateMaintenanceRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
) -> dict:
    """POST /api/v1/maintenance-requests — SDD §3.3."""
    service = MaintenanceService(db)
    request = await service.create_request(
        property_id=body.property_id,
        room_id=body.room_id,
        title=body.title,
        description=body.description,
        created_by=uuid.UUID(current_user["user_id"]),
        priority=body.priority,
    )
    return {"data": MaintenanceResponse.model_validate(request), "meta": None}


@router.get(
    "/maintenance-requests/pending",
    response_model=MaintenanceListResponse,
    summary="List pending maintenance requests by property",
)
async def list_pending_requests(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    property_id: uuid.UUID = Query(..., description="Filter by property"),
) -> dict:
    """GET /api/v1/maintenance-requests/pending — SDD §3.3."""
    service = MaintenanceService(db)
    requests = await service.get_pending_by_property(property_id)
    return {
        "data": [MaintenanceResponse.model_validate(r) for r in requests],
        "meta": None,
    }


@router.get(
    "/maintenance-requests/{request_id}",
    response_model=MaintenanceCreateResponse,
    summary="Get a maintenance request by ID",
)
async def get_maintenance_request(
    request_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
) -> dict:
    """GET /api/v1/maintenance-requests/{id} — SDD §3.3."""
    service = MaintenanceService(db)
    request = await service.get_request(request_id)
    return {"data": MaintenanceResponse.model_validate(request), "meta": None}


@router.patch(
    "/maintenance-requests/{request_id}/status",
    response_model=MaintenanceCreateResponse,
    summary="Update maintenance request status",
    description="Updates status per BR-09 workflow: pending → in_progress → resolved/cancelled.",
)
async def update_maintenance_status(
    request_id: uuid.UUID,
    body: UpdateMaintenanceStatusRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
) -> dict:
    """PATCH /api/v1/maintenance-requests/{id}/status — SDD §3.3."""
    service = MaintenanceService(db)
    request = await service.update_status(
        request_id=request_id,
        new_status=body.status,
        changed_by=uuid.UUID(current_user["user_id"]),
    )
    return {"data": MaintenanceResponse.model_validate(request), "meta": None}


@router.patch(
    "/maintenance-requests/{request_id}/assign",
    response_model=MaintenanceCreateResponse,
    summary="Assign a maintenance request to a user",
)
async def assign_maintenance_request(
    request_id: uuid.UUID,
    body: AssignMaintenanceRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
) -> dict:
    """PATCH /api/v1/maintenance-requests/{id}/assign."""
    service = MaintenanceService(db)
    request = await service.assign_to(
        request_id=request_id,
        assigned_to=body.assigned_to,
        assigned_by=uuid.UUID(current_user["user_id"]),
    )
    return {"data": MaintenanceResponse.model_validate(request), "meta": None}