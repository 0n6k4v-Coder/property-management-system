"""Auth module constants — error codes and domain event names (SDD.md §3.3).

All error codes map to ``APIError(code="AUTH-XXX", ...)`` exceptions
raised by the service layer and caught by the global exception handler
registered in ``main.py``.

References:
    - SDD.md §3.3: Error Table for Auth Module
"""

# ── Error codes (SDD §3.3 Error Table) ────────────────────────────────
AUTH_001 = "Invalid email or password"
AUTH_002 = "Account is not active"
AUTH_003 = "Invite link has expired"
AUTH_004 = "Email already in use"
AUTH_005 = "Insufficient property scope"
AUTH_006 = "User already invited"
AUTH_007 = "Invalid or expired refresh token"
AUTH_008 = "Refresh token has been revoked"
AUTH_009 = "Invalid or expired access token"

# ── Domain event names (SDD §9.2) ─────────────────────────────────────
EVENT_USER_REGISTERED = "user.registered"
EVENT_USER_INVITED = "user.invited"
EVENT_USER_LOGGED_IN = "user.logged_in"