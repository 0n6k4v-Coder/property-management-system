"""Billing module SQLAlchemy models.

References:
- SDD.md §4.2: Physical schema
- BR-10: Utility rate cascade
- BR-12: Invoice calculation breakdown
"""

import enum
import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Column,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship

from app.shared.database import Base


class InvoiceStatus(str, enum.Enum):
    """Invoice lifecycle status."""

    DRAFT = "draft"
    ISSUED = "issued"
    PAID = "paid"
    PARTIAL = "partial"
    OVERDUE = "overdue"
    CANCELLED = "cancelled"

    def __str__(self) -> str:
        return self.value


class LineItemType(str, enum.Enum):
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

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    room_id = Column(PG_UUID(as_uuid=True), ForeignKey("rooms.id"), index=True)
    billing_month = Column(Integer, index=True)
    billing_year = Column(Integer, index=True)
    electric_previous = Column(Integer, default=0)
    electric_current = Column(Integer, default=0)
    water_previous = Column(Integer, default=0)
    water_current = Column(Integer, default=0)
    recorded_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    # Computed properties
    @property
    def electric_used(self) -> int:
        return max(0, self.electric_current - self.electric_previous)

    @property
    def water_used(self) -> int:
        return max(0, self.water_current - self.water_previous)

    room = relationship("Room", back_populates="meter_readings")

    __table_args__ = (
        UniqueConstraint("room_id", "billing_month", "billing_year", name="uq_meter_reading_room_month_year"),
    )


class UtilityRate(Base):
    """Utility rates with cascade scope support (BR-10).

    Rates can be defined at property, building, floor, or room level.
    The most specific matching rate is used (room > floor > building > property).
    """

    __tablename__ = "utility_rates"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    scope_type = Column(String(20), index=True)  # 'property', 'building', 'floor', 'room'
    scope_id = Column(PG_UUID(as_uuid=True), index=True)

    # Rate values (per unit)
    electric_rate_per_unit = Column(Numeric(10, 4), default=Decimal("0"))
    water_rate_per_unit = Column(Numeric(10, 4), default=Decimal("0"))
    common_fee = Column(Numeric(10, 4), default=Decimal("0"))

    # Effective date range
    effective_from = Column(Date, index=True)
    effective_to = Column(Date, index=True, nullable=True)

    # Audit columns
    created_by = Column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index("ix_utility_rates_scope_effective", "scope_type", "scope_id", "effective_from", "effective_to"),
        UniqueConstraint("scope_type", "scope_id", "effective_from", name="uq_utility_rate_scope_effective"),
    )


class Invoice(Base):
    """Invoice records for tenant billing."""

    __tablename__ = "invoices"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_number = Column(String(50), unique=True, index=True)
    contract_id = Column(PG_UUID(as_uuid=True), ForeignKey("contracts.id"), index=True)
    room_id = Column(PG_UUID(as_uuid=True), ForeignKey("rooms.id"), index=True)
    tenant_id = Column(PG_UUID(as_uuid=True), ForeignKey("tenants.id"), index=True)
    property_id = Column(PG_UUID(as_uuid=True), ForeignKey("properties.id"), index=True)

    billing_month = Column(Integer, index=True)
    billing_year = Column(Integer, index=True)
    due_date = Column(Date, index=True)

    status = Column(
        Enum(InvoiceStatus, name="invoice_status_enum", values_callable=lambda x: [e.value for e in x]),
        default=InvoiceStatus.DRAFT.value,
        index=True,
    )

    total_amount = Column(Numeric(12, 2), default=Decimal("0"))
    paid_amount = Column(Numeric(12, 2), default=Decimal("0"))

    created_by = Column(PG_UUID(as_uuid=True))
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    issued_at = Column(DateTime, nullable=True)
    paid_at = Column(DateTime, nullable=True)

    # Relationships
    contract = relationship("Contract", back_populates="invoices")
    room = relationship("Room", back_populates="invoices")
    tenant = relationship("Tenant", back_populates="invoices")
    property = relationship("Property", back_populates="invoices")
    line_items = relationship(
        "InvoiceLineItem", back_populates="invoice", cascade="all, delete-orphan"
    )
    payments = relationship("Payment", back_populates="invoice", cascade="all, delete-orphan")


class InvoiceLineItem(Base):
    """Individual line items on an invoice (BR-12 breakdown)."""

    __tablename__ = "invoice_line_items"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_id = Column(PG_UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="CASCADE"), index=True)
    line_type = Column(Enum(LineItemType, name="line_item_type_enum", values_callable=lambda x: [e.value for e in x]), index=True)
    description = Column(String(500))
    quantity = Column(Numeric(10, 2), default=Decimal("1"))
    unit_price = Column(Numeric(12, 4))
    amount = Column(Numeric(12, 2))

    created_at = Column(DateTime, default=datetime.utcnow)

    invoice = relationship("Invoice", back_populates="line_items")


class Payment(Base):
    """Payment records for invoices."""

    __tablename__ = "payments"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_id = Column(PG_UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="CASCADE"), index=True)
    amount = Column(Numeric(12, 2))
    method = Column(String(50))  # 'cash', 'bank_transfer', 'credit_card', 'qr_code', 'wallet'
    reference = Column(String(100), nullable=True)  # Transaction ID, slip number, etc.
    payment_date = Column(Date, default=date.today, index=True)
    recorded_by = Column(PG_UUID(as_uuid=True), nullable=False)
    processed_by = Column(PG_UUID(as_uuid=True), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    invoice = relationship("Invoice", back_populates="payments")
