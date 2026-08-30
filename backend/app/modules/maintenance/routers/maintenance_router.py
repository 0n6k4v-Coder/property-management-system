"""Maintenance REST API endpoints — 5 routes (SDD §2.5, §3.3).

References:
    - SDD.md §3.3: Critical Endpoint Specifications
    - CODE_STYLE.md §3.4: Router layer responsibility

Implements the Target Design from docs/API.md fixing anti-patterns #5, #1, #20:
- #5  authorization: all *** endpoints require auth + property scope
- #1  idempotency: POST /maintenance/ accepts Idempotency-Key header
- #20 Cache-Control: private, no-store on GET /pending and GET /{id}
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Header, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.maintenance.repository import MaintenanceRepository
from app.modules.maintenance.schemas import (
    AssignMaintenanceRequest,
    CreateMaintenanceRequest,
    MaintenanceCreateResponse,
    MaintenanceListResponse,
    MaintenanceResponse,
    UpdateMaintenanceStatusRequest,
)
from app.modules.maintenance.services.maintenance_service import MaintenanceService
from app.shared.database import get_db
from app.shared.deps import (
    CurrentUser,
    ensure_property_scope,
    get_current_user,
    require_property_scope,
)
from app.shared.idempotency import check_idempotency, store_idempotency

router = APIRouter(tags=["maintenance"], redirect_slashes=False)

# Module-level constants for FastAPI dependencies (fixes B008 mutable default)
GET_DB = Depends(get_db)
GET_CURRENT_USER = Depends(get_current_user)
QUERY_PROPERTY_ID = Query(..., description="Filter by property")
QUERY_LIMIT_12 = Query(12, ge=1, le=100, description="Max readings to return (1-100)")


# ── POST /maintenance/ ──────────────────────────────────────────────

@router.post(
    "/",
    response_model=MaintenanceCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a maintenance request",
)
@router.post(
    "",
    response_model=MaintenanceCreateResponse,
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False,
)
async def create_maintenance_request(
    body: CreateMaintenanceRequest,
    _: Annotated[None, require_property_scope()],
    current_user: Annotated[CurrentUser, GET_CURRENT_USER],
    db: AsyncSession = GET_DB,
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> MaintenanceCreateResponse:
    """Create a new maintenance request (BR-08).

    Authorization (fixes #5): ``property_id`` is in the body, so
    ``require_property_scope()`` (body-sourced form) enforces it directly.
    Idempotency (fixes #1): an optional ``Idempotency-Key`` header replays a
    prior 201 within the 24h dedupe window; reusing a key with a different
    body raises ``409 VAL-409``.
    """
    if idempotency_key:
        cached = await check_idempotency(
            db,
            idempotency_key,
            "POST:/api/v1/maintenance/",
            body.model_dump(mode="json"),
        )
        if cached is not None:
            return MaintenanceCreateResponse.model_validate(cached)

    service = MaintenanceService(db)
    request = await service.create_request(
        property_id=body.property_id,
        room_id=body.room_id,
        title=body.title,
        description=body.description,
        created_by=uuid.UUID(current_user["user_id"]),
        priority=body.priority,
    )
    response = MaintenanceCreateResponse(data=MaintenanceResponse.model_validate(request))

    if idempotency_key:
        await store_idempotency(
            db,
            idempotency_key,
            "POST:/api/v1/maintenance/",
            body.model_dump(mode="json"),
            response.model_dump(mode="json"),
            MaintenanceRepository,
        )
    return response


# ── GET /maintenance/pending ────────────────────────────────────────


@router.get(
    "/pending",
    response_model=MaintenanceListResponse,
    summary="List pending maintenance requests by property",
)
async def list_pending_requests(
    response: Response,
    _: Annotated[None, require_property_scope(query_param="property_id")],
    current_user: Annotated[CurrentUser, GET_CURRENT_USER],
    property_id: uuid.UUID = QUERY_PROPERTY_ID,
    db: AsyncSession = GET_DB,
) -> MaintenanceListResponse:
    """Get pending maintenance requests for a property (fixes #5, #20).

    Authorization (#5): ``property_id`` is a required query param, checked
    via ``require_property_scope(query_param="property_id")``.
    Caching (#20): ``Cache-Control: private, no-store`` — maintenance lists
    are property-scoped and must not be shared/stored.
    """
    # Fixes #20: maintenance list must never be cached/shared.
    _ = current_user.get("user_id")
    response.headers["Cache-Control"] = "private, no-store"

    service = MaintenanceService(db)
    requests = await service.get_pending_by_property(property_id)
    return MaintenanceListResponse(
        data=[MaintenanceResponse.model_validate(r) for r in requests],
        meta=None,
    )


# ── GET /maintenance/{request_id} ───────────────────────────────────


@router.get(
    "/{request_id}",
    response_model=MaintenanceCreateResponse,
    summary="Get a maintenance request by ID",
)
async def get_maintenance_request(
    current_user: Annotated[CurrentUser, GET_CURRENT_USER],
    response: Response,
    request_id: uuid.UUID,
    db: AsyncSession = GET_DB,
) -> MaintenanceCreateResponse:
    """Get a single maintenance request by ID (fixes #5, #20).

    Authorization (#5): the request's ``property_id`` is resolved and checked
    via ``user_has_property_scope`` (resolve-then-check pattern).
    Caching (#20): ``Cache-Control: private, no-store``.
    """
    # Fixes #20: maintenance detail must never be cached/shared.
    response.headers["Cache-Control"] = "private, no-store"

    repo = MaintenanceRepository(db)
    prop_id: uuid.UUID | None = await repo.get_request_property_id(request_id)
    await ensure_property_scope(current_user, db, prop_id)

    service = MaintenanceService(db)
    request = await service.get_request(request_id)
    return MaintenanceCreateResponse(data=MaintenanceResponse.model_validate(request))


# ── PATCH /maintenance/{request_id}/status ──────────────────────────


@router.patch(
    "/{request_id}/status",
    response_model=MaintenanceCreateResponse,
    summary="Update maintenance request status",
    description="Updates status per BR-09 workflow: pending → in_progress → resolved/cancelled.",
)
async def update_maintenance_status(
    current_user: Annotated[CurrentUser, GET_CURRENT_USER],
    request_id: uuid.UUID,
    body: UpdateMaintenanceStatusRequest,
    db: AsyncSession = GET_DB,
) -> MaintenanceCreateResponse:
    """Update the status of a maintenance request (fixes #5).

    Authorization (#5): the request's ``property_id`` is resolved and checked
    via ``user_has_property_scope`` (resolve-then-check pattern).
    """
    repo = MaintenanceRepository(db)
    prop_id: uuid.UUID | None = await repo.get_request_property_id(request_id)
    await ensure_property_scope(current_user, db, prop_id)

    service = MaintenanceService(db)
    request = await service.update_status(
        request_id=request_id,
        new_status=body.status,
        changed_by=uuid.UUID(current_user["user_id"]),
    )
    return MaintenanceCreateResponse(data=MaintenanceResponse.model_validate(request))


# ── PATCH /maintenance/{request_id}/assign ──────────────────────────


@router.patch(
    "/{request_id}/assign",
    response_model=MaintenanceCreateResponse,
    summary="Assign a maintenance request to a user",
)
async def assign_maintenance_request(
    current_user: Annotated[CurrentUser, GET_CURRENT_USER],
    request_id: uuid.UUID,
    body: AssignMaintenanceRequest,
    db: AsyncSession = GET_DB,
) -> MaintenanceCreateResponse:
    """Assign a maintenance request to a user (fixes #5).

    Authorization (#5): the request's ``property_id`` is resolved and checked
    via ``user_has_property_scope`` (resolve-then-check pattern).
    """
    repo = MaintenanceRepository(db)
    prop_id: uuid.UUID | None = await repo.get_request_property_id(request_id)
    await ensure_property_scope(current_user, db, prop_id)

    service = MaintenanceService(db)
    request = await service.assign_to(
        request_id=request_id,
        assigned_to=body.assigned_to,
        assigned_by=uuid.UUID(current_user["user_id"]),
    )
    return MaintenanceCreateResponse(data=MaintenanceResponse.model_validate(request))

