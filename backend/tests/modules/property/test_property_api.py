"""Integration tests for Property API endpoints (SDD §3.3, FR-PROP-01, FR-PROP-02).

References:
- SDD.md §3.3: Complete API Contract — GET /properties/{id}
- CODE_STYLE.md §7.3: Integration test pattern (TestClient + DB)
"""

import uuid

import pytest
from httpx import AsyncClient

from app.modules.auth.models import User, UserPropertyScope
from app.modules.property.models import Property
from app.shared.deps import get_current_user
from app.shared.security import hash_password


def _setup_auth_override(app, user_id, is_owner=False, is_superuser=False):
    """Helper to override get_current_user for a specific user_id."""
    app.dependency_overrides[get_current_user] = lambda: {
        "user_id": str(user_id),
        "email": "test-user@example.com",
        "property_scopes": [],
        "token_type": "access",
        "is_owner": is_owner,
        "is_superuser": is_superuser,
    }


def _cleanup_auth_override(app):
    """Clean up the get_current_user override."""
    app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.integration
async def test_get_property_success(
    async_client: AsyncClient,
    db_session,
    app,  # Add app to access dependency overrides
) -> None:
    """FR-PROP-02: GET /api/v1/properties/{id} returns 200 with property data."""
    prop = Property(
        name="API Test Property",
        address="456 API Road",
        billing_due_day=5,
        min_deposit_months=2,
    )
    db_session.add(prop)
    await db_session.flush()
    await db_session.refresh(prop)

    # Create a user in the users table
    user_id = uuid.uuid4()
    user = User(
        id=user_id,
        email="test-user@example.com",
        password_hash=hash_password("TestPass123!"),
        full_name="Test User",
        phone="0812345678",
        is_active=True,
    )
    db_session.add(user)
    await db_session.flush()

    # Create a user with property scope
    scope = UserPropertyScope(
        user_id=user_id,
        property_id=prop.id,
        role="owner",
    )
    db_session.add(scope)
    await db_session.flush()

    # Override get_current_user to include the user_id that has the scope
    _setup_auth_override(app, user_id)

    response = await async_client.get(f"/api/v1/properties/{prop.id}")

    # Clean up the override
    _cleanup_auth_override(app)

    assert response.status_code == 200
    body = response.json()
    assert "data" in body
    assert body["data"]["id"] == str(prop.id)
    assert body["data"]["name"] == "API Test Property"
    assert body["data"]["address"] == "456 API Road"
    assert body["meta"] is None


@pytest.mark.integration
async def test_get_property_not_found(
    async_client: AsyncClient,
    db_session,
    app,
) -> None:
    """PROP-004: GET /api/v1/properties/{id} returns 404 for non-existent ID."""
    user_id = uuid.uuid4()
    _setup_auth_override(app, user_id, is_owner=True)

    fake_id = uuid.uuid4()

    response = await async_client.get(f"/api/v1/properties/{fake_id}")

    _cleanup_auth_override(app)

    assert response.status_code == 404
    body = response.json()
    assert "error" in body
    assert body["error"]["code"] == "PROP-004"


@pytest.mark.integration
async def test_get_property_invalid_uuid(
    async_client: AsyncClient,
    db_session,
    app,
) -> None:
    """GET /api/v1/properties/{id} returns 422 for malformed UUID (FastAPI path validation)."""
    user_id = uuid.uuid4()
    _setup_auth_override(app, user_id, is_owner=True)

    response = await async_client.get("/api/v1/properties/not-a-uuid")

    _cleanup_auth_override(app)

    assert response.status_code == 422


@pytest.mark.integration
async def test_list_properties_includes_created(
    async_client: AsyncClient,
    db_session,
    app,
) -> None:
    """FR-PROP-01: GET /api/v1/properties returns newly created properties."""
    prop = Property(
        name="Listed Property",
        address="789 List Road",
        billing_due_day=5,
        min_deposit_months=2,
    )
    db_session.add(prop)
    await db_session.flush()
    await db_session.refresh(prop)

    # Create a user in the users table
    user_id = uuid.uuid4()
    user = User(
        id=user_id,
        email="test-user@example.com",
        password_hash=hash_password("TestPass123!"),
        full_name="Test User",
        phone="0812345678",
        is_active=True,
    )
    db_session.add(user)
    await db_session.flush()

    _setup_auth_override(app, user_id)

    # Add scope for the user to access the property
    scope = UserPropertyScope(
        user_id=user_id,
        property_id=prop.id,
        role="owner",
    )
    db_session.add(scope)
    await db_session.flush()

    response = await async_client.get("/api/v1/properties")

    _cleanup_auth_override(app)

    assert response.status_code == 200
    body = response.json()
    assert "data" in body
    names = [p["name"] for p in body["data"]]
    assert "Listed Property" in names
