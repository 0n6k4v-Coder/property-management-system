"""Auth module — public facade (SDD.md §2.1).

Export only what other modules and the app factory may import.
No business logic or instantiation here.

References:
    - SDD.md §2.1: Auth module specification
    - CODE_STYLE.md §1.1: Module __init__.py as facade only
"""

from app.modules.auth.repository import UserRepository
from app.modules.auth.services.auth_service import AuthService
from app.modules.auth.services.invite_service import InviteService
from app.modules.auth.routers.auth_router import router

__all__ = [
    "UserRepository",
    "AuthService",
    "InviteService",
    "router",
]