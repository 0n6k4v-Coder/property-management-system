"""Targeted unit tests to boost overall test coverage above 85%."""

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.modules.admin.constants import (
    ADMIN_001_NOT_FOUND,
    ADMIN_002_FORBIDDEN,
    ADMIN_003_INVALID_FILTER,
    ADMIN_004_CONFIG_KEY_NOT_FOUND,
    ADMIN_005_CONFIG_READ_ONLY,
    ERROR_MESSAGES,
    EVENT_ADMIN_AUDIT_VIEWED,
    EVENT_ADMIN_CONFIG_UPDATED,
)
from app.modules.admin.events import publish_admin_event
from app.modules.billing.events import publish_billing_event
from app.modules.contract.events import publish_contract_event
from app.modules.maintenance.events import publish_maintenance_event
from app.modules.notification.events import publish_notification_event
from app.modules.notification.repository import NotificationRepository
from app.modules.property.events import publish_property_event
from app.modules.tenant.events import publish_tenant_event
from app.workers.celery_app import get_celery_app
from app.workers.schedulers import get_celery_beat_schedule


@pytest.mark.unit
def test_admin_constants():
    assert ADMIN_001_NOT_FOUND in ERROR_MESSAGES
    assert ADMIN_002_FORBIDDEN in ERROR_MESSAGES
    assert ADMIN_003_INVALID_FILTER in ERROR_MESSAGES
    assert ADMIN_004_CONFIG_KEY_NOT_FOUND in ERROR_MESSAGES
    assert ADMIN_005_CONFIG_READ_ONLY in ERROR_MESSAGES
    assert EVENT_ADMIN_AUDIT_VIEWED == "admin.audit_viewed"
    assert EVENT_ADMIN_CONFIG_UPDATED == "admin.config_updated"


@pytest.mark.asyncio
async def test_publish_events_success_and_fail():
    await publish_admin_event("admin.config_updated", "conf-123", {"key": "value"})
    with patch("app.modules.admin.events.logger.info", side_effect=Exception("Log failed")):
        await publish_admin_event("admin.config_updated", "conf-123", {"key": "value"})

    await publish_billing_event("billing.recorded", "bill-123", {"key": "value"})
    with patch("app.modules.billing.events.logger.info", side_effect=Exception("Log failed")):
        await publish_billing_event("billing.recorded", "bill-123", {"key": "value"})

    await publish_contract_event("contract.created", "contract-123", {"key": "value"})
    with patch("app.modules.contract.events.logger.info", side_effect=Exception("Log failed")):
        await publish_contract_event("contract.created", "contract-123", {"key": "value"})

    await publish_maintenance_event("maint.created", "maint-123", {"key": "value"})
    with patch("app.modules.maintenance.events.logger.info", side_effect=Exception("Log failed")):
        await publish_maintenance_event("maint.created", "maint-123", {"key": "value"})

    await publish_notification_event("notif.sent", "notif-123", {"key": "value"})
    with patch("app.modules.notification.events.logger.info", side_effect=Exception("Log failed")):
        await publish_notification_event("notif.sent", "notif-123", {"key": "value"})

    await publish_property_event("prop.created", "prop-123", {"key": "value"})
    with patch("app.modules.property.events.logger.info", side_effect=Exception("Log failed")):
        await publish_property_event("prop.created", "prop-123", {"key": "value"})

    await publish_tenant_event("tenant.created", "tenant-123", {"key": "value"})
    with patch("app.modules.tenant.events.logger.info", side_effect=Exception("Log failed")):
        await publish_tenant_event("tenant.created", "tenant-123", {"key": "value"})


@pytest.mark.unit
def test_celery_app_getter_and_schedulers():
    app = get_celery_app()
    assert app.main == "pms_backend"
    assert "billing" in app.conf.task_routes["app.workers.tasks.invoice_tasks.*"]["queue"]

    sched = get_celery_beat_schedule()
    assert "send-overdue-reminders" in sched


@pytest.mark.asyncio
async def test_notification_repository_methods():
    mock_db = AsyncMock()

    # get_notification_property_id
    mock_res_prop = MagicMock()
    prop_id = uuid.uuid4()
    mock_res_prop.scalar_one_or_none.return_value = prop_id
    mock_db.execute.return_value = mock_res_prop

    repo = NotificationRepository(mock_db)
    found_prop = await repo.get_notification_property_id(uuid.uuid4())
    assert found_prop == prop_id

    # update_status
    mock_notif = MagicMock()
    mock_res_notif = MagicMock()
    mock_res_notif.scalars.return_value.first.return_value = mock_notif
    mock_db.execute.return_value = mock_res_notif

    updated = await repo.update_status(uuid.uuid4(), "sent")
    assert updated == mock_notif
    assert mock_notif.status == "sent"

    # update
    notif_obj = MagicMock()
    updated_obj = await repo.update(notif_obj)
    assert updated_obj == notif_obj

    # get_by_property_paginated
    mock_count_res = MagicMock()
    mock_count_res.scalar_one.return_value = 1
    mock_items_res = MagicMock()
    mock_items_res.scalars.return_value.all.return_value = [mock_notif]

    mock_db.execute.side_effect = [mock_count_res, mock_items_res, mock_count_res, mock_items_res]

    items, total = await repo.get_by_property_paginated(prop_id, page=1, limit=20)
    assert total == 1
    assert len(items) == 1

    # get_by_user_paginated
    user_id = uuid.uuid4()
    u_items, u_total = await repo.get_by_user_paginated(user_id, page=1, limit=20)
    assert u_total == 1
    assert len(u_items) == 1
