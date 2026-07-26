"""Scheduler package for Celery Beat and APScheduler jobs.

Contains:
- Contract expiry scheduler
- Overdue alert scheduler
- Meter reminder scheduler
- SLA monitoring scheduler
"""
from app.workers.schedulers.contract_expiry_scheduler import (
    contract_expiry_scheduler,
    register_contract_expiry_jobs,
)
from app.workers.schedulers.meter_reminder_scheduler import (
    meter_reminder_scheduler,
    register_meter_reminder_jobs,
)
from app.workers.schedulers.overdue_alert_scheduler import (
    overdue_alert_scheduler,
    register_overdue_alert_jobs,
)
from app.workers.schedulers.sla_monitoring_scheduler import (
    register_sla_monitoring_jobs,
    sla_monitoring_scheduler,
)

__all__ = [
    "contract_expiry_scheduler",
    "register_contract_expiry_jobs",
    "overdue_alert_scheduler",
    "register_overdue_alert_jobs",
    "meter_reminder_scheduler",
    "register_meter_reminder_jobs",
    "sla_monitoring_scheduler",
    "register_sla_monitoring_jobs",
]
