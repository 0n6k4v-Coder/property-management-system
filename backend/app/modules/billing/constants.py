"""Billing module constants: enums, error codes, domain events (SDD §2.3, §6).

References:
- SDD.md §2.3: Billing Module Specification
- SDD.md §6: State Machines (InvoiceStatus transitions)
"""

from enum import StrEnum

# ── Error Codes (BILL-0xx, VAL-0xx shared) ────────────────────────────

BILL_001_METER_DECREASED: str = "BILL-001"
BILL_002_DUPLICATE_READING: str = "BILL-002"
BILL_003_RATE_NOT_FOUND: str = "BILL-003"
BILL_004_INVOICE_ALREADY_GENERATED: str = "BILL-004"
BILL_005_INVOICE_ALREADY_PAID: str = "BILL-005"
BILL_006_PAYMENT_EXCEEDS_BALANCE: str = "BILL-006"
BILL_007_INVOICE_NOT_FOUND: str = "BILL-007"
BILL_008_INVALID_INVOICE_STATUS: str = "BILL-008"
BILL_009_CONTRACT_NOT_FOUND: str = "BILL-009"

# ── Enums ──────────────────────────────────────────────────────────────


class InvoiceStatus(StrEnum):
    """Possible states for an invoice (SDD §6: State Machines)."""

    DRAFT = "draft"
    SENT = "sent"
    PARTIAL = "partial"
    PAID = "paid"
    OVERDUE = "overdue"
    CANCELLED = "cancelled"


class PaymentMethod(StrEnum):
    """Payment methods accepted by the system."""

    BANK_TRANSFER = "bank_transfer"
    CASH = "cash"
    PROMPTPAY = "promptpay"
    QR_CODE = "qr_code"
    CREDIT_CARD = "credit_card"


class UtilityScopeType(StrEnum):
    """Scope types for polymorphic utility rate association (BR-10 cascade)."""

    PROPERTY = "property"
    BUILDING = "building"
    FLOOR = "floor"
    ROOM = "room"


class LineItemType(StrEnum):
    """Types of line items on an invoice."""

    RENT = "rent"
    ELECTRIC = "electric"
    WATER = "water"
    COMMON_FEE = "common_fee"
    OTHER = "other"


# ── Domain Events ──────────────────────────────────────────────────────

EVENT_METER_RECORDED: str = "meter.recorded"
EVENT_INVOICE_GENERATED: str = "invoice.generated"
EVENT_PAYMENT_RECORDED: str = "payment.recorded"
