"""Property module constants: enums, error codes, domain events (SDD §2.2, §6).

References:
- SDD.md §2.2: Property Module Specification
- SDD.md §6: State Machines (RoomStatus transitions)
"""

from enum import StrEnum

# ── Error Codes (PROP-0xx) ─────────────────────────────────────────────

PROP_001_ROOM_NUMBER_EXISTS: str = "PROP-001"
PROP_002_INVALID_FLOOR_REF: str = "PROP-002"
PROP_003_CANNOT_DELETE_OCCUPIED: str = "PROP-003"
PROP_004_PROPERTY_NOT_FOUND: str = "PROP-004"
PROP_005_BUILDING_NOT_FOUND: str = "PROP-005"
PROP_006_FLOOR_NOT_FOUND: str = "PROP-006"
PROP_007_ROOM_NOT_FOUND: str = "PROP-007"
PROP_008_INVALID_STATUS_TRANSITION: str = "PROP-008"
PROP_009_DUPLICATE_BUILDING_NAME: str = "PROP-009"


# ── Enums ──────────────────────────────────────────────────────────────


class RoomStatus(StrEnum):
    """Possible states for a room (SDD §6: State Machines)."""

    AVAILABLE = "available"
    OCCUPIED = "occupied"
    MAINTENANCE = "maintenance"


class RoomType(StrEnum):
    """Room classification (SDD §4.1.1)."""

    STUDIO = "studio"
    ONE_BEDROOM = "one_bedroom"
    TWO_BEDROOM = "two_bedroom"
    DORM = "dorm"


# ── Domain Events ──────────────────────────────────────────────────────

EVENT_ROOM_CREATED: str = "room.created"
EVENT_ROOM_STATUS_CHANGED: str = "room.status_changed"
EVENT_PROPERTY_CREATED: str = "property.created"
EVENT_BUILDING_CREATED: str = "building.created"
EVENT_FLOOR_CREATED: str = "floor.created"
