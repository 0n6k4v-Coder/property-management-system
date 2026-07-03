"""Integration tests for Admin API endpoints — AsyncClient + real DB (SDD §3.3).

Uses ``httpx.AsyncClient`` with ``ASGITransport`` (CODE_STYLE.md §7.5).
"""

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.models import User
from app.modules.property.models import Property

pytestmark = pytest.mark.integration


async def _seed_owner(db_session: AsyncSession) -> dict:
    """Seed an owner user + property."""
    uid = uuid.uuid4()
    db_session.add(
        User(id=uid, email=f"{uid.hex[:8]}@test.com", password_hash="hashed",
             full_name="Owner", is_active=True)
    )
    await db_session.flush()

    prop = Property(name="P", address="A", billing_due_day=5,
                    min_deposit_months=2, created_by=uid)
    db_session.add(prop)
    await db_session.flush()
    await db_session.refresh(prop)

    return {"user_id": uid, "property": prop}


class TestGetAuditLogsEndpoint:
    """GET /api/v1/admin/audit-logs."""

    async def test_get_audit_logs_success(
        self, async_client: AsyncClient, db_session: AsyncSession,
    ) -> None:
        """Owner with valid property → 200 with log entries."""
        data = await _seed_owner(db_session)

        from app.shared.deps import get_current_user
        async_client._transport.app.dependency_overrides[get_current_user] = lambda: {
            "user_id": str(data["user_id"]), "email": "owner@test.com",
            "property_scopes": [str(data["property"].id)],
            "token_type": "access", "is_owner": True,
        }

        response = await async_client.get(
            f"/api/v1/admin/audit-logs?property_id={data['property'].id}"
        )
        assert response.status_code == 200
        body = response.json()
        assert "data" in body
        assert "meta" in body

    async def test_get_audit_logs_forbidden(
        self, async_client: AsyncClient, db_session: AsyncSession,
    ) -> None:
        """Non-owner → 403."""
        data = await _seed_owner(db_session)
        from app.shared.deps import get_current_user
        async_client._transport.app.dependency_overrides[get_current_user] = lambda: {
            "user_id": str(data["user_id"]), "email": "user@test.com",
            "property_scopes": [], "token_type": "access",
            "is_owner": False,
        }
        response = await async_client.get(
            f"/api/v1/admin/audit-logs?property_id={data['property'].id}"
        )
        assert response.status_code == 403
        assert response.json()["error"]["code"] == "ADMIN-002"


class TestGetSystemConfigEndpoint:
    """GET /api/v1/admin/config."""

    async def test_get_config_masked(
        self, async_client: AsyncClient, db_session: AsyncSession,
    ) -> None:
        """Owner → 200 with masked secrets."""
        data = await _seed_owner(db_session)
        from app.shared.deps import get_current_user
        async_client._transport.app.dependency_overrides[get_current_user] = lambda: {
            "user_id": str(data["user_id"]), "email": "owner@test.com",
            "property_scopes": [], "token_type": "access", "is_owner": True,
        }
        response = await async_client.get("/api/v1/admin/config")
        assert response.status_code == 200
        body = response.json()
        assert "data" in body

        # Check SECRET_KEY is masked
        config_items = {item["key"]: item for item in body["data"]}
        if "SECRET_KEY" in config_items:
            assert config_items["SECRET_KEY"]["value"] == "****"
            assert config_items["SECRET_KEY"]["masked"] is True
