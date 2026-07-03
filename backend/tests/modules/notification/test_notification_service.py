"""Unit tests for NotificationService — send, resend, fail-silent.

References:
    - SDD.md §2.7: Notification Module
    - Fail-Silent Pattern: External send failures logged, not raised.
"""

import uuid

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
        """Send test → notification created with status=sent."""
        prop_id = await _seed_user_and_property(db_session, any_user_id)
        service = NotificationService(db_session)
        notif = await service.send_test(
            user_id=any_user_id, property_id=prop_id,
            channel="email", subject="Test", body="Hello from PMS",
            sent_by=any_user_id,
        )
        assert notif.id is not None
        assert notif.status == NotificationStatus.SENT
        assert notif.channel == "email"

    async def test_send_fail_silent(self, db_session: AsyncSession, any_user_id: uuid.UUID) -> None:
        """Fail-silent: even on failure, returns a Notification with failed status."""
        prop_id = await _seed_user_and_property(db_session, any_user_id)
        service = NotificationService(db_session)

        original_send = service._mock_external_send
        async def _broken_send(*args, **kwargs):
            raise RuntimeError("Provider unavailable")
        service._mock_external_send = _broken_send

        notif = await service.send_test(
            user_id=any_user_id, property_id=prop_id,
            channel="line", subject="Alert", body="Test message",
            sent_by=any_user_id,
        )
        assert notif.status == NotificationStatus.FAILED
        assert "Provider unavailable" in (notif.error_message or "")
        service._mock_external_send = original_send

    async def test_resend_failed(self, db_session: AsyncSession, any_user_id: uuid.UUID) -> None:
        """Resend failed notification → status becomes sent."""
        prop_id = await _seed_user_and_property(db_session, any_user_id)
        service = NotificationService(db_session)

        original_send = service._mock_external_send
        async def _broken_send(*args, **kwargs):
            raise RuntimeError("Fail first")
        service._mock_external_send = _broken_send

        notif = await service.send_test(
            user_id=any_user_id, property_id=prop_id,
            channel="email", subject="Retry", body="Will retry",
            sent_by=any_user_id,
        )
        assert notif.status == NotificationStatus.FAILED

        service._mock_external_send = original_send
        resent = await service.resend(notif_id=notif.id, resent_by=any_user_id)
        assert resent.status == NotificationStatus.SENT

    async def test_resend_not_found(self, db_session: AsyncSession) -> None:
        """Non-existent notification → 404."""
        service = NotificationService(db_session)
        with pytest.raises(APIError) as exc:
            await service.resend(notif_id=uuid.uuid4(), resent_by=uuid.uuid4())
        assert exc.value.code == "NOTIF-001"
        assert exc.value.status_code == 404
