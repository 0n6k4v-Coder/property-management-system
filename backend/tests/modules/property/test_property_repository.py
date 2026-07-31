"""Integration tests for Property module repositories."""

import uuid

import pytest

from app.modules.auth.models import User
from app.modules.property.models import Building, Floor, Property, Room
from app.modules.property.repository import (
    BuildingRepository,
    FloorRepository,
    PropertyRepository,
    RoomRepository,
)
from app.shared.security import hash_password


@pytest.mark.integration
async def test_property_repository_full(db_session):
    repo = PropertyRepository(db_session)

    # 1. Create property
    prop = Property(
        name="Repo Test Prop",
        address="123 Repo St",
        billing_due_day=5,
        min_deposit_months=2,
    )
    saved_prop = await repo.create(prop)
    assert saved_prop.id is not None

    # 2. Get by ID
    by_id = await repo.get_by_id(saved_prop.id)
    assert by_id is not None
    assert by_id.name == "Repo Test Prop"

    # Non-existent ID
    assert await repo.get_by_id(uuid.uuid4()) is None

    # 3. Get all
    all_props = await repo.get_all()
    assert len(all_props) >= 1

    # 4. Get paginated & count_all
    paginated = await repo.get_paginated(0, 10)
    assert len(paginated) >= 1
    total_count = await repo.count_all()
    assert total_count >= 1

    # 5. User scope testing
    user = User(
        id=uuid.uuid4(),
        email="scope-user@example.com",
        password_hash=hash_password("Pass123!"),
        full_name="Scope User",
        phone="0899999999",
        is_active=True,
    )
    db_session.add(user)
    await db_session.flush()

    await repo.add_owner_scope(user.id, saved_prop.id)

    user_props = await repo.get_paginated_for_user(user.id, 0, 10)
    assert len(user_props) == 1
    user_count = await repo.count_for_user(user.id)
    assert user_count == 1

    # 6. Update property
    saved_prop.name = "Updated Repo Prop"
    updated = await repo.update(saved_prop)
    assert updated.name == "Updated Repo Prop"


@pytest.mark.integration
async def test_building_repository_full(db_session):
    prop_repo = PropertyRepository(db_session)
    building_repo = BuildingRepository(db_session)
    floor_repo = FloorRepository(db_session)

    prop = Property(
        name="Building Prop",
        address="123 Bldg St",
        billing_due_day=5,
        min_deposit_months=2,
    )
    await prop_repo.create(prop)

    bldg = Building(
        property_id=prop.id,
        name="Building A",
        display_order=1,
    )
    saved_bldg = await building_repo.create(bldg)
    assert saved_bldg.id is not None

    by_id = await building_repo.get_by_id(saved_bldg.id)
    assert by_id is not None
    assert by_id.name == "Building A"

    by_prop = await building_repo.get_by_property(prop.id)
    assert len(by_prop) == 1

    # Check has_floors (initially False)
    assert await building_repo.building_has_floors(saved_bldg.id) is False

    # Add a floor
    flr = Floor(
        building_id=saved_bldg.id,
        name="Floor 1",
        display_order=1,
    )
    await floor_repo.create(flr)

    # Check has_floors (now True)
    assert await building_repo.building_has_floors(saved_bldg.id) is True


@pytest.mark.integration
async def test_floor_repository_full(db_session):
    prop_repo = PropertyRepository(db_session)
    building_repo = BuildingRepository(db_session)
    floor_repo = FloorRepository(db_session)

    prop = Property(
        name="Floor Prop",
        address="123 Floor St",
        billing_due_day=5,
        min_deposit_months=2,
    )
    await prop_repo.create(prop)

    bldg = Building(
        property_id=prop.id,
        name="Building F",
        display_order=1,
    )
    await building_repo.create(bldg)

    flr = Floor(
        building_id=bldg.id,
        name="Floor 1",
        display_order=1,
    )
    saved_flr = await floor_repo.create(flr)
    assert saved_flr.id is not None

    by_id = await floor_repo.get_by_id(saved_flr.id)
    assert by_id is not None
    assert by_id.name == "Floor 1"

    by_bldg = await floor_repo.get_by_building(bldg.id)
    assert len(by_bldg) == 1


@pytest.mark.integration
async def test_room_repository_full(db_session):
    prop_repo = PropertyRepository(db_session)
    building_repo = BuildingRepository(db_session)
    floor_repo = FloorRepository(db_session)
    room_repo = RoomRepository(db_session)

    prop = Property(
        name="Room Prop",
        address="123 Room St",
        billing_due_day=5,
        min_deposit_months=2,
    )
    await prop_repo.create(prop)

    bldg = Building(
        property_id=prop.id,
        name="Building R",
        display_order=1,
    )
    await building_repo.create(bldg)

    flr = Floor(
        building_id=bldg.id,
        name="Floor 1",
        display_order=1,
    )
    await floor_repo.create(flr)

    room = Room(
        property_id=prop.id,
        building_id=bldg.id,
        floor_id=flr.id,
        room_number="101",
        status="available",
    )
    saved_room = await room_repo.create(room)
    assert saved_room.id is not None

    # Get by ID
    by_id = await room_repo.get_by_id(saved_room.id)
    assert by_id is not None
    assert by_id.room_number == "101"

    # Get by building
    by_bldg = await room_repo.get_rooms_by_building(bldg.id)
    assert len(by_bldg) == 1

    # Get by status
    by_status = await room_repo.get_rooms_by_status(prop.id, "available")
    assert len(by_status) == 1
    assert len(await room_repo.get_rooms_by_status(prop.id, "occupied")) == 0

    # Room number exists check
    assert await room_repo.room_number_exists(bldg.id, "101") is True
    assert await room_repo.room_number_exists(bldg.id, "999") is False

    # Update status
    updated_room = await room_repo.update_status(saved_room.id, "occupied")
    assert updated_room is not None
    assert updated_room.status == "occupied"

    # Non-existent update status
    assert await room_repo.update_status(uuid.uuid4(), "occupied") is None

    # Get rooms by property & paginated & count
    rooms_by_prop = await room_repo.get_rooms_by_property(prop.id)
    assert len(rooms_by_prop) == 1

    rooms_paginated = await room_repo.get_rooms_by_property_paginated(prop.id, 0, 10)
    assert len(rooms_paginated) == 1

    count_rooms = await room_repo.count_rooms_by_property(prop.id)
    assert count_rooms == 1
