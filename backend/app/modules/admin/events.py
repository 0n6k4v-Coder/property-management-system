"""Domain event stubs for Admin module (SDD §2.7)."""
import structlog

logger = structlog.get_logger()

async def publish_admin_event(event_name: str, resource_id: str, metadata: dict | None = None) -> None:
    try:
        logger.info("admin.event.published", event_name=event_name, resource_id=resource_id, metadata=metadata or {})
    except Exception:
        logger.warning("admin.event.publish_failed", event_name=event_name, exc_info=True)
