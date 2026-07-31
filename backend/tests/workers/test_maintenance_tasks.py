"""Unit tests for maintenance Celery tasks."""

import uuid
from datetime import UTC, date, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


class MockSessionCM:
    def __init__(self, mock_db):
        self.mock_db = mock_db

    async def __aenter__(self):
        return self.mock_db

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        pass


@pytest.fixture
def mock_db():
    db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalars.return_value.first.return_value = None
    mock_result.scalars.return_value.all.return_value = []
    db.execute.return_value = mock_result
    return db


@pytest.fixture
def mock_async_session(mock_db):
    return MagicMock(side_effect=lambda: MockSessionCM(mock_db))


@pytest.mark.asyncio
async def test_check_sla_breaches_task_success(mock_async_session, mock_db):
    prop_id = str(uuid.uuid4())
    req1 = MagicMock()
    req1.id = uuid.uuid4()
    req1.property_id = uuid.UUID(prop_id)
    req1.room_id = uuid.uuid4()
    req1.priority = "high"
    req1.sla_response_due = datetime.now(UTC) - timedelta(hours=1)
    req1.sla_resolution_due = datetime.now(UTC) - timedelta(hours=2)

    prop_obj = MagicMock()
    prop_obj.created_by = uuid.uuid4()

    mock_result = MagicMock()
    mock_result.scalars.return_value.first.return_value = prop_obj
    mock_db.execute.return_value = mock_result

    with patch("app.workers.tasks.maintenance_tasks.async_session", mock_async_session), \
         patch("app.workers.tasks.maintenance_tasks.MaintenanceRepository") as mock_maint_repo_cls, \
         patch("app.workers.tasks.maintenance_tasks.NotificationRepository") as mock_notif_repo_cls, \
         patch("app.workers.tasks.maintenance_tasks.log_audit", new_callable=AsyncMock) as mock_log_audit:

        mock_maint_repo = AsyncMock()
        mock_maint_repo.get_sla_breaches.return_value = [req1]
        mock_maint_repo_cls.return_value = mock_maint_repo

        mock_notif_repo = AsyncMock()
        mock_notif_repo_cls.return_value = mock_notif_repo

        from app.workers.tasks.maintenance_tasks import check_sla_breaches_task

        res = await check_sla_breaches_task(property_id=prop_id)
        assert res["status"] == "completed"
        assert res["breaches_found"] == 1
        mock_notif_repo.create.assert_called_once()
        mock_log_audit.assert_called_once()


@pytest.mark.asyncio
async def test_check_sla_breaches_task_retry(mock_async_session):
    from app.workers.tasks.maintenance_tasks import check_sla_breaches_task

    with patch("app.workers.tasks.maintenance_tasks.async_session", mock_async_session), \
         patch("app.workers.tasks.maintenance_tasks.MaintenanceRepository", side_effect=Exception("DB Error")), \
         patch.object(check_sla_breaches_task, "retry", side_effect=Exception("Retrying")):

        with pytest.raises(Exception, match="Retrying"):
            await check_sla_breaches_task()


@pytest.mark.asyncio
async def test_send_overdue_alerts_task_success(mock_async_session, mock_db):
    invoice1 = MagicMock()
    invoice1.id = uuid.uuid4()
    invoice1.tenant_id = uuid.uuid4()
    invoice1.property_id = uuid.uuid4()
    invoice1.invoice_number = "INV-001"
    invoice1.billing_month = 5
    invoice1.billing_year = 2026
    invoice1.total_amount = 10000
    invoice1.paid_amount = 0
    invoice1.due_date = date.today() - timedelta(days=5)

    tenant_obj = MagicMock()
    tenant_obj.email = "tenant@example.com"

    with patch("app.workers.tasks.maintenance_tasks.async_session", mock_async_session), \
         patch("app.workers.tasks.maintenance_tasks.BillingRepository") as mock_billing_repo_cls, \
         patch("app.workers.tasks.maintenance_tasks.NotificationRepository") as mock_notif_repo_cls, \
         patch("app.modules.tenant.repository.TenantRepository", create=True) as mock_tenant_repo_cls, \
         patch("app.workers.tasks.maintenance_tasks.log_audit", new_callable=AsyncMock) as mock_log_audit:

        mock_billing_repo = AsyncMock()
        mock_billing_repo.get_overdue_invoices.return_value = [invoice1]
        mock_billing_repo_cls.return_value = mock_billing_repo

        mock_notif_repo = AsyncMock()
        mock_notif_repo_cls.return_value = mock_notif_repo

        mock_tenant_repo = AsyncMock()
        mock_tenant_repo.get_by_id.return_value = tenant_obj
        mock_tenant_repo_cls.return_value = mock_tenant_repo

        from app.workers.tasks.maintenance_tasks import send_overdue_alerts_task

        res = await send_overdue_alerts_task()
        assert res["status"] == "completed"
        assert res["alerts_sent"] == 1
        mock_notif_repo.create.assert_called_once()
        mock_log_audit.assert_called_once()


@pytest.mark.asyncio
async def test_send_overdue_alerts_task_no_email(mock_async_session, mock_db):
    invoice1 = MagicMock()
    invoice1.id = uuid.uuid4()
    invoice1.tenant_id = uuid.uuid4()

    tenant_obj = MagicMock()
    tenant_obj.email = None

    with patch("app.workers.tasks.maintenance_tasks.async_session", mock_async_session), \
         patch("app.workers.tasks.maintenance_tasks.BillingRepository") as mock_billing_repo_cls, \
         patch("app.workers.tasks.maintenance_tasks.NotificationRepository") as mock_notif_repo_cls, \
         patch("app.modules.tenant.repository.TenantRepository", create=True) as mock_tenant_repo_cls:

        mock_billing_repo = AsyncMock()
        mock_billing_repo.get_overdue_invoices.return_value = [invoice1]
        mock_billing_repo_cls.return_value = mock_billing_repo

        mock_tenant_repo = AsyncMock()
        mock_tenant_repo.get_by_id.return_value = tenant_obj
        mock_tenant_repo_cls.return_value = mock_tenant_repo

        from app.workers.tasks.maintenance_tasks import send_overdue_alerts_task

        res = await send_overdue_alerts_task()
        assert res["status"] == "completed"
        assert res["alerts_sent"] == 1


@pytest.mark.asyncio
async def test_send_overdue_alerts_task_retry(mock_async_session):
    from app.workers.tasks.maintenance_tasks import send_overdue_alerts_task

    with patch("app.workers.tasks.maintenance_tasks.async_session", mock_async_session), \
         patch("app.workers.tasks.maintenance_tasks.BillingRepository", side_effect=Exception("DB Error")), \
         patch.object(send_overdue_alerts_task, "retry", side_effect=Exception("Retrying")):

        with pytest.raises(Exception, match="Retrying"):
            await send_overdue_alerts_task()


@pytest.mark.asyncio
async def test_check_contract_expiry_task_success(mock_async_session, mock_db):
    contract1 = MagicMock()
    contract1.id = uuid.uuid4()
    contract1.property_id = uuid.uuid4()
    contract1.room_id = uuid.uuid4()
    contract1.end_date = date.today() + timedelta(days=30)

    prop_obj = MagicMock()
    prop_obj.created_by = uuid.uuid4()

    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [contract1]
    mock_result.scalars.return_value.first.return_value = prop_obj
    mock_db.execute.return_value = mock_result

    with patch("app.workers.tasks.maintenance_tasks.async_session", mock_async_session), \
         patch("app.workers.tasks.maintenance_tasks.NotificationRepository") as mock_notif_repo_cls, \
         patch("app.workers.tasks.maintenance_tasks.log_audit", new_callable=AsyncMock) as mock_log_audit:

        mock_notif_repo = AsyncMock()
        mock_notif_repo_cls.return_value = mock_notif_repo

        from app.workers.tasks.maintenance_tasks import check_contract_expiry_task

        res = await check_contract_expiry_task()
        assert res["status"] == "completed"
        assert res["notifications_sent"] > 0


@pytest.mark.asyncio
async def test_check_contract_expiry_task_retry(mock_async_session):
    from app.workers.tasks.maintenance_tasks import check_contract_expiry_task

    with patch("app.workers.tasks.maintenance_tasks.async_session", mock_async_session), \
         patch("app.workers.tasks.maintenance_tasks.NotificationRepository", side_effect=Exception("DB Error")), \
         patch.object(check_contract_expiry_task, "retry", side_effect=Exception("Retrying")):

        with pytest.raises(Exception, match="Retrying"):
            await check_contract_expiry_task()


@pytest.mark.asyncio
async def test_cleanup_expired_sessions_task(mock_async_session):
    with patch("app.workers.tasks.maintenance_tasks.async_session", mock_async_session):
        from app.workers.tasks.maintenance_tasks import cleanup_expired_sessions_task

        res = await cleanup_expired_sessions_task()
        assert res["status"] == "completed"
        assert res["cleaned_count"] == 0


@pytest.mark.asyncio
async def test_cleanup_expired_sessions_task_retry():
    class FailingSessionCM:
        async def __aenter__(self):
            raise Exception("Session failed")
        async def __aexit__(self, exc_type, exc_val, exc_tb):
            pass

    mock_failing_session = MagicMock(side_effect=lambda: FailingSessionCM())

    from app.workers.tasks.maintenance_tasks import cleanup_expired_sessions_task

    with patch("app.workers.tasks.maintenance_tasks.async_session", mock_failing_session):
        with pytest.raises(Exception, match="Session failed"):
            await cleanup_expired_sessions_task()
