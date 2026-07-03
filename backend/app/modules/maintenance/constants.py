"""Maintenance module constants: enums, error codes, domain events (SDD §2.5, §6).

References:
    - SDD.md §2.5: Maintenance Module Specification
    - SDD.md §6.3: Room Status Machine
    - BR-08: Maintenance request tied to room + user (audit)
    - BR-09: Status workflow (pending → in_progress → resolved/cancelled)
"""

from enum import StrEnum


# ── Error Codes (MAINT-0xx) ──────────────────────────────────────────

MAINT_001_REQUEST_NOT_FOUND: str = "MAINT-001"
"""404 — Maintenance request not found."""

MAINT_002_ROOM_NOT_FOUND: str = "MAINT-002"
"""404 — Referenced room not found."""

MAINT_003_INVALID_STATUS_TRANSITION: str = "MAINT-003"
"""400 — Cannot transition from current status to requested status (BR-09)."""

MAINT_004_TITLE_TOO_SHORT: str = "MAINT-004"
"""400 — Title must be at least 3 characters."""

MAINT_005_DESCRIPTION_TOO_SHORT: str = "MAINT-005"
"""400 — Description must be at least 10 characters."""

MAINT_006_ALREADY_RESOLVED: str = "MAINT-006"
"""400 — Request is already resolved — no further transitions."""

MAINT_007_ALREADY_CANCELLED: str = "MAINT-007"
"""400 — Request is already cancelled — no further transitions."""

MAINT_008_ASSIGN_USER_NOT_FOUND: str = "MAINT-008"
"""404 — Assigned user not found."""

MAINT_009_PROPERTY_MISMATCH: str = "MAINT-009"
"""400 — Room does not belong to the specified property."""


# ── Error Messages ────────────────────────────────────────────────────

ERROR_MESSAGES: dict[str, str] = {
    MAINT_001_REQUEST_NOT_FOUND: "Maintenance request not found",
    MAINT_002_ROOM_NOT_FOUND: "Referenced room not found",
    MAINT_003_INVALID_STATUS_TRANSITION: "Cannot transition from {current} to {target}",
    MAINT_004_TITLE_TOO_SHORT: "Title must be at least 3 characters",
    MAINT_005_DESCRIPTION_TOO_SHORT: "Description must be at least 10 characters",
    MAINT_006_ALREADY_RESOLVED: "Request is already resolved — no further transitions",
    MAINT_007_ALREADY_CANCELLED: "Request is already cancelled — no further transitions",
    MAINT_008_ASSIGN_USER_NOT_FOUND: "Assigned user not found",
    MAINT_009_PROPERTY_MISMATCH: "Room does not belong to the specified property",
}


# ── Enums ─────────────────────────────────────────────────────────────


class MaintenanceStatus(StrEnum):
    """Possible states for a MaintenanceRequest (BR-09 workflow).

    Valid transitions:
        pending ──→ in_progress
        in_progress ──→ resolved
        in_progress ──→ cancelled
        pending ──→ cancelled
    """

    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    CANCELLED = "cancelled"


class Priority(StrEnum):
    """Priority level for a maintenance request."""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


# ── BR-09 Status Transition Table ────────────────────────────────────
# Maps current status → allowed target statuses

ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    MaintenanceStatus.PENDING: {MaintenanceStatus.IN_PROGRESS, MaintenanceStatus.CANCELLED},
    MaintenanceStatus.IN_PROGRESS: {MaintenanceStatus.RESOLVED, MaintenanceStatus.CANCELLED},
    MaintenanceStatus.RESOLVED: set(),       # terminal
    MaintenanceStatus.CANCELLED: set(),      # terminal
}


# ── Domain Events ─────────────────────────────────────────────────────

EVENT_MAINTENANCE_CREATED: str = "maintenance.created"
EVENT_MAINTENANCE_STATUS_CHANGED: str = "maintenance.status_changed"
EVENT_MAINTENANCE_ASSIGNED: str = "maintenance.assigned"