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

from fastapi import APIRouter, Depends, Header, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.schemas import (
    AuthRequest,
    InviteRequest,
    InviteResponse,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
)
from app.modules.auth.services.auth_service import AuthService
from app.modules.auth.services.invite_service import InviteService
from app.shared.deps import CurrentUser as CurrentUserDep
from app.shared.deps import get_db, require_property_scope
from app.shared.idempotency import check_idempotency, store_idempotency

router = APIRouter(tags=["auth"])


def _user_response_from_scopes(
    *,
    id,
    email,
    full_name,
    property_scopes: list[str],
    is_active: bool,
) -> dict:
    """Build the ``user`` sub-document with REAL ``property_scopes``.

    ``property_scopes`` comes from the token claim (populated from
    ``user_property_scopes`` at login/refresh time), not from a
    hardcoded empty list (anti-pattern #5 fix).
    """
    return UserResponse(
        id=id,
        email=email,
        full_name=full_name,
        property_scopes=[str(s) for s in property_scopes],
        is_active=is_active,
    ).model_dump(mode="json")


@router.post("/login", status_code=status.HTTP_200_OK)
async def login(
    payload: AuthRequest,
    request: Request,
    response: Response,
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
    429
        ``{"error": {"code": "SYS-429", "message": "Too many requests"}}`` (per-route limiter)
    """
    from app.middleware.rate_limit import login_rate_limit, set_rate_limit_headers

    allowed, limit, remaining, retry_after = await login_rate_limit(request)
    set_rate_limit_headers(response, limit, remaining, retry_after)
    if not allowed:
        from app.shared.exceptions import APIError

        raise APIError(
            code="SYS-429",
            message="Too many requests. Please try again later.",
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            details={},
        )

    service = AuthService(db)
    user, tokens = await service.authenticate(payload.email, payload.password)
    # ``_build_user_response`` populates ``property_scopes`` from the real
    # ``user_property_scopes`` rows (anti-pattern #5 fix) — not hardcoded [].
    user_doc = await service._build_user_response(user)
    return {
        "data": {
            "access_token": tokens["access"],
            "refresh_token": tokens["refresh"],
            "user": user_doc,
        },
    }


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(
    payload: RegisterRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> dict:
    """Accept an invitation and create a new user account (FR-USER-02).

    Supports optional ``Idempotency-Key`` header: a repeated request with
    the same key within 24h replays the original ``201`` response instead
    of re-executing the create (anti-pattern #1 fix).

    Request body
    ------------
    .. code-block:: json

        {"invite_token": "...", "full_name": "...", "password": "...", "phone": "..."}

    Responses
    ---------
    201
        ``{"data": {"id": "...", "email": "...", "full_name": "...", "property_scopes": [...], "is_active": true}}``
    400
        ``{"error": {"code": "VAL-001", "message": "..."}}`` (validation error)
    409
        ``{"error": {"code": "AUTH-004", "message": "Email already in use"}}``
    """
    from app.modules.auth.repository import UserRepository

    cache_key = None
    if idempotency_key:
        cache_key = await check_idempotency(
            db, idempotency_key, "POST:/api/v1/auth/register", payload.model_dump(mode="json")
        )
        if cache_key is not None:
            return cache_key

    invite_service = InviteService(db)
    user = await invite_service.accept_invite(
        token=payload.invite_token,
        password=payload.password,
        full_name=payload.full_name,
        phone=payload.phone,
    )

    body = {
        "data": _user_response_from_scopes(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            property_scopes=[],
            is_active=user.is_active,
        )
    }

    if idempotency_key:
        await store_idempotency(
            db, idempotency_key, "POST:/api/v1/auth/register",
            payload.model_dump(mode="json"), body,
            UserRepository,
        )
    return body


@router.post("/invite", status_code=status.HTTP_201_CREATED)
async def invite(
    payload: InviteRequest,
    _: Annotated[None, require_property_scope()],
    current_user: CurrentUserDep,
    db: Annotated[AsyncSession, Depends(get_db)],
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> dict:
    """Send an invitation link to a new user (FR-USER-02).

    Requires the current user to have sufficient property scope for
    ``payload.property_id`` (raises ``403 AUTH-005`` otherwise) — see
    ``require_property_scope`` (anti-pattern #5 fix).  Supports the
    ``Idempotency-Key`` header like ``/register`` (anti-pattern #1 fix).

    Request body
    ------------
    .. code-block:: json

        {"email": "...", "property_id": "..."}

    Responses
    ---------
    201
        ``{"data": {"invite_link": "...", "property_id": "...", "expires_at": "..."}}``
    403
        ``{"error": {"code": "AUTH-005", "message": "Insufficient property scope"}}``
    409
        ``{"error": {"code": "AUTH-004", "message": "Email already in use"}}``
    """
    import uuid as _uuid

    from app.modules.auth.repository import UserRepository

    cache_key = None
    if idempotency_key:
        cache_key = await check_idempotency(
            db, idempotency_key, "POST:/api/v1/auth/invite", payload.model_dump(mode="json")
        )
        if cache_key is not None:
            return cache_key

    inviter_id_str = current_user.get("user_id")
    invite_service = InviteService(db)
    result = await invite_service.create_invite(
        email=payload.email,
        property_id=payload.property_id,
        inviter_id=_uuid.UUID(inviter_id_str) if inviter_id_str else _uuid.uuid4(),
    )

    body = {
        "data": InviteResponse(
            invite_link=result["invite_link"],
            property_id=payload.property_id,
            expires_at=result["expires_at"],
        ).model_dump(mode="json")
    }

    if idempotency_key:
        await store_idempotency(
            db, idempotency_key, "POST:/api/v1/auth/invite",
            payload.model_dump(mode="json"), body,
            UserRepository,
        )
    return body


@router.post("/refresh", status_code=status.HTTP_200_OK)
async def refresh(
    payload: RefreshRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Issue a new token set from a valid refresh token (FR-USER-03).

    Body is the strict ``RefreshRequest`` schema (anti-pattern #7 fix).
    Response returns the full ``TokenResponse`` (access + rotated refresh
    + user) and invalidates the presented refresh token via rotation
    (anti-pattern #11 fix).

    Request body
    ------------
    .. code-block:: json

        {"refresh_token": "..."}

    Responses
    ---------
    200
        ``{"data": {"access_token": "...", "refresh_token": "...", "user": {...}}}``
    401
        ``{"error": {"code": "AUTH-007", "message": "Invalid or expired refresh token"}}``
    """
    service = AuthService(db)
    result = await service.refresh_access_token(payload.refresh_token)
    return {
        "data": TokenResponse(
            access_token=result["access"],
            refresh_token=result["refresh"],
            user=_user_response_from_scopes(
                id=result["user"]["id"],
                email=result["user"]["email"],
                full_name=result["user"]["full_name"],
                property_scopes=result["user"]["property_scopes"],
                is_active=result["user"]["is_active"],
            ),
        ).model_dump(mode="json"),
    }


@router.get("/me", status_code=status.HTTP_200_OK)
async def get_me(
    current_user: CurrentUserDep,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Return the authenticated user's profile (FR-USER-01).

    Requires a valid Bearer token in the ``Authorization`` header.
    ``property_scopes`` reflects the real claim from the token.

    Responses
    ---------
    200
        ``{"data": {"id": "...", "email": "...", "full_name": "...", "property_scopes": [...], "is_active": true}}``
    401
        ``{"error": {"code": "AUTH-009", "message": "Invalid or expired access token"}}``
    """
    service = AuthService(db)
    user = await service.get_current_user_info(current_user)
    return {
        "data": _user_response_from_scopes(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            property_scopes=current_user.get("property_scopes", []),
            is_active=user.is_active,
        )
    }
