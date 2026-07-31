"""Contract module ORM models: Contract, LeaseExtension, ContractTermination (SDD §4.1.1, §4.2).

References:
    - SDD.md §4.1.1: Entity Relationship Diagram
    - SDD.md §4.2: Physical Schema (SQLAlchemy 2.0 syntax)
    - SDD.md §6.2: Contract Status Machine
    - SDD.md §5.2: Contract Termination → Room Status Update
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Date,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.modules.contract.constants import ContractStatus
from app.shared.database import Base

# Forward reference for Invoice (from billing module) to avoid circular imports
if False:
    from app.modules.billing.models import Invoice


class Contract(Base):
    """A rental contract linking a Tenant to a Room.

    Each contract has a defined start/end date, monthly rent, and
    deposit amount.  The **BR-01** rule enforces that a room can have
    at most one *active* contract at any time via a partial unique
    index ``ix_contracts_room_active_unique``.

    Status transitions follow the state machine defined in SDD §6.2:

        draft ──→ active ──→ terminated
                              └──→ expired (auto via scheduler)

    References:
        - SDD §6.2: Contract Status Machine
        - BR-01: One active contract per room
        - BR-04: Termination requires reason + audit
    """

    __tablename__ = "contracts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
    )
    room_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("rooms.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    property_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("properties.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    monthly_rent: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), nullable=False,
    )
    deposit_amount: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), nullable=False,
    )
    status: Mapped[str] = mapped_column(
        String(20), default=ContractStatus.DRAFT, nullable=False, index=True,
    )
    special_conditions: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_renewal: Mapped[bool] = mapped_column(default=False, nullable=False)
    renewed_from_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("contracts.id", ondelete="SET NULL"),
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

    # ── Partial index for BR-01 (one active contract per room) ─────────
    __table_args__ = (
        Index(
            "ix_contracts_room_active_unique",
            "room_id",
            unique=True,
            postgresql_where=text("status = 'active'"),
        ),
        Index(
            "ix_contracts_property_status",
            "property_id",
            "status",
        ),
        Index(
            "ix_contracts_tenant_status",
            "tenant_id",
            "status",
        ),
    )

    # ── Relationships ──────────────────────────────────────────────────
    termination: Mapped[ContractTermination | None] = relationship(
        "ContractTermination",
        back_populates="contract",
        uselist=False,
        lazy="selectin",
        cascade="all, delete-orphan",
    )
    extensions: Mapped[list[LeaseExtension]] = relationship(
        "LeaseExtension",
        back_populates="contract",
        lazy="selectin",
        cascade="all, delete-orphan",
    )
    invoices: Mapped[list[Invoice]] = relationship(
        "Invoice",
        back_populates="contract",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return (
            f"<Contract(id={self.id}, room={self.room_id}, "
            f"status={self.status}, rent={self.monthly_rent})>"
        )


class LeaseExtension(Base):
    """Records a lease extension — extending the contract's end_date.

    Each extension creates a new row so the audit trail is complete.
    The contract's ``end_date`` is updated to the new ``extended_to``
    date when the extension is applied.

    References:
        - SDD §5.2: Contract Termination flow (extend before terminate)
    """

    __tablename__ = "lease_extensions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
    )
    contract_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("contracts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    previous_end_date: Mapped[date] = mapped_column(Date, nullable=False)
    extended_to: Mapped[date] = mapped_column(Date, nullable=False)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── Audit ────────────────────────────────────────────────────────────
    extended_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )

    # ── Relationships ──────────────────────────────────────────────────
    contract: Mapped[Contract] = relationship("Contract", back_populates="extensions")

    def __repr__(self) -> str:
        return (
            f"<LeaseExtension(id={self.id}, contract={self.contract_id}, "
            f"extended_to={self.extended_to})>"
        )


class ContractTermination(Base):
    """Records the termination of a contract (BR-04).

    Created when ``ContractService.terminate_contract()`` is called.
    The termination reason is mandatory and stored alongside the
    effective date.  After termination the linked Room status is set
    to ``available``.

    References:
        - SDD §5.2: Contract Termination Sequence Diagram
        - BR-04: Termination requires reason + audit
    """

    __tablename__ = "contract_terminations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
    )
    contract_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("contracts.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,  # one termination per contract
        index=True,
    )
    reason: Mapped[str] = mapped_column(String(100), nullable=False)
    termination_date: Mapped[date] = mapped_column(Date, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── Audit ────────────────────────────────────────────────────────────
    terminated_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )

    # ── Relationships ──────────────────────────────────────────────────
    contract: Mapped[Contract] = relationship("Contract", back_populates="termination")

    def __repr__(self) -> str:
        return (
            f"<ContractTermination(id={self.id}, contract={self.contract_id}, "
            f"reason={self.reason})>"
        )

