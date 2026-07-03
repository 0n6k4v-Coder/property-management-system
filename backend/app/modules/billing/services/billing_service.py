"""Billing service with async business logic (SDD §2.3, BR-07, BR-10, BR-12).

References:
- SDD.md §2.3: Billing Module Specification
- SDD.md §5: Critical Sequence Diagrams
- SDD.md §6: Business Rules (BR-07, BR-10, BR-12)
- CODE_STYLE.md §3.2: Service layer patterns
"""

from decimal import Decimal
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.billing.constants import (
    BILL_001_METER_DECREASED,
    BILL_002_DUPLICATE_READING,
    BILL_003_RATE_NOT_FOUND,
    BILL_004_INVOICE_ALREADY_GENERATED,
    BILL_005_INVOICE_ALREADY_PAID,
    BILL_006_PAYMENT_EXCEEDS_BALANCE,
    BILL_007_INVOICE_NOT_FOUND,
    BILL_009_CONTRACT_NOT_FOUND,
    EVENT_INVOICE_GENERATED,
    EVENT_PAYMENT_RECORDED,
    InvoiceStatus,
    LineItemType,
)
from app.modules.billing.events import publish_billing_event
from app.modules.billing.models import (
    Invoice,
    InvoiceLineItem,
    MeterReading,
    Payment,
    UtilityRate,
)
from app.modules.billing.repository import BillingRepository
from app.modules.billing.services.rate_service import RateService
from app.modules.property.models import Room
from app.shared.audit import log_audit
from app.shared.exceptions import APIError


class BillingService:
    """Business logic for the Billing module.

    Follows the layered architecture:
    - Router → Service (this class) → Repository → Database

    All methods are async and use UUID identifiers.
    """

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = BillingRepository(db)
        self.rate_service = RateService(db)

    # ── Meter Readings (BR-07) ────────────────────────────────────────────

    async def record_meter_reading(
        self,
        room_id: uuid.UUID,
        billing_month: int,
        billing_year: int,
        electric_previous: int,
        electric_current: int,
        water_previous: int,
        water_current: int,
        recorded_by: uuid.UUID | None = None,
    ) -> MeterReading:
        """Record a new meter reading (FR-METER-01, BR-07).

        Business rules enforced:
        - BR-07: Current readings must exceed previous readings
        - BILL-002: Duplicate reading for same room/month/year raises conflict

        Raises
        ------
        APIError:
            BILL-001 if reading decreased (BR-07)
            BILL-002 if duplicate reading exists
        """
        if electric_current <= electric_previous:
            raise APIError(
                code=BILL_001_METER_DECREASED,
                message="Electric current reading must be greater than previous",
                status_code=400,
            )
        if water_current <= water_previous:
            raise APIError(
                code=BILL_001_METER_DECREASED,
                message="Water current reading must be greater than previous",
                status_code=400,
            )

        # Check for duplicate
        existing = await self.repo.get_latest_reading(room_id)
        if existing and existing.billing_month == billing_month and existing.billing_year == billing_year:
            raise APIError(
                code=BILL_002_DUPLICATE_READING,
                message="Meter reading already exists for this room and billing period",
                status_code=409,
            )

        reading = await self.repo.create_meter_reading(
            room_id=room_id,
            billing_month=billing_month,
            billing_year=billing_year,
            electric_previous=electric_previous,
            electric_current=electric_current,
            water_previous=water_previous,
            water_current=water_current,
        )

        # Audit log - wrap in try/except to prevent transaction issues
        try:
            await log_audit(
                db=self.db,
                user_id=recorded_by,
                action="meter_reading.created",
                resource_type="meter_reading",
                resource_id=reading.id,
                metadata={
                    "room_id": str(room_id),
                    "billing_month": billing_month,
                    "billing_year": billing_year,
                    "electric_used": reading.electric_used,
                    "water_used": reading.water_used,
                },
            )
        except Exception:
            # Fail-silent: audit must never break the primary operation
            pass

        return reading

    async def get_meter_reading_history(
        self, room_id: uuid.UUID, limit: int = 12
    ) -> list[MeterReading]:
        """Get meter reading history for a room."""
        return await self.repo.get_meter_reading_history(room_id, limit)

    # ── Utility Rate Resolution (BR-10) ──────────────────────────────────

    async def resolve_utility_rate(
        self, room_id: uuid.UUID, billing_month: int, billing_year: int
    ) -> UtilityRate:
        """BR-10: Resolve utility rate via cascade Room → Floor → Building → Property.

        Raises
        ------
        APIError:
            BILL-003 if no rate is found at any level of the cascade.
        """
        rate = await self.rate_service.resolve_utility_rate(room_id, billing_month, billing_year)
        if rate is None:
            raise APIError(
                code=BILL_003_RATE_NOT_FOUND,
                message="No utility rate found for any scope in the cascade",
                status_code=500,
                details={"room_id": str(room_id)},
            )
        return rate

    # ── Invoice Generation (BR-12) ────────────────────────────────────────

    async def generate_monthly_invoice(
        self,
        property_id: uuid.UUID,
        billing_month: int,
        billing_year: int,
        created_by: uuid.UUID,
    ) -> Invoice:
        """Generate invoices for all occupied rooms in a property (FR-METER-07).

        Uses BulkInvoiceService internally for proper separation of concerns.
        """
        from app.modules.billing.services.bulk_service import BulkInvoiceService

        bulk_service = BulkInvoiceService(self.db)
        result = await bulk_service.generate_bulk_invoices(
            property_id=property_id,
            billing_month=billing_month,
            billing_year=billing_year,
            created_by=created_by,
        )

        # Return the first generated invoice (for backward compatibility)
        if result["generated_count"] > 0:
            first_invoice = result["invoices"][0]
            return await self.repo.get_invoice_by_id(uuid.UUID(first_invoice["invoice_id"]))

        raise APIError(
            code=BILL_009_CONTRACT_NOT_FOUND,
            message="No invoices could be generated - no valid rooms found",
            status_code=404,
        )

    async def generate_invoice_for_room(
        self,
        room_id: uuid.UUID,
        billing_month: int,
        billing_year: int,
        created_by: uuid.UUID,
    ) -> Invoice:
        """Generate invoice for a single room (FR-METER-06)."""
        from app.modules.billing.services.bulk_service import BulkInvoiceService

        bulk_service = BulkInvoiceService(self.db)

        # Get room to find property_id
        room_result = await self.db.execute(
            select(Room).where(Room.id == room_id)
        )
        room = room_result.scalars().first()
        if not room:
            raise APIError(
                code=BILL_009_CONTRACT_NOT_FOUND,
                message="Room not found",
                status_code=404,
            )

        # Check if invoice already exists for this room
        existing = await self.repo.get_invoice_by_room_and_month(
            room_id, billing_month, billing_year
        )
        if existing:
            raise APIError(
                code=BILL_004_INVOICE_ALREADY_GENERATED,
                message="Invoice already generated for this room and month",
                status_code=409,
            )

        # Generate using bulk service logic for single room
        try:
            invoice = await bulk_service._generate_invoice_for_room(
                room=room,
                billing_month=billing_month,
                billing_year=billing_year,
                created_by=created_by,
            )
            if not invoice:
                raise ValueError("Invoice generation failed for room")
            return invoice
        except Exception as e:
            raise APIError(
                code=BILL_003_RATE_NOT_FOUND,
                message=str(e),
                status_code=400,
            ) from e

    # ── Payments ──────────────────────────────────────────────────────────

    async def record_payment(
        self,
        invoice_id: uuid.UUID,
        amount: Decimal,
        method: str,
        recorded_by: uuid.UUID | None = None,
        reference: str | None = None,
        reference_number: str | None = None,
    ) -> Payment:
        """Record payment for an invoice (FR-METER-09).

        Raises
        ------
        APIError:
            BILL-005 if invoice already paid
            BILL-006 if payment exceeds balance
            BILL-007 if invoice not found
        """
        # Use reference_number if provided, otherwise use reference
        ref = reference_number or reference

        # First, check if invoice exists and get remaining balance
        invoice = await self.repo.get_invoice_by_id(invoice_id)
        if not invoice:
            raise APIError(
                code=BILL_007_INVOICE_NOT_FOUND,
                message="Invoice not found",
                status_code=404,
            )

        # Check if payment exceeds remaining balance
        remaining_balance = invoice.total_amount - invoice.paid_amount
        if amount > remaining_balance:
            raise APIError(
                code=BILL_006_PAYMENT_EXCEEDS_BALANCE,
                message=f"Payment amount {amount} exceeds remaining balance {remaining_balance}",
                status_code=400,
            )

        try:
            payment = await self.repo.record_payment(
                invoice_id=invoice_id,
                amount=amount,
                method=method,
                reference=ref,
                recorded_by=recorded_by,
            )
        except ValueError as e:
            error_msg = str(e)
            if "not found" in error_msg.lower():
                raise APIError(
                    code=BILL_007_INVOICE_NOT_FOUND,
                    message="Invoice not found",
                    status_code=404,
                ) from e
            elif "non-pending" in error_msg.lower() or "already paid" in error_msg.lower():
                raise APIError(
                    code=BILL_005_INVOICE_ALREADY_PAID,
                    message=error_msg,
                    status_code=409,
                ) from e
            elif "exceed" in error_msg.lower():
                raise APIError(
                    code=BILL_006_PAYMENT_EXCEEDS_BALANCE,
                    message=error_msg,
                    status_code=400,
                ) from e
            else:
                raise APIError(
                    code=BILL_006_PAYMENT_EXCEEDS_BALANCE,
                    message=error_msg,
                    status_code=400,
                ) from e

        # Get updated invoice for audit
        invoice = await self.repo.get_invoice_by_id(invoice_id)

        # Publish event
        await publish_billing_event(
            EVENT_PAYMENT_RECORDED,
            str(invoice_id),
            {
                "invoice_number": invoice.invoice_number,
                "amount": str(amount),
                "method": method,
                "reference": reference,
            },
        )

        # Audit log
        await log_audit(
            db=self.db,
            user_id=recorded_by,
            action="payment.recorded",
            resource_type="payment",
            resource_id=payment.id,
            property_id=invoice.property_id,
            metadata={
                "invoice_id": str(invoice_id),
                "invoice_number": invoice.invoice_number,
                "amount": str(amount),
                "method": method,
            },
        )

        return payment

    # ── Query Methods ─────────────────────────────────────────────────────

    async def get_invoice_by_id(self, invoice_id: uuid.UUID) -> Invoice | None:
        """Get invoice by ID with line items."""
        return await self.repo.get_invoice_by_id(invoice_id)

    async def get_invoices_for_property(
        self, property_id: uuid.UUID, billing_month: int, billing_year: int
    ) -> list[Invoice]:
        """Get all invoices for a property/month."""
        return await self.repo.get_invoices_for_month(property_id, billing_month, billing_year)

    async def get_overdue_invoices(self) -> list[Invoice]:
        """Get all overdue invoices."""
        return await self.repo.get_overdue_invoices()