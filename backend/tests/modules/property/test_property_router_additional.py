"""Integration tests for Property router endpoints (create property, idempotency, rooms, room status)."""

import uuid

import pytest
from httpx import AsyncClient

from app.modules.auth.models import User, UserPropertyScope
from app.modules.property.models import Building, Floor, Property, Room
from app.shared.security import create_access_token, hash_password


def _get_auth_headers(user_id: uuid.UUID, email: str, is_owner: bool = False, is_superuser: bool = False) -> dict[str, str]:
    token = create_access_token({
        "sub": str(user_id),
        "user_id": str(user_id),
        "email": email,
        "is_owner": is_owner,
        "is_superuser": is_superuser,
    })
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.integration
async def test_create_property_endpoint(async_client: AsyncClient, db_session, app):
    app.dependency_overrides.clear()

    user_id = uuid.uuid4()
    email = f"owner-{uuid.uuid4()}@example.com"
    user = User(
        id=user_id,
        email=email,
        password_hash=hash_password("Pass123!"),
        full_name="Owner User",
        phone="0811111111",
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()

    headers = _get_auth_headers(user_id, email, is_owner=True)

    payload = {
        "name": "New Created Property",
        "address": "100 New St",
        "billing_due_day": 10,
        "min_deposit_months": 1,
    }

    # First request
    res1 = await async_client.post("/api/v1/properties/", json=payload, headers=headers)
    assert res1.status_code == 201
    data1 = res1.json()["data"]
    assert data1["name"] == "New Created Property"

    # Second request with Idempotency-Key
    idem_key = f"idempotent-key-prop-{uuid.uuid4()}"
    idem_headers = {**headers, "Idempotency-Key": idem_key}
    res2 = await async_client.post("/api/v1/properties/", json=payload, headers=idem_headers)
    assert res2.status_code == 201

    # Replay request with same Idempotency-Key
    res3 = await async_client.post("/api/v1/properties/", json=payload, headers=idem_headers)
    assert res3.status_code == 201
    assert res3.json()["data"]["id"] == res2.json()["data"]["id"]


@pytest.mark.integration
async def test_get_property_rooms_endpoint(async_client: AsyncClient, db_session, app):
    app.dependency_overrides.clear()

    user_id = uuid.uuid4()
    email = f"owner-{uuid.uuid4()}@example.com"
    user = User(
        id=user_id,
        email=email,
        password_hash=hash_password("Pass123!"),
        full_name="Owner User",
        phone="0811111111",
        is_active=True,
    )
    db_session.add(user)

    prop = Property(
        name="Prop Rooms Test",
        address="200 Room St",
        billing_due_day=5,
        min_deposit_months=2,
    )
    db_session.add(prop)
    await db_session.flush()

    scope = UserPropertyScope(user_id=user_id, property_id=prop.id, role="owner")
    db_session.add(scope)

    bldg = Building(property_id=prop.id, name="Bldg 1", display_order=1)
    db_session.add(bldg)
    await db_session.flush()

    flr = Floor(building_id=bldg.id, name="Floor 1", display_order=1)
    db_session.add(flr)
    await db_session.flush()

    room = Room(property_id=prop.id, building_id=bldg.id, floor_id=flr.id, room_number="101", status="available")
    db_session.add(room)
    await db_session.commit()

    headers = _get_auth_headers(user_id, email, is_owner=True)

    res = await async_client.get(f"/api/v1/properties/{prop.id}/rooms", headers=headers)
    assert res.status_code == 200
    body = res.json()
    assert "data" in body
    assert "rooms" in body["data"]
    assert len(body["data"]["rooms"]) == 1
    assert body["data"]["rooms"][0]["room_number"] == "101"


@pytest.mark.integration
async def test_update_room_status_endpoint(async_client: AsyncClient, db_session, app):
    app.dependency_overrides.clear()

    user_id = uuid.uuid4()
    email = f"owner-{uuid.uuid4()}@example.com"
    user = User(
        id=user_id,
        email=email,
        password_hash=hash_password("Pass123!"),
        full_name="Owner User",
        phone="0811111111",
        is_active=True,
    )
    db_session.add(user)

    prop = Property(
        name="Prop Status Test",
        address="300 Status St",
        billing_due_day=5,
        min_deposit_months=2,
    )
    db_session.add(prop)
    await db_session.flush()

    scope = UserPropertyScope(user_id=user_id, property_id=prop.id, role="owner")
    db_session.add(scope)

    bldg = Building(property_id=prop.id, name="Bldg 1", display_order=1)
    db_session.add(bldg)
    await db_session.flush()

    flr = Floor(building_id=bldg.id, name="Floor 1", display_order=1)
    db_session.add(flr)
    await db_session.flush()

    room = Room(property_id=prop.id, building_id=bldg.id, floor_id=flr.id, room_number="102", status="available")
    db_session.add(room)
    await db_session.commit()

    headers = _get_auth_headers(user_id, email, is_owner=True)

    payload = {"status": "maintenance"}
    res = await async_client.patch(
        f"/api/v1/properties/{prop.id}/rooms/{room.id}/status",
        json=payload,
        headers=headers,
    )
    assert res.status_code == 200
    body = res.json()
    assert body["data"]["status"] == "maintenance"
