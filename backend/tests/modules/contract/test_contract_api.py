"""Integration tests for Contract & Lease API endpoints — AsyncClient + real DB (SDD §3.3).

Uses ``httpx.AsyncClient`` with ``ASGITransport`` (CODE_STYLE.md §7.5)
so that the request lifecycle stays in the same event loop as
``pytest-asyncio``.

References:
    - CODE_STYLE.md §7.5: Async Integration Test Pattern
    - SDD.md §3.3: Critical Endpoint Specifications — Contract Module
    - SDD.md §5.2: Contract Termination → Room Status Update
    - SDD.md §6.2: Contract Status Machine
"""

import uuid
from datetime import date
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.models import User
from app.modules.contract.models import Contract
from app.modules.contract.repository import ContractRepository
from app.modules.property.constants import RoomStatus, RoomType
from app.modules.property.models import Building, Property, Room
from app.modules.tenant.models import Tenant
from app.shared.security import encrypt_sensitive

pytestmark = pytest.mark.integration


async def _seed_data(db_session: AsyncSession) -> dict:
    """Seed minimal data for contract tests: user, property, building, room, tenant.

    Returns a dict with all seeded objects keyed by their type name.
    """
    uid = uuid.uuid4()
    db_session.add(
        User(id=uid, email=f"{uid.hex[:8]}@test.com", password_hash="hashed",
             full_name="Test User", is_active=True)
    )
    await db_session.flush()

    prop = Property(name="Test Property", address="123 Street", billing_due_day=5,
                    min_deposit_months=2, created_by=uid)
    db_session.add(prop)
    await db_session.flush()
    await db_session.refresh(prop)

    bld = Building(property_id=prop.id, name="Building A", display_order=1)
    db_session.add(bld)
    await db_session.flush()
    await db_session.refresh(bld)

    room = Room(property_id=prop.id, building_id=bld.id, room_number="101",
                room_type=RoomType.STUDIO, base_rent=Decimal("5000.00"),
                status=RoomStatus.AVAILABLE)
    db_session.add(room)
    await db_session.flush()
    await db_session.refresh(room)

    tenant = Tenant(property_id=prop.id, full_name="Test Tenant",
                    id_card_number_encrypted=encrypt_sensitive("1234567890123"),
                    phone="0812345678")
    db_session.add(tenant)
    await db_session.flush()
    await db_session.refresh(tenant)

    return {"user_id": uid, "property": prop, "building": bld, "room": room, "tenant": tenant}


class TestCreateContractEndpoint:
    """POST /api/v1/contracts — SDD §3.3."""

    async def test_create_contract_success(
        self, async_client: AsyncClient, db_session: AsyncSession,
    ) -> None:
        """Valid payload → 201 with contract data."""
        data = await _seed_data(db_session)

        from app.shared.deps import get_current_user
        async_client._transport.app.dependency_overrides[get_current_user] = lambda: {
            "user_id": str(data["user_id"]), "email": "admin@test.com",
            "property_scopes": [], "token_type": "access",
        }

        response = await async_client.post(
            "/api/v1/contracts",
            json={
                "room_id": str(data["room"].id),
                "tenant_id": str(data["tenant"].id),
                "property_id": str(data["property"].id),
                "start_date": "2026-07-01",
                "end_date": "2027-06-30",
                "monthly_rent": 5000.00,
                "deposit_amount": 10000.00,
            },
        )

        assert response.status_code == 201
        body = response.json()
        assert "data" in body
        assert body["data"]["status"] == "active"
        assert body["data"]["monthly_rent"] == "5000.00"

    async def test_create_contract_br01(
        self, async_client: AsyncClient, db_session: AsyncSession,
    ) -> None:
        """BR-01: Second contract for same room → 409 CONT-001."""
        data = await _seed_data(db_session)

        from app.shared.deps import get_current_user
        async_client._transport.app.dependency_overrides[get_current_user] = lambda: {
            "user_id": str(data["user_id"]), "email": "admin@test.com",
            "property_scopes": [], "token_type": "access",
        }

        # First contract
        await async_client.post(
            "/api/v1/contracts",
            json={
                "room_id": str(data["room"].id), "tenant_id": str(data["tenant"].id),
                "property_id": str(data["property"].id),
                "start_date": "2026-07-01", "end_date": "2027-06-30",
                "monthly_rent": 5000.00, "deposit_amount": 10000.00,
            },
        )

        # Second contract for same room → 409
        response = await async_client.post(
            "/api/v1/contracts",
            json={
                "room_id": str(data["room"].id), "tenant_id": str(data["tenant"].id),
                "property_id": str(data["property"].id),
                "start_date": "2028-01-01", "end_date": "2029-12-31",
                "monthly_rent": 5500.00, "deposit_amount": 11000.00,
            },
        )
        assert response.status_code == 409
        assert response.json()["error"]["code"] == "CONT-001"

    async def test_create_contract_validation_error(
        self, async_client: AsyncClient,
    ) -> None:
        """end_date before start_date → 422."""
        from app.shared.deps import get_current_user
        async_client._transport.app.dependency_overrides[get_current_user] = lambda: {
            "user_id": str(uuid.uuid4()), "email": "admin@test.com",
            "property_scopes": [], "token_type": "access",
        }

        response = await async_client.post(
            "/api/v1/contracts",
            json={
                "room_id": str(uuid.uuid4()), "tenant_id": str(uuid.uuid4()),
                "property_id": str(uuid.uuid4()),
                "start_date": "2027-06-30", "end_date": "2026-07-01",
                "monthly_rent": 5000.00, "deposit_amount": 10000.00,
            },
        )
        assert response.status_code == 422


class TestTerminateContractEndpoint:
    """PATCH /api/v1/contracts/{id}/terminate — SDD §3.3, BR-04."""

    async def test_terminate_success(
        self, async_client: AsyncClient, db_session: AsyncSession,
    ) -> None:
        """Active contract → 200 with terminated status."""
        data = await _seed_data(db_session)

        from app.shared.deps import get_current_user
        app = async_client._transport.app
        app.dependency_overrides[get_current_user] = lambda: {
            "user_id": str(data["user_id"]), "email": "admin@test.com",
            "property_scopes": [], "token_type": "access",
        }

        # Create contract via service
        from app.modules.contract.services.contract_service import ContractService
        svc = ContractService(db_session)
        contract = await svc.create_contract(
            room_id=data["room"].id, tenant_id=data["tenant"].id,
            property_id=data["property"].id,
            start_date=date(2026, 7, 1), end_date=date(2027, 6, 30),
            monthly_rent=5000.00, deposit_amount=10000.00,
            created_by=data["user_id"],
        )

        response = await async_client.patch(
            f"/api/v1/contracts/{contract.id}/terminate",
            json={"reason": "tenant_moved_out", "termination_date": "2026-12-31"},
        )

        assert response.status_code == 200
        assert response.json()["data"]["status"] == "terminated"

    async def test_terminate_not_found(self, async_client: AsyncClient) -> None:
        """Non-existent contract → 404 CONT-006."""
        from app.shared.deps import get_current_user
        async_client._transport.app.dependency_overrides[get_current_user] = lambda: {
            "user_id": str(uuid.uuid4()), "email": "admin@test.com",
            "property_scopes": [], "token_type": "access",
        }

        response = await async_client.patch(
            f"/api/v1/contracts/{uuid.uuid4()}/terminate",
            json={"reason": "tenant_moved_out"},
        )
        assert response.status_code == 404
        assert response.json()["error"]["code"] == "CONT-006"


class TestExtendLeaseEndpoint:
    """POST /api/v1/contracts/{id}/extend."""

    async def test_extend_success(
        self, async_client: AsyncClient, db_session: AsyncSession,
    ) -> None:
        """Active contract → 200 with extended end_date."""
        data = await _seed_data(db_session)

        from app.shared.deps import get_current_user
        app = async_client._transport.app
        app.dependency_overrides[get_current_user] = lambda: {
            "user_id": str(data["user_id"]), "email": "admin@test.com",
            "property_scopes": [], "token_type": "access",
        }

        from app.modules.contract.services.contract_service import ContractService
        svc = ContractService(db_session)
        contract = await svc.create_contract(
            room_id=data["room"].id, tenant_id=data["tenant"].id,
            property_id=data["property"].id,
            start_date=date(2026, 7, 1), end_date=date(2027, 6, 30),
            monthly_rent=5000.00, deposit_amount=10000.00,
            created_by=data["user_id"],
        )

        response = await async_client.post(
            f"/api/v1/contracts/{contract.id}/extend",
            json={"new_end_date": "2028-06-30", "reason": "Tenant requested"},
        )

        assert response.status_code == 200
        assert response.json()["data"]["end_date"] == "2028-06-30"


class TestGetActiveContractsEndpoint:
    """GET /api/v1/contracts/active."""

    async def test_get_active_contracts(
        self, async_client: AsyncClient, db_session: AsyncSession,
    ) -> None:
        """Active contracts → 200 with list."""
        data = await _seed_data(db_session)

        from app.shared.deps import get_current_user
        async_client._transport.app.dependency_overrides[get_current_user] = lambda: {
            "user_id": str(data["user_id"]), "email": "admin@test.com",
            "property_scopes": [], "token_type": "access",
        }

        from app.modules.contract.services.contract_service import ContractService
        svc = ContractService(db_session)
        await svc.create_contract(
            room_id=data["room"].id, tenant_id=data["tenant"].id,
            property_id=data["property"].id,
            start_date=date(2026, 7, 1), end_date=date(2027, 6, 30),
            monthly_rent=5000.00, deposit_amount=10000.00,
            created_by=data["user_id"],
        )

        response = await async_client.get(
            f"/api/v1/contracts/active?property_id={data['property'].id}",
        )

        assert response.status_code == 200
        assert len(response.json()["data"]) >= 1


class TestLeaseHistoryEndpoint:
    """GET /api/v1/leases/{room_id}/history."""

    async def test_lease_history(
        self, async_client: AsyncClient, db_session: AsyncSession,
    ) -> None:
        """Room lease history → 200 with list."""
        data = await _seed_data(db_session)

        from app.shared.deps import get_current_user
        async_client._transport.app.dependency_overrides[get_current_user] = lambda: {
            "user_id": str(data["user_id"]), "email": "admin@test.com",
            "property_scopes": [], "token_type": "access",
        }

        from app.modules.contract.services.contract_service import ContractService
        svc = ContractService(db_session)
        await svc.create_contract(
            room_id=data["room"].id, tenant_id=data["tenant"].id,
            property_id=data["property"].id,
            start_date=date(2026, 7, 1), end_date=date(2027, 6, 30),
            monthly_rent=5000.00, deposit_amount=10000.00,
            created_by=data["user_id"],
        )

        response = await async_client.get(f"/api/v1/leases/{data['room'].id}/history")

        assert response.status_code == 200
        assert len(response.json()["data"]) >= 1