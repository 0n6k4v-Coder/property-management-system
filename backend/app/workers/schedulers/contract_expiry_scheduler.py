"""Contract Expiry Scheduler.

Runs daily to check for contracts expiring in 30, 60, 90 days
and sends renewal reminders.

References:
- SDD §10.1: Celery Beat / scheduled tasks
- SDD §2.4: Contract Module Specification
"""
import structlog
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.workers.tasks.maintenance_tasks import check_contract_expiry_task

logger = structlog.get_logger()

# Scheduler instance
contract_expiry_scheduler = AsyncIOScheduler(timezone="UTC")


def register_contract_expiry_jobs(scheduler: AsyncIOScheduler | None = None) -> AsyncIOScheduler:
    """Register contract expiry check jobs with the scheduler.

    Parameters
    ----------
    scheduler: Optional AsyncIOScheduler instance. Creates new one if not provided.

    Returns
    -------
    AsyncIOScheduler: Configured scheduler instance
    """
    scheduler = scheduler or contract_expiry_scheduler

    # Daily at 09:00 UTC - check for expiring contracts
    scheduler.add_job(
        _run_contract_expiry_check,
        trigger=CronTrigger(hour=9, minute=0, timezone="UTC"),
        id="contract-expiry-check",
        name="Contract Expiry Check",
        max_instances=1,
        coalesce=True,
        misfire_grace_time=3600,  # 1 hour grace period
    )

    logger.info("contract_expiry_scheduler_jobs_registered")
    return scheduler


async def _run_contract_expiry_check():
    """Wrapper to run the Celery task from APScheduler."""
    logger.info("contract_expiry_scheduler_triggered")
    # Trigger the Celery task
    check_contract_expiry_task.delay()


def start_contract_expiry_scheduler():
    """Start the contract expiry scheduler."""
    register_contract_expiry_jobs()
    contract_expiry_scheduler.start()
    logger.info("contract_expiry_scheduler_started")


def stop_contract_expiry_scheduler():
    """Stop the contract expiry scheduler."""
    contract_expiry_scheduler.shutdown(wait=True)
    logger.info("contract_expiry_scheduler_stopped")
