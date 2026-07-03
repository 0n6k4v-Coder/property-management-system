"""Unit tests for TenantService (SDD §2.4, FR-TENANT-01~04).

References:
- SDD.md §2.4: Tenant Module Specification
- CODE_STYLE.md §7.2: Unit-test pattern (mock DB layer)
- CODE_STYLE.md §6.3: Sensitive data encryption (Fernet round-trip)
"""

import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.tenant.constants import TENANT_001_DUPLICATE_PHONE, TENANT_008_QUERY_TOO_SHORT
from app.modules.tenant.models import Tenant
from app.modules.tenant.services.tenant_service import TenantService
from app.shared.exceptions import APIError
from app.shared.security import decrypt_sensitive, encrypt_sensitive


# ── Encryption tests ───────────────────────────────────────────────────


@pytest.mark.unit
def test_encrypt_decrypt_round_trip() -> None:
    """FR-TENANT-02: ID card number can be encrypted and decrypted (Fernet round-trip)."""
    original = "1234567890123"
    encrypted = encrypt_sensitive(original)
    decrypted = decrypt_sensitive(encrypted)

    assert encrypted != original
    assert decrypted == original
    assert isinstance(encrypted, str)
    assert len(encrypted) > 0


@pytest.mark.unit
def test_encrypt_different_same_length() -> None:
    """FR-TENANT-02: Same plaintext produces different ciphertexts (random IV)."""
    plain = "9876543210123"
    c1 = encrypt_sensitive(plain)
    c2 = encrypt_sensitive(plain)

    assert c1 != c2
    assert decrypt_sensitive(c1) == plain
    assert decrypt_sensitive(c2) == plain


# ── TenantService tests ────────────────────────────────────────────────


@pytest.fixture
def test_user_id() -> uuid.UUID:
    return uuid.uuid4()


async def _create_property(db_session: AsyncSession, user_id: uuid.UUID) -> uuid.UUID:
    """Create a minimal property and return its ID.

    If a user with the given ``user_id`` already exists in the session,
    reuse it.  Otherwise create a new user first.
    """
    from app.modules.auth.models import User

    user = await db_session.get(User, user_id)
    if user is None:
        user = User(id=user_id, email=f"user_{user_id.hex[:8]}@test.com",
                    password_hash="hashed_abc", full_name="Test Owner", is_active=True)
        db_session.add(user)
        await db_session.flush()

    from app.modules.property.models import Property as PropModel

    prop = PropModel(name="Test Dorm", address="123 St", billing_due_day=5,
                     min_deposit_months=2, created_by=user_id)
    db_session.add(prop)
    await db_session.flush()
    await db_session.refresh(prop)
    return prop.id


@pytest.mark.unit
async def test_create_tenant_success(
    db_session: AsyncSession,
    test_user_id: uuid.UUID,
) -> None:
    """FR-TENANT-01: A tenant can be created with valid data."""
    prop_id = await _create_property(db_session, test_user_id)
    service = TenantService(db_session)

    tenant = await service.create_tenant(
        property_id=prop_id,
        full_name="John Doe",
        id_card_number="1234567890123",
        phone="0812345678",
        created_by=test_user_id,
        email="john@example.com",
    )

    assert tenant.id is not None
    assert tenant.full_name == "John Doe"
    assert tenant.phone == "0812345678"
    assert tenant.email == "john@example.com"
    assert tenant.property_id == prop_id

    # ID card is encrypted — raw field is NOT the plain text
    assert tenant.id_card_number_encrypted != "1234567890123"
    assert decrypt_sensitive(tenant.id_card_number_encrypted) == "1234567890123"


@pytest.mark.unit
async def test_create_tenant_minimal(
    db_session: AsyncSession,
    test_user_id: uuid.UUID,
) -> None:
    """FR-TENANT-01: Tenant creation with minimum required fields."""
    prop_id = await _create_property(db_session, test_user_id)
    service = TenantService(db_session)

    tenant = await service.create_tenant(
        property_id=prop_id,
        full_name="Jane Smith",
        id_card_number="1234567890123",
        phone="0898765432",
        created_by=test_user_id,
    )

    assert tenant.full_name == "Jane Smith"
    assert tenant.phone == "0898765432"
    assert tenant.email is None
    assert tenant.emergency_contact_name is None
    assert tenant.emergency_contact_phone is None


@pytest.mark.unit
async def test_create_tenant_duplicate_phone(
    db_session: AsyncSession,
    test_user_id: uuid.UUID,
) -> None:
    """TENANT-001: Duplicate phone in same property raises error."""
    prop_id = await _create_property(db_session, test_user_id)
    service = TenantService(db_session)

    # Create first tenant
    await service.create_tenant(
        property_id=prop_id,
        full_name="First Tenant",
        id_card_number="1234567890123",
        phone="0812345678",
        created_by=test_user_id,
    )

    # Try creating second tenant with same phone
    with pytest.raises(APIError) as exc_info:
        await service.create_tenant(
            property_id=prop_id,
            full_name="Second Tenant",
            id_card_number="9876543210987",
            phone="0812345678",
            created_by=test_user_id,
        )

    assert exc_info.value.code == TENANT_001_DUPLICATE_PHONE
    assert exc_info.value.status_code == 409


@pytest.mark.unit
async def test_create_tenant_same_phone_different_property(
    db_session: AsyncSession,
    test_user_id: uuid.UUID,
) -> None:
    """TENANT-001: Same phone in different properties is allowed."""
    prop1_id = await _create_property(db_session, test_user_id)
    prop2_id = await _create_property(db_session, test_user_id)
    service = TenantService(db_session)

    # Create tenant in first property
    await service.create_tenant(
        property_id=prop1_id,
        full_name="Tenant A",
        id_card_number="1234567890123",
        phone="0812345678",
        created_by=test_user_id,
    )

    # Same phone in second property should succeed
    tenant = await service.create_tenant(
        property_id=prop2_id,
        full_name="Tenant B",
        id_card_number="1234567890123",
        phone="0812345678",
        created_by=test_user_id,
    )

    assert tenant is not None
    assert tenant.full_name == "Tenant B"


@pytest.mark.unit
async def test_search_tenants_by_name(
    db_session: AsyncSession,
    test_user_id: uuid.UUID,
) -> None:
    """FR-TENANT-04: Search tenants by name."""
    prop_id = await _create_property(db_session, test_user_id)
    service = TenantService(db_session)

    # Create a tenant
    await service.create_tenant(
        property_id=prop_id,
        full_name="Searchable Person",
        id_card_number="1234567890123",
        phone="0811111111",
        created_by=test_user_id,
    )

    result = await service.search_tenants(
        property_id=prop_id,
        query="Searchable",
        search_by="name",
    )

    assert len(result["data"]) >= 1
    assert result["meta"]["total"] >= 1
    assert result["data"][0].full_name == "Searchable Person"


@pytest.mark.unit
async def test_search_tenants_by_phone(
    db_session: AsyncSession,
    test_user_id: uuid.UUID,
) -> None:
    """FR-TENANT-04: Search tenants by phone number."""
    prop_id = await _create_property(db_session, test_user_id)
    service = TenantService(db_session)

    await service.create_tenant(
        property_id=prop_id,
        full_name="Phone Test",
        id_card_number="1234567890123",
        phone="0899999999",
        created_by=test_user_id,
    )

    result = await service.search_tenants(
        property_id=prop_id,
        query="0899999999",
        search_by="phone",
    )

    assert len(result["data"]) >= 1
    assert result["data"][0].phone == "0899999999"


@pytest.mark.unit
async def test_search_tenants_query_too_short(
    db_session: AsyncSession,
) -> None:
    """TENANT-008: Search query shorter than 3 characters raises error."""
    service = TenantService(db_session)

    with pytest.raises(APIError) as exc_info:
        await service.search_tenants(
            property_id=uuid.uuid4(),
            query="ab",
            search_by="name",
        )

    assert exc_info.value.code == TENANT_008_QUERY_TOO_SHORT
    assert exc_info.value.status_code == 400


@pytest.mark.unit
async def test_get_tenant_by_id(
    db_session: AsyncSession,
    test_user_id: uuid.UUID,
) -> None:
    """Retrieve a tenant by ID."""
    prop_id = await _create_property(db_session, test_user_id)
    service = TenantService(db_session)

    tenant = await service.create_tenant(
        property_id=prop_id,
        full_name="By ID Test",
        id_card_number="1234567890123",
        phone="0822222222",
        created_by=test_user_id,
    )

    found = await service.get_tenant_by_id(tenant.id)
    assert found.id == tenant.id
    assert found.full_name == "By ID Test"


@pytest.mark.unit
async def test_get_tenant_by_id_not_found(db_session: AsyncSession) -> None:
    """TENANT-004: Retrieving non-existent tenant raises error."""
    service = TenantService(db_session)
    fake_id = uuid.uuid4()

    with pytest.raises(APIError) as exc_info:
        await service.get_tenant_by_id(fake_id)

    assert exc_info.value.code == "TENANT-004"
    assert exc_info.value.status_code == 404