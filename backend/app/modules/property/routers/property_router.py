"""Property and Room HTTP routes (SDD §2.2, §3.3).

Implements the "Proposed Redesign — Property & Rooms Module" target design
from ``docs/API.md`` fixing API anti-patterns #5, #3, #13, #11, #10, #1:

- #5  authorization via ``require_property_scope`` + scope-filtered list +
      auto-owner grant on create.
- #3  ``property_id``/``room_id`` typed as ``uuid.UUID`` (clean 422, no 500).
- #13 pagination on the list + rooms endpoints.
- #11 room-status nested under ``/{property_id}/rooms/{room_id}/status``;
      dedicated ``PropertyDetailResponse``; standard ``{data, meta}`` envelope
      for the rooms endpoint.
- #10 ``created_by`` dropped from the public property response.
- #1  optional ``Idempotency-Key`` header on create (24h dedupe).

References:
- SDD.md §2.2, §3.3
- docs/API.md "Proposed Redesign — Property & Rooms Module"
- CODE_STYLE.md §4.1: Router structure, dependency injection
"""

import uuid
from http import HTTPStatus
from typing import Annotated

from fastapi import APIRouter, Depends, Header, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.property.schemas import (
    CreatePropertyRequest,
    PropertyCreateResponse,
    PropertyDetailResponse,
    PropertyListResponse,
    PropertyResponse,
    PropertyWithRoomsData,
    PropertyWithRoomsResponse,
    RoomResponse,
    UpdateRoomStatusRequest,
)
from app.modules.property.services.property_service import PropertyService
from app.shared.deps import (
    get_current_user,
    get_db,
    is_global_scope,
    require_property_scope,
)
from app.shared.idempotency import check_idempotency, store_idempotency

router = APIRouter(tags=["property"], redirect_slashes=False)


@router.get(
    "/{property_id}",
    response_model=PropertyDetailResponse,
    status_code=HTTPStatus.OK,
    summary="Get property by ID (FR-PROP-02)",
)
async def get_property(
    property_id: uuid.UUID,
    _: Annotated[None, require_property_scope("property_id")],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> PropertyDetailResponse:
    """Retrieve a single property by its UUID.

    Requires a property-scope row for ``property_id`` (403 AUTH-005 otherwise).
    Returns 404 if the property does not exist.
    """
    service = PropertyService(db)
    property_obj = await service.get_property_by_id(property_id)

    return PropertyDetailResponse(
        data=PropertyResponse.model_validate(property_obj),
    )


@router.get(
    "/",
    response_model=PropertyListResponse,
    status_code=HTTPStatus.OK,
    summary="List properties the caller can access (paginated)",
)
@router.get(
    "",
    response_model=PropertyListResponse,
    status_code=HTTPStatus.OK,
    include_in_schema=False,
)
async def list_properties(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
) -> PropertyListResponse:
    """GET /api/v1/properties/ — paginated list scoped to the caller.

    Only returns properties the caller holds a ``user_property_scopes`` row
    for, unless the caller is a global owner/admin (anti-pattern #5). Results
    are paginated via ``page``/``limit`` (anti-pattern #13).
    """
    service = PropertyService(db)
    is_global = is_global_scope(current_user)
    user_id_str = current_user.get("user_id")
    user_id = uuid.UUID(str(user_id_str)) if user_id_str else None

    properties, total = await service.list_properties_paginated(
        page=page,
        limit=limit,
        user_id=user_id,
        is_global=is_global,
    )

    return PropertyListResponse(
        data=[PropertyResponse.model_validate(p) for p in properties],
        meta={
            "page": page,
            "limit": limit,
            "total": total,
            "has_next": page * limit < total,
        },
    )


@router.post(
    "/",
    response_model=PropertyCreateResponse,
    status_code=HTTPStatus.CREATED,
    summary="Create a new property (FR-PROP-01)",
)
async def create_property(
    payload: CreatePropertyRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> PropertyCreateResponse:
    """Create a new property.

    The caller is auto-granted an ``owner`` scope row for the new property
    (anti-pattern #5). Supports an optional ``Idempotency-Key`` header — a
    repeat within 24h replays the original 201 response (anti-pattern #1).
    """
    from app.modules.auth.repository import UserRepository

    service = PropertyService(db)
    user_id = uuid.UUID(str(current_user["user_id"]))

    if idempotency_key:
        cached = await check_idempotency(
            db,
            idempotency_key,
            "POST:/api/v1/properties/",
            payload.model_dump(mode="json"),
        )
        if cached is not None:
            return PropertyCreateResponse.model_validate(cached)

    property_obj = await service.create_property(
        name=payload.name,
        address=payload.address,
        billing_due_day=payload.billing_due_day,
        min_deposit_months=payload.min_deposit_months,
        created_by=user_id,
    )

    response = PropertyCreateResponse(
        data=PropertyResponse.model_validate(property_obj),
    )

    if idempotency_key:
        await store_idempotency(
            db,
            idempotency_key,
            "POST:/api/v1/properties/",
            payload.model_dump(mode="json"),
            response.model_dump(mode="json"),
            UserRepository,
        )

    return response


@router.get(
    "/{property_id}/rooms",
    response_model=PropertyWithRoomsResponse,
    status_code=HTTPStatus.OK,
    summary="Get property with a page of its rooms (FR-PROP-06)",
)
async def get_property_rooms(
    property_id: uuid.UUID,
    _: Annotated[None, require_property_scope("property_id")],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
) -> PropertyWithRoomsResponse:
    """Retrieve a property with a paginated slice of its room list.

    Requires a property-scope row for ``property_id`` (403 AUTH-005 otherwise).
    Wrapped in the standard ``{data, meta}`` envelope; ``rooms`` is paginated
    while ``property`` remains a single unpaginated record.
    """
    service = PropertyService(db)
    property_obj, rooms, total = await service.get_property_with_rooms_paginated(
        property_id,
        page=page,
        limit=limit,
    )

    return PropertyWithRoomsResponse(
        data=PropertyWithRoomsData(
            property=PropertyResponse.model_validate(property_obj),
            rooms=[RoomResponse.model_validate(r) for r in rooms],
        ),
        meta={
            "page": page,
            "limit": limit,
            "total": total,
            "has_next": page * limit < total,
        },
    )


@router.patch(
    "/{property_id}/rooms/{room_id}/status",
    response_model=dict,
    status_code=HTTPStatus.OK,
    summary="Update room status (FR-PROP-05)",
)
async def update_room_status(
    property_id: uuid.UUID,
    room_id: uuid.UUID,
    payload: UpdateRoomStatusRequest,
    _: Annotated[None, require_property_scope("property_id")],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> dict:
    """Update a room's current status (available/occupied/maintenance).

    Requires a property-scope row for ``property_id`` (403 AUTH-005 otherwise).
    The room must belong to ``property_id`` (404 PROP-007 otherwise).
    Audit log is recorded automatically by the service.
    """
    service = PropertyService(db)
    user_id = uuid.UUID(str(current_user["user_id"]))

    room = await service.update_room_status(
        room_id=room_id,
        new_status=payload.status,
        changed_by=user_id,
        property_id=property_id,
    )

    return {"data": RoomResponse.model_validate(room).model_dump(mode="json"), "meta": None}
