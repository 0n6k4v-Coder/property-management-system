"""Dependency injection helpers (SDD.md §9.1, §3.3)."""

from typing import Annotated

from fastapi import Depends, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.shared.database import get_db
from app.shared.exceptions import APIError
from app.shared.security import verify_token

security = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Extract and verify the current user from the JWT bearer token.

    Validates the ``Authorization: Bearer <token>`` header, decodes the
    JWT payload, and returns the token claims as a dictionary.

    Returns
    -------
    dict
        Decoded JWT payload containing ``user_id``, ``email``, and
        ``property_scopes`` claims.

    Raises
    ------
    APIError
        If the ``Authorization`` header is missing (401 AUTH-009) or
        the token is invalid/expired (401 AUTH-009).
    """
    if not credentials:
        raise APIError(
            code="AUTH-009",
            message="Invalid or expired access token",
            status_code=status.HTTP_401_UNAUTHORIZED,
            details={"www_authenticate": "Bearer"},
        )

    payload = await verify_token(credentials.credentials, db)
    if not payload:
        raise APIError(
            code="AUTH-009",
            message="Invalid or expired access token",
            status_code=status.HTTP_401_UNAUTHORIZED,
            details={"www_authenticate": "Bearer"},
        )

    return payload


# Type-annotated dependency for FastAPI routes
CurrentUser = Annotated[dict, Depends(get_current_user)]


def require_property_scope():
    """Build a FastAPI dependency enforcing property scope for ``/invite``.

    The ``property_id`` to check is read from the request body (the same
    JSON the endpoint's ``InviteRequest`` parsed).  The dependency raises
    ``AUTH-005`` (403) unless the caller is a global owner/admin or holds
    a ``user_property_scopes`` row for that property.  The check reads the
    live DB so scope changes take effect immediately.

    Usage::

        @router.post("/invite")
        async def invite(
            payload: InviteRequest,
            _: Annotated[None, require_property_scope()],
        ): ...
    """

    async def _enforce(
        current_user: Annotated[dict, Depends(get_current_user)],
        request: Request,
        db: Annotated[AsyncSession, Depends(get_db)],
    ) -> None:
        import uuid as _uuid

        from app.modules.auth.constants import AUTH_005
        from app.modules.auth.repository import UserRepository

        # Read property_id from the buffered request body (FastAPI has
        # already read it for the InviteRequest parse above).
        try:
            body = await request.json()
            property_id = _uuid.UUID(body.get("property_id"))
        except Exception:
            raise APIError(
                code="AUTH-005",
                message=AUTH_005,
                status_code=status.HTTP_403_FORBIDDEN,
            ) from None

        # Global owner/admin bypass (schema-free admin allowlist).
        if current_user.get("is_owner") or current_user.get("is_superuser"):
            return

        user_id = current_user.get("user_id")
        if not user_id:
            raise APIError(
                code="AUTH-005",
                message=AUTH_005,
                status_code=status.HTTP_403_FORBIDDEN,
            )

        repo = UserRepository(db)
        scopes = await repo.get_property_scopes(_uuid.UUID(user_id))
        if any(s.property_id == property_id for s in scopes):
            return

        raise APIError(
            code="AUTH-005",
            message=AUTH_005,
            status_code=status.HTTP_403_FORBIDDEN,
        )

    return Depends(_enforce)
