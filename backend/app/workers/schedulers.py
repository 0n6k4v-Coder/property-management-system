"""Celery Beat schedule definitions for periodic tasks.

Registers all recurring background jobs with their schedules.
References:
  - SDD §10.1: Celery Beat / scheduled tasks
  - backend/docs/OPERATIONS.md: Scheduled job monitoring
"""
from celery.schedules import crontab


def get_celery_beat_schedule() -> dict:
    """Return Celery Beat schedule configuration dict.

    Returns
    -------
    dict: Schedule mapping for Celery Beat
    """
    return {
        # Daily at 02:00 UTC: send overdue-reminder notifications
        "send-overdue-reminders": {
            "task": "app.workers.tasks.maintenance_tasks.send_overdue_alerts_task",
            "schedule": crontab(hour=2, minute=0),
            "options": {"queue": "notifications"},
        },
        # Monthly on the 1st at 03:00 UTC: generate monthly invoices
        "generate-monthly-invoices": {
            "task": "app.workers.tasks.invoice_tasks.generate_bulk_invoices_task",
            "schedule": crontab(day_of_month=1, hour=3, minute=0),
            "options": {"queue": "billing"},
        },
        # Every hour at minute 0: cleanup expired sessions / tokens
        "cleanup-expired-sessions": {
            "task": "app.workers.tasks.maintenance_tasks.cleanup_expired_sessions_task",
            "schedule": crontab(minute=0),
            "options": {"queue": "maintenance"},
        },
        # Every hour at minute 15: check SLA breaches
        "check-sla-breaches": {
            "task": "app.workers.tasks.maintenance_tasks.check_sla_breaches_task",
            "schedule": crontab(minute=15),
            "options": {"queue": "maintenance"},
        },
        # Daily at 00:00 UTC: check contract expiries (90, 60, 30 days)
        "check-contract-expiries": {
            "task": "app.workers.tasks.maintenance_tasks.check_contract_expiry_task",
            "schedule": crontab(hour=0, minute=0),
            "options": {"queue": "maintenance"},
        },
    }
