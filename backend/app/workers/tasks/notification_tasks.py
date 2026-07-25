"""Notification-related Celery tasks.

Implements:
- LINE push notifications
- Email notifications
- In-app notifications

References:
- SDD §10.3: Workers
- backend/docs/OPERATIONS.md: Task monitoring
"""
import uuid

import structlog
from celery import shared_task
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.modules.notification.models import NotificationChannel, NotificationStatus
from app.modules.notification.repository import NotificationRepository
from app.shared.audit import log_audit

logger = structlog.get_logger()

# Create async engine for Celery tasks
engine = create_async_engine(settings.DATABASE_URL, pool_pre_ping=True)
async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


@shared_task(bind=True, max_retries=3, default_retry_delay=30, queue="notifications")
async def send_line_notification_task(
    self, notification_id: str, user_id: str, recipient_line_id: str, message: str
):
    """Send notification via LINE Messaging API.

    Parameters
    ----------
    notification_id: UUID string of the notification record
    user_id: UUID string of the user sending the notification
    recipient_line_id: LINE user ID of the recipient
    message: Message content to send

    Returns
    -------
    dict: Result with delivery status
    """
    notification_uuid = uuid.UUID(notification_id)
    user_uuid = uuid.UUID(user_id)

    logger.info(
        "notification.line_send_start",
        notification_id=notification_id,
        recipient_line_id=recipient_line_id,
    )

    async with async_session() as db:
        try:
            repo = NotificationRepository(db)
            notification = await repo.get_notification_by_id(notification_uuid)
            if not notification:
                raise ValueError(f"Notification {notification_id} not found")

            # Update status to sending
            await repo.update_notification_status(
                notification_uuid, NotificationStatus.SENDING
            )

            # TODO: Implement actual LINE API call using LINE Messaging API SDK
            # For now, simulate successful delivery
            await _send_line_message(recipient_line_id, message)

            # Update status to sent
            await repo.update_notification_status(
                notification_uuid, NotificationStatus.SENT
            )

            logger.info(
                "notification.line_send_complete",
                notification_id=notification_id,
                recipient_line_id=recipient_line_id,
            )

            # Audit log
            await log_audit(
                db=db,
                user_id=user_uuid,
                action="notification.line_sent",
                resource_type="notification",
                resource_id=notification_uuid,
                metadata={
                    "channel": NotificationChannel.LINE.value,
                    "recipient_line_id": recipient_line_id,
                },
            )

            return {
                "status": "sent",
                "notification_id": notification_id,
                "channel": "line",
                "recipient": recipient_line_id,
            }

        except Exception as exc:
            logger.error(
                "notification.line_send_failed",
                notification_id=notification_id,
                error=str(exc),
                retries=self.request.retries,
            )
            # Update status to failed
            try:
                async with async_session() as db:
                    repo = NotificationRepository(db)
                    await repo.update_notification_status(
                        notification_uuid, NotificationStatus.FAILED
                    )
            except Exception:
                pass
            raise self.retry(exc=exc, countdown=30 * (2**self.request.retries)) from exc


@shared_task(bind=True, max_retries=3, default_retry_delay=60, queue="notifications")
async def send_email_notification_task(
    self,
    notification_id: str,
    user_id: str,
    recipient_email: str,
    subject: str,
    body: str,
    html_body: str | None = None,
):
    """Send notification via email.

    Parameters
    ----------
    notification_id: UUID string of the notification record
    user_id: UUID string of the user sending the notification
    recipient_email: Email address of the recipient
    subject: Email subject
    body: Plain text email body
    html_body: Optional HTML email body

    Returns
    -------
    dict: Result with delivery status
    """
    notification_uuid = uuid.UUID(notification_id)
    user_uuid = uuid.UUID(user_id)

    logger.info(
        "notification.email_send_start",
        notification_id=notification_id,
        recipient_email=recipient_email,
    )

    async with async_session() as db:
        try:
            repo = NotificationRepository(db)
            notification = await repo.get_notification_by_id(notification_uuid)
            if not notification:
                raise ValueError(f"Notification {notification_id} not found")

            # Update status to sending
            await repo.update_notification_status(
                notification_uuid, NotificationStatus.SENDING
            )

            # TODO: Implement actual email sending (SendGrid, SES, SMTP)
            # For now, simulate successful delivery
            await _send_email(recipient_email, subject, body, html_body)

            # Update status to sent
            await repo.update_notification_status(
                notification_uuid, NotificationStatus.SENT
            )

            logger.info(
                "notification.email_send_complete",
                notification_id=notification_id,
                recipient_email=recipient_email,
            )

            # Audit log
            await log_audit(
                db=db,
                user_id=user_uuid,
                action="notification.email_sent",
                resource_type="notification",
                resource_id=notification_uuid,
                metadata={
                    "channel": NotificationChannel.EMAIL.value,
                    "recipient_email": recipient_email,
                    "subject": subject,
                },
            )

            return {
                "status": "sent",
                "notification_id": notification_id,
                "channel": "email",
                "recipient": recipient_email,
            }

        except Exception as exc:
            logger.error(
                "notification.email_send_failed",
                notification_id=notification_id,
                error=str(exc),
                retries=self.request.retries,
            )
            # Update status to failed
            try:
                async with async_session() as db:
                    repo = NotificationRepository(db)
                    await repo.update_notification_status(
                        notification_uuid, NotificationStatus.FAILED
                    )
            except Exception:
                pass
            raise self.retry(exc=exc, countdown=60 * (2**self.request.retries)) from exc


@shared_task(bind=True, max_retries=2, default_retry_delay=10, queue="notifications")
async def send_in_app_notification_task(
    self, notification_id: str, user_id: str, recipient_user_id: str, title: str, _body: str
) -> None:
    """Create in-app notification (stored in database, delivered via WebSocket/polling).

    Parameters
    ----------
    notification_id: UUID string of the notification record
    user_id: UUID string of the user sending the notification
    recipient_user_id: UUID string of the recipient user
    title: Notification title
    _body: Notification body (unused in stub)

    Returns
    -------
    dict: Result with delivery status
    """
    notification_uuid = uuid.UUID(notification_id)
    user_uuid = uuid.UUID(user_id)
    _ = uuid.UUID(recipient_user_id)  # validated but not used in this stub

    logger.info(
        "notification.in_app_create_start",
        notification_id=notification_id,
        recipient_user_id=recipient_user_id,
    )

    async with async_session() as db:
        try:
            repo = NotificationRepository(db)
            notification = await repo.get_notification_by_id(notification_uuid)
            if not notification:
                raise ValueError(f"Notification {notification_id} not found")

            # For in-app, just update status to sent (already stored in DB)
            await repo.update_notification_status(
                notification_uuid, NotificationStatus.SENT
            )

            # TODO: Push real-time via WebSocket or server-sent events
            # For now, just log
            logger.info(
                "notification.in_app_created",
                notification_id=notification_id,
                recipient_user_id=recipient_user_id,
            )

            # Audit log
            await log_audit(
                db=db,
                user_id=user_uuid,
                action="notification.in_app_created",
                resource_type="notification",
                resource_id=notification_uuid,
                metadata={
                    "channel": NotificationChannel.IN_APP.value,
                    "recipient_user_id": recipient_user_id,
                    "title": title,
                },
            )

            return {
                "status": "created",
                "notification_id": notification_id,
                "channel": "in_app",
                "recipient": recipient_user_id,
            }

        except Exception as exc:
            logger.error(
                "notification.in_app_create_failed",
                notification_id=notification_id,
                error=str(exc),
                retries=self.request.retries,
            )
            raise self.retry(exc=exc, countdown=10 * (2**self.request.retries)) from exc


async def _send_line_message(recipient_line_id: str, message: str) -> None:
    """Send message via LINE Messaging API.

    In production, use line-bot-sdk:
    from linebot import LineBotApi
    from linebot.models import TextSendMessage
    line_bot_api = LineBotApi(LINE_CHANNEL_ACCESS_TOKEN)
    line_bot_api.push_message(recipient_line_id, TextSendMessage(text=message))
    """
    # Simulate API call
    logger.debug("LINE API call simulated", recipient=recipient_line_id, message=message)
    pass


async def _send_email(
    recipient_email: str, subject: str, body: str, html_body: str | None = None
) -> None:
    """Send email via configured provider (SendGrid, SES, SMTP)."""
    _ = body  # validated but not used in stub
    _ = html_body  # validated but not used in stub
    # Simulate API call
    logger.debug(
        "Email API call simulated", recipient=recipient_email, subject=subject
    )
    pass
