"""Billing module SQLAlchemy models.

References:
- SDD.md §4.2: Physical schema
- BR-10: Utility rate cascade
- BR-12: Invoice calculation breakdown
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import (
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.shared.database import Base

if TYPE_CHECKING:
    from app.modules.contract.models import Contract
    from app.modules.property.models import Property, Room
    from app.modules.tenant.models import Tenant


class InvoiceStatus(StrEnum):
    """Invoice lifecycle status."""

    DRAFT = "draft"
    ISSUED = "issued"
    PAID = "paid"
    PARTIAL = "partial"
    OVERDUE = "overdue"
    CANCELLED = "cancelled"

    def __str__(self) -> str:
        return self.value


class LineItemType(StrEnum):
    """Invoice line item types."""

    RENT = "rent"
    ELECTRIC = "electric"
    WATER = "water"
    COMMON_FEE = "common_fee"
    DEPOSIT = "deposit"
    PENALTY = "penalty"
    DISCOUNT = "discount"
    OTHER = "other"

    def __str__(self) -> str:
        return self.value


class MeterReading(Base):
    """Meter reading records for utility billing."""

    __tablename__ = "meter_readings"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    room_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("rooms.id"), index=True
    )
    billing_month: Mapped[int] = mapped_column(Integer, index=True)
    billing_year: Mapped[int] = mapped_column(Integer, index=True)
    electric_previous: Mapped[int] = mapped_column(Integer, default=0)
    electric_current: Mapped[int] = mapped_column(Integer, default=0)
    water_previous: Mapped[int] = mapped_column(Integer, default=0)
    water_current: Mapped[int] = mapped_column(Integer, default=0)
    recorded_by: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )

    # Computed properties
    @property
    def electric_used(self) -> int:
        diff = self.electric_current - self.electric_previous
        return max(0, int(diff or 0))

    @property
    def water_used(self) -> int:
        diff = self.water_current - self.water_previous
        return max(0, int(diff or 0))

    room: Mapped[Room] = relationship("Room", back_populates="meter_readings")

    __table_args__ = (
        UniqueConstraint(
            "room_id", "billing_month", "billing_year", name="uq_meter_reading_room_month_year"
        ),
    )


class UtilityRate(Base):
    """Utility rates with cascade scope support (BR-10).

    Rates can be defined at property, building, floor, or room level.
    The most specific matching rate is used (room > floor > building > property).
    """

    __tablename__ = "utility_rates"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    scope_type: Mapped[str] = mapped_column(String(20), index=True)  # 'property', 'building', 'floor', 'room'
    scope_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), index=True)

    # Rate values (per unit)
    electric_rate_per_unit: Mapped[Decimal] = mapped_column(
        Numeric(10, 4), default=Decimal("0")
    )
    water_rate_per_unit: Mapped[Decimal] = mapped_column(
        Numeric(10, 4), default=Decimal("0")
    )
    common_fee: Mapped[Decimal] = mapped_column(
        Numeric(10, 4), default=Decimal("0")
    )

    # Effective date range
    effective_from: Mapped[date] = mapped_column(Date, index=True)
    effective_to: Mapped[date | None] = mapped_column(Date, index=True, nullable=True)

    # Audit columns
    created_by: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    __table_args__ = (
        Index(
            "ix_utility_rates_scope_effective",
            "scope_type",
            "scope_id",
            "effective_from",
            "effective_to",
        ),
        UniqueConstraint(
            "scope_type", "scope_id", "effective_from", name="uq_utility_rate_scope_effective"
        ),
    )


class Invoice(Base):
    """Invoice records for tenant billing."""

    __tablename__ = "invoices"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    invoice_number: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    contract_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("contracts.id"), index=True
    )
    room_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("rooms.id"), index=True
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("tenants.id"), index=True
    )
    property_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("properties.id"), index=True
    )

    billing_month: Mapped[int] = mapped_column(Integer, index=True)
    billing_year: Mapped[int] = mapped_column(Integer, index=True)
    due_date: Mapped[date] = mapped_column(Date, index=True)

    status: Mapped[InvoiceStatus] = mapped_column(
        Enum(InvoiceStatus, name="invoice_status_enum", values_callable=lambda x: [e.value for e in x]),
        default=InvoiceStatus.DRAFT.value,
        index=True,
    )

    total_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0"))
    paid_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0"))

    created_by: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )
    issued_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    contract: Mapped[Contract] = relationship("Contract", back_populates="invoices")
    room: Mapped[Room] = relationship("Room", back_populates="invoices")
    tenant: Mapped[Tenant] = relationship("Tenant", back_populates="invoices")
    property: Mapped[Property] = relationship("Property", back_populates="invoices")
    line_items: Mapped[list[InvoiceLineItem]] = relationship(
        "InvoiceLineItem", back_populates="invoice", cascade="all, delete-orphan"
    )
    payments: Mapped[list[Payment]] = relationship(
        "Payment", back_populates="invoice", cascade="all, delete-orphan"
    )


class InvoiceLineItem(Base):
    """Individual line items on an invoice (BR-12 breakdown)."""

    __tablename__ = "invoice_line_items"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    invoice_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="CASCADE"), index=True
    )
    line_type: Mapped[LineItemType] = mapped_column(
        Enum(LineItemType, name="line_item_type_enum", values_callable=lambda x: [e.value for e in x]),
        nullable=False,
    )
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 4), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)

    invoice: Mapped[Invoice] = relationship("Invoice", back_populates="line_items")


class Payment(Base):
    """Payment records for invoices."""

    __tablename__ = "payments"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    invoice_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="CASCADE"), index=True
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    method: Mapped[str] = mapped_column(String(50), nullable=False)  # cash, bank_transfer, credit_card, qr_code, wallet
    reference: Mapped[str | None] = mapped_column(String(100), nullable=True)  # Transaction ID / slip number
    payment_date: Mapped[date] = mapped_column(Date, default=date.today, index=True)
    recorded_by: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    processed_by: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )

    invoice: Mapped[Invoice] = relationship("Invoice", back_populates="payments")
