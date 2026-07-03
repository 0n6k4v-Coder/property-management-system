"""Tenant ORM model with encrypted ID card (SDD §2.4, §4.1.1, §4.2).

References:
- SDD.md §2.4: Tenant Module Specification (FR-TENANT-01~04)
- SDD.md §4.1.1: Tenant entity in ERD
- SDD.md §4.2: Physical schema — tenants table
- SDD.md §4.4: Security & access control (encrypted at rest)
"""

from datetime import datetime

import uuid

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.shared.database import Base


class Tenant(Base):
    """A person renting a room within a property.

    Sensitive personal data (``id_card_number``) is encrypted with Fernet
    *before* being stored in ``id_card_number_encrypted``.  The plain-text
    value is **never** returned in any API response.

    Table properties:
        - ``id_card_number_encrypted`` stores the Fernet ciphertext as a
          base64-encoded string (max 500 chars).
        - ``phone`` + ``property_id`` have a unique index to enforce
          BR-15 (phone unique per property).
    """

    __tablename__ = "tenants"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
    )
    property_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("properties.id", ondelete="CASCADE"),
        nullable=False,
    )
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    id_card_number_encrypted: Mapped[str] = mapped_column(
        String(500), nullable=False,
    )
    phone: Mapped[str] = mapped_column(String(20), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    emergency_contact_name: Mapped[str | None] = mapped_column(
        String(255), nullable=True,
    )
    emergency_contact_phone: Mapped[str | None] = mapped_column(
        String(20), nullable=True,
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

    __table_args__ = (
        Index(
            "ix_tenants_property_phone_unique",
            "property_id",
            "phone",
            unique=True,
        ),
        Index("ix_tenants_phone", "phone"),
        Index("ix_tenants_property", "property_id", "full_name"),
    )

    # ── Relationships ──────────────────────────────────────────────────
    invoices: Mapped[list["Invoice"]] = relationship(
        "Invoice", back_populates="tenant", lazy="selectin", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Tenant(id={self.id}, name={self.full_name})>"
