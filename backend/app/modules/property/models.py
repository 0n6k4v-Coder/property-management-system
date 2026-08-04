"""Property module ORM models: Property, Building, Floor, Room (SDD §4.1.1, §4.2).

References:
- SDD.md §4.1.1: Entity Relationship Diagram
- SDD.md §4.2: Physical Schema (SQLAlchemy 2.0 syntax)
- SDD.md §6: State Machines — RoomStatus transitions
"""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Any

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

if TYPE_CHECKING:
    from app.modules.auth.models import UserPropertyScope
    from app.modules.billing.models import Invoice, MeterReading
    from app.modules.maintenance.models import MaintenanceRequest
from app.modules.property.constants import RoomStatus, RoomType
from app.shared.database import Base


class Property(Base):
    """A real-estate property (dormitory, apartment building, etc.).

    A Property is the top-level aggregate.  It contains multiple Buildings,
    each of which may contain Floors, each of which contains Rooms.
    """

    __tablename__ = "properties"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    address: Mapped[str] = mapped_column(Text, nullable=False)
    billing_due_day: Mapped[int] = mapped_column(nullable=False)
    min_deposit_months: Mapped[int] = mapped_column(default=2, nullable=False)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # ── Relationships ──────────────────────────────────────────────────
    buildings: Mapped[list[Building]] = relationship(
        "Building", back_populates="property", lazy="selectin",
        cascade="all, delete-orphan",
    )
    rooms: Mapped[list[Room]] = relationship(
        "Room", back_populates="property", lazy="selectin",
        cascade="all, delete-orphan",
    )
    invoices: Mapped[list[Invoice]] = relationship(
        "Invoice", back_populates="property", lazy="selectin", cascade="all, delete-orphan"
    )
    users: Mapped[list[UserPropertyScope]] = relationship(
        "UserPropertyScope", back_populates="property", lazy="selectin", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Property(id={self.id}, name={self.name})>"


class Building(Base):
    """A building within a Property (can have floors or be single-storey).

    If *has floors* (via Floor records), the ``BR-12`` rule requires
    that every Room belongs to a Floor.  Single-storey buildings can
    omit floors.
    """

    __tablename__ = "buildings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
    )
    property_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("properties.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    display_order: Mapped[int] = mapped_column(default=0, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── Relationships ──────────────────────────────────────────────────
    property: Mapped[Property] = relationship("Property", back_populates="buildings")
    floors: Mapped[list[Floor]] = relationship(
        "Floor", back_populates="building", lazy="selectin",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("ix_buildings_property_order", "property_id", "display_order"),
    )

    def __repr__(self) -> str:
        return f"<Building(id={self.id}, name={self.name})>"


class Floor(Base):
    """A single floor inside a Building.

    Optional per BR-12: buildings without floors can have rooms directly
    assigned to the building with ``floor_id = NULL``.
    """

    __tablename__ = "floors"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
    )
    building_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("buildings.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    display_order: Mapped[int] = mapped_column(default=0, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── Relationships ──────────────────────────────────────────────────
    building: Mapped[Building] = relationship("Building", back_populates="floors")
    rooms: Mapped[list[Room]] = relationship(
        "Room", back_populates="floor", lazy="selectin",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("ix_floors_building_order", "building_id", "display_order"),
    )

    def __repr__(self) -> str:
        return f"<Floor(id={self.id}, name={self.name})>"


class Room(Base):
    """A rentable unit within a Property/Building/Floor hierarchy.

    Status transitions follow the state machine defined in SDD §6:
        available ↔ occupied ↔ maintenance

    References:
        - BR-11: room_number unique per building (index constraint below).
        - BR-12: floor_id is optional if building has no floors.
    """

    __tablename__ = "rooms"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
    )
    property_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("properties.id", ondelete="CASCADE"),
        nullable=False,
    )
    building_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("buildings.id", ondelete="CASCADE"),
        nullable=False,
    )
    floor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("floors.id", ondelete="SET NULL"),
        nullable=True,
    )
    room_number: Mapped[str] = mapped_column(String(20), nullable=False)
    room_type: Mapped[str] = mapped_column(
        String(50), default=RoomType.STUDIO, nullable=False,
    )
    base_rent: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), default=0.00, nullable=False,
    )
    status: Mapped[str] = mapped_column(
        String(20), default=RoomStatus.AVAILABLE, nullable=False,
    )
    images: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)

    # ── Relationships ──────────────────────────────────────────────────
    property: Mapped[Property] = relationship("Property", back_populates="rooms")
    floor: Mapped[Floor | None] = relationship("Floor", back_populates="rooms")
    meter_readings: Mapped[list[MeterReading]] = relationship(
        "MeterReading", back_populates="room", lazy="selectin", cascade="all, delete-orphan"
    )
    invoices: Mapped[list[Invoice]] = relationship(
        "Invoice", back_populates="room", lazy="selectin", cascade="all, delete-orphan"
    )
    maintenance_requests: Mapped[list[MaintenanceRequest]] = relationship(
        "MaintenanceRequest", back_populates="room", lazy="selectin", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_rooms_property_status", "property_id", "status"),
        Index(
            "ix_rooms_number_unique_per_building",
            "building_id",
            "room_number",
            unique=True,
        ),
    )

    def __repr__(self) -> str:
        return f"<Room(id={self.id}, number={self.room_number}, status={self.status})>"
