"""Meter Reading Reminder Scheduler.

Runs on the 25th of each month to remind tenants to submit meter readings.

References:
- SDD §10.1: Celery Beat / scheduled tasks
- SDD §2.3: Billing Module Specification
"""
import structlog
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

logger = structlog.get_logger()

# Scheduler instance
meter_reminder_scheduler = AsyncIOScheduler(timezone="UTC")


def register_meter_reminder_jobs(scheduler: AsyncIOScheduler | None = None) -> AsyncIOScheduler:
    """Register meter reading reminder jobs with the scheduler.

    Parameters
    ----------
    scheduler: Optional AsyncIOScheduler instance. Creates new one if not provided.

    Returns
    -------
    AsyncIOScheduler: Configured scheduler instance
    """
    scheduler = scheduler or meter_reminder_scheduler

    # Monthly on the 25th at 10:00 UTC - remind tenants to submit meter readings
    scheduler.add_job(
        _run_meter_reading_reminders,
        trigger=CronTrigger(day=25, hour=10, minute=0, timezone="UTC"),
        id="meter-reading-reminders",
        name="Meter Reading Reminders",
        max_instances=1,
        coalesce=True,
        misfire_grace_time=86400,  # 1 day grace period
    )

    logger.info("meter_reminder_scheduler_jobs_registered")
    return scheduler


async def _run_meter_reading_reminders() -> None:
    """Wrapper to send meter reading reminders to all active tenants."""
    logger.info("meter_reminder_scheduler_triggered")

    # This would typically:
    # 1. Query all active contracts
    # 2. For each tenant, create an in-app notification
    # 3. Optionally send LINE/Email reminders
    #
    # For now, we'll use a placeholder task that would be implemented
    # with actual tenant querying logic.
    try:
        # TODO: Implement actual tenant querying and notification creation
        # For now, log the trigger
        logger.info("meter_reading_reminders_would_be_sent")

        # In production, this would be:
        # async with async_session() as db:
        #     tenants = await get_active_tenants(db)
        #     for tenant in tenants:
        #         notification = create_meter_reminder_notification(tenant)
        #         send_in_app_notification_task.delay(
        #             notification_id=str(notification.id),
        #             user_id="system",
        #             recipient_user_id=str(tenant.id),
        #             title="Meter Reading Due",
        #             body="Please submit your meter readings by end-of-month meter readings by the 28th."
        #         )

    except Exception as exc:
        logger.error("meter_reminder_scheduler_failed", error=str(exc))


def start_meter_reminder_scheduler() -> None:
    """Start the meter reminder scheduler."""
    register_meter_reminder_jobs()
    meter_reminder_scheduler.start()
    logger.info("meter_reminder_scheduler_started")


def stop_meter_reminder_scheduler() -> None:
    """Stop the meter reminder scheduler."""
    meter_reminder_scheduler.shutdown(wait=True)
    logger.info("meter_reminder_scheduler_stopped")
