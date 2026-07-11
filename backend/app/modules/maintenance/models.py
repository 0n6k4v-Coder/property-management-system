"""Maintenance module ORM models: MaintenanceRequest (SDD §4.1.1, §4.2).

References:
    - SDD.md §4.1.1: Entity Relationship Diagram
    - SDD.md §4.2: Physical Schema (SQLAlchemy 2.0 syntax)
    - BR-08: Request tied to room + user (audit)
    - BR-09: Status workflow (pending → in_progress → resolved/cancelled)
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.modules.maintenance.constants import MaintenanceStatus, Priority
from app.shared.database import Base


class MaintenanceRequest(Base):
    """A maintenance request tied to a room (BR-08).

    Status transitions follow the BR-09 workflow:

        pending ──→ in_progress ──→ resolved
                        └──→ cancelled

    References:
        - SDD §6.3: Room Status Machine
        - BR-08: Request tied to room + user (audit)
        - BR-09: Status workflow validation
    """

    __tablename__ = "maintenance_requests"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
    )
    property_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("properties.id", ondelete="CASCADE"),
        nullable=False,
    )
    room_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("rooms.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    priority: Mapped[str] = mapped_column(
        String(20), default=Priority.MEDIUM, nullable=False,
    )
    status: Mapped[str] = mapped_column(
        String(20), default=MaintenanceStatus.PENDING, nullable=False,
    )
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # ── Audit timestamps ─────────────────────────────────────────────────
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

    # ── Indexes ───────────────────────────────────────────────────────────
    __table_args__ = (
        Index(
            "ix_maintenance_requests_property_status",
            "property_id",
            "status",
        ),
        Index(
            "ix_maintenance_requests_created_at_desc",
            text("created_at DESC"),
        ),
    )

    def __repr__(self) -> str:
        return (
            f"<MaintenanceRequest(id={self.id}, title={self.title}, "
            f"status={self.status})>"
        )
