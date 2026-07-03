"""Authentication business logic — login, token generation (SDD.md §2.1).

The service layer orchestrates authentication flows: verifying credentials,
issuing JWT token pairs, and recording audit events.  It never accesses
the database directly — all persistence goes through ``UserRepository``.

References:
    - SDD.md §2.1: Auth module specification (FR-USER-01)
    - SDD.md §3.3: POST /login API contract
    - SDD.md §4.4: Security guidelines
"""

import uuid
from datetime import timedelta

from fastapi import status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.modules.auth import constants
from app.modules.auth.events import publish
from app.modules.auth.models import User
from app.modules.auth.repository import UserRepository
from app.shared.audit import log_audit
from app.shared.exceptions import APIError
from app.shared.security import (
    create_access_token,
    hash_password,
    verify_password,
)

_settings = get_settings()


class AuthService:
    """Handles user authentication and token lifecycle (FR-USER-01).

    Callers receive a ``(User, dict)`` tuple on success where the dict
    contains ``access`` and ``refresh`` tokens.  On failure an
    ``APIError`` is raised with the appropriate ``AUTH-XXX`` code.
    """

    def __init__(self, db: AsyncSession) -> None:
        self._repo = UserRepository(db)
        self._db = db

    async def authenticate(self, email: str, password: str) -> tuple[User, dict[str, str]]:
        """Verify credentials and issue a token pair (FR-USER-01).

        Flow
        ----
        1. Look up the user by email via ``UserRepository.get_by_email``.
        2. Verify the password against the stored Argon2id hash.
        3. Check ``is_active`` flag.
        4. Generate ``access`` + ``refresh`` JWT tokens.
        5. Record an audit event via ``log_audit``.
        6. Return the user and token dict.

        Parameters
        ----------
        email
            The user's email address.
        password
            The plaintext password to verify.

        Returns
        -------
        tuple[User, dict[str, str]]
            The authenticated user ORM instance and a dict with
            ``access`` and ``refresh`` keys.

        Raises
        ------
        APIError
            ``AUTH-001`` if the email does not exist or the password is
            incorrect.  ``AUTH-002`` if the account is inactive.
        """
        user = await self._repo.get_by_email(email)

        if not user or not verify_password(password, user.password_hash):
            raise APIError(
                code="AUTH-001",
                message=constants.AUTH_001,
                status_code=status.HTTP_401_UNAUTHORIZED,
                details={"field": "credentials"},
            )

        if not user.is_active:
            raise APIError(
                code="AUTH-002",
                message=constants.AUTH_002,
                status_code=status.HTTP_403_FORBIDDEN,
            )

        tokens = await self.generate_tokens(user)

        # Fire-and-forget audit log (fail-silent per SDD §7.4.2)
        await log_audit(
            db=self._db,
            user_id=user.id,
            action=constants.EVENT_USER_LOGGED_IN,
            resource_type="user",
            resource_id=user.id,
        )

        # Fire-and-forget domain event (fail-silent per SDD §9.2)
        await publish(constants.EVENT_USER_LOGGED_IN, {"user_id": str(user.id)})

        return user, tokens

    async def generate_tokens(self, user: User) -> dict[str, str]:
        """Create an access + refresh token pair for the given user.

        The access token is short-lived (configurable via
        ``ACCESS_TOKEN_EXPIRE_MINUTES``).  The refresh token lives
        longer (``REFRESH_TOKEN_EXPIRE_DAYS``) and carries a
        ``token_type`` claim so it can be distinguished during
        token rotation.

        Parameters
        ----------
        user
            The authenticated user whose identity is embedded in
            the token claims.

        Returns
        -------
        dict[str, str]
            Dictionary with ``access`` (short-lived JWT) and
            ``refresh`` (long-lived JWT) keys.
        """
        now = __import__("datetime").datetime.now(__import__("datetime").timezone.utc)

        access_token = create_access_token(
            data={
                "user_id": str(user.id),
                "email": user.email,
                "property_scopes": [],
                "token_type": "access",
            },
        )

        refresh_token = create_access_token(
            data={
                "user_id": str(user.id),
                "token_type": "refresh",
            },
            expires_delta=timedelta(days=_settings.REFRESH_TOKEN_EXPIRE_DAYS),
        )

        return {"access": access_token, "refresh": refresh_token}

    async def register(
        self,
        email: str,
        password: str,
        full_name: str,
        phone: str,
        property_scopes: list[uuid.UUID] | None = None,
    ) -> User:
        """Register a new user directly (admin registration, no invite).

        Checks for duplicate email, hashes the password, persists the
        user, and publishes the ``user.registered`` event.

        Parameters
        ----------
        email
            Unique email address.
        password
            Raw password (strength already validated by Pydantic schema).
        full_name
            Display name of the user.
        phone
            Contact phone number.
        property_scopes
            Optional list of property UUIDs this user can access.

        Returns
        -------
        User
            The newly created user ORM instance.

        Raises
        ------
        APIError
            ``AUTH-004`` if the email is already registered.
        """
        existing = await self._repo.get_by_email(email)
        if existing:
            raise APIError(
                code="AUTH-004",
                message=constants.AUTH_004,
                status_code=status.HTTP_409_CONFLICT,
            )

        user = User(
            email=email,
            password_hash=hash_password(password),
            full_name=full_name,
            phone=phone,
            is_active=True,
        )

        user = await self._repo.create(user)

        await log_audit(
            db=self._db,
            user_id=user.id,
            action=constants.EVENT_USER_REGISTERED,
            resource_type="user",
            resource_id=user.id,
        )

        await publish(constants.EVENT_USER_REGISTERED, {"user_id": str(user.id)})

        return user

    async def refresh_access_token(self, refresh_token: str) -> dict[str, str]:
        """Issue a new access token from a valid refresh token.

        Decodes the refresh token, validates the ``token_type`` claim,
        fetches the user by ``user_id`` embedded in the claims, and
        generates a fresh access token only (no new refresh token).

        Parameters
        ----------
        refresh_token
            A JWT string whose payload contains ``token_type: "refresh"``
            and a ``user_id`` claim.

        Returns
        -------
        dict[str, str]
            Dictionary with a single ``access`` key.

        Raises
        ------
        APIError
            ``AUTH-007`` if the token is invalid, expired, or malformed.
            ``AUTH-008`` if the token has been revoked (future).
        """
        from app.shared.security import decode_token

        payload = decode_token(refresh_token)
        if not payload:
            raise APIError(
                code="AUTH-007",
                message=constants.AUTH_007,
                status_code=status.HTTP_401_UNAUTHORIZED,
            )

        if payload.get("token_type") != "refresh":
            raise APIError(
                code="AUTH-007",
                message=constants.AUTH_007,
                status_code=status.HTTP_401_UNAUTHORIZED,
            )

        user_id_str = payload.get("user_id")
        if not user_id_str:
            raise APIError(
                code="AUTH-007",
                message=constants.AUTH_007,
                status_code=status.HTTP_401_UNAUTHORIZED,
            )

        user = await self._repo.get_by_id(uuid.UUID(user_id_str))
        if not user or not user.is_active:
            raise APIError(
                code="AUTH-007",
                message=constants.AUTH_007,
                status_code=status.HTTP_401_UNAUTHORIZED,
            )

        access_token = create_access_token(
            data={
                "user_id": str(user.id),
                "email": user.email,
                "property_scopes": [],
                "token_type": "access",
            },
        )

        return {"access": access_token}

    async def get_current_user_info(self, token_payload: dict) -> User:
        """Retrieve the full User ORM instance from a JWT payload.

        Parameters
        ----------
        token_payload
            Decoded JWT claims (from ``get_current_user`` dependency),
            expected to contain a ``user_id`` key.

        Returns
        -------
        User
            The full ORM user object.

        Raises
        ------
        APIError
            ``AUTH-009`` if the user is not found or is inactive.
        """
        user_id_str = token_payload.get("user_id")
        if not user_id_str:
            raise APIError(
                code="AUTH-009",
                message=constants.AUTH_009,
                status_code=status.HTTP_401_UNAUTHORIZED,
            )

        user = await self._repo.get_by_id(uuid.UUID(user_id_str))
        if not user or not user.is_active:
            raise APIError(
                code="AUTH-009",
                message=constants.AUTH_009,
                status_code=status.HTTP_401_UNAUTHORIZED,
            )

        return user