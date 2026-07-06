"""Data access layer for Billing module (SDD §2.3 — Infrastructure layer).

References:
    - CODE_STYLE.md §3.2: Async query patterns (SQLAlchemy 2.0 select())
    - SDD.md §4.2: Physical schema
    - BR-10: Utility rate cascade resolution
    - BR-12: Invoice calculation breakdown
"""

import uuid
from datetime import date
from decimal import Decimal
from typing import List, Optional

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.billing.models import (
    Invoice,
    InvoiceLineItem,
    InvoiceStatus,
    MeterReading,
    Payment,
    UtilityRate,
)
from app.modules.billing.constants import LineItemType
from sqlalchemy import select


class BillingRepository:
    """Database queries for the Billing aggregate."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ── Meter Readings ─────────────────────────────────────────────────────

    async def create_meter_reading(
        self,
        room_id: uuid.UUID,
        billing_month: int,
        billing_year: int,
        electric_previous: int,
        electric_current: int,
        water_previous: int,
        water_current: int,
    ) -> MeterReading:
        """Create a new meter reading record.

        Business rule: current readings must be greater than previous.
        """
        if electric_current <= electric_previous:
            raise ValueError("Electric current reading must be greater than previous")
        if water_current <= water_previous:
            raise ValueError("Water current reading must be greater than previous")

        db_reading = MeterReading(
            room_id=room_id,
            billing_month=billing_month,
            billing_year=billing_year,
            electric_previous=electric_previous,
            electric_current=electric_current,
            water_previous=water_previous,
            water_current=water_current,
        )
        self.db.add(db_reading)
        await self.db.flush()
        await self.db.refresh(db_reading)
        return db_reading

    async def get_meter_reading_history(
        self, room_id: uuid.UUID, limit: int = 12
    ) -> List[MeterReading]:
        """Get meter reading history for a room, limited to most recent readings."""
        stmt = (
            select(MeterReading)
            .where(MeterReading.room_id == room_id)
            .order_by(MeterReading.created_at.desc())
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_latest_reading(self, room_id: uuid.UUID) -> MeterReading | None:
        """Get the most recent meter reading for a room."""
        stmt = (
            select(MeterReading)
            .where(MeterReading.room_id == room_id)
            .order_by(MeterReading.created_at.desc())
            .limit(1)
        )
        result = await self.db.execute(stmt)
        return result.scalars().first()

    # ── Utility Rates (Cascade Resolution) ────────────────────────────────

    async def resolve_rate_cascade(
        self, room_id: uuid.UUID, billing_month: int, billing_year: int
    ) -> UtilityRate | None:
        """BR-10: Resolve utility rate via cascade Room → Floor → Building → Property.

        Returns the most specific matching rate, or None if not found at any level.
        """
        from app.modules.property.models import Room

        # Get the room with its hierarchy
        room_result = await self.db.execute(
            select(Room).where(Room.id == room_id)
        )
        room = room_result.scalars().first()
        if not room:
            return None

        billing_date = date(billing_year, billing_month, 1)

        # Build cascade scopes in priority order
        cascade_scopes: list[tuple[str, uuid.UUID]] = [("room", room.id)]
        if room.floor_id:
            cascade_scopes.append(("floor", room.floor_id))
        cascade_scopes.append(("building", room.building_id))
        cascade_scopes.append(("property", room.property_id))

        # Check each scope level for an effective rate
        for scope_type, scope_id in cascade_scopes:
            rate = await self.get_rate_for_scope(scope_type, scope_id, billing_date)
            if rate:
                return rate

        return None

    async def get_rate_for_scope(
        self,
        scope_type: str,
        scope_id: uuid.UUID,
        billing_date: date | None = None,
    ) -> UtilityRate | None:
        """Get the effective rate for a specific scope at a given date."""
        stmt = select(UtilityRate).where(
            UtilityRate.scope_type == scope_type,
            UtilityRate.scope_id == scope_id,
        )

        if billing_date:
            stmt = stmt.where(
                UtilityRate.effective_from <= billing_date,
                or_(UtilityRate.effective_to.is_(None), UtilityRate.effective_to >= billing_date),
            )

        # Get the most recent effective rate
        stmt = stmt.order_by(UtilityRate.effective_from.desc())
        result = await self.db.execute(stmt)
        return result.scalars().first()

    # ── Invoices ────────────────────────────────────────────────────────────

    async def create_invoice(self, invoice: Invoice) -> Invoice:
        """Persist a new Invoice and return it with an ID assigned."""
        self.db.add(invoice)
        await self.db.flush()
        await self.db.refresh(invoice)
        return invoice

    async def get_invoice_by_id(self, invoice_id: uuid.UUID) -> Invoice | None:
        """Retrieve an Invoice by primary key with line items eagerly loaded."""
        stmt = (
            select(Invoice)
            .where(Invoice.id == invoice_id)
            .options(selectinload(Invoice.line_items))
        )
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def get_invoices_for_month(
        self, property_id: uuid.UUID, billing_month: int, billing_year: int
    ) -> List[Invoice]:
        """Get all invoices for a property/month combination."""
        stmt = select(Invoice).where(
            Invoice.property_id == property_id,
            Invoice.billing_month == billing_month,
            Invoice.billing_year == billing_year,
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_invoice_by_room_and_month(
        self, room_id: uuid.UUID, billing_month: int, billing_year: int
    ) -> Invoice | None:
        """Get invoice for a specific room and billing month."""
        stmt = select(Invoice).where(
            Invoice.room_id == room_id,
            Invoice.billing_month == billing_month,
            Invoice.billing_year == billing_year,
        )
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def get_overdue_invoices(self) -> List[Invoice]:
        """Get all overdue invoices (past due date, not paid, not cancelled)."""
        stmt = select(Invoice).where(
            Invoice.due_date < date.today(),
            Invoice.status.in_([InvoiceStatus.DRAFT, InvoiceStatus.ISSUED]),
        ).options(selectinload(Invoice.line_items))
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def list_invoices(self, property_id: Optional[uuid.UUID] = None) -> List[Invoice]:
        """List invoices, optionally filtered by property, newest due date first."""
        stmt = select(Invoice).options(selectinload(Invoice.line_items))
        if property_id is not None:
            stmt = stmt.where(Invoice.property_id == property_id)
        stmt = stmt.order_by(Invoice.due_date.desc())
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    # ── Invoice Line Items ─────────────────────────────────────────────────

    async def create_line_item(self, line_item: InvoiceLineItem) -> InvoiceLineItem:
        """Persist a new InvoiceLineItem."""
        self.db.add(line_item)
        await self.db.flush()
        await self.db.refresh(line_item)
        return line_item

    async def get_line_items(self, invoice_id: uuid.UUID) -> List[InvoiceLineItem]:
        """Get all line items for an invoice."""
        stmt = select(InvoiceLineItem).where(InvoiceLineItem.invoice_id == invoice_id)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    # ── Payments ────────────────────────────────────────────────────────────

    async def record_payment(
        self,
        invoice_id: uuid.UUID,
        amount: Decimal,
        method: str,
        reference: str | None = None,
        recorded_by: uuid.UUID | None = None,
    ) -> Payment:
        """Record payment for an invoice."""
        invoice = await self.get_invoice_by_id(invoice_id)
        if not invoice:
            raise ValueError("Invoice not found")

        if invoice.status not in (InvoiceStatus.DRAFT, InvoiceStatus.ISSUED):
            raise ValueError("Cannot record payment for non-pending invoice")

        payment = Payment(
            invoice_id=invoice_id,
            amount=amount,
            method=method,
            reference=reference,
            recorded_by=recorded_by,
        )
        self.db.add(payment)

        # Update invoice paid amount and status
        invoice.paid_amount += amount
        if invoice.paid_amount >= invoice.total_amount:
            invoice.status = InvoiceStatus.PAID
        elif invoice.paid_amount > 0:
            invoice.status = InvoiceStatus.PARTIAL

        await self.db.flush()
        await self.db.refresh(payment)
        return payment

    # ── Bulk Operations ────────────────────────────────────────────────────

    async def create_invoices_batch(
        self,
        invoices: List[Invoice],
        line_items_by_invoice: dict[uuid.UUID, List[InvoiceLineItem]],
    ) -> List[Invoice]:
        """Create multiple invoices with their line items in a single transaction."""
        for invoice in invoices:
            self.db.add(invoice)
        await self.db.flush()

        for invoice in invoices:
            for line_item in line_items_by_invoice.get(invoice.id, []):
                line_item.invoice_id = invoice.id
                self.db.add(line_item)

        await self.db.flush()
        for invoice in invoices:
            await self.db.refresh(invoice)

        return invoices