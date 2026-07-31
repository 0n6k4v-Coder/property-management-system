"""Domain event stubs for the Property module (SDD §2.2, §5).

References:
- SDD.md §2.2: Property module domain events
- SDD.md §5: Critical Sequence Diagrams
"""

from typing import Any

import structlog

logger = structlog.get_logger()


async def publish_room_event(event_name: str, room_id: str, metadata: dict[str, Any] | None = None) -> None:
    """Publish a room-related domain event.

    Current implementation logs to structlog.  Replaced with Redis
    pub/sub in a future sprint.

    Parameters
    ----------
    event_name
        Fully-qualified event name, e.g. ``"room.status_changed"``.
    room_id
        UUID of the affected room as a string.
    metadata
        Optional key-value payload attached to the event.
    """
    try:
        logger.info(
            "room.event.published",
            event_name=event_name,
            room_id=room_id,
            metadata=metadata or {},
        )
    except Exception:
        logger.warning("room.event.publish_failed", event_name=event_name, exc_info=True)


async def publish_property_event(event_name: str, property_id: str, metadata: dict[str, Any] | None = None) -> None:
    """Publish a property-related domain event."""
    try:
        logger.info(
            "property.event.published",
            event_name=event_name,
            property_id=property_id,
            metadata=metadata or {},
        )
    except Exception:
        logger.warning("property.event.publish_failed", event_name=event_name, exc_info=True)
