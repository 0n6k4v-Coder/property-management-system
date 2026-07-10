"""Unit tests for AuthService — business logic in isolation (SDD §7.2).

All database calls are mocked so that these tests validate only the
service-layer logic: credential verification, token generation, active
account checks, and audit/event publishing.

References:
    - CODE_STYLE.md §7.2: Unit-test pattern
    - SDD.md §2.1: AuthService specification (FR-USER-01)
    - SDD.md §3.3: POST /login API contract
"""

import uuid
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import status

from app.modules.auth.constants import AUTH_001, AUTH_002, AUTH_009
from app.modules.auth.models import User
from app.modules.auth.services.auth_service import AuthService
from app.shared.exceptions import APIError
from app.shared.security import hash_password


@pytest.mark.unit
class TestAuthenticate:
    """Tests for ``AuthService.authenticate()`` (FR-USER-01)."""

    async def test_authenticate_success(self) -> None:
        """Valid email + password → returns (User, tokens dict)."""
        user_id = uuid.uuid4()
        user = User(
            id=user_id,
            email="alice@example.com",
            password_hash=hash_password("SecurePass123"),
            full_name="Alice",
            phone="0811111111",
            is_active=True,
        )
        mock_repo = AsyncMock()
        mock_repo.get_by_email.return_value = user

        service = AuthService.__new__(AuthService)
        service._repo = mock_repo
        service._db = AsyncMock()

        result_user, tokens = await service.authenticate("alice@example.com", "SecurePass123")

        assert result_user.id == user_id
        assert "access" in tokens
        assert "refresh" in tokens
        # Tokens should look like JWTs (two dots)
        assert tokens["access"].count(".") == 2
        assert tokens["refresh"].count(".") == 2
        mock_repo.get_by_email.assert_awaited_once_with("alice@example.com")

    async def test_authenticate_wrong_password(self) -> None:
        """Invalid password → raises APIError (AUTH-001)."""
        user = User(
            id=uuid.uuid4(),
            email="bob@example.com",
            password_hash=hash_password("CorrectPass1"),
            full_name="Bob",
            phone="0822222222",
            is_active=True,
        )
        mock_repo = AsyncMock()
        mock_repo.get_by_email.return_value = user

        service = AuthService.__new__(AuthService)
        service._repo = mock_repo
        service._db = AsyncMock()

        with pytest.raises(APIError) as exc:
            await service.authenticate("bob@example.com", "WrongPass1")

        assert exc.value.code == "AUTH-001"
        assert exc.value.message == AUTH_001
        assert exc.value.status_code == status.HTTP_401_UNAUTHORIZED

    async def test_authenticate_nonexistent_email(self) -> None:
        """Email not found → raises APIError (AUTH-001)."""
        mock_repo = AsyncMock()
        mock_repo.get_by_email.return_value = None

        service = AuthService.__new__(AuthService)
        service._repo = mock_repo
        service._db = AsyncMock()

        with pytest.raises(APIError) as exc:
            await service.authenticate("nobody@example.com", "AnyPass1")

        assert exc.value.code == "AUTH-001"

    async def test_authenticate_inactive_user(self) -> None:
        """``is_active=False`` → raises APIError (AUTH-002)."""
        user = User(
            id=uuid.uuid4(),
            email="inactive@example.com",
            password_hash=hash_password("InactivePass1"),
            full_name="Inactive",
            phone="0833333333",
            is_active=False,
        )
        mock_repo = AsyncMock()
        mock_repo.get_by_email.return_value = user

        service = AuthService.__new__(AuthService)
        service._repo = mock_repo
        service._db = AsyncMock()

        with pytest.raises(APIError) as exc:
            await service.authenticate("inactive@example.com", "InactivePass1")

        assert exc.value.code == "AUTH-002"
        assert exc.value.message == AUTH_002
        assert exc.value.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.unit
class TestGenerateTokens:
    """Tests for ``AuthService.generate_tokens()``."""

    async def test_generate_tokens_returns_jwt_pair(self) -> None:
        """Returns dict with ``access`` and ``refresh`` JWT strings."""
        user = User(
            id=uuid.uuid4(),
            email="token@example.com",
            password_hash=hash_password("TokenPass1"),
            full_name="Token",
            phone="0844444444",
            is_active=True,
        )
        service = AuthService.__new__(AuthService)
        service._repo = AsyncMock()
        service._db = AsyncMock()

        tokens = await service.generate_tokens(user)

        assert isinstance(tokens, dict)
        assert "access" in tokens
        assert "refresh" in tokens
        assert tokens["access"].count(".") == 2
        assert tokens["refresh"].count(".") == 2
        # Access and refresh should be different strings
        assert tokens["access"] != tokens["refresh"]


@pytest.mark.unit
class TestRegister:
    """Tests for ``AuthService.register()`` (direct admin registration)."""

    async def test_register_success(self) -> None:
        """New email → creates user, returns User instance."""
        mock_repo = AsyncMock()
        mock_repo.get_by_email.return_value = None  # email free

        created_user = User(
            id=uuid.uuid4(),
            email="newuser@example.com",
            password_hash=hash_password("NewUserPass1"),
            full_name="New User",
            phone="0855555555",
            is_active=True,
        )
        mock_repo.create.return_value = created_user

        service = AuthService.__new__(AuthService)
        service._repo = mock_repo
        service._db = AsyncMock()

        result = await service.register(
            email="newuser@example.com",
            password="NewUserPass1",
            full_name="New User",
            phone="0855555555",
        )

        assert result.id == created_user.id
        assert result.email == "newuser@example.com"
        mock_repo.get_by_email.assert_awaited_once_with("newuser@example.com")
        mock_repo.create.assert_awaited_once()

    async def test_register_duplicate_email(self) -> None:
        """Existing email → raises APIError (AUTH-004)."""
        existing = User(
            id=uuid.uuid4(),
            email="existing@example.com",
            password_hash=hash_password("ExistingPass1"),
            full_name="Existing",
            phone="0866666666",
            is_active=True,
        )
        mock_repo = AsyncMock()
        mock_repo.get_by_email.return_value = existing

        service = AuthService.__new__(AuthService)
        service._repo = mock_repo
        service._db = AsyncMock()

        with pytest.raises(APIError) as exc:
            await service.register(
                email="existing@example.com",
                password="NewPass123",
                full_name="Dup",
                phone="0877777777",
            )

        assert exc.value.code == "AUTH-004"
        assert exc.value.status_code == status.HTTP_409_CONFLICT


@pytest.mark.unit
class TestRefreshAccessToken:
    """Tests for ``AuthService.refresh_access_token()``."""

    async def test_refresh_valid_token(self) -> None:
        """Valid refresh token → returns new access token."""
        user_id = uuid.uuid4()
        user = User(
            id=user_id,
            email="refresh@example.com",
            password_hash=hash_password("RefreshPass1"),
            full_name="Refresh",
            phone="0888888888",
            is_active=True,
        )
        mock_repo = AsyncMock()
        mock_repo.get_by_id.return_value = user
        # Refresh-token rotation persists the new jti; mirror that on the
        # in-memory user so the rotation guard (AUTH-008) accepts it.
        async def _persist_jti(uid, jti):
            user.current_refresh_jti = jti

        mock_repo.set_current_refresh_jti.side_effect = _persist_jti

        # Create a real refresh token via the auth_service
        service = AuthService.__new__(AuthService)
        service._repo = mock_repo
        service._db = AsyncMock()

        # Generate a proper refresh token
        tokens = await service.generate_tokens(user)
        refresh_token = tokens["refresh"]

        # Now test refresh_access_token
        result = await service.refresh_access_token(refresh_token)

        assert "access" in result
        assert result["access"].count(".") == 2

    async def test_refresh_invalid_token(self) -> None:
        """Garbage token → raises APIError (AUTH-007)."""
        mock_repo = AsyncMock()
        service = AuthService.__new__(AuthService)
        service._repo = mock_repo
        service._db = AsyncMock()

        with pytest.raises(APIError) as exc:
            await service.refresh_access_token("not.a.jwt")

        assert exc.value.code == "AUTH-007"
        assert exc.value.status_code == status.HTTP_401_UNAUTHORIZED

    async def test_refresh_access_token_missing_user(self) -> None:
        """Token references a non-existent user → raises APIError (AUTH-007)."""
        mock_repo = AsyncMock()
        mock_repo.get_by_id.return_value = None

        user = User(
            id=uuid.uuid4(),
            email="ghost@example.com",
            password_hash=hash_password("GhostPass1"),
            full_name="Ghost",
            phone="0899999999",
            is_active=True,
        )

        service = AuthService.__new__(AuthService)
        service._repo = AsyncMock()
        service._db = AsyncMock()

        # Create a refresh token for a real user, then make repo return None
        tokens = await service.generate_tokens(user)
        service._repo = mock_repo

        with pytest.raises(APIError) as exc:
            await service.refresh_access_token(tokens["refresh"])

        assert exc.value.code == "AUTH-007"


@pytest.mark.unit
class TestGetCurrentUserInfo:
    """Tests for ``AuthService.get_current_user_info()``."""

    async def test_get_current_user_info_success(self) -> None:
        """Valid JWT payload → returns User instance."""
        user_id = uuid.uuid4()
        user = User(
            id=user_id,
            email="me@example.com",
            password_hash=hash_password("MePass1"),
            full_name="Me",
            phone="0800000000",
            is_active=True,
        )
        mock_repo = AsyncMock()
        mock_repo.get_by_id.return_value = user

        service = AuthService.__new__(AuthService)
        service._repo = mock_repo
        service._db = AsyncMock()

        result = await service.get_current_user_info({"user_id": str(user_id)})

        assert result.id == user_id
        assert result.email == "me@example.com"

    async def test_get_current_user_info_not_found(self) -> None:
        """User ID in payload does not exist → raises APIError (AUTH-009)."""
        mock_repo = AsyncMock()
        mock_repo.get_by_id.return_value = None

        service = AuthService.__new__(AuthService)
        service._repo = mock_repo
        service._db = AsyncMock()

        with pytest.raises(APIError) as exc:
            await service.get_current_user_info({"user_id": str(uuid.uuid4())})

        assert exc.value.code == "AUTH-009"
        assert exc.value.status_code == status.HTTP_401_UNAUTHORIZED

    async def test_get_current_user_info_missing_id(self) -> None:
        """Payload lacks ``user_id`` → raises APIError (AUTH-009)."""
        service = AuthService.__new__(AuthService)
        service._repo = AsyncMock()
        service._db = AsyncMock()

        with pytest.raises(APIError) as exc:
            await service.get_current_user_info({})

        assert exc.value.code == "AUTH-009"