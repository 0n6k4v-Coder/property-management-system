"""Unit tests for AdminService — pagination, data scoping, secret masking.

References:
    - SDD.md §7.4: Audit Compliance
"""

import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.admin.services.admin_service import AdminService
from app.shared.audit import AuditLog


@pytest.mark.unit
class TestGetAuditLogs:
    async def test_empty_logs_returns_empty_list(self, db_session: AsyncSession) -> None:
        """No audit logs → empty list with meta.total=0."""
        service = AdminService(db_session)
        result = await service.get_audit_logs(
            property_id=uuid.uuid4(), page=1, limit=50,
        )
        assert result["data"] == []
        assert result["meta"]["total"] == 0
        assert result["meta"]["page"] == 1

    async def test_pagination_metadata(self, db_session: AsyncSession) -> None:
        """Logs exist → correct page/limit/total/has_next."""
        from app.modules.auth.models import User
        uid = uuid.uuid4()
        db_session.add(User(id=uid, email=f"{uid.hex[:8]}@test.com", password_hash="hashed",
                            full_name="Test", is_active=True))
        await db_session.flush()

        prop_id = uuid.uuid4()
        for i in range(3):
            log = AuditLog(
                property_id=prop_id, action="test.action",
                resource_type="test",
                user_id=uid,
            )
            db_session.add(log)
        await db_session.flush()

        service = AdminService(db_session)
        result = await service.get_audit_logs(
            property_id=prop_id, page=1, limit=2,
        )
        assert result["meta"]["total"] == 3
        assert result["meta"]["page"] == 1
        assert result["meta"]["has_next"] is True
        assert len(result["data"]) == 2

    async def test_data_scoping(self, db_session: AsyncSession) -> None:
        """Logs from another property should not be returned."""
        from app.modules.auth.models import User
        uid_a = uuid.uuid4()
        db_session.add(User(id=uid_a, email=f"{uid_a.hex[:8]}@a.com", password_hash="hashed",
                            full_name="A", is_active=True))
        uid_b = uuid.uuid4()
        db_session.add(User(id=uid_b, email=f"{uid_b.hex[:8]}@b.com", password_hash="hashed",
                            full_name="B", is_active=True))
        await db_session.flush()

        prop_a = uuid.uuid4()
        prop_b = uuid.uuid4()

        log_a = AuditLog(property_id=prop_a, action="action.a", resource_type="test", user_id=uid_a)
        log_b = AuditLog(property_id=prop_b, action="action.b", resource_type="test", user_id=uid_b)
        db_session.add(log_a)
        db_session.add(log_b)
        await db_session.flush()

        service = AdminService(db_session)
        result = await service.get_audit_logs(property_id=prop_a)
        assert len(result["data"]) == 1
        assert result["data"][0].action == "action.a"


@pytest.mark.unit
class TestSystemConfig:
    async def test_secrets_masked(self) -> None:
        """Sensitive config values are masked with ****."""
        from app.modules.admin.services.admin_service import _SENSITIVE_CONFIG_KEYS
        assert "SECRET_KEY" in _SENSITIVE_CONFIG_KEYS
        assert "ID_CARD_ENCRYPTION_KEY" in _SENSITIVE_CONFIG_KEYS

    async def test_get_system_config_returns_list(self, db_session: AsyncSession) -> None:
        """get_system_config returns masked config items."""
        service = AdminService(db_session)
        config = await service.get_system_config()
        assert len(config) > 0

        # Check specific items
        for item in config:
            if item.key == "SECRET_KEY":
                assert item.value == "****"
                assert item.masked is True
            if item.key == "APP_NAME":
                assert item.masked is False
