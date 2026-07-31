"""Domain event stubs for the Maintenance module (SDD §2.5).

References:
    - SDD.md §2.5: Maintenance module domain events
"""

from typing import Any

import structlog

from app.modules.maintenance.constants import (
    EVENT_MAINTENANCE_ASSIGNED,
    EVENT_MAINTENANCE_CREATED,
    EVENT_MAINTENANCE_STATUS_CHANGED,
)

logger = structlog.get_logger()

__all__ = [
    "EVENT_MAINTENANCE_ASSIGNED",
    "EVENT_MAINTENANCE_CREATED",
    "EVENT_MAINTENANCE_STATUS_CHANGED",
    "publish_maintenance_event",
]


async def publish_maintenance_event(event_name: str, request_id: str, metadata: dict[str, Any] | None = None) -> None:
    """Publish a maintenance-related domain event.

    Current implementation logs to structlog.  Replaced with Redis
    pub/sub in a future sprint.  Failures are silently caught.
    """
    try:
        logger.info(
            "maintenance.event.published",
            event_name=event_name,
            request_id=request_id,
            metadata=metadata or {},
        )
    except Exception:
        logger.warning("maintenance.event.publish_failed", event_name=event_name, exc_info=True)
