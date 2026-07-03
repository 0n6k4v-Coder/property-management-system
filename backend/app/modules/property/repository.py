"""Data access layer for Property module (SDD §2.2 — Infrastructure layer).

References:
- CODE_STYLE.md §3.2: Async query patterns (SQLAlchemy 2.0 select())
- SDD.md §4.2: Physical schema
"""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.property.models import Building, Floor, Property, Room


class PropertyRepository:
    """Database queries for the Property aggregate root."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(self, property_obj: Property) -> Property:
        """Persist a new Property and return it with an ID assigned."""
        self.db.add(property_obj)
        await self.db.flush()
        await self.db.refresh(property_obj)
        return property_obj

    async def get_by_id(self, property_id: uuid.UUID) -> Property | None:
        """Retrieve a Property by primary key with its buildings eagerly loaded."""
        stmt = (
            select(Property)
            .where(Property.id == property_id)
            .options(selectinload(Property.buildings))
        )
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def get_all(self) -> list[Property]:
        """Return all properties with buildings preloaded."""
        stmt = select(Property).options(selectinload(Property.buildings))
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def update(self, property_obj: Property) -> Property:
        """Persist changes to an existing Property."""
        await self.db.flush()
        await self.db.refresh(property_obj)
        return property_obj


class BuildingRepository:
    """Database queries for the Building entity."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(self, building: Building) -> Building:
        self.db.add(building)
        await self.db.flush()
        await self.db.refresh(building)
        return building

    async def get_by_id(self, building_id: uuid.UUID) -> Building | None:
        stmt = (
            select(Building)
            .where(Building.id == building_id)
            .options(selectinload(Building.floors))
        )
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def get_by_property(self, property_id: uuid.UUID) -> list[Building]:
        stmt = (
            select(Building)
            .where(Building.property_id == property_id)
            .order_by(Building.display_order)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def building_has_floors(self, building_id: uuid.UUID) -> bool:
        """Check whether a building has any Floor records created (BR-12)."""
        stmt = select(Floor).where(Floor.building_id == building_id).limit(1)
        result = await self.db.execute(stmt)
        return result.scalars().first() is not None


class FloorRepository:
    """Database queries for the Floor entity."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(self, floor: Floor) -> Floor:
        self.db.add(floor)
        await self.db.flush()
        await self.db.refresh(floor)
        return floor

    async def get_by_id(self, floor_id: uuid.UUID) -> Floor | None:
        stmt = select(Floor).where(Floor.id == floor_id)
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def get_by_building(self, building_id: uuid.UUID) -> list[Floor]:
        stmt = (
            select(Floor)
            .where(Floor.building_id == building_id)
            .order_by(Floor.display_order)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())


class RoomRepository:
    """Database queries for the Room entity."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(self, room: Room) -> Room:
        self.db.add(room)
        await self.db.flush()
        await self.db.refresh(room)
        return room

    async def get_by_id(self, room_id: uuid.UUID) -> Room | None:
        stmt = select(Room).where(Room.id == room_id)
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def get_rooms_by_building(self, building_id: uuid.UUID) -> list[Room]:
        stmt = (
            select(Room)
            .where(Room.building_id == building_id)
            .order_by(Room.room_number)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_rooms_by_status(
        self,
        property_id: uuid.UUID,
        status: str,
    ) -> list[Room]:
        """Filter rooms by property and current status.

        Uses the ``ix_rooms_property_status`` composite index.
        """
        stmt = (
            select(Room)
            .where(Room.property_id == property_id, Room.status == status)
            .order_by(Room.room_number)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def room_number_exists(
        self,
        building_id: uuid.UUID,
        room_number: str,
    ) -> bool:
        """Check for duplicate room number within a building (BR-11)."""
        stmt = (
            select(Room)
            .where(Room.building_id == building_id, Room.room_number == room_number)
            .limit(1)
        )
        result = await self.db.execute(stmt)
        return result.scalars().first() is not None

    async def update_status(
        self,
        room_id: uuid.UUID,
        new_status: str,
    ) -> Room | None:
        """Update the status of a room and return the updated object."""
        room = await self.get_by_id(room_id)
        if room is None:
            return None
        room.status = new_status
        await self.db.flush()
        await self.db.refresh(room)
        return room

    async def get_rooms_by_property(self, property_id: uuid.UUID) -> list[Room]:
        """Return all rooms belonging to a property, ordered by room number."""
        stmt = (
            select(Room)
            .where(Room.property_id == property_id)
            .order_by(Room.room_number)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
