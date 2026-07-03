"""Integration tests for Property API endpoints (SDD §3.3, FR-PROP-01, FR-PROP-02).

References:
- SDD.md §3.3: Complete API Contract — GET /properties/{id}
- CODE_STYLE.md §7.3: Integration test pattern (TestClient + DB)
"""

import uuid

import pytest
from httpx import AsyncClient

from app.modules.property.models import Property
from app.shared.deps import get_current_user


@pytest.mark.integration
async def test_get_property_success(
    async_client: AsyncClient,
    db_session,
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

    response = await async_client.get(f"/api/v1/properties/{prop.id}")

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
) -> None:
    """PROP-004: GET /api/v1/properties/{id} returns 404 for non-existent ID."""
    fake_id = uuid.uuid4()

    response = await async_client.get(f"/api/v1/properties/{fake_id}")

    assert response.status_code == 404
    body = response.json()
    assert "error" in body
    assert body["error"]["code"] == "PROP-004"


@pytest.mark.integration
async def test_get_property_invalid_uuid(
    async_client: AsyncClient,
    db_session,
) -> None:
    """GET /api/v1/properties/{id} returns 422 for malformed UUID."""
    response = await async_client.get("/api/v1/properties/not-a-uuid")

    assert response.status_code == 422


@pytest.mark.integration
async def test_list_properties_includes_created(
    async_client: AsyncClient,
    db_session,
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

    response = await async_client.get("/api/v1/properties")

    assert response.status_code == 200
    body = response.json()
    assert "data" in body
    names = [p["name"] for p in body["data"]]
    assert "Listed Property" in names
