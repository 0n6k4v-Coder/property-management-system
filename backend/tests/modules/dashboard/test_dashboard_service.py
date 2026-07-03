"""Unit tests for DashboardService — aggregation queries, data scoping.

References:
    - SDD.md §2.6: Dashboard Module Specification
    - Data Scoping: Every query filters by property_id.
"""

import uuid
from datetime import date, datetime
from decimal import Decimal

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.models import User
from app.modules.billing.models import Invoice, InvoiceLineItem
from app.modules.contract.models import Contract
from app.modules.property.constants import RoomStatus, RoomType
from app.modules.property.models import Building, Property, Room
from app.modules.tenant.models import Tenant
from app.shared.security import encrypt_sensitive


@pytest.fixture
def any_user_id() -> uuid.UUID:
    return uuid.uuid4()


async def _seed_full_data(db_session: AsyncSession, uid: uuid.UUID) -> dict:
    """Seed a complete set of data for dashboard tests."""
    db_session.add(User(id=uid, email=f"{uid.hex[:8]}@test.com", password_hash="hashed", full_name="Test", is_active=True))
    await db_session.flush()

    prop = Property(name="P", address="A", billing_due_day=5, min_deposit_months=2, created_by=uid)
    db_session.add(prop)
    await db_session.flush()
    await db_session.refresh(prop)

    bld = Building(property_id=prop.id, name="B", display_order=1)
    db_session.add(bld)
    await db_session.flush()
    await db_session.refresh(bld)

    room1 = Room(property_id=prop.id, building_id=bld.id, room_number="101", status=RoomStatus.OCCUPIED)
    db_session.add(room1)
    room2 = Room(property_id=prop.id, building_id=bld.id, room_number="102", status=RoomStatus.AVAILABLE)
    db_session.add(room2)
    await db_session.flush()
    await db_session.refresh(room1)
    await db_session.refresh(room2)

    tenant = Tenant(property_id=prop.id, full_name="T", id_card_number_encrypted=encrypt_sensitive("1234567890123"), phone="0812345678")
    db_session.add(tenant)
    await db_session.flush()
    await db_session.refresh(tenant)

    contract = Contract(room_id=room1.id, tenant_id=tenant.id, property_id=prop.id,
                        start_date=date(2026, 1, 1), end_date=date(2027, 12, 31),
                        monthly_rent=Decimal("5000"), deposit_amount=Decimal("10000"),
                        status="active", created_by=uid)
    db_session.add(contract)
    await db_session.flush()
    await db_session.refresh(contract)

    inv = Invoice(property_id=prop.id, room_id=room1.id, tenant_id=tenant.id, contract_id=contract.id,
                  invoice_number=f"INV-{uuid.uuid4().hex[:8]}",
                  billing_month=5, billing_year=2026,
                  due_date=date(2026, 5, 5),  # past due
                  status="sent", total_amount=Decimal("7000"), paid_amount=Decimal("0"),
                  created_by=uid)
    db_session.add(inv)
    await db_session.flush()

    return {"prop": prop, "room1": room1, "room2": room2, "contract": contract, "invoice": inv}


@pytest.mark.unit
class TestDashboardSummary:
    async def test_summary_calculation(self, db_session: AsyncSession, any_user_id: uuid.UUID) -> None:
        """Dashboard summary computes correct metrics."""
        data = await _seed_full_data(db_session, any_user_id)

        from app.modules.dashboard.services.dashboard_service import DashboardService
        service = DashboardService(db_session)
        summary = await service.get_summary(data["prop"].id)

        assert summary.total_rooms == 2
        assert summary.occupied_rooms == 1
        assert summary.occupancy_rate == 50.0
        assert summary.active_contracts == 1
        assert summary.overdue_count >= 1

    async def test_data_scoping_enforced(self, db_session: AsyncSession, any_user_id: uuid.UUID) -> None:
        """Another property's data should not affect this property's summary."""
        data = await _seed_full_data(db_session, any_user_id)

        other_prop_id = uuid.uuid4()

        from app.modules.dashboard.services.dashboard_service import DashboardService
        service = DashboardService(db_session)
        summary = await service.get_summary(other_prop_id)

        assert summary.total_rooms == 0
        assert summary.occupied_rooms == 0
        assert summary.occupancy_rate == 0.0
