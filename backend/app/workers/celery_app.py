"""Celery application configuration (async task queue).

Manages the Celery singleton used by all background tasks.  The broker
and result-backend URLs are read from environment variables with sensible
development defaults pointing at the local Redis container.

References:
  - SDD §10.1: Docker / Celery integration
  - backend/docs/DEPLOYMENT.md: Production Celery tuning
"""
import os

from celery import Celery
from celery.schedules import crontab

CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", "redis://redis:6379/1")
CELERY_RESULT_BACKEND = os.getenv(
    "CELERY_RESULT_BACKEND", "redis://redis:6379/2"
)

celery_app = Celery(
    "pms_backend",
    broker=CELERY_BROKER_URL,
    backend=CELERY_RESULT_BACKEND,
    include=[
        "app.workers.tasks.invoice_tasks",
        "app.workers.tasks.notification_tasks",
        "app.workers.tasks.maintenance_tasks",
    ],
)

# Celery Beat schedule - combines all schedulers
celery_app.conf.beat_schedule = {
    "meter-reminder": {
        "task": "app.workers.tasks.notification_tasks.send_meter_reading_reminders_task",
        "schedule": crontab(day_of_month=25, hour=9, minute=0),
    },
    "contract-expiry": {
        "task": "app.workers.tasks.maintenance_tasks.check_contract_expiry_task",
        "schedule": crontab(hour=2, minute=0),
    },
    "overdue-alert": {
        "task": "app.workers.tasks.maintenance_tasks.send_overdue_alerts_task",
        "schedule": crontab(hour=2, minute=30),
    },
    "sla-monitoring": {
        "task": "app.workers.tasks.maintenance_tasks.check_sla_breaches_task",
        "schedule": crontab(minute=0),
    },
}

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=300,       # 5 minutes max per task
    worker_prefetch_multiplier=1,  # fair distribution across workers
    # Result expiration
    result_expires=86400,  # 24 hours
    # Task routing
    task_routes={
        "app.workers.tasks.invoice_tasks.*": {"queue": "billing"},
        "app.workers.tasks.notification_tasks.*": {"queue": "notifications"},
        "app.workers.tasks.maintenance_tasks.*": {"queue": "maintenance"},
    },
    # Worker configuration
    worker_send_task_events=True,
    task_send_sent_event=True,
)


def get_celery_app() -> Celery:
    """Return the configured Celery application instance."""
    return celery_app
