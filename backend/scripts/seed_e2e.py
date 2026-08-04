"""Seed deterministic fixture data for fullstack Playwright E2E tests.

Unlike ``seed_admin.py`` (which only creates the admin login user), this
script seeds a full, realistic dataset — properties, buildings, rooms, a
tenant, a contract, an invoice, a maintenance request, and a meter reading —
using **fixed, deterministic UUIDs** derived from ``uuid.uuid5`` so that E2E
spec files can reference these exact IDs (see
``frontend/e2e/fixtures/seeded-ids.ts``, which must be kept in sync with the
``uuid5()`` calls below).

Idempotent: safe to run multiple times — existing rows (matched by their
deterministic ID) are left as-is rather than duplicated.

Usage:
    docker compose exec backend python -m scripts.seed_e2e
    docker compose exec backend python -m scripts.seed_e2e --reset  # wipe + reseed

Not a `--reset` implementation that touches other apps' data: ``--reset``
truncates only the tables this script writes to (see TABLES_TO_TRUNCATE),
scoped to fixture rows only where practical.
"""

import argparse
import asyncio
import sys
import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import text

from app.modules.auth.models import User
from app.modules.billing.models import Invoice, InvoiceStatus, MeterReading, UtilityRate
from app.modules.contract.constants import ContractStatus
from app.modules.contract.models import Contract
from app.modules.maintenance.constants import MaintenanceStatus, Priority
from app.modules.maintenance.models import MaintenanceRequest
from app.modules.property.constants import RoomStatus, RoomType
from app.modules.property.models import Building, Property, Room
from app.modules.tenant.models import Tenant
from app.shared.database import async_session_maker
from app.shared.security import encrypt_sensitive, hash_password

# ── Deterministic IDs (namespace fixed — DO NOT change without updating
#    frontend/e2e/fixtures/seeded-ids.ts to match) ─────────────────────

_NS = uuid.UUID("12345678-1234-5678-1234-567812345678")


def _id(name: str) -> uuid.UUID:
    return uuid.uuid5(_NS, name)


ADMIN_USER_ID = _id("admin-user")
PROPERTY_SUNSET_ID = _id("property-sunset-tower")
PROPERTY_RIVERSIDE_ID = _id("property-riverside")
BUILDING_SUNSET_A_ID = _id("building-sunset-a")
ROOM_101_ID = _id("room-101")
ROOM_102_ID = _id("room-102")
ROOM_103_ID = _id("room-103")
ROOM_104_ID = _id("room-104")
TENANT_JOHN_DOE_ID = _id("tenant-john-doe")
CONTRACT_ROOM_102_ID = _id("contract-room-102")
INVOICE_2026_0001_ID = _id("invoice-2026-0001")
MAINTENANCE_LEAKING_FAUCET_ID = _id("maintenance-leaking-faucet")
METER_READING_101_ID = _id("meter-reading-101")
METER_READING_102_ID = _id("meter-reading-102")
UTILITY_RATE_SUNSET_ID = _id("utility-rate-sunset-tower")

ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "Admin123!"

INACTIVE_USER_ID = _id("inactive-user")
INACTIVE_EMAIL = "inactive@example.com"
INACTIVE_PASSWORD = "Inactive123!"

TABLES_TO_TRUNCATE = [
    "meter_readings",
    "utility_rates",
    "invoice_line_items",
    "payments",
    "invoices",
    "lease_extensions",
    "contracts",
    "maintenance_requests",
    "tenants",
    "rooms",
    "floors",
    "buildings",
    "properties",
]


async def reset_fixture_data() -> None:
    """Truncate all fixture-owned tables (CASCADE) — does NOT touch `users`."""
    async with async_session_maker() as session:
        for table in TABLES_TO_TRUNCATE:
            await session.execute(text(f"TRUNCATE TABLE {table} CASCADE"))
        await session.commit()
        print(f"🗑️  Truncated {len(TABLES_TO_TRUNCATE)} fixture tables.")


async def _get_or_none(session, model, id_: uuid.UUID):
    return await session.get(model, id_)


async def seed_e2e() -> None:
    async with async_session_maker() as session:
        # ── Admin user (idempotent — reuse seed_admin.py's row if present).
        # NOTE: seed_admin.py (run separately, e.g. by CI setup) creates this
        # user with a *random* uuid4, not our deterministic ADMIN_USER_ID —
        # so we must look up whichever ID actually exists and use THAT for
        # every created_by/recorded_by FK below, not the constant itself.
        admin = await session.get(User, ADMIN_USER_ID)
        if admin is not None:
            admin_id = ADMIN_USER_ID
        else:
            existing_by_email = await session.execute(
                text("SELECT id FROM users WHERE email = :e"), {"e": ADMIN_EMAIL}
            )
            row = existing_by_email.fetchone()
            if row is None:
                admin = User(
                    id=ADMIN_USER_ID,
                    email=ADMIN_EMAIL,
                    password_hash=hash_password(ADMIN_PASSWORD),
                    full_name="Admin User",
                    phone="0812345678",
                    is_active=True,
                )
                session.add(admin)
                await session.flush()
                admin_id = ADMIN_USER_ID
                print(f"✅ Created admin user {ADMIN_EMAIL}")
            else:
                admin_id = row[0]
                print(f"ℹ️  Admin user {ADMIN_EMAIL} already exists (id={admin_id}) — reusing.")

        # ── Inactive user (AUTH-LOGIN-07: inactive account login attempt) ──
        inactive_user = await session.get(User, INACTIVE_USER_ID)
        if inactive_user is None:
            inactive_user = User(
                id=INACTIVE_USER_ID,
                email=INACTIVE_EMAIL,
                password_hash=hash_password(INACTIVE_PASSWORD),
                full_name="Inactive User",
                phone="0800000000",
                is_active=False,
            )
            session.add(inactive_user)
            await session.flush()
            print(f"✅ Created inactive user {INACTIVE_EMAIL}")

        # ── Properties ───────────────────────────────────────────────────
        sunset = await _get_or_none(session, Property, PROPERTY_SUNSET_ID)
        if sunset is None:
            sunset = Property(
                id=PROPERTY_SUNSET_ID,
                name="Sunset Tower",
                address="123 Main St",
                billing_due_day=5,
                min_deposit_months=2,
            )
            session.add(sunset)
            await session.flush()
            print("✅ Created property: Sunset Tower")

        riverside = await _get_or_none(session, Property, PROPERTY_RIVERSIDE_ID)
        if riverside is None:
            riverside = Property(
                id=PROPERTY_RIVERSIDE_ID,
                name="Riverside Apartments",
                address="456 River Rd",
                billing_due_day=10,
                min_deposit_months=3,
            )
            session.add(riverside)
            await session.flush()
            print("✅ Created property: Riverside Apartments")

        # ── Building (Sunset Tower needs one for its rooms) ─────────────
        building_a = await _get_or_none(session, Building, BUILDING_SUNSET_A_ID)
        if building_a is None:
            building_a = Building(
                id=BUILDING_SUNSET_A_ID,
                property_id=PROPERTY_SUNSET_ID,
                name="Building A",
                display_order=0,
            )
            session.add(building_a)
            await session.flush()
            print("✅ Created building: Sunset Tower / Building A")

        # ── Add property scope for admin user (now that Sunset Tower exists) ─────
        from app.modules.auth.models import UserPropertyScope, PropertyRole
        existing_scope = await session.get(UserPropertyScope, (admin_id, PROPERTY_SUNSET_ID))
        if not existing_scope:
            scope = UserPropertyScope(
                user_id=admin_id,
                property_id=PROPERTY_SUNSET_ID,
                role=PropertyRole.owner,
            )
            session.add(scope)
            print(f"✅ Created property scope for admin user: Sunset Tower (owner)")

        # ── Rooms ────────────────────────────────────────────────────────
        room_101 = await _get_or_none(session, Room, ROOM_101_ID)
        if room_101 is None:
            room_101 = Room(
                id=ROOM_101_ID,
                property_id=PROPERTY_SUNSET_ID,
                building_id=BUILDING_SUNSET_A_ID,
                room_number="101",
                room_type=RoomType.STUDIO,
                base_rent=Decimal("5000.00"),
                status=RoomStatus.AVAILABLE,
            )
            session.add(room_101)
            await session.flush()
            print("✅ Created room 101 (available)")

        room_102 = await _get_or_none(session, Room, ROOM_102_ID)
        if room_102 is None:
            room_102 = Room(
                id=ROOM_102_ID,
                property_id=PROPERTY_SUNSET_ID,
                building_id=BUILDING_SUNSET_A_ID,
                room_number="102",
                room_type=RoomType.ONE_BEDROOM,
                base_rent=Decimal("8000.00"),
                status=RoomStatus.OCCUPIED,
            )
            session.add(room_102)
            await session.flush()
            print("✅ Created room 102 (occupied)")

        # ── Rooms 103 / 104 (available, reserved for E2E contract-create &
        #    renew flows so they never collide with BR-01 one-active-contract
        #    per-room against the shared room 101/102 fixtures) ─────────────
        room_103 = await _get_or_none(session, Room, ROOM_103_ID)
        if room_103 is None:
            room_103 = Room(
                id=ROOM_103_ID,
                property_id=PROPERTY_SUNSET_ID,
                building_id=BUILDING_SUNSET_A_ID,
                room_number="103",
                room_type=RoomType.STUDIO,
                base_rent=Decimal("5500.00"),
                status=RoomStatus.AVAILABLE,
            )
            session.add(room_103)
            await session.flush()
            print("✅ Created room 103 (available)")

        room_104 = await _get_or_none(session, Room, ROOM_104_ID)
        if room_104 is None:
            room_104 = Room(
                id=ROOM_104_ID,
                property_id=PROPERTY_SUNSET_ID,
                building_id=BUILDING_SUNSET_A_ID,
                room_number="104",
                room_type=RoomType.ONE_BEDROOM,
                base_rent=Decimal("6500.00"),
                status=RoomStatus.AVAILABLE,
            )
            session.add(room_104)
            await session.flush()
            print("✅ Created room 104 (available)")

        # ── Tenant ───────────────────────────────────────────────────────
        tenant = await _get_or_none(session, Tenant, TENANT_JOHN_DOE_ID)
        if tenant is None:
            tenant = Tenant(
                id=TENANT_JOHN_DOE_ID,
                property_id=PROPERTY_SUNSET_ID,
                full_name="John Doe",
                id_card_number_encrypted=encrypt_sensitive("1234567890123"),
                phone="0899999999",
            )
            session.add(tenant)
            await session.flush()
            print("✅ Created tenant: John Doe")

        # ── Contract (room 102, active) ──────────────────────────────────
        contract = await _get_or_none(session, Contract, CONTRACT_ROOM_102_ID)
        if contract is None:
            contract = Contract(
                id=CONTRACT_ROOM_102_ID,
                room_id=ROOM_102_ID,
                tenant_id=TENANT_JOHN_DOE_ID,
                property_id=PROPERTY_SUNSET_ID,
                start_date=date(2026, 1, 1),
                end_date=date(2026, 12, 31),
                monthly_rent=Decimal("8000.00"),
                deposit_amount=Decimal("16000.00"),
                status=ContractStatus.ACTIVE,
                created_by=admin_id,
            )
            session.add(contract)
            await session.flush()
            print("✅ Created contract for room 102 (active)")

        # ── Invoice (unpaid, room 102) ───────────────────────────────────
        invoice = await _get_or_none(session, Invoice, INVOICE_2026_0001_ID)
        if invoice is None:
            invoice = Invoice(
                id=INVOICE_2026_0001_ID,
                invoice_number="INV-2026-0001",
                contract_id=CONTRACT_ROOM_102_ID,
                room_id=ROOM_102_ID,
                tenant_id=TENANT_JOHN_DOE_ID,
                property_id=PROPERTY_SUNSET_ID,
                billing_month=7,
                billing_year=2026,
                due_date=date(2026, 7, 15),
                status=InvoiceStatus.ISSUED.value,
                total_amount=Decimal("8500.00"),
                paid_amount=Decimal("0"),
                created_by=admin_id,
                issued_at=datetime(2026, 7, 1),
            )
            session.add(invoice)
            await session.flush()
            print("✅ Created invoice INV-2026-0001 (issued, unpaid)")

        # ── Maintenance request (room 101, pending) ──────────────────────
        maint = await _get_or_none(session, MaintenanceRequest, MAINTENANCE_LEAKING_FAUCET_ID)
        if maint is None:
            maint = MaintenanceRequest(
                id=MAINTENANCE_LEAKING_FAUCET_ID,
                property_id=PROPERTY_SUNSET_ID,
                room_id=ROOM_101_ID,
                title="Leaking faucet",
                description="Kitchen faucet has been dripping for 3 days.",
                priority=Priority.MEDIUM,
                status=MaintenanceStatus.PENDING,
                created_by=admin_id,
            )
            session.add(maint)
            await session.flush()
            print("✅ Created maintenance request: Leaking faucet (pending)")

        # ── Meter reading (room 101) ──────────────────────────────────────
        reading = await _get_or_none(session, MeterReading, METER_READING_101_ID)
        if reading is None:
            reading = MeterReading(
                id=METER_READING_101_ID,
                room_id=ROOM_101_ID,
                billing_month=7,
                billing_year=2026,
                electric_previous=0,
                electric_current=100,
                water_previous=0,
                water_current=50,
                recorded_by=admin_id,
            )
            session.add(reading)
            await session.flush()
            print("✅ Created meter reading for room 101")

        reading_102 = await _get_or_none(session, MeterReading, METER_READING_102_ID)
        if reading_102 is None:
            reading_102 = MeterReading(
                id=METER_READING_102_ID,
                room_id=ROOM_102_ID,
                billing_month=7,
                billing_year=2026,
                electric_previous=0,
                electric_current=150,
                water_previous=0,
                water_current=80,
                recorded_by=admin_id,
            )
            session.add(reading_102)
            await session.flush()
            print("✅ Created meter reading for room 102")

        # ── Utility rate (property-level, so BR-10 cascade resolves for both
        #    rooms — needed for invoice generation to succeed) ──────────────
        rate = await _get_or_none(session, UtilityRate, UTILITY_RATE_SUNSET_ID)
        if rate is None:
            rate = UtilityRate(
                id=UTILITY_RATE_SUNSET_ID,
                scope_type="property",
                scope_id=PROPERTY_SUNSET_ID,
                electric_rate_per_unit=Decimal("7.00"),
                water_rate_per_unit=Decimal("18.00"),
                common_fee=Decimal("200.00"),
                effective_from=date(2026, 1, 1),
                effective_to=None,
                created_by=admin_id,
            )
            session.add(rate)
            await session.flush()
            print("✅ Created utility rate for Sunset Tower (property-level)")

        # ── Idempotent room status sync ───────────────────────────────────
        # Always sync room status with active contracts to prevent DB state
        # pollution from repeated seed runs without --reset. Only affects
        # fixture rooms in Sunset Tower (property_id = PROPERTY_SUNSET_ID).
        from sqlalchemy import select

        # Get all active contracts for Sunset Tower
        active_contracts = await session.execute(
            select(Contract).where(
                Contract.property_id == PROPERTY_SUNSET_ID,
                Contract.status == ContractStatus.ACTIVE,
            )
        )
        active_contract_room_ids = {c.room_id for c in active_contracts.scalars().all()}

        # Get all fixture rooms for Sunset Tower
        fixture_rooms = await session.execute(
            select(Room).where(Room.property_id == PROPERTY_SUNSET_ID)
        )
        for room in fixture_rooms.scalars().all():
            expected_status = (
                RoomStatus.OCCUPIED if room.id in active_contract_room_ids else RoomStatus.AVAILABLE
            )
            if room.status != expected_status:
                room.status = expected_status
                print(f"🔄 Synced room {room.room_number} status → {expected_status.value}")

        await session.commit()
        print("\n🎉 E2E fixture data seeded successfully.")
        print(f"   Property (Sunset Tower):    {PROPERTY_SUNSET_ID}")
        print(f"   Property (Riverside):       {PROPERTY_RIVERSIDE_ID}")
        print(f"   Room 101 / Room 102:        {ROOM_101_ID} / {ROOM_102_ID}")
        print(f"   Contract / Invoice:         {CONTRACT_ROOM_102_ID} / {INVOICE_2026_0001_ID}")
        print(f"   Maintenance / Meter reading: {MAINTENANCE_LEAKING_FAUCET_ID} / {METER_READING_101_ID}")


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--reset", action="store_true", help="Truncate fixture tables before seeding"
    )
    args = parser.parse_args()

    if args.reset:
        await reset_fixture_data()

    await seed_e2e()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as e:  # noqa: BLE001 — top-level script error boundary
        print(f"❌ Seed failed: {e}", file=sys.stderr)
        sys.exit(1)
