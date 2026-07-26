"""Unit tests for NotificationService — send, resend, fail-silent.

References:
    - SDD.md §2.7: Notification Module
    - Fail-Silent Pattern: External send failures logged, not raised.
"""

import uuid
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.models import User
from app.modules.notification.constants import NotificationStatus
from app.modules.notification.services.notification_service import NotificationService
from app.shared.exceptions import APIError


@pytest.fixture
def any_user_id() -> uuid.UUID:
    return uuid.uuid4()


async def _seed_user(db_session: AsyncSession, uid: uuid.UUID) -> None:
    db_session.add(User(id=uid, email=f"{uid.hex[:8]}@test.com", password_hash="hashed", full_name="Test", is_active=True))
    await db_session.flush()


async def _seed_user_and_property(db_session: AsyncSession, uid: uuid.UUID) -> uuid.UUID:
    """Seed user + property, return the property_id."""
    from app.modules.property.models import Property
    db_session.add(User(id=uid, email=f"{uid.hex[:8]}@test.com", password_hash="hashed", full_name="Test", is_active=True))
    await db_session.flush()
    prop = Property(name="Test", address="Addr", billing_due_day=5, min_deposit_months=2, created_by=uid)
    db_session.add(prop)
    await db_session.flush()
    await db_session.refresh(prop)
    return prop.id


@pytest.mark.unit
class TestSendNotification:
    async def test_send_test_success(self, db_session: AsyncSession, any_user_id: uuid.UUID) -> None:
        """Send test → notification created with status=PENDING (Celery enqueued)."""
        prop_id = await _seed_user_and_property(db_session, any_user_id)
        service = NotificationService(db_session)

        # Mock the Celery task enqueue to avoid needing a worker
        with patch.object(service, '_enqueue_notification_task', new_callable=AsyncMock) as mock_enqueue:
            notif = await service.send_test(
                user_id=any_user_id, property_id=prop_id,
                channel="email", subject="Test", body="Hello from PMS",
                sent_by=any_user_id,
            )
            assert notif.id is not None
            assert notif.status == NotificationStatus.PENDING  # Returns PENDING, Celery updates to SENT
            assert notif.channel == "email"
            mock_enqueue.assert_called_once()

    async def test_send_fail_silent(self, db_session: AsyncSession, any_user_id: uuid.UUID) -> None:
        """Fail-silent: enqueue failure returns notification with FAILED status."""
        prop_id = await _seed_user_and_property(db_session, any_user_id)
        service = NotificationService(db_session)

        # Mock _enqueue_notification_task to raise an exception
        with patch.object(service, '_enqueue_notification_task', new_callable=AsyncMock) as mock_enqueue:
            mock_enqueue.side_effect = RuntimeError("Provider unavailable")

            notif = await service.send_test(
                user_id=any_user_id, property_id=prop_id,
                channel="line", subject="Alert", body="Test message",
                sent_by=any_user_id,
            )
            assert notif.status == NotificationStatus.FAILED
            assert "Failed to enqueue notification task" in (notif.error_message or "")

    async def test_resend_failed(self, db_session: AsyncSession, any_user_id: uuid.UUID) -> None:
        """Resend failed notification → status becomes PENDING (Celery will update to SENT)."""
        prop_id = await _seed_user_and_property(db_session, any_user_id)
        service = NotificationService(db_session)

        # First send fails (enqueue fails)
        with patch.object(service, '_enqueue_notification_task', new_callable=AsyncMock) as mock_enqueue:
            mock_enqueue.side_effect = RuntimeError("Fail first")

            notif = await service.send_test(
                user_id=any_user_id, property_id=prop_id,
                channel="email", subject="Retry", body="Will retry",
                sent_by=any_user_id,
            )
            assert notif.status == NotificationStatus.FAILED

        # Resend succeeds (enqueue succeeds)
        with patch.object(service, '_enqueue_notification_task', new_callable=AsyncMock) as mock_enqueue:
            resent = await service.resend(notif_id=notif.id, resent_by=any_user_id)
            assert resent.status == NotificationStatus.PENDING
            mock_enqueue.assert_called_once()

    async def test_resend_not_found(self, db_session: AsyncSession) -> None:
        """Non-existent notification → 404."""
        service = NotificationService(db_session)
        with pytest.raises(APIError) as exc:
            await service.resend(notif_id=uuid.uuid4(), resent_by=uuid.uuid4())
        assert exc.value.code == "NOTIF-001"
        assert exc.value.status_code == 404
