"""Integration tests for Tenant router endpoints (create, list, search, idempotency, Cache-Control)."""

import uuid

import pytest
from httpx import AsyncClient

from app.modules.auth.models import User, UserPropertyScope
from app.modules.property.models import Property
from app.modules.tenant.models import Tenant
from app.shared.security import create_access_token, hash_password


def _get_auth_headers(user_id: uuid.UUID, email: str, is_owner: bool = True, is_superuser: bool = False) -> dict[str, str]:
    token = create_access_token({
        "sub": str(user_id),
        "user_id": str(user_id),
        "email": email,
        "is_owner": is_owner,
        "is_superuser": is_superuser,
    })
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.integration
async def test_create_tenant_endpoint(async_client: AsyncClient, db_session, app):
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
        name="Tenant Prop",
        address="100 Tenant St",
        billing_due_day=5,
        min_deposit_months=2,
    )
    db_session.add(prop)
    await db_session.flush()

    scope = UserPropertyScope(user_id=user_id, property_id=prop.id, role="owner")
    db_session.add(scope)
    await db_session.commit()

    headers = _get_auth_headers(user_id, email, is_owner=True)

    payload = {
        "property_id": str(prop.id),
        "full_name": "Somsak Jaidee",
        "id_card_number": "1100702213761",
        "phone": "0898765432",
        "email": "somsak@example.com",
    }

    # 1. Post new tenant with Idempotency Key
    idem_key = f"idempotent-key-tenant-{uuid.uuid4()}"
    idem_headers = {**headers, "Idempotency-Key": idem_key}
    res1 = await async_client.post("/api/v1/tenants/", json=payload, headers=idem_headers)
    assert res1.status_code == 201
    data1 = res1.json()["data"]
    assert data1["full_name"] == "Somsak Jaidee"
    assert "id_card_number" not in data1

    # 2. Replay request with same Idempotency Key
    res2 = await async_client.post("/api/v1/tenants/", json=payload, headers=idem_headers)
    assert res2.status_code == 201
    assert res2.json()["data"]["id"] == data1["id"]


@pytest.mark.integration
async def test_list_tenants_endpoint(async_client: AsyncClient, db_session, app):
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
        name="List Tenant Prop",
        address="200 Tenant St",
        billing_due_day=5,
        min_deposit_months=2,
    )
    db_session.add(prop)
    await db_session.flush()

    scope = UserPropertyScope(user_id=user_id, property_id=prop.id, role="owner")
    db_session.add(scope)

    tenant = Tenant(
        property_id=prop.id,
        full_name="Manoch Dee",
        id_card_number_encrypted="encrypted_str",
        phone="0876543210",
        email="manoch@example.com",
    )
    db_session.add(tenant)
    await db_session.commit()

    headers = _get_auth_headers(user_id, email, is_owner=True)

    res = await async_client.get(f"/api/v1/tenants/?property_id={prop.id}", headers=headers)
    assert res.status_code == 200
    body = res.json()
    assert "data" in body
    assert len(body["data"]) >= 1


@pytest.mark.integration
async def test_search_tenants_endpoint(async_client: AsyncClient, db_session, app):
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
        name="Search Tenant Prop",
        address="300 Tenant St",
        billing_due_day=5,
        min_deposit_months=2,
    )
    db_session.add(prop)
    await db_session.flush()

    scope = UserPropertyScope(user_id=user_id, property_id=prop.id, role="owner")
    db_session.add(scope)

    tenant = Tenant(
        property_id=prop.id,
        full_name="Kanda Srisawat",
        id_card_number_encrypted="encrypted_str",
        phone="0819876543",
        email="kanda@example.com",
    )
    db_session.add(tenant)
    await db_session.commit()

    headers = _get_auth_headers(user_id, email, is_owner=True)

    # Search by name
    res = await async_client.get(
        f"/api/v1/tenants/search?property_id={prop.id}&query=Kanda&search_by=name",
        headers=headers,
    )
    assert res.status_code == 200
    assert res.headers.get("Cache-Control") == "private, no-store"
    body = res.json()
    assert len(body["data"]) == 1
    assert body["data"][0]["full_name"] == "Kanda Srisawat"

    # Search by invalid field (should return 422 - Anti-pattern #7 check)
    res_bad = await async_client.get(
        f"/api/v1/tenants/search?property_id={prop.id}&query=Kanda&search_by=address",
        headers=headers,
    )
    assert res_bad.status_code == 422
