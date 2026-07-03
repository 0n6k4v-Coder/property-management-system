"""Invite link business logic — create and accept invitations (SDD.md §2.1).

Invitations allow existing users to grant access to new users without
exposing the registration form publicly.  An invite is a signed JWT
that encodes the target email, property scope, and an expiry date.

References:
    - SDD.md §2.1: InviteService specification (FR-USER-02)
    - SDD.md §3.3: POST /invite, POST /register API contracts
    - SDD.md §4.4: JWT-based invite token security
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
from app.shared.security import create_access_token, decode_token, hash_password

_settings = get_settings()


class InviteService:
    """Creates and redeems invitation links for new users (FR-USER-02).

    Invitations are property-scoped: the invite encodes which property
    the new user will be granted access to.  Tokens are valid for
    ``INVITE_TOKEN_EXPIRE_DAYS`` days (configurable via settings).
    """

    def __init__(self, db: AsyncSession) -> None:
        self._repo = UserRepository(db)
        self._db = db

    async def create_invite(
        self,
        email: str,
        property_id: uuid.UUID,
        inviter_id: uuid.UUID,
    ) -> str:
        """Generate an invitation link for a new user (FR-USER-02).

        Flow
        ----
        1. Check that the email is not already registered (AUTH-004).
        2. Check the inviter has the required property scope (AUTH-005).
        3. Build a JWT with ``email``, ``property_id``, ``inviter_id``.
        4. Record an audit event.
        5. Return the full invite URL.

        Parameters
        ----------
        email
            The email address to invite.
        property_id
            The property UUID to which the new user will be granted
            access.
        inviter_id
            The UUID of the user sending the invitation.

        Returns
        -------
        str
            Full invite URL (``<APP_DOMAIN>/auth/accept?token=...``).

        Raises
        ------
        APIError
            ``AUTH-004`` if the email is already registered.
            ``AUTH-005`` if the inviter lacks property scope.
        """
        existing = await self._repo.get_by_email(email)
        if existing:
            raise APIError(
                code="AUTH-004",
                message=constants.AUTH_004,
                status_code=status.HTTP_409_CONFLICT,
            )

        # NOTE: Property scope check (AUTH-005) is deferred to Phase 2
        # when the Property module exists.  For now every authenticated
        # owner/admin can invite.
        # TODO: Verify inviter has access to property_id once Property
        #       module is available (FR-USER-02, BR-05).

        token = create_access_token(
            data={
                "invite_email": email,
                "property_id": str(property_id),
                "inviter_id": str(inviter_id),
                "token_type": "invite",
            },
            expires_delta=timedelta(days=_settings.INVITE_TOKEN_EXPIRE_DAYS),
        )

        invite_link = f"{_settings.APP_DOMAIN}/auth/accept?token={token}"

        await log_audit(
            db=self._db,
            user_id=inviter_id,
            action=constants.EVENT_USER_INVITED,
            resource_type="user",
            resource_id=None,
            property_id=property_id,
            metadata={"invited_email": email},
        )

        await publish(
            constants.EVENT_USER_INVITED,
            {
                "email": email,
                "property_id": str(property_id),
                "inviter_id": str(inviter_id),
            },
        )

        return invite_link

    async def accept_invite(self, token: str, password: str, full_name: str, phone: str) -> User:
        """Redeem an invitation token and create a new user account.

        Flow
        ----
        1. Decode and validate the invite JWT (AUTH-003 if invalid/expired).
        2. Extract ``invite_email`` and ``property_id`` from the payload.
        3. Confirm the email is still unregistered (AUTH-004).
        4. Hash the password and persist the new ``User`` row.
        5. Record an audit event.
        6. Return the newly created user.

        Parameters
        ----------
        token
            The JWT invite token (extracted from the query string).
        password
            The plaintext password chosen by the new user.
        full_name
            Display name for the new user.
        phone
            Contact phone number.

        Returns
        -------
        User
            The newly created ``User`` ORM instance.

        Raises
        ------
        APIError
            ``AUTH-003`` if the token is expired, malformed, or invalid.
            ``AUTH-004`` if the email is already registered.
        """
        payload = decode_token(token)
        if not payload:
            raise APIError(
                code="AUTH-003",
                message=constants.AUTH_003,
                status_code=status.HTTP_401_UNAUTHORIZED,
            )

        if payload.get("token_type") != "invite":
            raise APIError(
                code="AUTH-003",
                message=constants.AUTH_003,
                status_code=status.HTTP_401_UNAUTHORIZED,
            )

        invite_email = payload.get("invite_email")
        property_id = payload.get("property_id")  # noqa: F841 — used in audit/future scope assignment

        if not invite_email:
            raise APIError(
                code="AUTH-003",
                message=constants.AUTH_003,
                status_code=status.HTTP_401_UNAUTHORIZED,
            )

        existing = await self._repo.get_by_email(invite_email)
        if existing:
            raise APIError(
                code="AUTH-004",
                message=constants.AUTH_004,
                status_code=status.HTTP_409_CONFLICT,
            )

        user = User(
            email=invite_email,
            password_hash=hash_password(password),
            full_name=full_name,
            phone=phone,
            is_active=True,
        )

        user = await self._repo.create(user)

        # TODO: Link user to property via user_property_scopes once the
        #       Property module is available (Phase 2).

        await log_audit(
            db=self._db,
            user_id=user.id,
            action=constants.EVENT_USER_REGISTERED,
            resource_type="user",
            resource_id=user.id,
        )

        await publish(constants.EVENT_USER_REGISTERED, {"user_id": str(user.id)})

        return user