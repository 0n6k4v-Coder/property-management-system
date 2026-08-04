"""User model for auth module (SDD.md §4.1.1, §4.2)."""

import uuid
from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.shared.database import Base

if TYPE_CHECKING:
    from app.modules.property.models import Property


class PropertyRole(StrEnum):
    """Per-property role assigned to a user via ``user_property_scopes``.

    ``owner`` and ``admin`` bypass per-property scope checks; ``staff`` is
    scoped strictly to the listed properties.
    """

    owner = "owner"
    admin = "admin"
    staff = "staff"


class UserPropertyScope(Base):
    """Join table mapping a user to the properties they can access.

    Replaces the previously-hardcoded ``property_scopes`` claim.  A user
    with a row here for a given property is granted that property's role.
    ``owner``/``admin`` roles bypass per-property checks globally.

    References:
        - docs/API.md "Proposed Redesign" — anti-pattern #5 fix
        - REVIEW-2026-07-10-api-anti-pattern-audit.md §4.1
    """

    __tablename__ = "user_property_scopes"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    property_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("properties.id", ondelete="CASCADE"),
        primary_key=True,
    )
    role: Mapped[PropertyRole] = mapped_column(
        Enum(PropertyRole, name="property_role", native_enum=True),
        nullable=False,
        default=PropertyRole.staff,
    )

    user: Mapped[User] = relationship("User", back_populates="property_scopes")
    property: Mapped[Property] = relationship("Property", back_populates="users")

    def __repr__(self) -> str:
        return f"<UserPropertyScope(user_id={self.user_id}, property_id={self.property_id}, role={self.role.value})>"


class IdempotencyKey(Base):
    """Cached result of an idempotent POST (``/register``, ``/invite``).

    A repeated request carrying the same ``key`` within ``expires_at``
    returns the stored ``response_body`` instead of re-executing the
    handler (anti-pattern #1 fix).

    References:
        - docs/API.md "Proposed Redesign" — anti-pattern #1 fix
    """

    __tablename__ = "idempotency_keys"

    key: Mapped[str] = mapped_column(String(255), primary_key=True)
    request_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    response_body: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<IdempotencyKey(key={self.key}, expires_at={self.expires_at})>"


class User(Base):
    """Application user with authentication credentials and account state.

    This model represents a human or system user that can authenticate
    via the auth module.  Every user belongs to one or more properties
    through the ``property_scopes`` relationship (backed by
    ``user_property_scopes``).

    References:
        - SDD.md §4.1.1: User entity in ERD
        - SDD.md §4.2: Physical schema — users table
        - SDD.md §2.1: Auth module specification (FR-USER-01~03)
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
    # The ``jti`` (JWT ID) of the currently-valid refresh token.  Used to
    # invalidate the previous refresh token when a new one is issued
    # (refresh-token rotation).  ``None`` until the first login.
    current_refresh_jti: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True,
    )

    # ── Relationships ──────────────────────────────────────────────────
    property_scopes: Mapped[list[UserPropertyScope]] = relationship(
        "UserPropertyScope",
        back_populates="user",
        lazy="selectin",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<User(id={self.id}, email={self.email})>"
