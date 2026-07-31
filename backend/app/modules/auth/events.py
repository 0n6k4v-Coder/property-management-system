"""Auth module domain events — module-level publisher (SDD.md §9.2).

Auth-specific events are published through the shared event bus.
This module wraps ``shared/events.py`` with auth-specific signatures
so that service-layer code never imports the shared bus directly.

References:
    - SDD.md §9.2: Cross-Module Communication via events
    - SDD.md §5: Sequence diagrams for user.registered / user.logged_in
"""

from typing import Any

import structlog

from app.shared.events import publish as shared_publish

logger = structlog.get_logger()


async def publish(event_name: str, payload: dict[str, Any] | None = None) -> None:
    """Publish an auth-domain event through the shared event bus.

    Delegates to ``app.shared.events.publish``, which logs the event
    and is ready for Redis pub/sub in a future sprint.  Fail-silent
    — the primary business flow is never broken by event publishing.

    Parameters
    ----------
    event_name
        One of the ``EVENT_*`` constants defined in ``constants.py``.
    payload
        Free-form event payload (e.g. ``{"user_id": uuid}``).
    """
    try:
        await shared_publish(event_name, payload)
    except Exception:
        logger.warning("auth.event.publish_failed", event_name=event_name, exc_info=True)
