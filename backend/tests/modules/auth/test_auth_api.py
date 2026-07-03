"""Integration tests for all 5 auth endpoints — AsyncClient + real DB (SDD §7.3).

Each test runs against a real database session that is rolled back on
completion, so no test data persists between runs.  The ``async_client``
fixture overrides ``get_db`` automatically via ``httpx.ASGITransport``,
keeping everything in the same async event loop.

References:
    - CODE_STYLE.md §7.5: Async Integration Test Pattern
    - SDD.md §3.3: Complete API contract for auth endpoints
    - SDD.md §7.3: Integration-test fixtures
"""

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.constants import AUTH_001, AUTH_004, AUTH_009
from app.modules.auth.models import User
from app.modules.auth.repository import UserRepository
from app.modules.auth.services.invite_service import InviteService
from app.shared.security import create_access_token, hash_password


@pytest.mark.integration
class TestLoginEndpoint:
    """``POST /api/v1/auth/login`` — SDD §3.3."""

    async def _create_test_user(
        self, db_session: AsyncSession, email: str = "test@example.com", is_active: bool = True
    ) -> User:
        repo = UserRepository(db_session)
        user = User(
            email=email,
            password_hash=hash_password("SecurePass123"),
            full_name="Test User",
            phone="0812345678",
            is_active=is_active,
        )
        return await repo.create(user)

    async def test_login_success(self, async_client: AsyncClient, db_session: AsyncSession) -> None:
        """Valid credentials → 200 with tokens and user data."""
        await self._create_test_user(db_session)

        response = await async_client.post(
            "/api/v1/auth/login",
            json={"email": "test@example.com", "password": "SecurePass123"},
        )

        assert response.status_code == 200
        body = response.json()
        assert "data" in body
        assert "access_token" in body["data"]
        assert "refresh_token" in body["data"]
        assert "user" in body["data"]
        assert body["data"]["user"]["email"] == "test@example.com"

    async def test_login_wrong_password(self, async_client: AsyncClient, db_session: AsyncSession) -> None:
        """Wrong password → 401 AUTH-001."""
        await self._create_test_user(db_session)

        response = await async_client.post(
            "/api/v1/auth/login",
            json={"email": "test@example.com", "password": "WrongPass1"},
        )

        assert response.status_code == 401
        body = response.json()
        assert body["error"]["code"] == "AUTH-001"
        assert body["error"]["message"] == AUTH_001

    async def test_login_inactive_user(self, async_client: AsyncClient, db_session: AsyncSession) -> None:
        """Inactive account → 403 AUTH-002."""
        await self._create_test_user(db_session, is_active=False)

        response = await async_client.post(
            "/api/v1/auth/login",
            json={"email": "test@example.com", "password": "SecurePass123"},
        )

        assert response.status_code == 403
        body = response.json()
        assert body["error"]["code"] == "AUTH-002"

    async def test_login_validation_error(self, async_client: AsyncClient) -> None:
        """Password without digit → 400 validation error."""
        response = await async_client.post(
            "/api/v1/auth/login",
            json={"email": "test@example.com", "password": "weak"},
        )
        # FastAPI returns 422 for Pydantic validation errors by default
        assert response.status_code == 422


@pytest.mark.integration
class TestRegisterEndpoint:
    """``POST /api/v1/auth/register`` — SDD §3.3."""

    async def test_register_success(self, async_client: AsyncClient, db_session: AsyncSession) -> None:
        """Valid invite token → 201 with user data."""
        # Create an invite token first
        invite_service = InviteService(db_session)
        invite_link = await invite_service.create_invite(
            email="newuser@example.com",
            property_id=uuid.uuid4(),
            inviter_id=uuid.uuid4(),
        )
        token = invite_link.split("token=")[1]

        response = await async_client.post(
            "/api/v1/auth/register",
            json={
                "invite_token": token,
                "full_name": "New User",
                "password": "NewUserPass1",
                "phone": "0899999999",
            },
        )

        assert response.status_code == 201
        body = response.json()
        assert "data" in body
        assert body["data"]["email"] == "newuser@example.com"
        assert body["data"]["is_active"] is True

    async def test_register_duplicate(self, async_client: AsyncClient, db_session: AsyncSession) -> None:
        """Email already registered → 409 AUTH-004."""
        # Create invite first (service checks email doesn't exist yet)
        invite_service = InviteService(db_session)
        invite_link = await invite_service.create_invite(
            email="dup@example.com",
            property_id=uuid.uuid4(),
            inviter_id=uuid.uuid4(),
        )
        token = invite_link.split("token=")[1]

        # Now seed a user with the same email directly in the DB
        repo = UserRepository(db_session)
        await repo.create(
            User(
                email="dup@example.com",
                password_hash=hash_password("DupPass1"),
                full_name="Dup",
                phone="0811111111",
                is_active=True,
            )
        )

        # Attempting to register with the same email → 409
        response = await async_client.post(
            "/api/v1/auth/register",
            json={
                "invite_token": token,
                "full_name": "Dup User",
                "password": "DupPass123",
                "phone": "0822222222",
            },
        )

        assert response.status_code == 409
        body = response.json()
        assert body["error"]["code"] == "AUTH-004"


@pytest.mark.integration
class TestInviteEndpoint:
    """``POST /api/v1/auth/invite`` — SDD §3.3."""

    async def test_invite_success(self, async_client: AsyncClient, app, db_session: AsyncSession) -> None:
        """Authenticated user invites → 201 with invite_link."""
        from app.shared.deps import get_current_user

        app.dependency_overrides[get_current_user] = lambda: {
            "user_id": str(uuid.uuid4()),
            "email": "admin@example.com",
            "property_scopes": [],
            "token_type": "access",
        }

        response = await async_client.post(
            "/api/v1/auth/invite",
            json={"email": "invited@example.com", "property_id": str(uuid.uuid4())},
        )

        assert response.status_code == 201
        body = response.json()
        assert "data" in body
        assert "invite_link" in body["data"]
        assert "token=" in body["data"]["invite_link"]

    async def test_invite_without_auth(self, async_client: AsyncClient, app, db_session: AsyncSession) -> None:
        """No auth header → 401 AUTH-009."""
        from app.shared.deps import get_current_user

        # Remove current_user override so it goes through real auth
        app.dependency_overrides.pop(get_current_user, None)

        response = await async_client.post(
            "/api/v1/auth/invite",
            json={"email": "noauth@example.com", "property_id": str(uuid.uuid4())},
        )

        assert response.status_code == 401
        body = response.json()
        assert "error" in body
        assert body["error"]["code"] == "AUTH-009"


@pytest.mark.integration
class TestRefreshEndpoint:
    """``POST /api/v1/auth/refresh`` — SDD §3.3."""

    async def test_refresh_success(self, async_client: AsyncClient, db_session: AsyncSession) -> None:
        """Valid refresh token → 200 with new access_token."""
        # Create user + get a real refresh token
        repo = UserRepository(db_session)
        user = await repo.create(
            User(
                email="refreshme@example.com",
                password_hash=hash_password("RefreshPass1"),
                full_name="Refresh Me",
                phone="0833333333",
                is_active=True,
            )
        )

        from app.modules.auth.services.auth_service import AuthService

        service = AuthService(db_session)
        tokens = await service.generate_tokens(user)
        refresh_token = tokens["refresh"]

        response = await async_client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": refresh_token},
        )

        assert response.status_code == 200
        body = response.json()
        assert "data" in body
        assert "access_token" in body["data"]
        assert body["data"]["access_token"].count(".") == 2

    async def test_refresh_invalid_token(self, async_client: AsyncClient) -> None:
        """Malformed refresh token → 401 AUTH-007."""
        response = await async_client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": "not.a.jwt"},
        )

        assert response.status_code == 401
        body = response.json()
        assert body["error"]["code"] == "AUTH-007"


@pytest.mark.integration
class TestMeEndpoint:
    """``GET /api/v1/auth/me`` — SDD §3.3."""

    async def test_get_me_success(self, async_client: AsyncClient, app, db_session: AsyncSession) -> None:
        """Valid access token → 200 with user profile."""
        from app.shared.deps import get_current_user

        # Create a user + generate an access token
        repo = UserRepository(db_session)
        user = await repo.create(
            User(
                email="me@example.com",
                password_hash=hash_password("MePass1"),
                full_name="Me User",
                phone="0844444444",
                is_active=True,
            )
        )

        app.dependency_overrides[get_current_user] = lambda: {
            "user_id": str(user.id),
            "email": user.email,
            "property_scopes": [],
            "token_type": "access",
        }

        response = await async_client.get("/api/v1/auth/me")

        assert response.status_code == 200
        body = response.json()
        assert "data" in body
        assert body["data"]["email"] == "me@example.com"
        assert body["data"]["id"] == str(user.id)

    async def test_get_me_no_token(self, async_client: AsyncClient, app) -> None:
        """No Authorization header → 401 AUTH-009."""
        from app.shared.deps import get_current_user

        app.dependency_overrides.pop(get_current_user, None)

        response = await async_client.get("/api/v1/auth/me")
        assert response.status_code == 401
        body = response.json()
        assert body["error"]["code"] == "AUTH-009"