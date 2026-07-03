"""Background task definitions (stubs for future implementation).

Each task is a Celery ``@shared_task`` decorated function that can
be called asynchronously via ``task.delay(...)`` or scheduled via
Celery Beat.  Tasks follow the idempotent, retryable pattern so they
are safe to re-run on transient failures.

References:
  - SDD §10.3: Workers
  - backend/docs/OPERATIONS.md: Task monitoring
"""
import structlog
from celery import shared_task

logger = structlog.get_logger()


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_notification_task(
    self, notification_id: str, channel: str, _payload: dict
):
    """Stub: Send notification via Email/LINE (to be implemented in Sprint 6+)."""
    try:
        logger.info(
            "notification.send_attempt",
            notification_id=notification_id,
            channel=channel,
        )
        # TODO: Implement actual Email / LINE API calls
        return {"status": "sent", "notification_id": notification_id}
    except Exception as exc:
        logger.warning(
            "notification.send_failed",
            notification_id=notification_id,
            error=str(exc),
        )
        raise self.retry(exc=exc, countdown=60 * (2**self.request.retries)) from exc


@shared_task(bind=True, max_retries=2)
def generate_monthly_invoices_task(
    self, property_id: str, month: int, year: int
):
    """Stub: Generate invoices for all active contracts in a property."""
    try:
        logger.info(
            "invoice.generate_attempt",
            property_id=property_id,
            month=month,
            year=year,
        )
        # TODO: Implement bulk invoice generation logic
        return {"status": "completed", "property_id": property_id}
    except Exception as exc:
        logger.error(
            "invoice.generate_failed",
            property_id=property_id,
            error=str(exc),
        )
        raise self.retry(exc=exc, countdown=120) from exc
