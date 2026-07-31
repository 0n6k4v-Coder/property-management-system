"""Unit tests for invoice Celery tasks."""

import uuid
from datetime import date
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.modules.billing.models import InvoiceStatus


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
async def test_generate_bulk_invoices_task_success(mock_async_session):
    prop_id = str(uuid.uuid4())
    user_id = str(uuid.uuid4())

    with patch("app.workers.tasks.invoice_tasks.async_session", mock_async_session), \
         patch("app.workers.tasks.invoice_tasks.BulkInvoiceService") as mock_service_cls:

        mock_service = AsyncMock()
        mock_service.generate_bulk_invoices.return_value = {
            "generated_count": 5,
            "skipped_count": 0,
        }
        mock_service_cls.return_value = mock_service

        from app.workers.tasks.invoice_tasks import generate_bulk_invoices_task

        res = await generate_bulk_invoices_task(
            property_id=prop_id,
            billing_month=5,
            billing_year=2026,
            user_id=user_id,
        )
        assert res["generated_count"] == 5
        mock_service.generate_bulk_invoices.assert_called_once()


@pytest.mark.asyncio
async def test_generate_bulk_invoices_task_retry(mock_async_session):
    prop_id = str(uuid.uuid4())
    user_id = str(uuid.uuid4())

    with patch("app.workers.tasks.invoice_tasks.async_session", mock_async_session), \
         patch("app.workers.tasks.invoice_tasks.BulkInvoiceService", side_effect=Exception("Bulk error")), \
         patch("app.workers.tasks.invoice_tasks.generate_bulk_invoices_task.retry", side_effect=Exception("Retrying")):

        from app.workers.tasks.invoice_tasks import generate_bulk_invoices_task

        with pytest.raises(Exception, match="Retrying"):
            await generate_bulk_invoices_task(
                property_id=prop_id,
                billing_month=5,
                billing_year=2026,
                user_id=user_id,
            )


@pytest.mark.asyncio
async def test_generate_invoice_pdf_task(mock_async_session):
    inv_id = str(uuid.uuid4())
    user_id = str(uuid.uuid4())

    invoice_obj = MagicMock()
    invoice_obj.invoice_number = "INV-001"
    invoice_obj.due_date = date.today()
    invoice_obj.room_id = uuid.uuid4()
    invoice_obj.tenant_id = uuid.uuid4()
    invoice_obj.total_amount = 5000
    invoice_obj.paid_amount = 0
    invoice_obj.status = InvoiceStatus.ISSUED

    with patch("app.workers.tasks.invoice_tasks.async_session", mock_async_session), \
         patch("app.workers.tasks.invoice_tasks.BillingRepository") as mock_repo_cls, \
         patch("app.workers.tasks.invoice_tasks.get_storage_client") as mock_get_storage, \
         patch("app.workers.tasks.invoice_tasks.log_audit", new_callable=AsyncMock) as mock_log_audit:

        mock_repo = AsyncMock()
        mock_repo.get_invoice_by_id.return_value = invoice_obj
        mock_repo_cls.return_value = mock_repo

        mock_storage = AsyncMock()
        mock_storage.upload_file.return_value = "http://minio/documents/invoices/INV-001.pdf"
        mock_get_storage.return_value = mock_storage

        from app.workers.tasks.invoice_tasks import generate_invoice_pdf_task

        res = await generate_invoice_pdf_task(invoice_id=inv_id, user_id=user_id)
        assert res["status"] == "completed"
        assert res["invoice_id"] == inv_id
        assert "http://minio" in res["pdf_url"]
        mock_log_audit.assert_called_once()


@pytest.mark.asyncio
async def test_generate_invoice_pdf_not_found(mock_async_session):
    inv_id = str(uuid.uuid4())
    user_id = str(uuid.uuid4())

    with patch("app.workers.tasks.invoice_tasks.async_session", mock_async_session), \
         patch("app.workers.tasks.invoice_tasks.BillingRepository") as mock_repo_cls:

        mock_repo = AsyncMock()
        mock_repo.get_invoice_by_id.return_value = None
        mock_repo_cls.return_value = mock_repo

        from app.workers.tasks.invoice_tasks import _generate_invoice_pdf

        with pytest.raises(ValueError, match="Invoice .* not found"):
            await _generate_invoice_pdf(invoice_id=inv_id, user_id=user_id)


@pytest.mark.asyncio
async def test_send_invoice_email_task_success(mock_async_session):
    inv_id = str(uuid.uuid4())
    user_id = str(uuid.uuid4())
    email = "tenant@example.com"

    invoice_obj = MagicMock()
    invoice_obj.invoice_number = "INV-001"
    invoice_obj.due_date = date.today()
    invoice_obj.room_id = uuid.uuid4()
    invoice_obj.tenant_id = uuid.uuid4()
    invoice_obj.total_amount = 5000
    invoice_obj.paid_amount = 0
    invoice_obj.status = InvoiceStatus.ISSUED

    with patch("app.workers.tasks.invoice_tasks.async_session", mock_async_session), \
         patch("app.workers.tasks.invoice_tasks.BillingRepository") as mock_repo_cls, \
         patch("app.workers.tasks.invoice_tasks._generate_invoice_pdf", new_callable=AsyncMock) as mock_pdf_func, \
         patch("app.workers.tasks.invoice_tasks.log_audit", new_callable=AsyncMock) as mock_log_audit:

        mock_repo = AsyncMock()
        mock_repo.get_invoice_by_id.return_value = invoice_obj
        mock_repo_cls.return_value = mock_repo

        mock_pdf_func.return_value = {"pdf_url": "http://minio/pdf"}

        from app.workers.tasks.invoice_tasks import send_invoice_email_task

        res = await send_invoice_email_task(
            invoice_id=inv_id,
            recipient_email=email,
            user_id=user_id,
        )
        assert res["status"] == "sent"
        assert res["recipient"] == email
        mock_log_audit.assert_called_once()


@pytest.mark.asyncio
async def test_send_invoice_email_task_retry(mock_async_session):
    inv_id = str(uuid.uuid4())
    user_id = str(uuid.uuid4())

    with patch("app.workers.tasks.invoice_tasks.async_session", mock_async_session), \
         patch("app.workers.tasks.invoice_tasks.BillingRepository", side_effect=Exception("Email error")), \
         patch("app.workers.tasks.invoice_tasks.send_invoice_email_task.retry", side_effect=Exception("Retrying")):

        from app.workers.tasks.invoice_tasks import send_invoice_email_task

        with pytest.raises(Exception, match="Retrying"):
            await send_invoice_email_task(
                invoice_id=inv_id,
                recipient_email="test@example.com",
                user_id=user_id,
            )
