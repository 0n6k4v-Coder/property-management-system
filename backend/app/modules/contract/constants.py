"""Contract module constants: enums, error codes, domain events (SDD §2.5, §6).

References:
    - SDD.md §2.5: Contract Module Specification
    - SDD.md §6.2: Contract Status Machine
    - SDD.md §6.3: Room Status Machine
"""

from enum import StrEnum

# ── Error Codes (CONT-0xx) ──────────────────────────────────────────

CONT_001_ROOM_HAS_ACTIVE_CONTRACT: str = "CONT-001"
"""409 — Room already has an active contract (BR-01)."""

CONT_002_DEPOSIT_TOO_LOW: str = "CONT-002"
"""400 — Deposit must be at least N months of rent (BR-02)."""

CONT_003_DATE_OVERLAP: str = "CONT-003"
"""400 — Contract dates overlap with existing contract."""

CONT_004_CONTRACT_NOT_ACTIVE: str = "CONT-004"
"""409 — Contract is not in active state for termination."""

CONT_005_RENEW_INVALID_STATE: str = "CONT-005"
"""409 — Original contract must be terminated/expired before renewing."""

CONT_006_CONTRACT_NOT_FOUND: str = "CONT-006"
"""404 — Contract not found."""

CONT_007_ROOM_NOT_FOUND: str = "CONT-007"
"""404 — Room referenced in contract not found."""

CONT_008_TENANT_NOT_FOUND: str = "CONT-008"
"""404 — Tenant referenced in contract not found."""

CONT_009_INVALID_TERMINATION_REASON: str = "CONT-009"
"""400 — Termination reason is required and must be non-empty."""


# ── Enums ─────────────────────────────────────────────────────────────


class ContractStatus(StrEnum):
    """Possible states for a Contract (SDD §6.2: State Machines).

    Transitions:
        draft ──→ active (via signing)
        active ──→ terminated (via terminate_contract, BR-04)
        active ──→ expired (auto via scheduler when end_date < today)
        terminated ──→ (immutable, new contract created for renew)
        expired ──→ (immutable)
    """

    ACTIVE = "active"
    TERMINATED = "terminated"
    EXPIRED = "expired"
    DRAFT = "draft"


class TerminationReason(StrEnum):
    """Standardised reasons for contract termination (SDD §5.2)."""

    TENANT_MOVED_OUT = "tenant_moved_out"
    OWNER_TERMINATED = "owner_terminated"
    BREACH_OF_CONTRACT = "breach_of_contract"
    MUTUAL_AGREEMENT = "mutual_agreement"
    OTHER = "other"


# ── Error Messages ────────────────────────────────────────────────────

ERROR_MESSAGES: dict[str, str] = {
    CONT_001_ROOM_HAS_ACTIVE_CONTRACT: "Room already has an active contract",
    CONT_002_DEPOSIT_TOO_LOW: "Deposit must be at least {} months of rent",
    CONT_003_DATE_OVERLAP: "Contract dates overlap with an existing contract for this room",
    CONT_004_CONTRACT_NOT_ACTIVE: "Contract is not in active state — cannot terminate",
    CONT_005_RENEW_INVALID_STATE: "Original contract must be terminated or expired before renewing",
    CONT_006_CONTRACT_NOT_FOUND: "Contract not found",
    CONT_007_ROOM_NOT_FOUND: "Referenced room not found",
    CONT_008_TENANT_NOT_FOUND: "Referenced tenant not found",
    CONT_009_INVALID_TERMINATION_REASON: "Termination reason is required",
}


# ── Domain Events ─────────────────────────────────────────────────────

EVENT_CONTRACT_CREATED: str = "contract.created"
EVENT_CONTRACT_TERMINATED: str = "contract.terminated"
EVENT_CONTRACT_RENEWED: str = "contract.renewed"
EVENT_CONTRACT_EXPIRED: str = "contract.expired"
EVENT_CONTRACT_EXTENDED: str = "contract.extended"

