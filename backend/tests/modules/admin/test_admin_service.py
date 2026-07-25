"""Unit tests for AdminService — pagination, data scoping, secret masking.

References:
    - SDD.md §7.4: Audit Compliance
"""

import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.admin.services.admin_service import AdminService
from app.shared.audit import AuditLog
from app.modules.property.models import Property


@pytest.mark.unit
class TestGetAuditLogs:
    async def test_empty_logs_returns_empty_list(self, db_session: AsyncSession) -> None:
        @pytest.mark.unit
        class TestGetAuditLogs:
            async def test_empty_logs_returns_empty_list(self, db_session: AsyncSession) -> None:
                """No audit logs → empty list with meta.total=0."""
                service = AdminService(db_session)
                result = await service.get_audit_logs(property_id=None, page=1, limit=50)
                assert result["data"] == []
                assert result["meta"]["total"] == 0

            async def test_pagination_metadata(self, db_session: AsyncSession) -> None:
                """Verify meta fields: page, limit, total, has_next."""
                service = AdminService(db_session)
                from app.modules.admin.repository import AuditLogRepository
                repo = AuditLogRepository(db_session)
                import uuid
                from app.modules.property.models import Property
                from app.modules.auth.models import User
        
                # Create a user first (FK requirement for Property.created_by)
                user = User(id=uuid.uuid4(), email=f"{uuid.uuid4().hex[:8]}@test.com", password_hash="hashed", full_name="Test", is_active=True)
                db_session.add(user)
                await db_session.flush()
        
                # Create a property first (FK requirement)
                prop = Property(name="Test Property", address="123 Test St", billing_due_day=5, min_deposit_months=2, created_by=user.id)
                db_session.add(prop)
                await db_session.flush()
        
                for i in range(3):
                    await repo.create_audit_log(
                        user_id=user.id,
                        action=f"action.{i}",
                        resource_type="test",
                        property_id=prop.id,
                    )
                result = await service.get_audit_logs(property_id=None, page=1, limit=2)
                assert result["meta"]["page"] == 1
                assert result["meta"]["limit"] == 2
                assert result["meta"]["total"] == 3
                assert result["meta"]["has_next"] is True

            async def test_data_scoping(self, db_session: AsyncSession) -> None:
                """Logs filtered by property_id."""
                service = AdminService(db_session)
                from app.modules.admin.repository import AuditLogRepository
                repo = AuditLogRepository(db_session)
                import uuid
                from app.modules.property.models import Property
                from app.modules.auth.models import User
        
                # Create a user first (FK requirement for Property.created_by)
                user = User(id=uuid.uuid4(), email=f"{uuid.uuid4().hex[:8]}@test.com", password_hash="hashed", full_name="Test", is_active=True)
                db_session.add(user)
                await db_session.flush()
        
                # Create properties first (FK requirement)
                prop_a = Property(name="Property A", address="123 A St", billing_due_day=5, min_deposit_months=2, created_by=user.id)
                prop_b = Property(name="Property B", address="123 B St", billing_due_day=5, min_deposit_months=2, created_by=user.id)
                db_session.add(prop_a)
                db_session.add(prop_b)
                await db_session.flush()
        
                await repo.create_audit_log(user_id=user.id, action="action.a", resource_type="test", property_id=prop_a.id)
                await repo.create_audit_log(user_id=user.id, action="action.b", resource_type="test", property_id=prop_b.id)
                result = await service.get_audit_logs(property_id=prop_a.id, page=1, limit=50)
                assert len(result["data"]) == 1
                assert result["data"][0].action == "action.a"

@pytest.mark.unit
class TestSystemConfig:
    async def test_secrets_masked(self) -> None:
        """Sensitive config values are masked with ****. """
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