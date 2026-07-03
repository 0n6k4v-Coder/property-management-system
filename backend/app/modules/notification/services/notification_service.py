"""Notification business logic — send, resend, history (SDD §2.7).

Fail-Silent Pattern: External send failures are caught and recorded
as status=failed in the DB — no exception propagates to the caller.

References:
    - SDD.md §2.7: Notification Module
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.notification.constants import (
    ERROR_MESSAGES, NOTIF_001_NOT_FOUND, NOTIF_002_SEND_FAILED,
    NotificationStatus, NotificationChannel,
    EVENT_NOTIFICATION_SENT, EVENT_NOTIFICATION_FAILED,
)
from app.modules.notification.events import publish_notification_event
from app.modules.notification.models import Notification
from app.shared.audit import log_audit
from app.shared.exceptions import APIError


class NotificationRepository:
    """Simple direct data access for notifications."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(self, notif: Notification) -> Notification:
        self.db.add(notif)
        await self.db.flush()
        await self.db.refresh(notif)
        return notif

    async def get_by_id(self, notif_id: uuid.UUID) -> Notification | None:
        from sqlalchemy import select
        stmt = select(Notification).where(Notification.id == notif_id)
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def update(self, notif: Notification) -> Notification:
        await self.db.flush()
        await self.db.refresh(notif)
        return notif

    async def get_by_user(self, user_id: uuid.UUID, limit: int = 50) -> list[Notification]:
        from sqlalchemy import select
        stmt = (
            select(Notification)
            .where(Notification.user_id == user_id)
            .order_by(Notification.created_at.desc())
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_by_property(self, property_id: uuid.UUID, limit: int = 50) -> list[Notification]:
        from sqlalchemy import select
        stmt = (
            select(Notification)
            .where(Notification.property_id == property_id)
            .order_by(Notification.created_at.desc())
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())


class NotificationService:
    """Core notification logic with fail-silent sends."""

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
    ) -> Notification:
        """Send a test notification and record the result.

        Fail-Silent: If the external send fails, status is set to 'failed'
        and the error is logged — the caller always receives a valid
        Notification object.
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

        # Mock external send
        try:
            await self._mock_external_send(notif)
            notif.status = NotificationStatus.SENT
            notif.sent_at = datetime.now(timezone.utc)
            notif = await self.repo.update(notif)

            await publish_notification_event(EVENT_NOTIFICATION_SENT, str(notif.id))
            await log_audit(
                db=self.db, user_id=sent_by, action="notification.sent",
                resource_type="notification", resource_id=notif.id,
                property_id=property_id,
                metadata={"channel": channel, "subject": subject},
            )
        except Exception as exc:
            notif.status = NotificationStatus.FAILED
            notif.error_message = str(exc)
            notif = await self.repo.update(notif)

            await publish_notification_event(EVENT_NOTIFICATION_FAILED, str(notif.id))
            await log_audit(
                db=self.db, user_id=sent_by, action="notification.failed",
                resource_type="notification", resource_id=notif.id,
                property_id=property_id,
                metadata={"channel": channel, "error": str(exc)},
            )

        return notif

    async def _mock_external_send(self, notif: Notification) -> None:
        """Mock external notification provider.

        Always succeeds in test/dev.  Replace with real email/LINE/SMS
        integration in production.
        """
        import asyncio
        await asyncio.sleep(0.01)

    async def resend(self, notif_id: uuid.UUID, resent_by: uuid.UUID) -> Notification:
        """Resend a failed notification.

        Raises
        ------
        APIError
            NOTIF-001: notification not found.
            NOTIF-002: notification was already sent successfully.
        """
        notif = await self.repo.get_by_id(notif_id)
        if notif is None:
            raise APIError(
                code=NOTIF_001_NOT_FOUND, message=ERROR_MESSAGES[NOTIF_001_NOT_FOUND],
                status_code=404,
            )
        if notif.status == NotificationStatus.SENT:
            raise APIError(
                code=NOTIF_002_SEND_FAILED, message="Notification already sent successfully",
                status_code=400,
            )

        notif.status = NotificationStatus.PENDING
        await self.repo.update(notif)

        try:
            await self._mock_external_send(notif)
            notif.status = NotificationStatus.SENT
            notif.sent_at = datetime.now(timezone.utc)
            notif.error_message = None
            notif = await self.repo.update(notif)
            await log_audit(
                db=self.db, user_id=resent_by, action="notification.resend",
                resource_type="notification", resource_id=notif.id,
                property_id=notif.property_id,
            )
        except Exception as exc:
            notif.status = NotificationStatus.FAILED
            notif.error_message = str(exc)
            notif = await self.repo.update(notif)

        return notif

    async def get_history(self, user_id: uuid.UUID | None = None, property_id: uuid.UUID | None = None) -> list[Notification]:
        """Get notification history, filtered by user or property."""
        if property_id:
            return await self.repo.get_by_property(property_id)
        if user_id:
            return await self.repo.get_by_user(user_id)
        return []
