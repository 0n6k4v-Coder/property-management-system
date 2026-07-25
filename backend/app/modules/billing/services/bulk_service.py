"""Bulk Invoice Service — Batch Invoice Generation (FR-METER-07).

Extracted from BillingService for single responsibility:
- Generates invoices for all occupied rooms in a property
- Handles skipped rooms (no reading, no contract, no rate)
- Returns detailed summary

References:
- SDD.md §2.3: Billing Module Specification
- SDD.md §5: Critical Sequence Diagrams
- BR-12: Invoice calculation breakdown
"""

import uuid
from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from http import HTTPStatus

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.billing.constants import (
    BILL_003_RATE_NOT_FOUND,
    BILL_004_INVOICE_ALREADY_GENERATED,
    BILL_009_CONTRACT_NOT_FOUND,
    EVENT_INVOICE_GENERATED,
    InvoiceStatus,
    LineItemType,
)
from app.modules.billing.events import publish_billing_event
from app.modules.billing.models import (
    Invoice,
    InvoiceLineItem,
)
from app.modules.billing.repository import BillingRepository
from app.modules.billing.services.rate_service import RateService
from app.modules.property.models import Room
from app.shared.audit import log_audit
from app.shared.exceptions import APIError


class BulkInvoiceService:
    """Business logic for bulk invoice generation across a property.

    Processes all occupied rooms in a property, generating invoices
    where possible and skipping rooms that lack required data.
    """

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = BillingRepository(db)
        self.rate_service = RateService(db)

    async def generate_bulk_invoices(
        self,
        property_id: uuid.UUID,
        billing_month: int,
        billing_year: int,
        created_by: uuid.UUID,
    ) -> dict:
        """Generate invoices for all occupied rooms in a property (FR-METER-07).

        Parameters
        ----------
        property_id: UUID of the property to invoice.
        billing_month: Month to invoice (1-12).
        billing_year: Year to invoice.
        created_by: UUID of the user generating the invoices.

        Returns
        -------
        dict: Summary with generated_count, skipped_count, and invoice details.

        Raises
        ------
        APIError:
            BILL-004 if invoices already exist for this property/month.
        """
        billing_date = date(billing_year, billing_month, 1)

        # Check for existing invoices
        existing = await self.repo.get_invoices_for_month(
            property_id, billing_month, billing_year,
        )
        if existing:
            raise APIError(
                code=BILL_004_INVOICE_ALREADY_GENERATED,
                message="Invoices already generated for this month and property",
                status_code=HTTPStatus.CONFLICT,
            )

        # Get all rooms in the property
        rooms_result = await self.db.execute(
            select(Room).where(
                Room.property_id == property_id,
                Room.status == "occupied",
            )
        )
        rooms = rooms_result.scalars().all()

        if not rooms:
            raise APIError(
                code=BILL_009_CONTRACT_NOT_FOUND,
                message="No rooms found for this property",
                status_code=HTTPStatus.NOT_FOUND,
            )

        generated_invoices = []
        skipped_rooms = []

        for room in rooms:
            try:
                invoice = await self._generate_invoice_for_room(
                    room=room,
                    billing_month=billing_month,
                    billing_year=billing_year,
                    created_by=created_by,
                )
                if invoice:
                    generated_invoices.append({
                        "invoice_id": str(invoice.id),
                        "invoice_number": invoice.invoice_number,
                        "room_id": str(room.id),
                        "room_number": room.room_number,
                        "total_amount": str(invoice.total_amount),
                    })
            except Exception as e:
                # Skip rooms with missing data (no reading, no rate, etc.)
                skipped_rooms.append({
                    "room_id": str(room.id),
                    "room_number": room.room_number,
                    "reason": f"{type(e).__name__}: {str(e)}",
                })

        # Publish bulk event
        await publish_billing_event(
            EVENT_INVOICE_GENERATED,
            f"bulk-{property_id}-{billing_year}{billing_month:02d}",
            {
                "property_id": str(property_id),
                "month": billing_month,
                "year": billing_year,
                "generated": len(generated_invoices),
                "skipped": len(skipped_rooms),
            },
        )

        # DEBUG: log skipped rooms
        if skipped_rooms:
            import structlog
            logger = structlog.get_logger()
            logger.warning("bulk_invoice_skipped_rooms", skipped=skipped_rooms)

        return {
            "generated_count": len(generated_invoices),
            "skipped_count": len(skipped_rooms),
            "invoices": generated_invoices,
            "skipped": skipped_rooms,
        }

    async def _generate_invoice_for_room(
        self,
        room: Room,
        billing_month: int,
        billing_year: int,
        created_by: uuid.UUID,
    ) -> Invoice | None:
        """Generate invoice for a single room, or return None if skipped."""
        # Get latest meter reading
        latest_reading = await self.repo.get_latest_reading(room.id)
        if not latest_reading:
            raise ValueError(f"No meter reading for room {room.room_number}")

        # Resolve utility rate via RateService (BR-10)
        try:
            rate = await self.rate_service.resolve_utility_rate(
                room.id, billing_month, billing_year
            )
        except APIError as e:
            if e.code == BILL_003_RATE_NOT_FOUND:
                raise ValueError(f"No utility rate for room {room.room_number}")
            raise

        # Get contract for this room
        from app.modules.contract.models import Contract, ContractStatus
        contract_result = await self.db.execute(
            select(Contract).where(
                Contract.room_id == room.id,
                Contract.status == ContractStatus.ACTIVE
            )
        )
        contract = contract_result.scalars().first()
        if not contract:
            raise ValueError(f"No active contract for room {room.room_number}")

        # BR-12: Calculate invoice amounts
        electric_cost = (latest_reading.electric_used * rate.electric_rate_per_unit).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP,
        )
        water_cost = (latest_reading.water_used * rate.water_rate_per_unit).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP,
        )
        rent_amount = room.base_rent.quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP,
        )
        common_fee = rate.common_fee.quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP,
        )
        total_amount = (rent_amount + electric_cost + water_cost + common_fee).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP,
        )

        # Create invoice - use actual contract and tenant
        invoice_number = f"INV-{billing_year}{billing_month:02d}-{uuid.uuid4().hex[:8].upper()}"
        invoice = Invoice(
            invoice_number=invoice_number,
            contract_id=contract.id,
            room_id=room.id,
            tenant_id=contract.tenant_id,
            property_id=room.property_id,
            billing_month=billing_month,
            billing_year=billing_year,
            due_date=date(billing_year, billing_month, 5),
            status=InvoiceStatus.DRAFT.value,
            total_amount=total_amount,
            paid_amount=Decimal("0"),
            created_by=created_by,
        )
        invoice = await self.repo.create_invoice(invoice)

        # Create line items (BR-12 breakdown)
        line_items_data = [
            (LineItemType.RENT.value, f"Monthly rent - {room.room_number}", Decimal("1"), rent_amount, rent_amount),
            (LineItemType.ELECTRIC.value, f"Electric usage ({latest_reading.electric_used} units × {rate.electric_rate_per_unit}/unit)", latest_reading.electric_used, rate.electric_rate_per_unit, electric_cost),
            (LineItemType.WATER.value, f"Water usage ({latest_reading.water_used} units × {rate.water_rate_per_unit}/unit)", latest_reading.water_used, rate.water_rate_per_unit, water_cost),
            (LineItemType.COMMON_FEE.value, "Common area maintenance fee", Decimal("1"), common_fee, common_fee),
        ]
        for line_type, desc, qty, unit_price, amount in line_items_data:
            item = InvoiceLineItem(
                invoice_id=invoice.id,
                line_type=line_type,
                description=desc,
                quantity=qty,
                unit_price=unit_price,
                amount=amount,
            )
            await self.repo.create_line_item(item)

        # Audit log - wrap in try/except to prevent transaction issues
        try:
            await log_audit(
                db=self.db,
                user_id=created_by,
                action="invoice.generated",
                resource_type="invoice",
                resource_id=invoice.id,
                property_id=room.property_id,
                metadata={
                    "invoice_number": invoice_number,
                    "billing_month": billing_month,
                    "billing_year": billing_year,
                    "total_amount": str(total_amount),
                    "room_number": room.room_number,
                },
            )
        except Exception:
            # Fail-silent: audit must never break the primary operation
            pass

        return invoice
