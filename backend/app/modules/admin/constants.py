"""Admin module constants: error codes, domain events (SDD §2.7).

References:
    - SDD.md §7.4: Audit Compliance
"""

ADMIN_001_NOT_FOUND: str = "ADMIN-001"
ADMIN_002_FORBIDDEN: str = "ADMIN-002"
ADMIN_003_INVALID_FILTER: str = "ADMIN-003"
ADMIN_004_CONFIG_KEY_NOT_FOUND: str = "ADMIN-004"
ADMIN_005_CONFIG_READ_ONLY: str = "ADMIN-005"

ERROR_MESSAGES: dict[str, str] = {
    ADMIN_001_NOT_FOUND: "Resource not found",
    ADMIN_002_FORBIDDEN: "Insufficient permissions",
    ADMIN_003_INVALID_FILTER: "Invalid filter parameters",
    ADMIN_004_CONFIG_KEY_NOT_FOUND: "Configuration key not found",
    ADMIN_005_CONFIG_READ_ONLY: "This configuration key is read-only",
}

EVENT_ADMIN_AUDIT_VIEWED: str = "admin.audit_viewed"
EVENT_ADMIN_CONFIG_UPDATED: str = "admin.config_updated"
