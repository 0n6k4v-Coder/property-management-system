"""Unit tests for APScheduler and Celery Beat scheduler configurations."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.workers.schedulers import get_celery_beat_schedule
from app.workers.schedulers.contract_expiry_scheduler import (
    _run_contract_expiry_check,
    register_contract_expiry_jobs,
    start_contract_expiry_scheduler,
    stop_contract_expiry_scheduler,
)
from app.workers.schedulers.meter_reminder_scheduler import (
    _run_meter_reading_reminders,
    register_meter_reminder_jobs,
    start_meter_reminder_scheduler,
    stop_meter_reminder_scheduler,
)
from app.workers.schedulers.overdue_alert_scheduler import (
    _run_overdue_alerts,
    register_overdue_alert_jobs,
    start_overdue_alert_scheduler,
    stop_overdue_alert_scheduler,
)
from app.workers.schedulers.sla_monitoring_scheduler import (
    _run_sla_check,
    register_sla_monitoring_jobs,
    start_sla_monitoring_scheduler,
    stop_sla_monitoring_scheduler,
)


def test_get_celery_beat_schedule():
    schedule = get_celery_beat_schedule()
    assert isinstance(schedule, dict)
    assert "send-overdue-reminders" in schedule
    assert "generate-monthly-invoices" in schedule
    assert "cleanup-expired-sessions" in schedule
    assert "check-sla-breaches" in schedule
    assert "check-contract-expiries" in schedule


def test_register_contract_expiry_jobs():
    mock_scheduler = MagicMock()
    res = register_contract_expiry_jobs(mock_scheduler)
    assert res == mock_scheduler
    mock_scheduler.add_job.assert_called_once()


@pytest.mark.asyncio
async def test_run_contract_expiry_check():
    with patch("app.workers.schedulers.contract_expiry_scheduler.check_contract_expiry_task") as mock_task:
        await _run_contract_expiry_check()
        mock_task.delay.assert_called_once()


def test_start_stop_contract_expiry_scheduler():
    with patch("app.workers.schedulers.contract_expiry_scheduler.contract_expiry_scheduler") as mock_sched:
        start_contract_expiry_scheduler()
        mock_sched.start.assert_called_once()

        stop_contract_expiry_scheduler()
        mock_sched.shutdown.assert_called_once_with(wait=True)


def test_register_meter_reminder_jobs():
    mock_scheduler = MagicMock()
    res = register_meter_reminder_jobs(mock_scheduler)
    assert res == mock_scheduler
    mock_scheduler.add_job.assert_called_once()


@pytest.mark.asyncio
async def test_run_meter_reading_reminders():
    await _run_meter_reading_reminders()  # Should run without error


def test_start_stop_meter_reminder_scheduler():
    with patch("app.workers.schedulers.meter_reminder_scheduler.meter_reminder_scheduler") as mock_sched:
        start_meter_reminder_scheduler()
        mock_sched.start.assert_called_once()

        stop_meter_reminder_scheduler()
        mock_sched.shutdown.assert_called_once_with(wait=True)


def test_register_overdue_alert_jobs():
    mock_scheduler = MagicMock()
    res = register_overdue_alert_jobs(mock_scheduler)
    assert res == mock_scheduler
    mock_scheduler.add_job.assert_called_once()


@pytest.mark.asyncio
async def test_run_overdue_alerts():
    with patch("app.workers.schedulers.overdue_alert_scheduler.send_overdue_alerts_task") as mock_task:
        await _run_overdue_alerts()
        mock_task.delay.assert_called_once()


def test_start_stop_overdue_alert_scheduler():
    with patch("app.workers.schedulers.overdue_alert_scheduler.overdue_alert_scheduler") as mock_sched:
        start_overdue_alert_scheduler()
        mock_sched.start.assert_called_once()

        stop_overdue_alert_scheduler()
        mock_sched.shutdown.assert_called_once_with(wait=True)


def test_register_sla_monitoring_jobs():
    mock_scheduler = MagicMock()
    res = register_sla_monitoring_jobs(mock_scheduler)
    assert res == mock_scheduler
    mock_scheduler.add_job.assert_called_once()


@pytest.mark.asyncio
async def test_run_sla_check():
    with patch("app.workers.schedulers.sla_monitoring_scheduler.check_sla_breaches_task") as mock_task:
        await _run_sla_check()
        mock_task.delay.assert_called_once()


def test_start_stop_sla_monitoring_scheduler():
    with patch("app.workers.schedulers.sla_monitoring_scheduler.sla_monitoring_scheduler") as mock_sched:
        start_sla_monitoring_scheduler()
        mock_sched.start.assert_called_once()

        stop_sla_monitoring_scheduler()
        mock_sched.shutdown.assert_called_once_with(wait=True)
