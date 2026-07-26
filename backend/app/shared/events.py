"""Shared internal event bus — sync stub, Redis pub/sub in future (SDD §9.2).

This module provides a lightweight in-process event bus that domain modules
use to publish cross-module events.  The current implementation is a
fail-silent synchronous stub.  In a future sprint the default handler will
be replaced with Redis pub/sub for horizontal scalability.

References:
    - SDD.md §9.2: Cross-Module Communication
    - SDD.md §5: Critical Sequence Diagrams
"""

import structlog

logger = structlog.get_logger()


async def publish(event_name: str, payload: dict | None = None) -> None:
    """Publish a domain event to the internal event bus.

    Current implementation logs the event to structlog and returns.
    Future implementations will fan out to Redis pub/sub channels or
    an internal message queue.

    Parameters
    ----------
    event_name
        Fully-qualified event name, e.g. ``"user.registered"``.
    payload
        Free-form key-value data attached to the event.  Sensitive fields
        should be excluded before calling this function.

    Raises
    ------
    Exception
        Any error is silently caught and logged as a warning — the event
        bus must never break the primary business flow.
    """
    if payload is None:
        payload = {}

    try:
        logger.info("event.published", event=event_name, payload=payload)
        # TODO: Replace with Redis pub/sub in Phase 3
        #   import aioredis
        #   from app.config import get_settings
        #   redis = await aioredis.from_url(get_settings().REDIS_URL)
        #   await redis.publish(event_name, json.dumps(payload))
    except Exception:
        logger.warning("event.publish_failed", event=event_name, exc_info=True)
