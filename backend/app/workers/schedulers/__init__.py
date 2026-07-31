"""Scheduler package for Celery Beat and APScheduler jobs.

Contains:
- Contract expiry scheduler
- Overdue alert scheduler
- Meter reminder scheduler
- SLA monitoring scheduler
"""
from app.workers.schedulers.contract_expiry_scheduler import (
    contract_expiry_scheduler,
    register_contract_expiry_jobs,
)
from app.workers.schedulers.meter_reminder_scheduler import (
    meter_reminder_scheduler,
    register_meter_reminder_jobs,
)
from app.workers.schedulers.overdue_alert_scheduler import (
    overdue_alert_scheduler,
    register_overdue_alert_jobs,
)
from app.workers.schedulers.sla_monitoring_scheduler import (
    register_sla_monitoring_jobs,
    sla_monitoring_scheduler,
)

from celery.schedules import crontab

def get_celery_beat_schedule() -> dict:
    """Return Celery Beat schedule configuration dict."""
    return {
        "send-overdue-reminders": {
            "task": "app.workers.tasks.maintenance_tasks.send_overdue_alerts_task",
            "schedule": crontab(hour=2, minute=0),
            "options": {"queue": "notifications"},
        },
        "generate-monthly-invoices": {
            "task": "app.workers.tasks.invoice_tasks.generate_bulk_invoices_task",
            "schedule": crontab(day_of_month=1, hour=3, minute=0),
            "options": {"queue": "billing"},
        },
        "cleanup-expired-sessions": {
            "task": "app.workers.tasks.maintenance_tasks.cleanup_expired_sessions_task",
            "schedule": crontab(minute=0),
            "options": {"queue": "maintenance"},
        },
        "check-sla-breaches": {
            "task": "app.workers.tasks.maintenance_tasks.check_sla_breaches_task",
            "schedule": crontab(minute=15),
            "options": {"queue": "maintenance"},
        },
        "check-contract-expiries": {
            "task": "app.workers.tasks.maintenance_tasks.check_contract_expiry_task",
            "schedule": crontab(hour=0, minute=0),
            "options": {"queue": "maintenance"},
        },
    }

__all__ = [
    "contract_expiry_scheduler",
    "register_contract_expiry_jobs",
    "overdue_alert_scheduler",
    "register_overdue_alert_jobs",
    "meter_reminder_scheduler",
    "register_meter_reminder_jobs",
    "sla_monitoring_scheduler",
    "register_sla_monitoring_jobs",
    "get_celery_beat_schedule",
]

