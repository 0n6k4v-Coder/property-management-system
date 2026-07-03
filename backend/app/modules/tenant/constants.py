"""Tenant module constants: error codes, domain events (SDD §2.4).

References:
- SDD.md §2.4: Tenant Module Specification
"""

# ── Error Codes (TENANT-0xx) ───────────────────────────────────────────

TENANT_001_DUPLICATE_PHONE: str = "TENANT-001"
TENANT_002_INVALID_ID_CARD: str = "TENANT-002"
TENANT_003_ENCRYPTION_KEY_MISSING: str = "TENANT-003"
TENANT_004_TENANT_NOT_FOUND: str = "TENANT-004"
TENANT_005_DUPLICATE_EMAIL: str = "TENANT-005"
TENANT_006_INVALID_PHONE_FORMAT: str = "TENANT-006"
TENANT_007_PROPERTY_NOT_FOUND: str = "TENANT-007"
TENANT_008_QUERY_TOO_SHORT: str = "TENANT-008"
TENANT_009_INVALID_SEARCH_FIELD: str = "TENANT-009"

# ── Domain Events ──────────────────────────────────────────────────────

EVENT_TENANT_CREATED: str = "tenant.created"
EVENT_TENANT_UPDATED: str = "tenant.updated"
EVENT_TENANT_DELETED: str = "tenant.deleted"
