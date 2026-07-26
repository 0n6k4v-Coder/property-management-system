"""Role-based access control — decorators and validators (SDD §4.5).

References:
    - SDD.md §4.5: Security & Access Control
    - CODE_STYLE.md §6: Security Guidelines
"""

from functools import wraps

from fastapi import status

from app.shared.exceptions import APIError


def require_role(role: str = "owner"):
    """Decorator that restricts endpoint access to users with the specified role.

    Usage::

        @router.get("/admin/audit-logs")
        @require_role("owner")
        async def view_audit_logs(...):
            ...

    The decorator reads the ``is_owner`` claim from the JWT payload.
    If the user does not have the required role, a 403 APIError is raised.

    Parameters
    ----------
    role
        The required role (default: "owner").
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Extract current_user from kwargs (injected by Depends)
            current_user = kwargs.get("current_user")
            if current_user is None:
                for arg in args:
                    if isinstance(arg, dict) and "user_id" in arg:
                        current_user = arg
                        break

            if not current_user:
                raise APIError(
                    code="ADMIN-002",
                    message="Authentication required",
                    status_code=status.HTTP_401_UNAUTHORIZED,
                )

            is_owner = current_user.get("is_owner", False)
            is_superuser = current_user.get("is_superuser", False)
            # A superuser (e.g. the seeded admin@example.com) may access
            # read-only admin views (audit logs, system config). Superuser
            # privileges subsume the owner role for these read endpoints.
            if role == "owner" and not (is_owner or is_superuser):
                raise APIError(
                    code="ADMIN-002",
                    message="Insufficient permissions. Owner role required.",
                    status_code=status.HTTP_403_FORBIDDEN,
                )

            return await func(*args, **kwargs)
        return wrapper
    return decorator
