"""Background task definitions for Celery workers.

Task modules:
- invoice_tasks: Bulk invoice generation, PDF generation, email delivery
- notification_tasks: LINE push, email, in-app notifications
- maintenance_tasks: SLA monitoring, overdue alerts, contract expiry checks
"""

from app.workers.tasks.invoice_tasks import (
    generate_bulk_invoices_task,
    generate_invoice_pdf_task,
    send_invoice_email_task,
)
from app.workers.tasks.notification_tasks import (
    send_line_notification_task,
    send_email_notification_task,
    send_in_app_notification_task,
)
from app.workers.tasks.maintenance_tasks import (
    check_sla_breaches_task,
    send_overdue_alerts_task,
    check_contract_expiry_task,
)

__all__ = [
    "generate_bulk_invoices_task",
    "generate_invoice_pdf_task",
    "send_invoice_email_task",
    "send_line_notification_task",
    "send_email_notification_task",
    "send_in_app_notification_task",
    "check_sla_breaches_task",
    "send_overdue_alerts_task",
    "check_contract_expiry_task",
]