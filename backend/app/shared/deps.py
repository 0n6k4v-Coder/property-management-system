"""Dependency injection helpers (SDD.md §9.1, §3.3)."""

import uuid
from typing import Annotated, Any

from fastapi import Depends, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.shared.database import get_db
from app.shared.exceptions import APIError
from app.shared.security import verify_token

security = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)],
) -> dict[str, Any]:
    """Extract and verify the current user from the JWT bearer token.

    Validates the ``Authorization: Bearer *** header, decodes the
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

    payload = await verify_token(credentials.credentials)
    if not payload:
        raise APIError(
            code="AUTH-009",
            message="Invalid or expired access token",
            status_code=status.HTTP_401_UNAUTHORIZED,
            details={"www_authenticate": "Bearer"},
        )

    return payload


# Type-annotated dependency for FastAPI routes
CurrentUser = dict[str, Any]

# Module-level constants for FastAPI dependencies (fixes B008 mutable default)
GET_DB = Depends(get_db)
GET_CURRENT_USER = Depends(get_current_user)

def is_global_scope(current_user: CurrentUser) -> bool:
    """Return ``True`` if the caller bypasses per-property scope checks.

    A global ``owner``/``admin`` (surfaced as the ``is_owner`` /
    ``is_superuser`` token claims) may read/mutate any property.  This is
    the single source of truth for the bypass condition so every scope
    check — the dependency below and the list-filter helper — stays
    consistent (no divergent duplicate logic).
    """
    return bool(current_user.get("is_owner") or current_user.get("is_superuser"))


async def user_has_property_scope(
    current_user: CurrentUser,
    db: AsyncSession,
    property_id: uuid.UUID,
) -> bool:
    """Return ``True`` if the caller may access ``property_id``.

    Global owner/admin callers always pass.  Otherwise the caller must
    hold a ``user_property_scopes`` row for that property.  Reads the live
    DB so scope changes take effect immediately.  Used both by the
    ``require_property_scope()`` dependency and by list endpoints that need
    to *filter* (rather than gate) their results by scope.
    """
    if is_global_scope(current_user):
        return True

    user_id = current_user.get("user_id")
    if not user_id:
        return False

    import uuid as _uuid

    from app.modules.auth.repository import UserRepository

    repo = UserRepository(db)
    scopes = await repo.get_property_scopes(_uuid.UUID(str(user_id)))
    return any(s.property_id == property_id for s in scopes)


def require_property_scope(
    path_param: str | None = None,
    query_param: str | None = None,
) -> Any:
    """Build a FastAPI dependency enforcing property scope.

    The ``property_id`` to check is sourced in one of three ways (mutually
    exclusive; exactly one should be configured per usage):

    - ``path_param`` and ``query_param`` both ``None`` (default,
      backward-compatible with ``/auth/invite``): read ``property_id``
      from the JSON request body.
    - ``path_param`` given (e.g. ``"property_id"``): read it from the
      matching path parameter, so path-scoped reads like
      ``GET /properties/{property_id}`` can reuse the same check.
    - ``query_param`` given (e.g. ``"property_id"``): read it from the
      matching query parameter, so query-scoped reads like
      ``GET /tenants/search?property_id=...`` can reuse the same check.

    The dependency raises ``AUTH-005`` (403) unless the caller is a global
    owner/admin or holds a ``user_property_scopes`` row for that property.
    The check reads the live DB so scope changes take effect immediately.

    Usage::

        # body-sourced (unchanged, e.g. /auth/invite and POST /tenants/)
        @router.post("/invite")
        async def invite(
            payload: InviteRequest,
            _: Annotated[None, require_property_scope()],
        ): ...

        # path-sourced
        @router.get("/{property_id}")
        async def get_property(
            property_id: uuid.UUID,
            _: Annotated[None, require_property_scope("property_id")],
        ): ...

        # query-sourced (e.g. GET /tenants/search?property_id=...)
        @router.get("/search")
        async def search(
            property_id: str = Query(...),
            _: Annotated[None, require_property_scope(query_param="property_id")],
        ): ...
    """

    async def _enforce(
        current_user: CurrentUser,
        request: Request,
        db: AsyncSession = GET_DB,
    ) -> None:
        import uuid as _uuid

        from app.modules.auth.constants import AUTH_005

        # Resolve the property_id from the configured source.
        try:
            if path_param is not None:
                raw = request.path_params[path_param]
            elif query_param is not None:
                raw = request.query_params[query_param]
            else:
                body = await request.json()
                raw = body.get("property_id")
            property_id = _uuid.UUID(str(raw))
        except Exception:
            raise APIError(
                code="AUTH-005",
                message=AUTH_005,
                status_code=status.HTTP_403_FORBIDDEN,
            ) from None

        if await user_has_property_scope(current_user, db, property_id):
            return

        raise APIError(
            code="AUTH-005",
            message=AUTH_005,
            status_code=status.HTTP_403_FORBIDDEN,
        )

    return Depends(_enforce)
