"""Maintenance-related Celery tasks.

Implements:
- SLA breach monitoring
- Overdue payment alerts
- Contract expiry checks
- Expired session cleanup

References:
- SDD §2.5: Maintenance Module Specification
- SDD §10.3: Workers
- backend/docs/OPERATIONS.md: Task monitoring
"""
import uuid
from datetime import UTC, date, datetime, timedelta
from typing import TYPE_CHECKING, Any

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.modules.billing.models import Invoice
from app.modules.billing.repository import BillingRepository
from app.modules.contract.models import Contract
from app.modules.maintenance.models import MaintenanceRequest
from app.modules.maintenance.repository import MaintenanceRepository
from app.modules.notification.constants import NotificationChannel, NotificationStatus
from app.modules.notification.models import Notification
from app.modules.notification.repository import NotificationRepository
from app.modules.property.models import Property
from app.shared.audit import log_audit
from app.workers.typing import CeleryTask, shared_task

if TYPE_CHECKING:
    pass

logger = structlog.get_logger()

settings = get_settings()

# Create async engine for Celery tasks
engine = create_async_engine(settings.DATABASE_URL, pool_pre_ping=True)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


@shared_task(bind=True, max_retries=2, default_retry_delay=300, queue="maintenance")  # type: ignore[untyped-decorator]
async def check_sla_breaches_task(self: CeleryTask, property_id: str | None = None) -> dict[str, Any]:
    """Check for SLA breaches in maintenance requests.

    Runs hourly to identify maintenance requests that have exceeded
    their SLA response/resolution times.

    Parameters
    ----------
    property_id: Optional UUID string to filter by property

    Returns
    -------
    dict: Summary of breaches found
    """
    property_uuid = uuid.UUID(property_id) if property_id else None

    logger.info("maintenance.sla_check_start", property_id=property_id)

    async with async_session() as db:
        try:
            repo = MaintenanceRepository(db)
            notification_repo = NotificationRepository(db)

            # Get active maintenance requests that might be breaching SLA
            breached_requests = await repo.get_sla_breaches(property_uuid)

            breach_count = 0
            for request in breached_requests:
                breach_count += 1
                await _handle_sla_breach(db, request, notification_repo)

            logger.info(
                "maintenance.sla_check_complete",
                property_id=property_id,
                breaches_found=breach_count,
            )

            return {"status": "completed", "breaches_found": breach_count}

        except Exception as exc:
            logger.error(
                "maintenance.sla_check_failed",
                property_id=property_id,
                error=str(exc),
                retries=self.request.retries,
            )
            raise self.retry(exc=exc, countdown=300 * (2**self.request.retries)) from exc


async def _handle_sla_breach(
    db: AsyncSession, request: MaintenanceRequest, notification_repo: NotificationRepository
) -> None:
    """Handle a single SLA breach - create notifications, escalate if needed."""
    # Determine breach type
    now = datetime.now(UTC)
    response_breach = False
    resolution_breach = False

    if request.sla_response_due and now > request.sla_response_due:
        response_breach = True
    if request.sla_resolution_due and now > request.sla_resolution_due:
        resolution_breach = True

    # Create notification for property manager
    prop_result = await db.execute(select(Property).where(Property.id == request.property_id))
    property_obj = prop_result.scalars().first()

    if property_obj and property_obj.created_by:
        notification = Notification(
            property_id=request.property_id,
            user_id=property_obj.created_by,
            channel=NotificationChannel.IN_APP,
            title=f"SLA Breach: Maintenance Request {request.id}",
            body=(
                f"Maintenance request {request.id} for room {request.room_id} "
                f"has breached its SLA. "
                f"{'Response time exceeded. ' if response_breach else ''}"
                f"{'Resolution time exceeded.' if resolution_breach else ''}"
            ),
            status=NotificationStatus.PENDING,
            priority="high",
        )
        await notification_repo.create(notification)

        # Also send email for high-priority breaches
        if request.priority in ("high", "urgent"):
            # TODO: Send email notification task
            pass

    # Audit log
    await log_audit(
        db=db,
        user_id=property_obj.created_by if property_obj else None,
        action="maintenance.sla_breach",
        resource_type="maintenance_request",
        resource_id=request.id,
        property_id=request.property_id,
        metadata={
            "request_id": str(request.id),
            "response_breach": response_breach,
            "resolution_breach": resolution_breach,
            "priority": request.priority,
        },
    )


@shared_task(bind=True, max_retries=2, default_retry_delay=600, queue="notifications")  # type: ignore[untyped-decorator]
async def send_overdue_alerts_task(self: CeleryTask) -> dict[str, Any]:
    """Send overdue payment reminders to tenants.

    Runs daily at 02:00 UTC to find overdue invoices and send reminders.

    Returns
    -------
    dict: Summary of alerts sent
    """
    logger.info("maintenance.overdue_alerts_start")

    async with async_session() as db:
        try:
            repo = BillingRepository(db)
            notification_repo = NotificationRepository(db)

            # Get all overdue invoices (past due date, not paid, not cancelled)
            overdue_invoices = await repo.get_overdue_invoices()

            alert_count = 0
            for invoice in overdue_invoices:
                try:
                    await _send_overdue_alert(db, invoice, notification_repo)
                    alert_count += 1
                except Exception as e:
                    logger.warning(
                        "maintenance.overdue_alert_failed",
                        invoice_id=str(invoice.id),
                        error=str(e),
                    )

            logger.info(
                "maintenance.overdue_alerts_complete",
                alerts_sent=alert_count,
            )

            return {"status": "completed", "alerts_sent": alert_count}

        except Exception as exc:
            logger.error(
                "maintenance.overdue_alerts_failed",
                error=str(exc),
                retries=self.request.retries,
            )
            raise self.retry(exc=exc, countdown=600 * (2**self.request.retries)) from exc


async def _send_overdue_alert(
    db: AsyncSession,
    invoice: Invoice,
    notification_repo: NotificationRepository,
) -> None:
    """Send overdue alert for a single invoice."""
    # Get tenant info
    from app.modules.tenant.repository import TenantRepository

    tenant_repo = TenantRepository(db)
    tenant = await tenant_repo.get_by_id(invoice.tenant_id)

    if not tenant or not tenant.email:
        logger.warning("maintenance.overdue_alert_no_email", invoice_id=str(invoice.id))
        return

    # Create in-app notification
    notification = Notification(
        property_id=invoice.property_id,
        user_id=invoice.tenant_id,  # Assuming tenant has user_id
        channel=NotificationChannel.IN_APP,
        title=f"Overdue Payment: Invoice {invoice.invoice_number}",
        body=(
            f"Your invoice {invoice.invoice_number} for "
            f"{invoice.billing_month:02d}/{invoice.billing_year} "
            f"is overdue. Amount due: {invoice.total_amount - invoice.paid_amount}. "
            f"Due date was {invoice.due_date.strftime('%Y-%m-%d')}."
        ),
        status=NotificationStatus.PENDING,
        priority="high",
    )
    await notification_repo.create(notification)

    # TODO: Send email notification via send_email_notification_task
    # await send_email_notification_task.delay(
    #     notification_id=str(notification.id),
    #     user_id=str(invoice.tenant_id),
    #     recipient_email=tenant.email,
    #     subject=f"Overdue Payment: Invoice {invoice.invoice_number}",
    #     body=f"Your invoice {invoice.invoice_number} is overdue..."
    # )

    # Audit log
    await log_audit(
        db=db,
        user_id=invoice.tenant_id,
        action="invoice.overdue_alert_sent",
        resource_type="invoice",
        resource_id=invoice.id,
        property_id=invoice.property_id,
        metadata={
            "invoice_number": invoice.invoice_number,
            "amount_due": str(invoice.total_amount - invoice.paid_amount),
            "days_overdue": (date.today() - invoice.due_date).days,
        },
    )


@shared_task(bind=True, max_retries=1, default_retry_delay=3600, queue="maintenance")  # type: ignore[untyped-decorator]
async def check_contract_expiry_task(self: CeleryTask) -> dict[str, Any]:
    """Check for contracts expiring in 90, 60, 30 days and send notifications.

    Runs daily at 00:00 UTC.

    Returns
    -------
    dict: Summary of expiring contracts found
    """
    logger.info("maintenance.contract_expiry_check_start")

    async with async_session() as db:
        try:
            notification_repo = NotificationRepository(db)

            # Check for contracts expiring at specific intervals
            intervals = [90, 60, 30, 14, 7, 1]
            total_notifications = 0

            for days_ahead in intervals:
                target_date = date.today() + timedelta(days=days_ahead)
                # Query contracts expiring on target_date
                stmt = select(Contract).where(
                    Contract.status == "active",
                    Contract.end_date == target_date,
                ).options(
                    selectinload(Contract.termination),
                    selectinload(Contract.extensions),
                )
                result = await db.execute(stmt)
                expiring_contracts = list(result.scalars().all())

                for contract in expiring_contracts:
                    try:
                        await _send_contract_expiry_notification(
                            db, contract, notification_repo, days_ahead
                        )
                        total_notifications += 1
                    except Exception as e:
                        logger.warning(
                            "maintenance.contract_expiry_notification_failed",
                            contract_id=str(contract.id),
                            days_ahead=days_ahead,
                            error=str(e),
                        )

            logger.info(
                "maintenance.contract_expiry_check_complete",
                total_notifications=total_notifications,
            )

            return {"status": "completed", "notifications_sent": total_notifications}

        except Exception as exc:
            logger.error(
                "maintenance.contract_expiry_check_failed",
                error=str(exc),
                retries=self.request.retries,
            )
            raise self.retry(exc=exc, countdown=3600 * (2**self.request.retries)) from exc


async def _send_contract_expiry_notification(
    db: AsyncSession,
    contract: Contract,
    notification_repo: NotificationRepository,
    days_ahead: int,
) -> None:
    """Send contract expiry notification."""
    # Get property manager
    prop_result = await db.execute(select(Property).where(Property.id == contract.property_id))
    property_obj = prop_result.scalars().first()

    if not property_obj or not property_obj.created_by:
        return

    # Create in-app notification for property manager
    notification = Notification(
        property_id=contract.property_id,
        user_id=property_obj.created_by,  # Using created_by as property manager
        channel=NotificationChannel.IN_APP,
        title=f"Contract Expiring in {days_ahead} Days",
        body=(
            f"Contract {contract.id} for room {contract.room_id} "
            f"expires on {contract.end_date.strftime('%Y-%m-%d')} "
            f"({days_ahead} days from now)."
        ),
        status=NotificationStatus.PENDING,
        priority="high" if days_ahead <= 14 else "normal",
    )
    await notification_repo.create(notification)

    # Audit log
    await log_audit(
        db=db,
        user_id=property_obj.created_by,  # Using created_by as property manager
        action="contract.expiry_notification",
        resource_type="contract",
        resource_id=contract.id,
        property_id=contract.property_id,
        metadata={
            "contract_id": str(contract.id),
            "days_ahead": days_ahead,
            "expiry_date": contract.end_date.isoformat(),
        },
    )


@shared_task(bind=True, max_retries=1, default_retry_delay=3600, queue="maintenance")  # type: ignore[untyped-decorator]
async def cleanup_expired_sessions_task(self: CeleryTask) -> dict[str, Any]:
    """Clean up expired sessions and tokens.

    Runs hourly to remove expired JWT tokens, refresh tokens, and sessions.

    Returns
    -------
    dict: Summary of cleanup performed
    """
    logger.info("maintenance.session_cleanup_start")

    async with async_session() as _db:
        try:
            # TODO: Implement actual session cleanup
            # This would delete expired:
            # - Refresh tokens (from auth module)
            # - Password reset tokens
            # - Email verification tokens
            # - API keys that have expired

            logger.info("maintenance.session_cleanup_complete", cleaned=0)

            return {"status": "completed", "cleaned_count": 0}

        except Exception as exc:
            logger.error(
                "maintenance.session_cleanup_failed",
                error=str(exc),
                retries=self.request.retries,
            )
            raise self.retry(exc=exc, countdown=3600 * (2**self.request.retries)) from exc
