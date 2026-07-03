"""Dependency injection helpers (SDD.md §9.1, §3.3)."""

from typing import Annotated

from fastapi import Depends, status
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