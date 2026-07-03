"""Auth HTTP routes — 5 endpoints for authentication (SDD.md §3.3).

This module registers the ``/api/v1/auth/*`` router on the FastAPI
application.  Each endpoint delegates to the appropriate service layer
and returns responses in the standard ``{"data": {...}}`` or
``{"error": {...}}`` envelope.

References:
    - SDD.md §3.3: Complete API contract for auth endpoints
    - SDD.md §2.1: Auth module specification (FR-USER-01~03)
    - CODE_STYLE.md §4.1: Router structure patterns
"""

from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.schemas import (
    AuthRequest,
    InviteRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
)
from app.modules.auth.services.auth_service import AuthService
from app.modules.auth.services.invite_service import InviteService
from app.shared.deps import CurrentUser as CurrentUserDep
from app.shared.deps import get_db

router = APIRouter(tags=["auth"])


@router.post("/login", status_code=status.HTTP_200_OK)
async def login(
    payload: AuthRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Authenticate user and return JWT tokens (FR-USER-01).

    Request body
    ------------
    .. code-block:: json

        {"email": "...", "password": "..."}

    Responses
    ---------
    200
        ``{"data": {"access_token": "...", "refresh_token": "...", "user": {...}}}``
    401
        ``{"error": {"code": "AUTH-001", "message": "Invalid email or password"}}``
    403
        ``{"error": {"code": "AUTH-002", "message": "Account is not active"}}``
    """
    service = AuthService(db)
    user, tokens = await service.authenticate(payload.email, payload.password)
    return {
        "data": {
            "access_token": tokens["access"],
            "refresh_token": tokens["refresh"],
            "user": UserResponse(
                id=user.id,
                email=user.email,
                full_name=user.full_name,
                property_scopes=[],
                is_active=user.is_active,
            ).model_dump(mode="json"),
        },
    }


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(
    payload: RegisterRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Accept an invitation and create a new user account (FR-USER-02).

    Request body
    ------------
    .. code-block:: json

        {"invite_token": "...", "full_name": "...", "password": "...", "phone": "..."}

    Responses
    ---------
    201
        ``{"data": {"id": "...", "email": "...", "full_name": "...", "property_scopes": [], "is_active": true}}``
    400
        ``{"error": {"code": "VAL-400", "message": "..."}}`` (validation error)
    409
        ``{"error": {"code": "AUTH-004", "message": "Email already in use"}}``
    """
    invite_service = InviteService(db)
    user = await invite_service.accept_invite(
        token=payload.invite_token,
        password=payload.password,
        full_name=payload.full_name,
        phone=payload.phone,
    )
    return {
        "data": UserResponse(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            property_scopes=[],
            is_active=user.is_active,
        ).model_dump(mode="json"),
    }


@router.post("/invite", status_code=status.HTTP_201_CREATED)
async def invite(
    payload: InviteRequest,
    current_user: CurrentUserDep,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Send an invitation link to a new user (FR-USER-02).

    Requires the current user to have sufficient property scope
    (validated in the service layer).

    Request body
    ------------
    .. code-block:: json

        {"email": "...", "property_id": "..."}

    Responses
    ---------
    201
        ``{"data": {"invite_link": "..."}}``
    403
        ``{"error": {"code": "AUTH-005", "message": "Insufficient property scope"}}``
    409
        ``{"error": {"code": "AUTH-004", "message": "Email already in use"}}``
    """
    import uuid as _uuid

    inviter_id_str = current_user.get("user_id")
    invite_service = InviteService(db)
    invite_link = await invite_service.create_invite(
        email=payload.email,
        property_id=payload.property_id,
        inviter_id=_uuid.UUID(inviter_id_str) if inviter_id_str else _uuid.uuid4(),
    )
    return {"data": {"invite_link": invite_link}}


@router.post("/refresh", status_code=status.HTTP_200_OK)
async def refresh(
    payload: dict,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Issue a new access token from a valid refresh token (FR-USER-03).

    Request body
    ------------
    .. code-block:: json

        {"refresh_token": "..."}

    Responses
    ---------
    200
        ``{"data": {"access_token": "..."}}``
    401
        ``{"error": {"code": "AUTH-007", "message": "Invalid or expired refresh token"}}``
    """
    refresh_token = payload.get("refresh_token", "")
    service = AuthService(db)
    tokens = await service.refresh_access_token(refresh_token)
    return {"data": {"access_token": tokens["access"]}}


@router.get("/me", status_code=status.HTTP_200_OK)
async def get_me(
    current_user: CurrentUserDep,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Return the authenticated user's profile (FR-USER-01).

    Requires a valid Bearer token in the ``Authorization`` header.

    Responses
    ---------
    200
        ``{"data": {"id": "...", "email": "...", "full_name": "...", "property_scopes": [], "is_active": true}}``
    401
        ``{"error": {"code": "AUTH-009", "message": "Invalid or expired access token"}}``
    """
    service = AuthService(db)
    user = await service.get_current_user_info(current_user)
    return {
        "data": UserResponse(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            property_scopes=[],
            is_active=user.is_active,
        ).model_dump(mode="json"),
    }