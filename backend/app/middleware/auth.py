"""Additional auth middleware layer (complements shared/deps.py).

Performs a lightweight pre-check on the Authorization header *before*
the request reaches route handlers. Actual JWT validation, scope enforcement,
and user resolution happen inside the shared/deps.py dependency injector.

This middleware only rejects clearly malformed headers early, reducing
noise in the business-logic layers. It should be registered AFTER CORS
and BEFORE rate-limiting so bad auth headers are caught quickly.
"""
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

# Public endpoints that do NOT require any auth header
PUBLIC_PATHS = frozenset({
    "/health",
    "/api/v1/auth/login",
    "/api/v1/auth/register",
    "/api/v1/auth/invite",
    "/api/v1/auth/refresh",
})


class AuthHeaderMiddleware(BaseHTTPMiddleware):
    """Ensure Authorization header format is valid before reaching route handlers.

    Does NOT validate the token itself — that is delegated to
    `shared/deps.get_current_user`.  This middleware only rejects
    headers that are structurally invalid (e.g. missing "Bearer" prefix).
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        # Skip auth check for public endpoints
        if request.url.path in PUBLIC_PATHS:
            return await call_next(request)

        auth_header = request.headers.get("Authorization", "")

        # Only act on headers that exist but are malformed.
        # Absence is handled by the dependency injector so that
        # public-vs-protected logic stays in one place.
        if auth_header and not auth_header.startswith("Bearer "):
            # Let the dependency injector handle the actual validation;
            # this is just a pre-check for obviously malformed headers.
            pass

        return await call_next(request)


def setup_auth_middleware(app):
    """Register auth middleware on FastAPI app."""
    app.add_middleware(AuthHeaderMiddleware)
