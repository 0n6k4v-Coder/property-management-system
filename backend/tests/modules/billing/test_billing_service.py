"""Unit tests for BillingService (SDD §2.3, BR-07, BR-10, BR-12).

References:
- SDD.md §2.3: Billing Module Specification
- CODE_STYLE.md §7.2: Unit-test pattern (mock DB layer)
- SDD.md §6: Business Rules (BR-07, BR-10, BR-12)
"""

from datetime import date
from decimal import Decimal

import uuid

import pytest
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
)
from app.modules.billing.models import Invoice, InvoiceLineItem, MeterReading, Payment, UtilityRate
from app.modules.billing.repository import BillingRepository
from app.modules.billing.services.billing_service import BillingService
from app.shared.exceptions import APIError
from app.shared.security import hash_password


@pytest.fixture
def any_user() -> uuid.UUID:
    return uuid.UUID("00000000-0000-0000-0000-000000000001")


async def _setup_property_with_room(
    db_session: AsyncSession,
    user_id: uuid.UUID,
) -> tuple[uuid.UUID, uuid.UUID, uuid.UUID]:
    """Helper: create user + property + building + room, return IDs."""
    from app.modules.auth.models import User
    user = User(id=user_id, email=f"billing_{uuid.uuid4().hex[:8]}@test.com",
                password_hash=hash_password("Test123"), full_name="Billing Tester", is_active=True)
    db_session.add(user)
    await db_session.flush()

    from app.modules.property.models import Property, Building, Room
    prop = Property(name="Billing Test", address="1 Billing St", billing_due_day=5,
                    min_deposit_months=2, created_by=user_id)
    db_session.add(prop)
    await db_session.flush()

    bld = Building(property_id=prop.id, name="Building A", display_order=1)
    db_session.add(bld)
    await db_session.flush()

    room = Room(property_id=prop.id, building_id=bld.id, room_number="B001",
                base_rent=Decimal("5000"), status="occupied")
    db_session.add(room)
    await db_session.flush()
    await db_session.refresh(room)
    await db_session.refresh(bld)
    await db_session.refresh(prop)

    return prop.id, bld.id, room.id


async def _setup_rate(
    db_session: AsyncSession,
    scope_type: str,
    scope_id: uuid.UUID,
    user_id: uuid.UUID,
) -> UtilityRate:
    """Helper: create a utility rate for a scope."""
    rate = UtilityRate(
        scope_type=scope_type,
        scope_id=scope_id,
        electric_rate_per_unit=Decimal("7.00"),
        water_rate_per_unit=Decimal("18.00"),
        common_fee=Decimal("200.00"),
        effective_from=date(2026, 1, 1),
        effective_to=None,
        created_by=user_id,
    )
    db_session.add(rate)
    await db_session.flush()
    await db_session.refresh(rate)
    return rate


# ── Meter Reading Tests (BR-07) ───────────────────────────────────────


@pytest.mark.unit
async def test_record_meter_reading_success(
    db_session: AsyncSession,
    any_user: uuid.UUID,
) -> None:
    """FR-METER-01: A meter reading can be recorded successfully."""
    _, _, room_id = await _setup_property_with_room(db_session, any_user)

    service = BillingService(db_session)
    reading = await service.record_meter_reading(
        room_id=room_id,
        billing_month=5,
        billing_year=2026,
        electric_previous=Decimal("0"),
        electric_current=Decimal("100"),
        water_previous=Decimal("0"),
        water_current=Decimal("50"),
        recorded_by=any_user,
    )

    assert reading.id is not None
    assert reading.electric_used == Decimal("100")
    assert reading.water_used == Decimal("50")
    assert reading.room_id == room_id


@pytest.mark.unit
async def test_record_meter_reading_br07_electric_decreased(
    db_session: AsyncSession,
    any_user: uuid.UUID,
) -> None:
    """BR-07: electric_current < electric_previous raises BILL-001."""
    _, _, room_id = await _setup_property_with_room(db_session, any_user)

    service = BillingService(db_session)
    with pytest.raises(APIError) as exc:
        await service.record_meter_reading(
            room_id=room_id,
            billing_month=5,
            billing_year=2026,
            electric_previous=Decimal("100"),
            electric_current=Decimal("50"),
            water_previous=Decimal("0"),
            water_current=Decimal("50"),
            recorded_by=any_user,
        )
    assert exc.value.code == BILL_001_METER_DECREASED


@pytest.mark.unit
async def test_record_meter_reading_br07_water_decreased(
    db_session: AsyncSession,
    any_user: uuid.UUID,
) -> None:
    """BR-07: water_current < water_previous raises BILL-001."""
    _, _, room_id = await _setup_property_with_room(db_session, any_user)

    service = BillingService(db_session)
    with pytest.raises(APIError) as exc:
        await service.record_meter_reading(
            room_id=room_id,
            billing_month=5,
            billing_year=2026,
            electric_previous=Decimal("0"),
            electric_current=Decimal("100"),
            water_previous=Decimal("50"),
            water_current=Decimal("10"),
            recorded_by=any_user,
        )
    assert exc.value.code == BILL_001_METER_DECREASED


@pytest.mark.unit
async def test_record_meter_reading_duplicate(
    db_session: AsyncSession,
    any_user: uuid.UUID,
) -> None:
    """BILL-002: Duplicate reading for same room/month/year raises conflict."""
    _, _, room_id = await _setup_property_with_room(db_session, any_user)

    service = BillingService(db_session)
    repo = BillingRepository(db_session)

    # Create first reading directly via repository to avoid transaction issues
    first_reading = await repo.create_meter_reading(
        room_id=room_id,
        billing_month=5,
        billing_year=2026,
        electric_previous=0,
        electric_current=100,
        water_previous=0,
        water_current=50,
    )
    assert first_reading.id is not None

    # Second attempt via service should raise BILL-002
    with pytest.raises(APIError) as exc:
        await service.record_meter_reading(
            room_id=room_id,
            billing_month=5,
            billing_year=2026,
            electric_previous=100,
            electric_current=200,
            water_previous=50,
            water_current=100,
            recorded_by=any_user,
        )
    assert exc.value.code == BILL_002_DUPLICATE_READING


# ── Utility Rate Resolution Tests (BR-10) ─────────────────────────────


@pytest.mark.unit
async def test_resolve_utility_rate_property_scope(
    db_session: AsyncSession,
    any_user: uuid.UUID,
) -> None:
    """BR-10: Rate at property level is found via cascade."""
    prop_id, _, room_id = await _setup_property_with_room(db_session, any_user)
    await _setup_rate(db_session, "property", prop_id, any_user)

    service = BillingService(db_session)
    rate = await service.resolve_utility_rate(room_id, 5, 2026)

    assert rate is not None
    assert rate.electric_rate_per_unit == Decimal("7.00")
    assert rate.water_rate_per_unit == Decimal("18.00")


@pytest.mark.unit
async def test_resolve_utility_rate_building_scope(
    db_session: AsyncSession,
    any_user: uuid.UUID,
) -> None:
    """BR-10: Rate at building level is found (more specific than property)."""
    prop_id, bld_id, room_id = await _setup_property_with_room(db_session, any_user)
    await _setup_rate(db_session, "building", bld_id, any_user)

    service = BillingService(db_session)
    rate = await service.resolve_utility_rate(room_id, 5, 2026)

    assert rate is not None
    assert rate.scope_type == "building"


@pytest.mark.unit
async def test_resolve_utility_rate_not_found(
    db_session: AsyncSession,
    any_user: uuid.UUID,
) -> None:
    """BILL-003: No rate at any cascade level raises error."""
    _, _, room_id = await _setup_property_with_room(db_session, any_user)

    service = BillingService(db_session)
    with pytest.raises(APIError) as exc:
        await service.resolve_utility_rate(room_id, 5, 2026)
    assert exc.value.code == BILL_003_RATE_NOT_FOUND


# ── Invoice Generation Tests (BR-12) ──────────────────────────────────


@pytest.mark.unit
async def test_generate_invoice_success(
    db_session: AsyncSession,
    any_user: uuid.UUID,
) -> None:
    """FR-METER-06: Invoice is generated with correct BR-12 calculation."""
    prop_id, _, room_id = await _setup_property_with_room(db_session, any_user)
    await _setup_rate(db_session, "property", prop_id, any_user)

    # First record a meter reading
    service = BillingService(db_session)
    await service.record_meter_reading(
        room_id=room_id,
        billing_month=5,
        billing_year=2026,
        electric_previous=Decimal("0"),
        electric_current=Decimal("100"),
        water_previous=Decimal("0"),
        water_current=Decimal("50"),
        recorded_by=any_user,
    )

    # Generate invoice
    invoice = await service.generate_monthly_invoice(
        property_id=prop_id,
        billing_month=5,
        billing_year=2026,
        created_by=any_user,
    )

    assert invoice.id is not None
    assert invoice.status == "draft"
    assert invoice.property_id == prop_id
    assert invoice.invoice_number.startswith("INV-")

    # Verify line items (BR-12 breakdown)
    repo = BillingRepository(db_session)
    line_items = await repo.get_line_items(invoice.id)
    assert len(line_items) >= 4  # rent, electric, water, common fee

    line_types = {li.line_type for li in line_items}
    assert "rent" in line_types
    assert "electric" in line_types
    assert "water" in line_types
    assert "common_fee" in line_types


@pytest.mark.unit
async def test_generate_invoice_already_exists(
    db_session: AsyncSession,
    any_user: uuid.UUID,
) -> None:
    """BILL-004: Duplicate invoice generation raises conflict."""
    prop_id, _, room_id = await _setup_property_with_room(db_session, any_user)
    await _setup_rate(db_session, "property", prop_id, any_user)

    service = BillingService(db_session)
    await service.record_meter_reading(
        room_id=room_id, billing_month=5, billing_year=2026,
        electric_previous=Decimal("0"), electric_current=Decimal("100"),
        water_previous=Decimal("0"), water_current=Decimal("50"),
        recorded_by=any_user,
    )
    await service.generate_monthly_invoice(prop_id, 5, 2026, any_user)

    with pytest.raises(APIError) as exc:
        await service.generate_monthly_invoice(prop_id, 5, 2026, any_user)
    assert exc.value.code == BILL_004_INVOICE_ALREADY_GENERATED


@pytest.mark.unit
async def test_generate_invoice_no_meter_reading(
    db_session: AsyncSession,
    any_user: uuid.UUID,
) -> None:
    """Generate invoice without meter reading raises error."""
    prop_id, _, _ = await _setup_property_with_room(db_session, any_user)
    await _setup_rate(db_session, "property", prop_id, any_user)

    service = BillingService(db_session)
    with pytest.raises(APIError) as exc:
        await service.generate_monthly_invoice(prop_id, 5, 2026, any_user)
    assert exc.value.status_code == 404


# ── Payment Tests ─────────────────────────────────────────────────────


@pytest.mark.unit
async def test_record_payment_success(
    db_session: AsyncSession,
    any_user: uuid.UUID,
) -> None:
    """FR-METER-09: Payment is recorded and invoice status updates."""
    prop_id, _, room_id = await _setup_property_with_room(db_session, any_user)
    await _setup_rate(db_session, "property", prop_id, any_user)

    # Generate invoice first
    service = BillingService(db_session)
    await service.record_meter_reading(
        room_id=room_id, billing_month=5, billing_year=2026,
        electric_previous=Decimal("0"), electric_current=Decimal("100"),
        water_previous=Decimal("0"), water_current=Decimal("50"),
        recorded_by=any_user,
    )
    invoice = await service.generate_monthly_invoice(prop_id, 5, 2026, any_user)

    # Record a partial payment
    payment = await service.record_payment(
        invoice_id=invoice.id,
        amount=Decimal("3000"),
        method="bank_transfer",
        recorded_by=any_user,
        reference_number="TXN001",
    )

    assert payment.id is not None
    assert payment.amount == Decimal("3000")
    assert payment.method == "bank_transfer"

    # Check invoice was updated - partial payment = "partial" status
    repo = BillingRepository(db_session)
    updated = await repo.get_invoice_by_id(invoice.id)
    assert updated.paid_amount == Decimal("3000")
    assert updated.status == "partial"


@pytest.mark.unit
async def test_record_payment_full(
    db_session: AsyncSession,
    any_user: uuid.UUID,
) -> None:
    """Payment that fully clears invoice sets status to paid."""
    prop_id, _, room_id = await _setup_property_with_room(db_session, any_user)
    await _setup_rate(db_session, "property", prop_id, any_user)

    service = BillingService(db_session)
    await service.record_meter_reading(
        room_id=room_id, billing_month=5, billing_year=2026,
        electric_previous=Decimal("0"), electric_current=Decimal("100"),
        water_previous=Decimal("0"), water_current=Decimal("50"),
        recorded_by=any_user,
    )
    invoice = await service.generate_monthly_invoice(prop_id, 5, 2026, any_user)

    total = invoice.total_amount
    await service.record_payment(
        invoice_id=invoice.id,
        amount=total,
        method="cash",
        recorded_by=any_user,
    )

    repo = BillingRepository(db_session)
    updated = await repo.get_invoice_by_id(invoice.id)
    assert updated.status == "paid"
    assert updated.paid_amount == total


@pytest.mark.unit
async def test_record_payment_exceeds_balance(
    db_session: AsyncSession,
    any_user: uuid.UUID,
) -> None:
    """BILL-006: Payment exceeding remaining balance raises error."""
    prop_id, _, room_id = await _setup_property_with_room(db_session, any_user)
    await _setup_rate(db_session, "property", prop_id, any_user)

    service = BillingService(db_session)
    await service.record_meter_reading(
        room_id=room_id, billing_month=5, billing_year=2026,
        electric_previous=Decimal("0"), electric_current=Decimal("100"),
        water_previous=Decimal("0"), water_current=Decimal("50"),
        recorded_by=any_user,
    )
    invoice = await service.generate_monthly_invoice(prop_id, 5, 2026, any_user)

    with pytest.raises(APIError) as exc:
        await service.record_payment(
            invoice_id=invoice.id,
            amount=invoice.total_amount + Decimal("1"),
            method="cash",
            recorded_by=any_user,
        )
    assert exc.value.code == BILL_006_PAYMENT_EXCEEDS_BALANCE


@pytest.mark.unit
async def test_record_payment_invoice_not_found(
    db_session: AsyncSession,
    any_user: uuid.UUID,
) -> None:
    """BILL-007: Paying non-existent invoice raises error."""
    service = BillingService(db_session)
    with pytest.raises(APIError) as exc:
        await service.record_payment(
            invoice_id=uuid.uuid4(),
            amount=Decimal("100"),
            method="cash",
            recorded_by=any_user,
        )
    assert exc.value.code == BILL_007_INVOICE_NOT_FOUND