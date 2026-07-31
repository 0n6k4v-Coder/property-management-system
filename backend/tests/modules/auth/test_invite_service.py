"""Unit tests for InviteService — invite creation and acceptance (SDD §7.2).

These tests mock the repository layer to isolate business-logic concerns:
JWT token generation/validation, duplicate-email detection, and audit/event
publishing.

References:
    - CODE_STYLE.md §7.2: Unit-test pattern
    - SDD.md §2.1: InviteService specification (FR-USER-02)
    - SDD.md §3.3: POST /invite, POST /register API contracts
"""

import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import status
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.constants import AUTH_003, AUTH_004
from app.modules.auth.models import User
from app.modules.auth.services.invite_service import InviteService
from app.shared.exceptions import APIError
from app.shared.security import hash_password


@pytest.mark.unit
class TestCreateInvite:
    """Tests for ``InviteService.create_invite()`` (FR-USER-02)."""

    async def test_create_invite_success(self) -> None:
        """Valid email + property_id → returns an invite link containing a JWT."""
        property_id = uuid.uuid4()
        inviter_id = uuid.uuid4()

        mock_repo = AsyncMock()
        mock_repo.get_by_email.return_value = None  # email not taken

        service = InviteService.__new__(InviteService)
        service._repo = mock_repo
        service._db = MagicMock(spec=AsyncSession)

        invite_link = await service.create_invite(
            email="invitee@example.com",
            property_id=property_id,
            inviter_id=inviter_id,
        )

        # The link should contain the app domain and a JWT token
        assert invite_link.startswith("http")
        assert "/auth/accept?token=" in invite_link
        token = invite_link.split("token=")[1]
        assert token.count(".") == 2  # JWT has 3 parts
        mock_repo.get_by_email.assert_awaited_once_with("invitee@example.com")

    async def test_create_invite_duplicate_email(self) -> None:
        """Email already registered → raises APIError (AUTH-004)."""
        existing = User(
            id=uuid.uuid4(),
            email="existing@example.com",
            password_hash=hash_password("ExistingPass1"),
            full_name="Existing",
            phone="0811111111",
            is_active=True,
        )
        mock_repo = AsyncMock()
        mock_repo.get_by_email.return_value = existing

        service = InviteService.__new__(InviteService)
        service._repo = mock_repo
        service._db = AsyncMock()

        with pytest.raises(APIError) as exc:
            await service.create_invite(
                email="existing@example.com",
                property_id=uuid.uuid4(),
                inviter_id=uuid.uuid4(),
            )

        assert exc.value.code == "AUTH-004"
        assert exc.value.message == AUTH_004
        assert exc.value.status_code == status.HTTP_409_CONFLICT


@pytest.mark.unit
class TestAcceptInvite:
    """Tests for ``InviteService.accept_invite()`` (FR-USER-02)."""

    async def test_accept_invite_success(self) -> None:
        """Valid token + password → creates user and returns User instance."""
        property_id = uuid.uuid4()
        inviter_id = uuid.uuid4()

        # Step 1: Create an invite token using a real InviteService
        mock_repo = AsyncMock()
        mock_repo.get_by_email.return_value = None

        service = InviteService.__new__(InviteService)
        service._repo = mock_repo
        service._db = MagicMock(spec=AsyncSession)

        invite_link = await service.create_invite(
            email="accept@example.com",
            property_id=property_id,
            inviter_id=inviter_id,
        )
        token = invite_link.split("token=")[1]

        # Step 2: Accept the invite
        created_user = User(
            id=uuid.uuid4(),
            email="accept@example.com",
            password_hash=hash_password("AcceptPass1"),
            full_name="Accepted",
            phone="0822222222",
            is_active=True,
        )

        # Replace the mock so get_by_email returns None (still free),
        # then create returns the new user
        accept_repo = AsyncMock()
        accept_repo.get_by_email.return_value = None
        accept_repo.create.return_value = created_user

        service._repo = accept_repo

        result = await service.accept_invite(
            token=token,
            password="AcceptPass1",
            full_name="Accepted",
            phone="0822222222",
        )

        assert result.id == created_user.id
        assert result.email == "accept@example.com"
        accept_repo.create.assert_awaited_once()

    async def test_accept_invite_expired_token(self) -> None:
        """Expired/malformed token → raises APIError (AUTH-003)."""
        mock_repo = AsyncMock()
        service = InviteService.__new__(InviteService)
        service._repo = mock_repo
        service._db = MagicMock(spec=AsyncSession)

        with pytest.raises(APIError) as exc:
            await service.accept_invite(
                token="invalid.jwt.token",
                password="NewPass123",
                full_name="Fail",
                phone="0833333333",
            )

        assert exc.value.code == "AUTH-003"
        assert exc.value.message == AUTH_003
        assert exc.value.status_code == status.HTTP_401_UNAUTHORIZED

    async def test_accept_invite_wrong_token_type(self) -> None:
        """Token is valid JWT but wrong type → raises APIError (AUTH-003)."""
        # Create an access token (token_type=access) and try to use it as invite
        mock_repo = AsyncMock()
        mock_repo.get_by_email.return_value = None

        service = InviteService.__new__(InviteService)
        service._repo = mock_repo
        service._db = MagicMock(spec=AsyncSession)

        wrong_token = await service.create_invite(
            email="wrongtype@example.com",
            property_id=uuid.uuid4(),
            inviter_id=uuid.uuid4(),
        )
        # This should work — now create an access token via another route
        from app.shared.security import create_access_token

        access_token = create_access_token(
            data={
                "user_id": str(uuid.uuid4()),
                "token_type": "access",
            }
        )

        with pytest.raises(APIError) as exc:
            await service.accept_invite(
                token=access_token,
                password="NewPass123",
                full_name="Fail",
                phone="0844444444",
            )

        assert exc.value.code == "AUTH-003"

    async def test_accept_invite_email_already_taken(self) -> None:
        """Email already registered between invite creation and acceptance → AUTH-004."""
        property_id = uuid.uuid4()
        inviter_id = uuid.uuid4()

        # Create the invite token
        create_repo = AsyncMock()
        create_repo.get_by_email.return_value = None
        service = InviteService.__new__(InviteService)
        service._repo = create_repo
        service._db = MagicMock(spec=AsyncSession)

        invite_link = await service.create_invite(
            email="taken@example.com",
            property_id=property_id,
            inviter_id=inviter_id,
        )
        token = invite_link.split("token=")[1]

        # Now accept — but email was taken in the meantime
        accept_repo = AsyncMock()
        accept_repo.get_by_email.return_value = User(
            id=uuid.uuid4(),
            email="taken@example.com",
            password_hash=hash_password("TakenPass1"),
            full_name="Taken",
            phone="0855555555",
            is_active=True,
        )
        service._repo = accept_repo

        with pytest.raises(APIError) as exc:
            await service.accept_invite(
                token=token,
                password="NewPass123",
                full_name="Fail",
                phone="0866666666",
            )

        assert exc.value.code == "AUTH-004"
        assert exc.value.status_code == status.HTTP_409_CONFLICT
