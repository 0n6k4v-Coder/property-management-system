"""User model for auth module (SDD.md §4.1.1, §4.2)."""

import uuid
from datetime import datetime

from sqlalchemy import String, Boolean, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.database import Base


class User(Base):
    """Application user with authentication credentials and account state.

    This model represents a human or system user that can authenticate
    via the auth module.  Every user belongs to at least one property
    through the ``property_scopes`` many-to-many relationship (added
    in Phase 2).

    References:
        - SDD.md §4.1.1: User entity in ERD
        - SDD.md §4.2: Physical schema — users table
        - SDD.md §2.1: Auth module specification (FR-USER-01~03)

    Table properties:
        - INSERT-only idempotency: primary key is a client-generated UUID.
        - ``updated_at`` is set automatically by ``onupdate`` on each row
          modification.  No manual assignment is required.
    """

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        nullable=False,
        index=True,
    )
    password_hash: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    full_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    phone: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # ── Relationships (prepared for Phase 2) ──────────────────────────
    # property_scopes: Mapped[list["Property"]] = relationship(
    #     secondary="user_property_scopes",
    #     back_populates="users",
    #     lazy="selectin",
    # )

    def __repr__(self) -> str:
        return f"<User(id={self.id}, email={self.email})>"
