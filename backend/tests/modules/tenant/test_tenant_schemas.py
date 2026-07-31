"""Unit tests for Tenant schemas validation logic."""

import uuid
from datetime import datetime

import pytest
from pydantic import ValidationError

from app.modules.tenant.schemas import (
    CreateTenantRequest,
    TenantCreateResponse,
    TenantListResponse,
    TenantResponse,
)


def test_valid_create_tenant_request():
    valid_id_card = "1100702213761"
    req = CreateTenantRequest(
        property_id=uuid.uuid4(),
        full_name="Somchai Jaidee",
        id_card_number=valid_id_card,
        phone="0812345678",
        email="somchai@example.com",
    )
    assert req.full_name == "Somchai Jaidee"
    assert req.phone == "0812345678"


def test_invalid_phone_format():
    valid_id_card = "1100702213761"
    with pytest.raises(ValidationError, match="Invalid Thai phone number format"):
        CreateTenantRequest(
            property_id=uuid.uuid4(),
            full_name="Somchai",
            id_card_number=valid_id_card,
            phone="1812345678",  # Doesn't start with 0
        )


def test_invalid_id_card_length():
    with pytest.raises(ValidationError):
        CreateTenantRequest(
            property_id=uuid.uuid4(),
            full_name="Somchai",
            id_card_number="123456",
            phone="0812345678",
        )


def test_invalid_id_card_checksum():
    with pytest.raises(ValidationError, match="Invalid Thai ID card checksum"):
        CreateTenantRequest(
            property_id=uuid.uuid4(),
            full_name="Somchai",
            id_card_number="1100702213769",  # Wrong check digit
            phone="0812345678",
        )


def test_tenant_response_and_wrappers():
    now = datetime.now()
    tid = uuid.uuid4()
    pid = uuid.uuid4()

    t_resp = TenantResponse(
        id=tid,
        property_id=pid,
        full_name="Test Tenant",
        phone="0812345678",
        email="test@example.com",
        created_at=now,
    )
    assert t_resp.id == tid

    create_resp = TenantCreateResponse(data=t_resp)
    assert create_resp.data.id == tid

    list_resp = TenantListResponse(data=[t_resp], meta={"total": 1})
    assert len(list_resp.data) == 1
    assert list_resp.meta["total"] == 1
