"""Domain event stubs for the Tenant module (SDD §2.4).

References:
- SDD.md §2.4: Tenant module domain events
"""

import structlog

logger = structlog.get_logger()


async def publish_tenant_event(event_name: str, tenant_id: str, metadata: dict | None = None) -> None:
    """Publish a tenant-related domain event.

    Current implementation logs to structlog.  Replaced with Redis
    pub/sub in a future sprint.
    """
    try:
        logger.info(
            "tenant.event.published",
            event_name=event_name,
            tenant_id=tenant_id,
            metadata=metadata or {},
        )
    except Exception:
        logger.warning("tenant.event.publish_failed", event_name=event_name, exc_info=True)
