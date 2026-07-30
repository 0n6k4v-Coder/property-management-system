"""Integration tests for Maintenance API endpoints — AsyncClient + real DB (SDD §3.3).

Uses ``httpx.AsyncClient`` with ``ASGITransport`` (CODE_STYLE.md §7.5).

References:
    - CODE_STYLE.md §7.5: Async Integration Test Pattern
    - SDD.md §3.3: Maintenance endpoints
    - BR-09: Status workflow validation
"""

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.models import User
from app.modules.property.models import Building, Property, Room

pytestmark = pytest.mark.integration


async def _seed_data(db_session: AsyncSession) -> dict:
    uid = uuid.uuid4()
    db_session.add(
        User(id=uid, email=f"{uid.hex[:8]}@test.com", password_hash="hashed",
             full_name="Test User", is_active=True)
    )
    await db_session.flush()

    prop = Property(name="P", address="A", billing_due_day=5,
                    min_deposit_months=2, created_by=uid)
    db_session.add(prop)
    await db_session.flush()
    await db_session.refresh(prop)

    bld = Building(property_id=prop.id, name="B", display_order=1)
    db_session.add(bld)
    await db_session.flush()
    await db_session.refresh(bld)

    room = Room(property_id=prop.id, building_id=bld.id, room_number="101")
    db_session.add(room)
    await db_session.flush()
    await db_session.refresh(room)

    # Seed UserPropertyScope for property access (required for auth)
    from app.modules.auth.models import UserPropertyScope
    scope = UserPropertyScope(user_id=uid, property_id=prop.id, role="owner")
    db_session.add(scope)
    await db_session.flush()

    return {"user_id": uid, "property": prop, "room": room}


class TestCreateMaintenanceEndpoint:
    """POST /api/v1/maintenance/."""

    async def test_create_success(
        self, async_client: AsyncClient, db_session: AsyncSession,
    ) -> None:
        """Valid payload -> 201 with maintenance request data."""
        data = await _seed_data(db_session)
        from app.shared.deps import get_current_user
        async_client._transport.app.dependency_overrides[get_current_user] = lambda: {
            "user_id": str(data["user_id"]), "email": "admin@test.com",
            "property_scopes": [], "token_type": "access",
        }
        response = await async_client.post(
            "/api/v1/maintenance/",
            json={
                "room_id": str(data["room"].id),
                "property_id": str(data["property"].id),
                "title": "AC not cooling",
                "description": "The air conditioner is blowing warm air.",
                "priority": "high",
            },
        )
        assert response.status_code == 201
        body = response.json()
        assert body["data"]["status"] == "pending"
        assert body["data"]["title"] == "AC not cooling"

    async def test_create_validation_error(self, async_client: AsyncClient, db_session: AsyncSession) -> None:
        """Title too short -> 422."""
        data = await _seed_data(db_session)
        from app.shared.deps import get_current_user
        async_client._transport.app.dependency_overrides[get_current_user] = lambda: {
            "user_id": str(data["user_id"]), "email": "admin@test.com",
            "property_scopes": [], "token_type": "access",
        }
        response = await async_client.post(
            "/api/v1/maintenance/",
            json={
                "room_id": str(data["room"].id),
                "property_id": str(data["property"].id),
                "title": "AB",
                "description": "The AC is broken and needs immediate repair.",
            },
        )
        assert response.status_code == 422


class TestGetMaintenanceEndpoint:
    """GET /api/v1/maintenance/{id}."""

    async def test_get_success(
        self, async_client: AsyncClient, db_session: AsyncSession,
    ) -> None:
        """Existing request -> 200 with data."""
        data = await _seed_data(db_session)
        from app.shared.deps import get_current_user
        async_client._transport.app.dependency_overrides[get_current_user] = lambda: {
            "user_id": str(data["user_id"]), "email": "admin@test.com",
            "property_scopes": [], "token_type": "access",
        }
        from app.modules.maintenance.services.maintenance_service import MaintenanceService
        svc = MaintenanceService(db_session)
        req = await svc.create_request(
            property_id=data["property"].id, room_id=data["room"].id,
            title="Fix light", description="Light bulb is broken in room 101.",
            created_by=data["user_id"],
        )
        response = await async_client.get(f"/api/v1/maintenance/{req.id}")
        assert response.status_code == 200
        assert response.json()["data"]["title"] == "Fix light"

    async def test_get_not_found(self, async_client: AsyncClient, db_session: AsyncSession) -> None:
        """Non-existent request -> 403 (scope check fails before 404)."""
        data = await _seed_data(db_session)
        from app.shared.deps import get_current_user
        async_client._transport.app.dependency_overrides[get_current_user] = lambda: {
            "user_id": str(data["user_id"]), "email": "admin@test.com",
            "property_scopes": [], "token_type": "access",
        }
        response = await async_client.get(f"/api/v1/maintenance/{uuid.uuid4()}")
        # _check_scope raises 403 when property_id is None (entity not found)
        assert response.status_code == 403
        assert response.json()["error"]["code"] == "AUTH-005"


class TestUpdateStatusEndpoint:
    """PATCH /api/v1/maintenance/{id}/status."""

    async def test_update_success(
        self, async_client: AsyncClient, db_session: AsyncSession,
    ) -> None:
        """pending -> in_progress -> 200."""
        data = await _seed_data(db_session)
        from app.shared.deps import get_current_user
        async_client._transport.app.dependency_overrides[get_current_user] = lambda: {
            "user_id": str(data["user_id"]), "email": "admin@test.com",
            "property_scopes": [], "token_type": "access",
        }
        from app.modules.maintenance.services.maintenance_service import MaintenanceService
        svc = MaintenanceService(db_session)
        req = await svc.create_request(
            property_id=data["property"].id, room_id=data["room"].id,
            title="Fix door", description="Door handle is loose.",
            created_by=data["user_id"],
        )
        response = await async_client.patch(
            f"/api/v1/maintenance/{req.id}/status",
            json={"status": "in_progress"},
        )
        assert response.status_code == 200
        assert response.json()["data"]["status"] == "in_progress"

    async def test_update_invalid_transition(
        self, async_client: AsyncClient, db_session: AsyncSession,
    ) -> None:
        """pending -> resolved -> 400 MAINT-003."""
        data = await _seed_data(db_session)
        from app.shared.deps import get_current_user
        async_client._transport.app.dependency_overrides[get_current_user] = lambda: {
            "user_id": str(data["user_id"]), "email": "admin@test.com",
            "property_scopes": [], "token_type": "access",
        }
        from app.modules.maintenance.services.maintenance_service import MaintenanceService
        svc = MaintenanceService(db_session)
        req = await svc.create_request(
            property_id=data["property"].id, room_id=data["room"].id,
            title="Fix pipe", description="Water leak under the sink.",
            created_by=data["user_id"],
        )
        response = await async_client.patch(
            f"/api/v1/maintenance/{req.id}/status",
            json={"status": "resolved"},
        )
        assert response.status_code == 400
        assert response.json()["error"]["code"] == "MAINT-003"


class TestListPendingEndpoint:
    """GET /api/v1/maintenance/pending."""

    async def test_list_pending(
        self, async_client: AsyncClient, db_session: AsyncSession,
    ) -> None:
        """Valid property_id -> 200 with list."""
        data = await _seed_data(db_session)
        from app.shared.deps import get_current_user
        async_client._transport.app.dependency_overrides[get_current_user] = lambda: {
            "user_id": str(data["user_id"]), "email": "admin@test.com",
            "property_scopes": [str(data["property"].id)], "token_type": "access",
        }
        from app.modules.maintenance.services.maintenance_service import MaintenanceService
        svc = MaintenanceService(db_session)
        await svc.create_request(
            property_id=data["property"].id, room_id=data["room"].id,
            title="Fix window", description="Window won't close.",
            created_by=data["user_id"],
        )
        response = await async_client.get(
            f"/api/v1/maintenance/pending?property_id={data['property'].id}",
        )
        assert response.status_code == 200
        assert len(response.json()["data"]) >= 1
