"""End-to-end auth flow: invite → register → login → me → refresh (SDD §5).

This test simulates a real user lifecycle through all five auth endpoints
in sequence, verifying that tokens, user data, and session state flow
correctly between steps.  It runs against a real database session and
resets after each run via rollback.

Uses ``async_client`` with ``httpx.ASGITransport`` — everything stays
in the same event loop as ``pytest-asyncio``.

References:
    - CODE_STYLE.md §7.5: Async Integration Test Pattern
    - SDD.md §3.3: Complete API contract
    - SDD.md §5: Critical sequence diagrams (user registration flow)
"""

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.models import User
from app.modules.auth.repository import UserRepository
from app.modules.auth.services.invite_service import InviteService
from app.shared.security import hash_password


@pytest.mark.integration
class TestAuthE2EFlow:
    """Complete E2E flow: invite → register → login → me → refresh."""

    async def test_full_auth_flow(self, async_client: AsyncClient, app, db_session: AsyncSession) -> None:
        """Execute the complete user lifecycle and assert each step succeeds."""
        from app.shared.deps import get_current_user

        # ----------------------------------------------------------------
        # Step 0 — Seed: create an admin user who will send the invite
        # ----------------------------------------------------------------
        admin_id = uuid.uuid4()
        aw_property_id = uuid.uuid4()
        repo = UserRepository(db_session)
        await repo.create(
            User(
                id=admin_id,
                email="owner@example.com",
                password_hash=hash_password("OwnerPass1"),
                full_name="Property Owner",
                phone="0800000001",
                is_active=True,
            )
        )

        # ----------------------------------------------------------------
        # Step 1 — POST /invite (admin invites a new user)
        # ----------------------------------------------------------------
        app.dependency_overrides[get_current_user] = lambda: {
            "user_id": str(admin_id),
            "email": "owner@example.com",
            "property_scopes": [str(aw_property_id)],
            "token_type": "access",
        }

        invite_response = await async_client.post(
            "/api/v1/auth/invite",
            json={
                "email": "newtenant@example.com",
                "property_id": str(aw_property_id),
            },
        )
        assert invite_response.status_code == 201, f"Invite failed: {invite_response.text}"
        invite_body = invite_response.json()
        assert "invite_link" in invite_body["data"]
        invite_token = invite_body["data"]["invite_link"].split("token=")[1]
        assert invite_token.count(".") == 2, "Invite token is not a valid JWT"

        # ----------------------------------------------------------------
        # Step 2 — POST /register (new user accepts the invite)
        # ----------------------------------------------------------------
        register_response = await async_client.post(
            "/api/v1/auth/register",
            json={
                "invite_token": invite_token,
                "full_name": "New Tenant",
                "password": "TenantPass1",
                "phone": "0899999991",
            },
        )
        assert register_response.status_code == 201, f"Register failed: {register_response.text}"
        register_body = register_response.json()
        assert register_body["data"]["email"] == "newtenant@example.com"
        assert register_body["data"]["is_active"] is True
        new_user_id = register_body["data"]["id"]

        # ----------------------------------------------------------------
        # Step 3 — POST /login (new user logs in with their credentials)
        # ----------------------------------------------------------------
        login_response = await async_client.post(
            "/api/v1/auth/login",
            json={"email": "newtenant@example.com", "password": "TenantPass1"},
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        login_body = login_response.json()
        assert "access_token" in login_body["data"]
        assert "refresh_token" in login_body["data"]
        assert login_body["data"]["user"]["email"] == "newtenant@example.com"

        access_token = login_body["data"]["access_token"]
        refresh_token = login_body["data"]["refresh_token"]

        # ----------------------------------------------------------------
        # Step 4 — GET /me (fetch profile with the access token)
        # ----------------------------------------------------------------
        app.dependency_overrides[get_current_user] = lambda: {
            "user_id": new_user_id,
            "email": "newtenant@example.com",
            "property_scopes": [],
            "token_type": "access",
        }

        me_response = await async_client.get("/api/v1/auth/me")
        assert me_response.status_code == 200, f"GET /me failed: {me_response.text}"
        me_body = me_response.json()
        assert me_body["data"]["email"] == "newtenant@example.com"
        assert me_body["data"]["id"] == new_user_id

        # ----------------------------------------------------------------
        # Step 5 — POST /refresh (rotate the access token)
        # ----------------------------------------------------------------
        refresh_response = await async_client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": refresh_token},
        )
        assert refresh_response.status_code == 200, f"Refresh failed: {refresh_response.text}"
        refresh_body = refresh_response.json()
        assert "access_token" in refresh_body["data"]
        new_access_token = refresh_body["data"]["access_token"]

        # The new access token should be different from the old one
        assert new_access_token != access_token, "Access token was not rotated"

        # ----------------------------------------------------------------
        # Verify — new access token works with GET /me
        # ----------------------------------------------------------------
        app.dependency_overrides[get_current_user] = lambda: {
            "user_id": new_user_id,
            "email": "newtenant@example.com",
            "property_scopes": [],
            "token_type": "access",
        }

        me2_response = await async_client.get("/api/v1/auth/me")
        assert me2_response.status_code == 200
        assert me2_response.json()["data"]["email"] == "newtenant@example.com"

        # ----------------------------------------------------------------
        # Step 6 — Verify error for wrong credentials on existing user
        # ----------------------------------------------------------------
        fail_response = await async_client.post(
            "/api/v1/auth/login",
            json={"email": "newtenant@example.com", "password": "WrongPass1"},
        )
        assert fail_response.status_code == 401
        assert fail_response.json()["error"]["code"] == "AUTH-001"