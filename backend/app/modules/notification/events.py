"""Domain event stubs for Notification module (SDD §2.7)."""
from typing import Any

import structlog

logger = structlog.get_logger()

async def publish_notification_event(event_name: str, notification_id: str, metadata: dict[str, Any] | None = None) -> None:
    try:
        logger.info("notification.event.published", event_name=event_name, notification_id=notification_id, metadata=metadata or {})
    except Exception:
        logger.warning("notification.event.publish_failed", event_name=event_name, exc_info=True)
