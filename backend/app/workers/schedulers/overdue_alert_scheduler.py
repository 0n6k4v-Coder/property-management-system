"""Overdue Alert Scheduler.

Runs daily at 02:00 to send overdue payment reminders.

References:
- SDD §10.1: Celery Beat / scheduled tasks
- SDD §2.3: Billing Module Specification
"""
import structlog
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.workers.tasks.maintenance_tasks import send_overdue_alerts_task

logger = structlog.get_logger()

# Scheduler instance
overdue_alert_scheduler = AsyncIOScheduler(timezone="UTC")


def register_overdue_alert_jobs(scheduler: AsyncIOScheduler | None = None) -> AsyncIOScheduler:
    """Register overdue alert jobs with the scheduler.

    Parameters
    ----------
    scheduler: Optional AsyncIOScheduler instance. Creates new one if not provided.

    Returns
    -------
    AsyncIOScheduler: Configured scheduler instance
    """
    scheduler = scheduler or overdue_alert_scheduler

    # Daily at 02:00 UTC - send overdue reminders
    scheduler.add_job(
        _run_overdue_alerts,
        trigger=CronTrigger(hour=2, minute=0, timezone="UTC"),
        id="overdue-alerts",
        name="Overdue Payment Alerts",
        max_instances=1,
        coalesce=True,
        misfire_grace_time=3600,  # 1 hour grace period
    )

    logger.info("overdue_alert_scheduler_jobs_registered")
    return scheduler


async def _run_overdue_alerts():
    """Wrapper to run the Celery task from APScheduler."""
    logger.info("overdue_alert_scheduler_triggered")
    # Trigger the Celery task
    send_overdue_alerts_task.delay()


def start_overdue_alert_scheduler():
    """Start the overdue alert scheduler."""
    register_overdue_alert_jobs()
    overdue_alert_scheduler.start()
    logger.info("overdue_alert_scheduler_started")


def stop_overdue_alert_scheduler():
    """Stop the overdue alert scheduler."""
    overdue_alert_scheduler.shutdown(wait=True)
    logger.info("overdue_alert_scheduler_stopped")
