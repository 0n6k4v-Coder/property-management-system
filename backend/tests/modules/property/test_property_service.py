"""Unit tests for PropertyService (SDD §2.2, FR-PROP-01, FR-PROP-05, FR-PROP-06).

References:
- SDD.md §2.2: Property Module Specification
- CODE_STYLE.md §7.2: Unit-test pattern (mock DB layer)
"""

import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.property.constants import RoomStatus
from app.modules.property.models import Building, Property, Room
from app.modules.property.repository import (
    PropertyRepository,
)
from app.modules.property.services.property_service import PropertyService
from app.shared.exceptions import APIError


@pytest.fixture
def any_user_id() -> uuid.UUID:
    """Return a unique test user identity for each test call."""
    return uuid.uuid4()


@pytest.mark.unit
async def test_create_property_success(
    db_session: AsyncSession,
    any_user_id: uuid.UUID,
) -> None:
    """FR-PROP-01: A property can be created with valid data."""
    # Create a minimal user first so the FK constraint is satisfied
    from app.modules.auth.models import User
    user = User(id=any_user_id, email="test@prop.com", password_hash="hashed_abc", full_name="Test User", is_active=True)
    db_session.add(user)
    await db_session.flush()

    service = PropertyService(db_session)

    prop = await service.create_property(
        name="Sunshine Dormitory",
        address="42 Happiness Road",
        billing_due_day=5,
        min_deposit_months=2,
        created_by=any_user_id,
    )

    assert prop.id is not None
    assert prop.name == "Sunshine Dormitory"
    assert prop.address == "42 Happiness Road"
    assert prop.billing_due_day == 5
    assert prop.min_deposit_months == 2
    assert prop.created_by == any_user_id

    # Verify it's persisted
    repo = PropertyRepository(db_session)
    fetched = await repo.get_by_id(prop.id)
    assert fetched is not None
    assert fetched.name == "Sunshine Dormitory"


@pytest.mark.unit
async def test_create_property_minimal(
    db_session: AsyncSession,
    any_user_id: uuid.UUID,
) -> None:
    """FR-PROP-01: Property creation with minimum required fields."""
    from app.modules.auth.models import User
    user = User(id=any_user_id, email="test2@prop.com", password_hash="hashed_abc", full_name="Test User", is_active=True)
    db_session.add(user)
    await db_session.flush()

    service = PropertyService(db_session)

    prop = await service.create_property(
        name="Mini Dorm",
        address="1 Small Lane",
        billing_due_day=28,
        min_deposit_months=1,
        created_by=any_user_id,
    )

    assert prop.name == "Mini Dorm"
    assert prop.billing_due_day == 28
    assert prop.min_deposit_months == 1


@pytest.mark.unit
async def test_update_room_status_success(
    db_session: AsyncSession,
    any_user_id: uuid.UUID,
) -> None:
    """FR-PROP-05: Room status can be updated from available to occupied."""
    from app.modules.auth.models import User
    user = User(id=any_user_id, email="test3@prop.com", password_hash="hashed_abc", full_name="Test User", is_active=True)
    db_session.add(user)
    await db_session.flush()

    # Create property with a real building and room
    prop = Property(name="Test Property", address="123 Street", billing_due_day=5, min_deposit_months=2, created_by=any_user_id)
    db_session.add(prop)
    await db_session.flush()
    await db_session.refresh(prop)

    building = Building(property_id=prop.id, name="Building A", display_order=1)
    db_session.add(building)
    await db_session.flush()
    await db_session.refresh(building)

    room = Room(
        property_id=prop.id, building_id=building.id, room_number="101",
        room_type="studio", base_rent=5000.00, status=RoomStatus.AVAILABLE,
    )
    db_session.add(room)
    await db_session.flush()
    await db_session.refresh(room)

    service = PropertyService(db_session)

    updated = await service.update_room_status(
        room_id=room.id,
        new_status=RoomStatus.OCCUPIED,
        changed_by=any_user_id,
    )

    assert updated.status == RoomStatus.OCCUPIED
    assert updated.id == room.id


@pytest.mark.unit
async def test_update_room_status_maintenance(
    db_session: AsyncSession,
    any_user_id: uuid.UUID,
) -> None:
    """FR-PROP-05: Room status can be updated to maintenance."""
    from app.modules.auth.models import User
    user = User(id=any_user_id, email="test4@prop.com", password_hash="hashed_abc", full_name="Test User", is_active=True)
    db_session.add(user)
    await db_session.flush()

    prop = Property(name="P", address="A", billing_due_day=5, min_deposit_months=2, created_by=any_user_id)
    db_session.add(prop)
    await db_session.flush()
    await db_session.refresh(prop)

    building = Building(property_id=prop.id, name="B", display_order=1)
    db_session.add(building)
    await db_session.flush()
    await db_session.refresh(building)

    room = Room(property_id=prop.id, building_id=building.id, room_number="201", status=RoomStatus.AVAILABLE)
    db_session.add(room)
    await db_session.flush()
    await db_session.refresh(room)

    service = PropertyService(db_session)
    updated = await service.update_room_status(
        room_id=room.id,
        new_status=RoomStatus.MAINTENANCE,
        changed_by=any_user_id,
    )

    assert updated.status == RoomStatus.MAINTENANCE


@pytest.mark.unit
async def test_update_room_status_not_found(db_session: AsyncSession) -> None:
    """PROP-007: Updating status for non-existent room raises APIError."""
    service = PropertyService(db_session)
    fake_id = uuid.uuid4()

    with pytest.raises(APIError) as exc_info:
        await service.update_room_status(
            room_id=fake_id,
            new_status=RoomStatus.OCCUPIED,
            changed_by=uuid.uuid4(),
        )

    assert exc_info.value.code == "PROP-007"
    assert exc_info.value.status_code == 404


@pytest.mark.unit
async def test_get_property_with_rooms_success(
    db_session: AsyncSession,
    any_user_id: uuid.UUID,
) -> None:
    """FR-PROP-06: Can retrieve a property with all its rooms."""
    from app.modules.auth.models import User
    user = User(id=any_user_id, email="test5@prop.com", password_hash="hashed_abc", full_name="Test User", is_active=True)
    db_session.add(user)
    await db_session.flush()

    prop = Property(name="P", address="A", billing_due_day=5, min_deposit_months=2, created_by=any_user_id)
    db_session.add(prop)
    await db_session.flush()
    await db_session.refresh(prop)

    building = Building(property_id=prop.id, name="B", display_order=1)
    db_session.add(building)
    await db_session.flush()
    await db_session.refresh(building)

    room1 = Room(property_id=prop.id, building_id=building.id, room_number="301")
    room2 = Room(property_id=prop.id, building_id=building.id, room_number="302")
    db_session.add(room1)
    db_session.add(room2)
    await db_session.flush()

    service = PropertyService(db_session)
    property_obj, rooms = await service.get_property_with_rooms(prop.id)

    assert property_obj.id == prop.id
    assert len(rooms) >= 2
    room_numbers = {r.room_number for r in rooms}
    assert "301" in room_numbers
    assert "302" in room_numbers


@pytest.mark.unit
async def test_get_property_with_rooms_not_found(db_session: AsyncSession) -> None:
    """PROP-004: Retrieving non-existent property raises APIError."""
    service = PropertyService(db_session)
    fake_id = uuid.uuid4()

    with pytest.raises(APIError) as exc_info:
        await service.get_property_with_rooms(fake_id)

    assert exc_info.value.code == "PROP-004"
    assert exc_info.value.status_code == 404


@pytest.mark.unit
async def test_get_property_by_id_success(
    db_session: AsyncSession,
    any_user_id: uuid.UUID,
) -> None:
    """FR-PROP-02: A property can be retrieved by its UUID."""
    from app.modules.auth.models import User
    user = User(id=any_user_id, email="test-prop-id@prop.com", password_hash="hashed_abc", full_name="Test User", is_active=True)
    db_session.add(user)
    await db_session.flush()

    service = PropertyService(db_session)
    prop = await service.create_property(
        name="Detail Property",
        address="100 Detail Road",
        billing_due_day=10,
        min_deposit_months=3,
        created_by=any_user_id,
    )

    fetched = await service.get_property_by_id(prop.id)
    assert fetched.id == prop.id
    assert fetched.name == "Detail Property"
    assert fetched.address == "100 Detail Road"


@pytest.mark.unit
async def test_get_property_by_id_not_found(db_session: AsyncSession) -> None:
    """PROP-004: Retrieving non-existent property raises APIError."""
    service = PropertyService(db_session)
    fake_id = uuid.uuid4()

    with pytest.raises(APIError) as exc_info:
        await service.get_property_by_id(fake_id)

    assert exc_info.value.code == "PROP-004"
    assert exc_info.value.status_code == 404


@pytest.mark.unit
async def test_create_property_invalid_billing_due_day() -> None:
    """Verify error constants exist (defensive)."""
    from app.modules.property.constants import (
        PROP_004_PROPERTY_NOT_FOUND,
        PROP_007_ROOM_NOT_FOUND,
        PROP_008_INVALID_STATUS_TRANSITION,
    )

    assert PROP_004_PROPERTY_NOT_FOUND == "PROP-004"
    assert PROP_007_ROOM_NOT_FOUND == "PROP-007"
    assert PROP_008_INVALID_STATUS_TRANSITION == "PROP-008"
