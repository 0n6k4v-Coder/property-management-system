"""Domain event stubs for the Contract module (SDD §2.5, §5.2).

References:
    - SDD.md §2.5: Contract module domain events
    - SDD.md §5.2: Contract Termination Sequence Diagram
"""

import structlog

from app.modules.contract.constants import (
    EVENT_CONTRACT_CREATED,
    EVENT_CONTRACT_EXTENDED,
    EVENT_CONTRACT_RENEWED,
    EVENT_CONTRACT_TERMINATED,
)

logger = structlog.get_logger()

# Re-export event names for convenience
__all__ = [
    "EVENT_CONTRACT_CREATED",
    "EVENT_CONTRACT_EXTENDED",
    "EVENT_CONTRACT_RENEWED",
    "EVENT_CONTRACT_TERMINATED",
    "publish_contract_event",
]


async def publish_contract_event(event_name: str, contract_id: str, metadata: dict | None = None) -> None:
    """Publish a contract-related domain event.

    Current implementation logs to structlog.  Replaced with Redis
    pub/sub in a future sprint.  Failures are silently caught so that
    an event publish never interrupts the primary business flow.

    Parameters
    ----------
    event_name
        Fully-qualified event name, e.g. ``"contract.created"``.
    contract_id
        UUID of the affected contract as a string.
    metadata
        Optional key-value payload attached to the event.
    """
    try:
        logger.info(
            "contract.event.published",
            event_name=event_name,
            contract_id=contract_id,
            metadata=metadata or {},
        )
    except Exception:
        logger.warning("contract.event.publish_failed", event_name=event_name, exc_info=True)