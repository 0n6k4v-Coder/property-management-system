"""Notification business logic — send, resend, history (SDD §2.7).

Fixes anti-patterns #3, #15, #1, #20:
- #3: POST /test returns 202 Accepted (not 201), async via Celery
- #15: External I/O offloaded to Celery tasks
- #1: Optional Idempotency-Key header support
- #20: Cache-Control headers added in router layer

References:
    - docs/API.md "Proposed Redesign — Notification Module"
    - SDD.md §2.7: Notification Module
"""

import uuid
from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.models import User
from app.modules.notification.constants import (
    ERROR_MESSAGES,
    EVENT_NOTIFICATION_FAILED,
    NOTIF_001_NOT_FOUND,
    NOTIF_002_SEND_FAILED,
    NotificationChannel,
    NotificationStatus,
)
from app.modules.notification.events import publish_notification_event
from app.modules.notification.models import Notification
from app.modules.notification.repository import NotificationRepository
from app.shared.audit import log_audit
from app.shared.exceptions import APIError


class NotificationService:
    """Core notification logic with async Celery delivery."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = NotificationRepository(db)

    async def send_test(
        self,
        user_id: uuid.UUID,
        property_id: uuid.UUID,
        channel: str,
        subject: str,
        body: str,
        sent_by: uuid.UUID,
        _idempotency_key: str | None = None,
    ) -> Notification:
        """Create notification record, enqueue async send, return PENDING notification.

        Does NOT await external send. Returns immediately with status=PENDING.
        Celery task updates status to SENT/FAILED + sent_at + error_message.
        """
        notif = Notification(
            user_id=user_id,
            property_id=property_id,
            channel=channel,
            subject=subject,
            body=body,
            status=NotificationStatus.PENDING,
            created_by=sent_by,
        )
        notif = await self.repo.create(notif)

        # Enqueue Celery task based on channel
        try:
            await self._enqueue_notification_task(notif, channel, subject, body, sent_by)
        except Exception:
            # If Celery enqueue fails, mark as FAILED (fail-silent)
            notif.status = NotificationStatus.FAILED
            notif.error_message = "Failed to enqueue notification task"
            notif = await self.repo.update(notif)
            await publish_notification_event(EVENT_NOTIFICATION_FAILED, str(notif.id))
            await log_audit(
                db=self.db,
                user_id=sent_by,
                action="notification.failed",
                resource_type="notification",
                resource_id=notif.id,
                property_id=property_id,
                metadata={"channel": channel, "error": "enqueue_failed"},
            )

        return notif

    async def _enqueue_notification_task(
        self,
        notif: Notification,
        channel: str,
        subject: str,
        body: str,
        sent_by: uuid.UUID,
    ) -> None:
        """Enqueue the appropriate Celery task for the notification channel."""
        if channel == NotificationChannel.EMAIL:
            from app.workers.tasks.notification_tasks import send_email_notification_task

            recipient_email = await self._get_user_email(notif.user_id) if notif.user_id else None
            send_email_notification_task.delay(
                notification_id=str(notif.id),
                user_id=str(sent_by),
                recipient_email=recipient_email,
                subject=subject,
                body=body,
            )
        elif channel == NotificationChannel.LINE:
            from app.workers.tasks.notification_tasks import send_line_notification_task

            recipient_line_id = await self._get_user_line_id(notif.user_id) if notif.user_id else None
            send_line_notification_task.delay(
                notification_id=str(notif.id),
                user_id=str(sent_by),
                recipient_line_id=recipient_line_id,
                message=body,
            )
        else:  # IN_APP or SMS
            from app.workers.tasks.notification_tasks import send_in_app_notification_task

            send_in_app_notification_task.delay(
                notification_id=str(notif.id),
                user_id=str(sent_by),
                recipient_user_id=str(notif.user_id) if notif.user_id else None,
                title=subject,
                body=body,
            )

    async def _get_user_email(self, user_id: uuid.UUID) -> str | None:
        """Get user email from users table."""
        stmt = select(User.email).where(User.id == user_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def _get_user_line_id(self, _user_id: uuid.UUID) -> str | None:
        """Get user LINE ID from users table.

        User model doesn't have line_user_id field yet — return None
        to skip LINE notifications until the field is added.
        """
        return None

    async def resend(
        self,
        notif_id: uuid.UUID,
        resent_by: uuid.UUID,
        _idempotency_key: str | None = None,
    ) -> Notification:
        """Resend a failed/pending notification.

        Resets status to PENDING, clears error, enqueues Celery task.
        Idempotency handled at router layer.
        """
        notif = await self.repo.get_by_id(notif_id)
        if notif is None:
            raise APIError(
                code=NOTIF_001_NOT_FOUND,
                message=ERROR_MESSAGES[NOTIF_001_NOT_FOUND],
                status_code=404,
            )
        if notif.status == NotificationStatus.SENT:
            raise APIError(
                code=NOTIF_002_SEND_FAILED,
                message="Notification already sent successfully",
                status_code=400,
            )

        notif.status = NotificationStatus.PENDING
        notif.error_message = None
        notif = await self.repo.update(notif)

        # Enqueue Celery task (same as send_test)
        try:
            await self._enqueue_notification_task(
                notif, notif.channel, notif.subject, notif.body, resent_by
            )
        except Exception:
            notif.status = NotificationStatus.FAILED
            notif.error_message = "Failed to enqueue notification task"
            notif = await self.repo.update(notif)
            await publish_notification_event(EVENT_NOTIFICATION_FAILED, str(notif.id))
            await log_audit(
                db=self.db,
                user_id=resent_by,
                action="notification.resend_failed",
                resource_type="notification",
                resource_id=notif.id,
                property_id=notif.property_id,
                metadata={"channel": notif.channel, "error": "enqueue_failed"},
            )

        return notif

    async def get_history(
        self,
        property_id: uuid.UUID,
        _user_id: uuid.UUID | None = None,
        page: int = 1,
        limit: int = 20,
    ) -> tuple[Sequence[Notification], int]:
        """Get paginated notification history for a property.

        Returns (items, total_count) for pagination meta.
        Caller must enforce property scope before calling.
        """
        if property_id is None:
            raise ValueError("property_id is required for notification history")

        items, total = await self.repo.get_by_property_paginated(property_id, page, limit)
        return items, total
