"""Billing module domain event stubs (SDD §2.3).

References:
- SDD.md §2.3: Billing module domain events
"""

from typing import Any

import structlog

logger = structlog.get_logger()


async def publish_billing_event(event_name: str, resource_id: str, metadata: dict[str, Any] | None = None) -> None:
    """Publish a billing-related domain event.

    Current implementation logs to structlog.  Replaced with Redis
    pub/sub in a future sprint.

    Parameters
    ----------
    event_name
        Fully-qualified event name, e.g. ``"meter.recorded"``.
    resource_id
        UUID of the affected resource as a string.
    metadata
        Optional key-value payload attached to the event.
    """
    try:
        logger.info(
            "billing.event.published",
            event_name=event_name,
            resource_id=resource_id,
            metadata=metadata or {},
        )
    except Exception:
        logger.warning("billing.event.publish_failed", event_name=event_name, exc_info=True)
