"""Property and Room HTTP routes (SDD §2.2, §3.3).

References:
- SDD.md §2.2: Property Module Specification (FR-PROP-01, FR-PROP-05, FR-PROP-06)
- SDD.md §3.3: Complete API Contract — response format, status codes
- CODE_STYLE.md §4.1: Router structure, dependency injection
"""

from http import HTTPStatus

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.property.schemas import (
    CreatePropertyRequest,
    PropertyCreateResponse,
    PropertyListResponse,
    PropertyWithRoomsResponse,
    RoomResponse,
    UpdateRoomStatusRequest,
)
from app.modules.property.services.property_service import PropertyService
from app.shared.deps import get_db, get_current_user

router = APIRouter(prefix="/api/v1", tags=["property"])


@router.get(
    "/properties/{property_id}",
    response_model=PropertyCreateResponse,
    status_code=HTTPStatus.OK,
    summary="Get property by ID (FR-PROP-02)",
)
async def get_property(
    property_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> PropertyCreateResponse:
    """Retrieve a single property by its UUID.

    Returns 404 if the property does not exist.
    """
    service = PropertyService(db)
    property_obj = await service.get_property_by_id(property_id)

    from app.modules.property.schemas import PropertyResponse as _PropertyResponse

    return PropertyCreateResponse(
        data=_PropertyResponse.model_validate(property_obj),
    )


@router.get(
    "/properties",
    response_model=PropertyListResponse,
    status_code=HTTPStatus.OK,
    summary="List all properties",
)
async def list_properties(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> PropertyListResponse:
    """GET /api/v1/properties — list all properties."""
    service = PropertyService(db)
    properties = await service.list_properties()
    from app.modules.property.schemas import PropertyResponse as _PR
    return PropertyListResponse(
        data=[_PR.model_validate(p) for p in properties],
    )


@router.post(
    "/properties",
    response_model=PropertyCreateResponse,
    status_code=HTTPStatus.CREATED,
    summary="Create a new property (FR-PROP-01)",
)
async def create_property(
    payload: CreatePropertyRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> PropertyCreateResponse:
    """Create a new property.

    The caller becomes the owner of the property.
    Audit log is recorded automatically by the service.
    """
    service = PropertyService(db)
    user_id_str: str = current_user["user_id"]
    user_id = user_id_str  # already a string, keep as-is for now

    # The current_user dict has user_id as str; PropertyService expects uuid.UUID
    import uuid as _uuid_module

    property_obj = await service.create_property(
        name=payload.name,
        address=payload.address,
        billing_due_day=payload.billing_due_day,
        min_deposit_months=payload.min_deposit_months,
        created_by=_uuid_module.UUID(user_id),
    )

    from app.modules.property.schemas import PropertyResponse as _PropertyResponse

    return PropertyCreateResponse(
        data=_PropertyResponse.model_validate(property_obj),
    )


@router.get(
    "/properties/{property_id}/rooms",
    response_model=PropertyWithRoomsResponse,
    status_code=HTTPStatus.OK,
    summary="Get property with all its rooms (FR-PROP-06)",
)
async def get_property_rooms(
    property_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> PropertyWithRoomsResponse:
    """Retrieve a property with its full room list."""
    import uuid as _uuid_module

    service = PropertyService(db)
    property_obj, rooms = await service.get_property_with_rooms(
        _uuid_module.UUID(property_id),
    )

    from app.modules.property.schemas import PropertyResponse as _PropertyResponse

    return PropertyWithRoomsResponse(
        property=_PropertyResponse.model_validate(property_obj),
        rooms=[RoomResponse.model_validate(r) for r in rooms],
    )


@router.patch(
    "/rooms/{room_id}/status",
    response_model=dict,
    status_code=HTTPStatus.OK,
    summary="Update room status (FR-PROP-05)",
)
async def update_room_status(
    room_id: str,
    payload: UpdateRoomStatusRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> dict:
    """Update a room's current status (available/occupied/maintenance).

    Audit log is recorded automatically by the service.
    """
    import uuid as _uuid_module

    service = PropertyService(db)
    user_id: str = current_user["user_id"]

    room = await service.update_room_status(
        room_id=_uuid_module.UUID(room_id),
        new_status=payload.status,
        changed_by=_uuid_module.UUID(user_id),
    )

    return {"data": RoomResponse.model_validate(room).model_dump(), "meta": None}