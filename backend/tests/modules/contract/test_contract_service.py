"""Unit tests for ContractService — business rules, audit, transactions (SDD §2.5, §6.2).

References:
    - CODE_STYLE.md §7.2: Unit-Test Pattern
    - CODE_STYLE.md §7.4: Async Database Fixture Pattern
    - SDD.md §2.5: Contract Module Specification
    - SDD.md §6.2: Contract Status Machine
    - BR-01: One active contract per room
    - BR-02: Deposit >= monthly_rent * min_deposit_months
    - BR-04: Termination requires reason + audit
"""

import uuid
from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.models import User
from app.modules.contract.models import Contract
from app.modules.contract.services.contract_service import ContractService
from app.modules.property.constants import RoomStatus, RoomType
from app.modules.property.models import Building, Property, Room
from app.modules.tenant.models import Tenant
from app.shared.exceptions import APIError
from app.shared.security import encrypt_sensitive


@pytest.fixture
def any_user_id() -> uuid.UUID:
    """Return a unique test user identity for each test call."""
    return uuid.uuid4()


async def _create_user(db_session: AsyncSession, uid: uuid.UUID) -> None:
    """Seed a minimal User record for FK constraints."""
    db_session.add(
        User(id=uid, email=f"{uid.hex[:8]}@test.com", password_hash="hashed", full_name="Test User", is_active=True)
    )
    await db_session.flush()


async def _create_property(db_session: AsyncSession, uid: uuid.UUID) -> Property:
    """Seed a minimal Property.  Returns the Property object."""
    prop = Property(name="Test Property", address="123 Street", billing_due_day=5, min_deposit_months=2, created_by=uid)
    db_session.add(prop)
    await db_session.flush()
    await db_session.refresh(prop)
    return prop


async def _create_building(db_session: AsyncSession, prop_id: uuid.UUID) -> Building:
    """Seed a minimal Building."""
    bld = Building(property_id=prop_id, name="Building A", display_order=1)
    db_session.add(bld)
    await db_session.flush()
    await db_session.refresh(bld)
    return bld


async def _create_room(db_session: AsyncSession, prop_id: uuid.UUID, bld_id: uuid.UUID, number: str = "101") -> Room:
    """Seed a minimal Room in available status."""
    room = Room(property_id=prop_id, building_id=bld_id, room_number=number, room_type=RoomType.STUDIO, base_rent=Decimal("5000.00"), status=RoomStatus.AVAILABLE)
    db_session.add(room)
    await db_session.flush()
    await db_session.refresh(room)
    return room


async def _create_tenant(db_session: AsyncSession, prop_id: uuid.UUID, phone: str = "0812345678") -> Tenant:
    """Seed a minimal Tenant with encrypted ID card."""
    tenant = Tenant(property_id=prop_id, full_name="Test Tenant", id_card_number_encrypted=encrypt_sensitive("1234567890123"), phone=phone)
    db_session.add(tenant)
    await db_session.flush()
    await db_session.refresh(tenant)
    return tenant


@pytest.mark.unit
class TestCreateContract:
    """``ContractService.create_contract()`` — FR-CONTRACT-01, BR-01, BR-02."""

    async def test_create_contract_success(self, db_session: AsyncSession, any_user_id: uuid.UUID) -> None:
        """Valid input → contract created with status=active, room status=occupied."""
        await _create_user(db_session, any_user_id)
        prop = await _create_property(db_session, any_user_id)
        bld = await _create_building(db_session, prop.id)
        room = await _create_room(db_session, prop.id, bld.id)
        tenant = await _create_tenant(db_session, prop.id)

        service = ContractService(db_session)
        contract = await service.create_contract(
            room_id=room.id,
            tenant_id=tenant.id,
            property_id=prop.id,
            start_date=date(2026, 7, 1),
            end_date=date(2027, 6, 30),
            monthly_rent=5000.00,
            deposit_amount=10000.00,
            created_by=any_user_id,
        )

        assert contract.id is not None
        assert contract.status == "active"
        assert contract.monthly_rent == 5000.00
        assert contract.deposit_amount == 10000.00
        assert contract.room_id == room.id
        assert contract.tenant_id == tenant.id

        # Room status changed to occupied
        assert room.status == "occupied"

    async def test_create_contract_br01_duplicate_active(self, db_session: AsyncSession, any_user_id: uuid.UUID) -> None:
        """BR-01: Creating a second contract for same room → 409 CONT-001."""
        await _create_user(db_session, any_user_id)
        prop = await _create_property(db_session, any_user_id)
        bld = await _create_building(db_session, prop.id)
        room = await _create_room(db_session, prop.id, bld.id)
        tenant = await _create_tenant(db_session, prop.id)

        service = ContractService(db_session)

        # First contract succeeds
        await service.create_contract(
            room_id=room.id, tenant_id=tenant.id, property_id=prop.id,
            start_date=date(2026, 7, 1), end_date=date(2027, 6, 30),
            monthly_rent=5000.00, deposit_amount=10000.00, created_by=any_user_id,
        )

        # Second contract for same room fails (BR-01)
        with pytest.raises(APIError) as exc:
            await service.create_contract(
                room_id=room.id, tenant_id=tenant.id, property_id=prop.id,
                start_date=date(2028, 1, 1), end_date=date(2029, 12, 31),
                monthly_rent=5500.00, deposit_amount=11000.00, created_by=any_user_id,
            )
        assert exc.value.code == "CONT-001"
        assert exc.value.status_code == 409

    async def test_create_contract_br02_deposit_too_low(self, db_session: AsyncSession, any_user_id: uuid.UUID) -> None:
        """BR-02: Deposit < 2× monthly_rent → 400 CONT-002."""
        await _create_user(db_session, any_user_id)
        prop = await _create_property(db_session, any_user_id)
        bld = await _create_building(db_session, prop.id)
        room = await _create_room(db_session, prop.id, bld.id)
        tenant = await _create_tenant(db_session, prop.id)

        service = ContractService(db_session)

        with pytest.raises(APIError) as exc:
            await service.create_contract(
                room_id=room.id, tenant_id=tenant.id, property_id=prop.id,
                start_date=date(2026, 7, 1), end_date=date(2027, 6, 30),
                monthly_rent=5000.00, deposit_amount=5000.00,  # Only 1×, need ≥2×
                created_by=any_user_id,
            )
        assert exc.value.code == "CONT-002"
        assert exc.value.status_code == 400

    async def test_create_contract_room_not_found(self, db_session: AsyncSession) -> None:
        """Non-existent room → 404 CONT-007."""
        service = ContractService(db_session)
        with pytest.raises(APIError) as exc:
            await service.create_contract(
                room_id=uuid.uuid4(), tenant_id=uuid.uuid4(), property_id=uuid.uuid4(),
                start_date=date(2026, 7, 1), end_date=date(2027, 6, 30),
                monthly_rent=5000.00, deposit_amount=10000.00, created_by=uuid.uuid4(),
            )
        assert exc.value.code == "CONT-007"
        assert exc.value.status_code == 404

    async def test_create_contract_tenant_not_found(self, db_session: AsyncSession, any_user_id: uuid.UUID) -> None:
        """Referencing non-existent tenant → 404 CONT-008."""
        await _create_user(db_session, any_user_id)
        prop = await _create_property(db_session, any_user_id)
        bld = await _create_building(db_session, prop.id)
        room = await _create_room(db_session, prop.id, bld.id)

        service = ContractService(db_session)
        with pytest.raises(APIError) as exc:
            await service.create_contract(
                room_id=room.id, tenant_id=uuid.uuid4(), property_id=prop.id,
                start_date=date(2026, 7, 1), end_date=date(2027, 6, 30),
                monthly_rent=5000.00, deposit_amount=10000.00, created_by=any_user_id,
            )
        assert exc.value.code == "CONT-008"
        assert exc.value.status_code == 404


@pytest.mark.unit
class TestTerminateContract:
    """``ContractService.terminate_contract()`` — FR-CONTRACT-03, BR-04."""

    async def test_terminate_success(self, db_session: AsyncSession, any_user_id: uuid.UUID) -> None:
        """Active contract → terminated, room → available, termination record created."""
        await _create_user(db_session, any_user_id)
        prop = await _create_property(db_session, any_user_id)
        bld = await _create_building(db_session, prop.id)
        room = await _create_room(db_session, prop.id, bld.id)
        tenant = await _create_tenant(db_session, prop.id)

        service = ContractService(db_session)
        contract = await service.create_contract(
            room_id=room.id, tenant_id=tenant.id, property_id=prop.id,
            start_date=date(2026, 7, 1), end_date=date(2027, 6, 30),
            monthly_rent=5000.00, deposit_amount=10000.00, created_by=any_user_id,
        )

        terminated = await service.terminate_contract(
            contract_id=contract.id, reason="tenant_moved_out", terminated_by=any_user_id,
            termination_date=date(2026, 12, 31),
        )

        assert terminated.status == "terminated"
        assert terminated.termination is not None
        assert terminated.termination.reason == "tenant_moved_out"
        assert room.status == "available"

    async def test_terminate_not_found(self, db_session: AsyncSession) -> None:
        """Non-existent contract → 404 CONT-006."""
        service = ContractService(db_session)
        with pytest.raises(APIError) as exc:
            await service.terminate_contract(
                contract_id=uuid.uuid4(), reason="tenant_moved_out", terminated_by=uuid.uuid4(),
            )
        assert exc.value.code == "CONT-006"
        assert exc.value.status_code == 404

    async def test_terminate_not_active(self, db_session: AsyncSession, any_user_id: uuid.UUID) -> None:
        """BR-04: Already terminated contract → 409 CONT-004."""
        await _create_user(db_session, any_user_id)
        prop = await _create_property(db_session, any_user_id)
        bld = await _create_building(db_session, prop.id)
        room = await _create_room(db_session, prop.id, bld.id)
        tenant = await _create_tenant(db_session, prop.id)

        service = ContractService(db_session)
        contract = await service.create_contract(
            room_id=room.id, tenant_id=tenant.id, property_id=prop.id,
            start_date=date(2026, 7, 1), end_date=date(2027, 6, 30),
            monthly_rent=5000.00, deposit_amount=10000.00, created_by=any_user_id,
        )
        await service.terminate_contract(
            contract_id=contract.id, reason="tenant_moved_out", terminated_by=any_user_id,
        )

        with pytest.raises(APIError) as exc:
            await service.terminate_contract(
                contract_id=contract.id, reason="tenant_moved_out", terminated_by=any_user_id,
            )
        assert exc.value.code == "CONT-004"
        assert exc.value.status_code == 409


@pytest.mark.unit
class TestExtendLease:
    """``ContractService.extend_lease()``."""

    async def test_extend_success(self, db_session: AsyncSession, any_user_id: uuid.UUID) -> None:
        """Active contract → end_date extended, LeaseExtension record created."""
        await _create_user(db_session, any_user_id)
        prop = await _create_property(db_session, any_user_id)
        bld = await _create_building(db_session, prop.id)
        room = await _create_room(db_session, prop.id, bld.id)
        tenant = await _create_tenant(db_session, prop.id)

        service = ContractService(db_session)
        contract = await service.create_contract(
            room_id=room.id, tenant_id=tenant.id, property_id=prop.id,
            start_date=date(2026, 7, 1), end_date=date(2027, 6, 30),
            monthly_rent=5000.00, deposit_amount=10000.00, created_by=any_user_id,
        )

        extended = await service.extend_lease(
            contract_id=contract.id, new_end_date=date(2028, 6, 30),
            extended_by=any_user_id, reason="Tenant requested one more year",
        )

        assert extended.end_date == date(2028, 6, 30)
        assert len(extended.extensions) > 0
        assert extended.extensions[0].previous_end_date == date(2027, 6, 30)
        assert extended.extensions[0].extended_to == date(2028, 6, 30)


@pytest.mark.unit
class TestRenewContract:
    """``ContractService.renew_contract()``."""

    async def test_renew_success(self, db_session: AsyncSession, any_user_id: uuid.UUID) -> None:
        """Terminated contract → new active contract with is_renewal=True."""
        await _create_user(db_session, any_user_id)
        prop = await _create_property(db_session, any_user_id)
        bld = await _create_building(db_session, prop.id)
        room = await _create_room(db_session, prop.id, bld.id)
        tenant = await _create_tenant(db_session, prop.id)

        service = ContractService(db_session)
        contract = await service.create_contract(
            room_id=room.id, tenant_id=tenant.id, property_id=prop.id,
            start_date=date(2026, 7, 1), end_date=date(2027, 6, 30),
            monthly_rent=5000.00, deposit_amount=10000.00, created_by=any_user_id,
        )
        await service.terminate_contract(
            contract_id=contract.id, reason="tenant_moved_out", terminated_by=any_user_id,
        )

        renewed = await service.renew_contract(
            original_contract_id=contract.id,
            new_start_date=date(2028, 1, 1), new_end_date=date(2029, 12, 31),
            new_monthly_rent=5500.00, new_deposit_amount=11000.00, renewed_by=any_user_id,
        )

        assert renewed.is_renewal is True
        assert renewed.renewed_from_id == contract.id
        assert renewed.status == "active"
        assert renewed.room_id == contract.room_id
        assert renewed.tenant_id == contract.tenant_id
        assert room.status == "occupied"


@pytest.mark.unit
class TestGetActiveContracts:
    """``ContractService.get_active_contracts()``."""

    async def test_get_active_contracts(self, db_session: AsyncSession, any_user_id: uuid.UUID) -> None:
        """Active contracts returned; terminated contracts filtered out."""
        await _create_user(db_session, any_user_id)
        prop = await _create_property(db_session, any_user_id)
        bld = await _create_building(db_session, prop.id)
        room1 = await _create_room(db_session, prop.id, bld.id, number="101")
        room2 = await _create_room(db_session, prop.id, bld.id, number="102")
        tenant1 = await _create_tenant(db_session, prop.id)
        tenant2 = await _create_tenant(db_session, prop.id, phone="0899999999")

        service = ContractService(db_session)

        c1 = await service.create_contract(
            room_id=room1.id, tenant_id=tenant1.id, property_id=prop.id,
            start_date=date(2026, 7, 1), end_date=date(2027, 6, 30),
            monthly_rent=5000.00, deposit_amount=10000.00, created_by=any_user_id,
        )
        c2 = await service.create_contract(
            room_id=room2.id, tenant_id=tenant2.id, property_id=prop.id,
            start_date=date(2026, 7, 1), end_date=date(2027, 6, 30),
            monthly_rent=5000.00, deposit_amount=10000.00, created_by=any_user_id,
        )
        # terminate c2
        await service.terminate_contract(
            contract_id=c2.id, reason="tenant_moved_out", terminated_by=any_user_id,
        )

        active = await service.get_active_contracts(prop.id)
        assert len(active) == 1
        assert active[0].id == c1.id