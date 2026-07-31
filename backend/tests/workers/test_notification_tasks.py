"""Unit tests for notification Celery tasks."""

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.modules.notification.constants import NotificationStatus


class MockSessionCM:
    def __init__(self, mock_db):
        self.mock_db = mock_db

    async def __aenter__(self):
        return self.mock_db

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        pass


@pytest.fixture
def mock_db():
    db = AsyncMock()
    return db


@pytest.fixture
def mock_async_session(mock_db):
    return MagicMock(side_effect=lambda: MockSessionCM(mock_db))


@pytest.mark.asyncio
async def test_send_line_notification_task_success(mock_async_session):
    notif_id = str(uuid.uuid4())
    user_id = str(uuid.uuid4())
    recipient_line_id = "line-123"

    notif_obj = MagicMock()
    notif_obj.id = uuid.UUID(notif_id)

    with patch("app.workers.tasks.notification_tasks.async_session", mock_async_session), \
         patch("app.workers.tasks.notification_tasks.NotificationRepository") as mock_repo_cls, \
         patch("app.workers.tasks.notification_tasks.log_audit", new_callable=AsyncMock) as mock_log_audit:

        mock_repo = AsyncMock()
        mock_repo.get_by_id.return_value = notif_obj
        mock_repo_cls.return_value = mock_repo

        from app.workers.tasks.notification_tasks import send_line_notification_task

        res = await send_line_notification_task(
            notification_id=notif_id,
            user_id=user_id,
            recipient_line_id=recipient_line_id,
            message="Hello",
        )
        assert res["status"] == "sent"
        assert res["channel"] == "line"
        mock_repo.update_status.assert_any_call(uuid.UUID(notif_id), NotificationStatus.SENDING)
        mock_repo.update_status.assert_any_call(uuid.UUID(notif_id), NotificationStatus.SENT)
        mock_log_audit.assert_called_once()


@pytest.mark.asyncio
async def test_send_line_notification_task_not_found(mock_async_session):
    notif_id = str(uuid.uuid4())
    user_id = str(uuid.uuid4())
    recipient_line_id = "line-123"

    with patch("app.workers.tasks.notification_tasks.async_session", mock_async_session), \
         patch("app.workers.tasks.notification_tasks.NotificationRepository") as mock_repo_cls, \
         patch("app.workers.tasks.notification_tasks.send_line_notification_task.retry", side_effect=Exception("Retrying")):

        mock_repo = AsyncMock()
        mock_repo.get_by_id.return_value = None
        mock_repo_cls.return_value = mock_repo

        from app.workers.tasks.notification_tasks import send_line_notification_task

        with pytest.raises(Exception, match="Retrying"):
            await send_line_notification_task(
                notification_id=notif_id,
                user_id=user_id,
                recipient_line_id=recipient_line_id,
                message="Hello",
            )
        mock_repo.update_status.assert_called_with(uuid.UUID(notif_id), NotificationStatus.FAILED)


@pytest.mark.asyncio
async def test_send_email_notification_task_success(mock_async_session):
    notif_id = str(uuid.uuid4())
    user_id = str(uuid.uuid4())
    email = "test@example.com"

    notif_obj = MagicMock()

    with patch("app.workers.tasks.notification_tasks.async_session", mock_async_session), \
         patch("app.workers.tasks.notification_tasks.NotificationRepository") as mock_repo_cls, \
         patch("app.workers.tasks.notification_tasks.log_audit", new_callable=AsyncMock) as mock_log_audit:

        mock_repo = AsyncMock()
        mock_repo.get_by_id.return_value = notif_obj
        mock_repo_cls.return_value = mock_repo

        from app.workers.tasks.notification_tasks import send_email_notification_task

        res = await send_email_notification_task(
            notification_id=notif_id,
            user_id=user_id,
            recipient_email=email,
            subject="Test Subject",
            body="Test Body",
            html_body="<p>Test Body</p>",
        )
        assert res["status"] == "sent"
        assert res["channel"] == "email"
        mock_log_audit.assert_called_once()


@pytest.mark.asyncio
async def test_send_email_notification_task_not_found(mock_async_session):
    notif_id = str(uuid.uuid4())
    user_id = str(uuid.uuid4())
    email = "test@example.com"

    with patch("app.workers.tasks.notification_tasks.async_session", mock_async_session), \
         patch("app.workers.tasks.notification_tasks.NotificationRepository") as mock_repo_cls, \
         patch("app.workers.tasks.notification_tasks.send_email_notification_task.retry", side_effect=Exception("Retrying")):

        mock_repo = AsyncMock()
        mock_repo.get_by_id.return_value = None
        mock_repo_cls.return_value = mock_repo

        from app.workers.tasks.notification_tasks import send_email_notification_task

        with pytest.raises(Exception, match="Retrying"):
            await send_email_notification_task(
                notification_id=notif_id,
                user_id=user_id,
                recipient_email=email,
                subject="Test Subject",
                body="Test Body",
            )
        mock_repo.update_status.assert_called_with(uuid.UUID(notif_id), NotificationStatus.FAILED)


@pytest.mark.asyncio
async def test_send_in_app_notification_task_success(mock_async_session):
    notif_id = str(uuid.uuid4())
    user_id = str(uuid.uuid4())
    recipient_user_id = str(uuid.uuid4())

    notif_obj = MagicMock()

    with patch("app.workers.tasks.notification_tasks.async_session", mock_async_session), \
         patch("app.workers.tasks.notification_tasks.NotificationRepository") as mock_repo_cls, \
         patch("app.workers.tasks.notification_tasks.log_audit", new_callable=AsyncMock) as mock_log_audit:

        mock_repo = AsyncMock()
        mock_repo.get_by_id.return_value = notif_obj
        mock_repo_cls.return_value = mock_repo

        from app.workers.tasks.notification_tasks import send_in_app_notification_task

        res = await send_in_app_notification_task(
            notification_id=notif_id,
            user_id=user_id,
            recipient_user_id=recipient_user_id,
            title="In-app Title",
            _body="In-app Body",
        )
        assert res["status"] == "created"
        assert res["channel"] == "in_app"
        mock_repo.update_status.assert_called_with(uuid.UUID(notif_id), NotificationStatus.SENT)
        mock_log_audit.assert_called_once()


@pytest.mark.asyncio
async def test_send_in_app_notification_task_not_found(mock_async_session):
    notif_id = str(uuid.uuid4())
    user_id = str(uuid.uuid4())
    recipient_user_id = str(uuid.uuid4())

    with patch("app.workers.tasks.notification_tasks.async_session", mock_async_session), \
         patch("app.workers.tasks.notification_tasks.NotificationRepository") as mock_repo_cls, \
         patch("app.workers.tasks.notification_tasks.send_in_app_notification_task.retry", side_effect=Exception("Retrying")):

        mock_repo = AsyncMock()
        mock_repo.get_by_id.return_value = None
        mock_repo_cls.return_value = mock_repo

        from app.workers.tasks.notification_tasks import send_in_app_notification_task

        with pytest.raises(Exception, match="Retrying"):
            await send_in_app_notification_task(
                notification_id=notif_id,
                user_id=user_id,
                recipient_user_id=recipient_user_id,
                title="Title",
                _body="Body",
            )
