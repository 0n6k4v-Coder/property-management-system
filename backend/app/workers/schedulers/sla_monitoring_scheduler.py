"""SLA Monitoring Scheduler.

Runs hourly to check for SLA breaches in maintenance requests.

References:
- SDD §10.1: Celery Beat / scheduled tasks
- SDD §2.5: Maintenance Module Specification
"""
import structlog
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.workers.tasks.maintenance_tasks import check_sla_breaches_task

logger = structlog.get_logger()

# Scheduler instance
sla_monitoring_scheduler = AsyncIOScheduler(timezone="UTC")


def register_sla_monitoring_jobs(scheduler: AsyncIOScheduler | None = None) -> AsyncIOScheduler:
    """Register SLA monitoring jobs with the scheduler.

    Parameters
    ----------
    scheduler: Optional AsyncIOScheduler instance. Creates new one if not provided.

    Returns
    -------
    AsyncIOScheduler: Configured scheduler instance
    """
    scheduler = scheduler or sla_monitoring_scheduler

    # Hourly at minute 0 - check for SLA breaches
    scheduler.add_job(
        _run_sla_check,
        trigger=CronTrigger(minute=0, timezone="UTC"),
        id="sla-monitoring",
        name="SLA Breach Monitoring",
        max_instances=1,
        coalesce=True,
        misfire_grace_time=1800,  # 30 min grace period
    )

    logger.info("sla_monitoring_scheduler_jobs_registered")
    return scheduler


async def _run_sla_check() -> None:
    """Wrapper to run the Celery task from APScheduler."""
    logger.info("sla_monitoring_scheduler_triggered")
    # Trigger the Celery task
    check_sla_breaches_task.delay()


def start_sla_monitoring_scheduler() -> None:
    """Start the SLA monitoring scheduler."""
    register_sla_monitoring_jobs()
    sla_monitoring_scheduler.start()
    logger.info("sla_monitoring_scheduler_started")


def stop_sla_monitoring_scheduler() -> None:
    """Stop the SLA monitoring scheduler."""
    sla_monitoring_scheduler.shutdown(wait=True)
    logger.info("sla_monitoring_scheduler_stopped")
