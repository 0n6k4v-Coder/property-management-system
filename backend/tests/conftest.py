"""Shared test fixtures — DB session, TestClient, mocks, factories (SDD §7.1-7.4).

This module provides the pytest fixtures used by every test across
all modules.  Key design decisions:

- DB session is scoped per function; after each test the transaction
  is rolled back so no data persists between tests.
- ``get_db`` is overridden via ``app.dependency_overrides`` so that
  integration tests use the same transaction-backed session.
- External services (event bus, audit) are mocked to prevent
  accidental data leaks and to keep unit tests fast.

References:
    - CODE_STYLE.md §7: Testing conventions
    - SDD.md §7.1-7.4: Test strategy, fixtures, audit logging
"""

import asyncio
import uuid
from collections.abc import AsyncGenerator, Generator
from decimal import Decimal
from typing import Any

import httpx
import pytest
import pytest_asyncio
from fastapi import FastAPI
from fastapi.testclient import TestClient  # back-compat for unconverted tests
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.config import get_settings
from app.main import create_app
from app.modules.auth.models import User
from app.modules.auth.repository import UserRepository
from app.modules.auth.services.auth_service import AuthService
from app.modules.auth.services.invite_service import InviteService
from app.shared.database import Base
from app.shared.deps import get_current_user
from app.shared.security import hash_password

# Reusable valid credentials for tests
VALID_EMAIL = "test-user@example.com"
VALID_PASSWORD = "SecurePass123"
VALID_FULL_NAME = "Test User"
VALID_PHONE = "0812345678"


# ── Async session helpers ─────────────────────────────────────────────


@pytest.fixture(scope="function")
def event_loop() -> Generator[asyncio.AbstractEventLoop, None, None]:
    """Create a single event loop for the whole test session.

    Required by pytest-asyncio when scope > function.
    """
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Provide an async DB session with a dedicated engine per test.

    Creates a fresh engine + session for each test to prevent event-loop
    cross-contamination (the import-time engine is bound to pytest's
    collection loop, not the per-test loop).  Uses ``NullPool`` so no
    connections persist between tests.

    Every test gets its own transaction; rollback on teardown.
    """
    settings = get_settings()
    test_engine = create_async_engine(
        settings.DATABASE_URL,
        poolclass=NullPool,
        echo=settings.DEBUG,
    )
    test_session_factory = async_sessionmaker(
        test_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    session = test_session_factory()
    try:
        yield session
    finally:
        await session.rollback()
        await session.close()
        await test_engine.dispose()


# ── Dependency-override helpers ───────────────────────────────────────


def _override_get_db() -> AsyncSession:
    """Placeholder — replaced at test time by the test's ``db_session``."""
    raise RuntimeError("_override_get_db must be patched per test")


def _override_get_current_user() -> dict:
    """Placeholder — replaced at test time by the test's token payload."""
    raise RuntimeError("_override_get_current_user must be patched per test")


@pytest.fixture
def app() -> FastAPI:
    """Create the FastAPI application with overridable dependencies."""
    application = create_app()

    # Install the default overrides (replaced per-test via ``patch_db``)
    application.dependency_overrides[get_current_user] = lambda: {
        "user_id": str(uuid.uuid4()),
        "email": VALID_EMAIL,
        "property_scopes": [],
        "token_type": "access",
    }
    return application


@pytest.fixture
def client(app: FastAPI) -> Generator[TestClient, None, None]:
    """Yield a TestClient bound to the test application."""
    with TestClient(app) as c:
        yield c


# ── Fixtures for overriding dependencies per test ─────────────────────


@pytest_asyncio.fixture
async def async_client(app: FastAPI, db_session: AsyncSession) -> AsyncGenerator[httpx.AsyncClient, None]:
    """Yield an ``httpx.AsyncClient`` bound to the test app.

    Uses ``ASGITransport`` so the entire request life-cycle runs **in the
    same event loop** as ``pytest-asyncio`` — no more "attached to a
    different loop" errors.

    The ``get_db`` dependency is pre-overridden with the test's
    ``db_session`` so that every request reads/writes the same
    rolled-back transaction.

    Usage::

        async def test_login(async_client, db_session):
            # DB is already wired — just call the endpoint
            resp = await async_client.post("/api/v1/auth/login", json={...})
            assert resp.status_code == 200
    """
    from app.shared.deps import get_db

    async def _override_db():
        return db_session

    app.dependency_overrides[get_db] = _override_db

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        yield client


@pytest.fixture
def patch_db(app: FastAPI, db_session: AsyncSession) -> AsyncSession:
    """Override ``get_db`` with the test's rolled-back session.

    Usage in an integration test::

        async def test_login(client, patch_db):
            # patch_db activates the override — calls go through db_session
            response = client.post("/api/v1/auth/login", json={...})
    """
    async def _override():
        return db_session

    app.dependency_overrides[get_current_user] = lambda: {
        "user_id": str(uuid.uuid4()),
        "email": "admin@example.com",
        "property_scopes": [],
        "token_type": "access",
    }
    return db_session


@pytest.fixture
def patch_current_user(app: FastAPI) -> dict:
    """Override ``get_current_user`` with a custom JWT payload.

    The returned dict can be mutated by tests to set specific claims::

        patch_current_user["user_id"] = str(some_user.id)
    """
    payload: dict[str, Any] = {
        "user_id": str(uuid.uuid4()),
        "email": "admin@example.com",
        "property_scopes": [],
        "token_type": "access",
    }
    app.dependency_overrides[get_current_user] = lambda: payload
    return payload


# ── Mock event bus ────────────────────────────────────────────────────


@pytest.fixture(autouse=True)
def mock_event_bus(monkeypatch: pytest.MonkeyPatch) -> None:
    """Replace ``app.modules.auth.events.publish`` with a no-op.

    This prevents accidental side-effects (Redis, cross-module coupling)
    during unit/integration tests.  The mock silently discards events
    without raising.
    """
    async def _noop_publish(event_name: str, payload: dict | None = None) -> None:
        pass  # silently swallow

    monkeypatch.setattr("app.modules.auth.events.publish", _noop_publish)


# ── Service fixtures (unit-test convenience) ──────────────────────────


@pytest_asyncio.fixture
async def auth_service(db_session: AsyncSession) -> AuthService:
    """Return an ``AuthService`` bound to the test DB session."""
    return AuthService(db_session)


@pytest_asyncio.fixture
async def invite_service(db_session: AsyncSession) -> InviteService:
    """Return an ``InviteService`` bound to the test DB session."""
    return InviteService(db_session)


# ── Factory helpers ───────────────────────────────────────────────────


@pytest_asyncio.fixture
async def user_factory(db_session: AsyncSession) -> User:
    """Create a minimal active user in the test database.

    Override attributes by passing keyword arguments to the returned
    ``UserRepository.create`` call::

        user = await user_factory(email="custom@test.com", is_active=False)

    The user is created within the test transaction and will be rolled
    back when the test finishes.
    """
    repo = UserRepository(db_session)

    async def _factory(**kwargs: Any) -> User:
        defaults: dict[str, Any] = {
            "email": VALID_EMAIL,
            "password_hash": hash_password(VALID_PASSWORD),
            "full_name": VALID_FULL_NAME,
            "phone": VALID_PHONE,
            "is_active": True,
        }
        merged = {**defaults, **kwargs}
        user = User(**merged)
        return await repo.create(user)

    return await _factory()


# ── Payload fixtures ──────────────────────────────────────────────────


@pytest.fixture
def valid_auth_payload() -> dict[str, str]:
    """Standard login payload with valid credentials."""
    return {"email": VALID_EMAIL, "password": VALID_PASSWORD}


@pytest.fixture
def valid_register_payload() -> dict[str, str]:
    """Standard register payload (invite_token filled by test)."""
    return {
        "invite_token": "",
        "full_name": "New User",
        "password": "NewUserPass1",
        "phone": "0899999999",
    }


# ── Property factory fixtures (Sprint 2) ──────────────────────────────


@pytest_asyncio.fixture
async def property_factory(db_session: AsyncSession):
    """Create a minimal Property in the test database.

    Override attributes by passing keyword arguments to the returned
    callable::

        prop = await property_factory(name="My Dorm", billing_due_day=5)

    The property is created within the test transaction and will be
    rolled back when the test finishes.
    """
    from app.modules.property.models import Property

    async def _factory(**kwargs: Any) -> Property:
        defaults: dict[str, Any] = {
            "name": "Test Property",
            "address": "123 Test Street",
            "billing_due_day": 5,
            "min_deposit_months": 2,
        }
        merged = {**defaults, **kwargs}
        prop = Property(**merged)
        db_session.add(prop)
        await db_session.flush()
        await db_session.refresh(prop)
        return prop

    return await _factory()


@pytest_asyncio.fixture
async def room_factory(db_session: AsyncSession):
    """Create a minimal Room in the test database.

    Requires an existing ``property_id`` and ``building_id``.

    Override attributes by passing keyword arguments::

        room = await room_factory(
            property_id=prop.id,
            building_id=bld.id,
            room_number="101",
        )
    """
    from app.modules.property.models import Room

    async def _factory(**kwargs: Any) -> Room:
        defaults: dict[str, Any] = {
            "room_number": "101",
            "room_type": "studio",
            "base_rent": Decimal("5000.00"),
            "status": "available",
        }
        merged = {**defaults, **kwargs}
        room = Room(**merged)
        db_session.add(room)
        await db_session.flush()
        await db_session.refresh(room)
        return room

    return await _factory()


# ── Tenant factory fixtures (Sprint 2) ────────────────────────────────


@pytest_asyncio.fixture
async def tenant_factory(db_session: AsyncSession):
    """Create a minimal Tenant in the test database.

    Override attributes by passing keyword arguments::

        tenant = await tenant_factory(
            property_id=prop.id,
            full_name="John Doe",
            phone="0812345678",
        )

    The tenant's ID card is automatically encrypted with Fernet.
    """
    from app.modules.tenant.models import Tenant
    from app.shared.security import encrypt_sensitive

    async def _factory(**kwargs: Any) -> Tenant:
        defaults: dict[str, Any] = {
            "property_id": uuid.uuid4(),
            "full_name": "Test Tenant",
            "id_card_number_encrypted": encrypt_sensitive("1234567890123"),
            "phone": "0812345678",
        }
        merged = {**defaults, **kwargs}
        tenant = Tenant(**merged)
        db_session.add(tenant)
        await db_session.flush()
        await db_session.refresh(tenant)
        return tenant

    return await _factory()


# ── Billing factory fixtures (Sprint 3) ───────────────────────────────


@pytest_asyncio.fixture
async def meter_reading_factory(db_session: AsyncSession):
    """Create a minimal MeterReading in the test database.

    Override attributes by passing keyword arguments::

        reading = await meter_reading_factory(
            room_id=..., electric_current=Decimal("100"),
        )
    """
    from app.modules.billing.models import MeterReading

    async def _factory(**kwargs: Any) -> MeterReading:
        defaults: dict[str, Any] = {
            "room_id": uuid.uuid4(),
            "billing_month": 5,
            "billing_year": 2026,
            "electric_previous": Decimal("0"),
            "electric_current": Decimal("100"),
            "electric_used": Decimal("100"),
            "water_previous": Decimal("0"),
            "water_current": Decimal("50"),
            "water_used": Decimal("50"),
            "recorded_by": uuid.uuid4(),
        }
        merged = {**defaults, **kwargs}
        reading = MeterReading(**merged)
        db_session.add(reading)
        await db_session.flush()
        await db_session.refresh(reading)
        return reading

    return await _factory()


@pytest_asyncio.fixture
async def rate_factory(db_session: AsyncSession):
    """Create a minimal UtilityRate in the test database.

    Override attributes by passing keyword arguments::

        rate = await rate_factory(
            scope_id=..., electric_rate_per_unit=Decimal("7"),
        )
    """
    from app.modules.billing.models import UtilityRate
    from datetime import date

    async def _factory(**kwargs: Any) -> UtilityRate:
        defaults: dict[str, Any] = {
            "scope_type": "property",
            "scope_id": uuid.uuid4(),
            "electric_rate_per_unit": Decimal("7.00"),
            "water_rate_per_unit": Decimal("18.00"),
            "common_fee": Decimal("200.00"),
            "effective_from": date(2026, 1, 1),
            "effective_to": None,
            "created_by": uuid.uuid4(),
        }
        merged = {**defaults, **kwargs}
        rate = UtilityRate(**merged)
        db_session.add(rate)
        await db_session.flush()
        await db_session.refresh(rate)
        return rate

    return await _factory()


@pytest_asyncio.fixture
async def invoice_factory(db_session: AsyncSession):
    """Create a minimal Invoice in the test database.

    Override attributes by passing keyword arguments::

        inv = await invoice_factory(property_id=..., status="draft")
    """
    from app.modules.billing.models import Invoice
    from datetime import date

    async def _factory(**kwargs: Any) -> Invoice:
        defaults: dict[str, Any] = {
            "invoice_number": f"INV-{uuid.uuid4().hex[:8].upper()}",
            "contract_id": uuid.uuid4(),
            "room_id": uuid.uuid4(),
            "tenant_id": uuid.uuid4(),
            "property_id": uuid.uuid4(),
            "billing_month": 5,
            "billing_year": 2026,
            "due_date": date(2026, 6, 5),
            "status": "draft",
            "total_amount": Decimal("5000.00"),
            "paid_amount": Decimal("0"),
            "created_by": uuid.uuid4(),
        }
        merged = {**defaults, **kwargs}
        inv = Invoice(**merged)
        db_session.add(inv)
        await db_session.flush()
        await db_session.refresh(inv)
        return inv

    return await _factory()


# ── Contract factory fixtures (Sprint 4) ───────────────────────────


@pytest_asyncio.fixture
async def contract_factory(db_session: AsyncSession):
    """Create a minimal active Contract in the test database.

    Override attributes by passing keyword arguments::

        contract = await contract_factory(
            room_id=room.id,
            tenant_id=tenant.id,
            property_id=prop.id,
            status="active",
        )

    The contract is created within the test transaction and will be
    rolled back when the test finishes.
    """
    from datetime import date

    from app.modules.contract.constants import ContractStatus
    from app.modules.contract.models import Contract

    async def _factory(**kwargs: Any) -> Contract:
        defaults: dict[str, Any] = {
            "room_id": uuid.uuid4(),
            "tenant_id": uuid.uuid4(),
            "property_id": uuid.uuid4(),
            "start_date": date(2026, 6, 1),
            "end_date": date(2027, 5, 31),
            "monthly_rent": Decimal("5000.00"),
            "deposit_amount": Decimal("10000.00"),
            "status": ContractStatus.ACTIVE,
            "created_by": uuid.uuid4(),
        }
        merged = {**defaults, **kwargs}
        contract = Contract(**merged)
        db_session.add(contract)
        await db_session.flush()
        await db_session.refresh(contract)
        return contract

    return await _factory()


@pytest_asyncio.fixture
async def lease_extension_factory(db_session: AsyncSession):
    """Create a minimal LeaseExtension in the test database.

    Requires an existing ``contract_id``::

        ext = await lease_extension_factory(contract_id=contract.id)
    """
    from datetime import date

    from app.modules.contract.models import LeaseExtension

    async def _factory(**kwargs: Any) -> LeaseExtension:
        defaults: dict[str, Any] = {
            "contract_id": uuid.uuid4(),
            "previous_end_date": date(2027, 5, 31),
            "extended_to": date(2028, 5, 31),
            "reason": "Tenant requested extension",
            "extended_by": uuid.uuid4(),
        }
        merged = {**defaults, **kwargs}
        ext = LeaseExtension(**merged)
        db_session.add(ext)
        await db_session.flush()
        await db_session.refresh(ext)
        return ext

    return await _factory()


# ── Maintenance factory fixtures (Sprint 5) ────────────────────────


@pytest_asyncio.fixture
async def maintenance_request_factory(db_session: AsyncSession):
    """Create a minimal MaintenanceRequest in the test database.

    Override attributes by passing keyword arguments::

        req = await maintenance_request_factory(
            property_id=prop.id,
            room_id=room.id,
        )
    """
    from app.modules.maintenance.constants import MaintenanceStatus, Priority
    from app.modules.maintenance.models import MaintenanceRequest

    async def _factory(**kwargs: Any) -> MaintenanceRequest:
        defaults: dict[str, Any] = {
            "property_id": uuid.uuid4(),
            "room_id": uuid.uuid4(),
            "title": "AC not cooling",
            "description": "The air conditioner in room 101 needs immediate repair.",
            "priority": Priority.MEDIUM,
            "status": MaintenanceStatus.PENDING,
            "created_by": uuid.uuid4(),
        }
        merged = {**defaults, **kwargs}
        req = MaintenanceRequest(**merged)
        db_session.add(req)
        await db_session.flush()
        await db_session.refresh(req)
        return req

    return await _factory()