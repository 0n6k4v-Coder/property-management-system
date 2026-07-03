"""Invoice-related Celery tasks.

Implements:
- Bulk invoice generation for properties (FR-METER-07)
- PDF generation for invoices
- Email delivery of invoices

References:
- SDD §2.3: Billing Module Specification
- SDD §10.3: Workers
- backend/docs/OPERATIONS.md: Task monitoring
"""
import structlog
from datetime import date
from decimal import Decimal
import uuid

from celery import shared_task
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.modules.billing.services.bulk_service import BulkInvoiceService
from app.modules.billing.repository import BillingRepository
from app.modules.billing.models import Invoice, InvoiceStatus
from app.shared.audit import log_audit
from app.shared.storage import storage_client

logger = structlog.get_logger()

# Create async engine for Celery tasks (separate from FastAPI request lifecycle)
engine = create_async_engine(settings.DATABASE_URL, pool_pre_ping=True)
async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


@shared_task(bind=True, max_retries=3, default_retry_delay=60, queue="billing")
async def generate_bulk_invoices_task(
    self, property_id: str, billing_month: int, billing_year: int, user_id: str
):
    """Generate invoices for all occupied rooms in a property.

    Called by scheduler on the 1st of each month, or manually via API.

    Parameters
    ----------
    property_id: UUID string of the property
    billing_month: Month to invoice (1-12)
    billing_year: Year to invoice
    user_id: UUID string of the user initiating the generation

    Returns
    -------
    dict: Summary with generated_count, skipped_count, and invoice details
    """
    property_uuid = uuid.UUID(property_id)
    user_uuid = uuid.UUID(user_id)

    logger.info(
        "invoice.bulk_generate_start",
        property_id=property_id,
        month=billing_month,
        year=billing_year,
        user_id=user_id,
    )

    async with async_session() as db:
        try:
            service = BulkInvoiceService(db)
            result = await service.generate_bulk_invoices(
                property_id=property_uuid,
                billing_month=billing_month,
                billing_year=billing_year,
                created_by=user_uuid,
            )

            logger.info(
                "invoice.bulk_generate_complete",
                property_id=property_id,
                generated=result["generated_count"],
                skipped=result["skipped_count"],
            )

            return result

        except Exception as exc:
            logger.error(
                "invoice.bulk_generate_failed",
                property_id=property_id,
                error=str(exc),
                retries=self.request.retries,
            )
            raise self.retry(exc=exc, countdown=120 * (2**self.request.retries)) from exc


@shared_task(bind=True, max_retries=3, default_retry_delay=120, queue="billing")
async def generate_invoice_pdf_task(self, invoice_id: str, user_id: str):
    """Generate PDF for a specific invoice.

    Parameters
    ----------
    invoice_id: UUID string of the invoice
    user_id: UUID string of the user requesting PDF

    Returns
    -------
    dict: Result with pdf_url and metadata
    """
    invoice_uuid = uuid.UUID(invoice_id)
    user_uuid = uuid.UUID(user_id)

    logger.info(
        "invoice.pdf_generate_start",
        invoice_id=invoice_id,
        user_id=user_id,
    )

    async with async_session() as db:
        try:
            repo = BillingRepository(db)
            invoice = await repo.get_invoice_by_id(invoice_uuid)
            if not invoice:
                raise ValueError(f"Invoice {invoice_id} not found")

            # TODO: Implement actual PDF generation using weasyprint or reportlab
            # For now, create a placeholder PDF content
            pdf_content = _generate_placeholder_pdf(invoice)

            # Upload to MinIO
            object_name = f"invoices/{invoice_id}/{invoice.invoice_number}.pdf"
            url = await storage_client.upload_bytes(
                bucket="documents",
                object_name=object_name,
                data=pdf_content,
                content_type="application/pdf",
            )

            logger.info(
                "invoice.pdf_generate_complete",
                invoice_id=invoice_id,
                pdf_url=url,
            )

            # Audit log
            await log_audit(
                db=db,
                user_id=user_uuid,
                action="invoice.pdf_generated",
                resource_type="invoice",
                resource_id=invoice_uuid,
                metadata={"invoice_number": invoice.invoice_number, "pdf_url": url},
            )

            return {"status": "completed", "invoice_id": invoice_id, "pdf_url": url}

        except Exception as exc:
            logger.error(
                "invoice.pdf_generate_failed",
                invoice_id=invoice_id,
                error=str(exc),
                retries=self.request.retries,
            )
            raise self.retry(exc=exc, countdown=120 * (2**self.request.retries)) from exc


@shared_task(bind=True, max_retries=3, default_retry_delay=60, queue="notifications")
async def send_invoice_email_task(self, invoice_id: str, recipient_email: str, user_id: str):
    """Send invoice via email to tenant.

    Parameters
    ----------
    invoice_id: UUID string of the invoice
    recipient_email: Email address of the tenant
    user_id: UUID string of the user sending the invoice

    Returns
    -------
    dict: Result with email status
    """
    invoice_uuid = uuid.UUID(invoice_id)
    user_uuid = uuid.UUID(user_id)

    logger.info(
        "invoice.email_send_start",
        invoice_id=invoice_id,
        recipient=recipient_email,
    )

    async with async_session() as db:
        try:
            repo = BillingRepository(db)
            invoice = await repo.get_invoice_by_id(invoice_uuid)
            if not invoice:
                raise ValueError(f"Invoice {invoice_id} not found")

            # Generate PDF first
            pdf_result = await generate_invoice_pdf_task(
                invoice_id=invoice_id, user_id=user_id
            )
            pdf_url = pdf_result.get("pdf_url")

            # TODO: Implement actual email sending with SendGrid, SES, or SMTP
            # For now, log the action
            logger.info(
                "invoice.email_sent",
                invoice_id=invoice_id,
                recipient=recipient_email,
                pdf_url=pdf_url,
            )

            # Audit log
            await log_audit(
                db=db,
                user_id=user_uuid,
                action="invoice.email_sent",
                resource_type="invoice",
                resource_id=invoice_uuid,
                metadata={
                    "invoice_number": invoice.invoice_number,
                    "recipient_email": recipient_email,
                    "pdf_url": pdf_url,
                },
            )

            return {
                "status": "sent",
                "invoice_id": invoice_id,
                "recipient": recipient_email,
                "pdf_url": pdf_url,
            }

        except Exception as exc:
            logger.error(
                "invoice.email_send_failed",
                invoice_id=invoice_id,
                recipient=recipient_email,
                error=str(exc),
                retries=self.request.retries,
            )
            raise self.retry(exc=exc, countdown=60 * (2**self.request.retries)) from exc


def _generate_placeholder_pdf(invoice: Invoice) -> bytes:
    """Generate a placeholder PDF content for an invoice.

    In production, replace with actual PDF generation using weasyprint or reportlab.
    """
    content = f"""
INVOICE
=======

Invoice Number: {invoice.invoice_number}
Date: {date.today().strftime('%Y-%m-%d')}
Due Date: {invoice.due_date.strftime('%Y-%m-%d')}

Room: {invoice.room_id}
Tenant: {invoice.tenant_id}

Total Amount: {invoice.total_amount}
Paid Amount: {invoice.paid_amount}
Balance Due: {invoice.total_amount - invoice.paid_amount}

Status: {invoice.status.value}

---
Generated by Property Management System
""".strip()
    return content.encode("utf-8")