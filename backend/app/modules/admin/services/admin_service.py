"""Admin business logic — audit logs, system config (SDD §2.7).

References:
    - SDD.md §7.4: Audit Compliance
    - Secret Masking: Sensitive config values are masked in responses.
"""

import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.modules.admin.repository import AuditLogRepository
from app.modules.admin.schemas import SystemConfigResponse

# Config keys that should be masked in responses
_SENSITIVE_CONFIG_KEYS = {"SECRET_KEY", "ID_CARD_ENCRYPTION_KEY", "DATABASE_URL", "REDIS_URL"}

# Config keys that are read-only and cannot be modified via API
_READ_ONLY_CONFIG_KEYS = {"SECRET_KEY", "ID_CARD_ENCRYPTION_KEY", "DATABASE_URL"}


class AdminService:
    """Admin operations — read-only audit queries, system config management."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = AuditLogRepository(db)

    async def get_audit_logs(
            self,
            property_id: uuid.UUID | None,
            action: str | None = None,
            page: int = 1,
            limit: int = 50,
            _requested_by: uuid.UUID | None = None,
        ) -> tuple[list[Any], int]:
            """Return paginated audit logs with metadata.

            Data Scoping: property_id is mandatory for non-admin users.

            Returns
            -------
            tuple
                (logs_list, total_count)
            """
            offset = (page - 1) * limit
            logs = await self.repo.get_audit_logs(
                property_id=property_id, action=action,
                limit=limit, offset=offset,
            )
            total = await self.repo.count_audit_logs(property_id=property_id, action=action)

            return logs, total

    async def get_system_config(self, _requested_by: uuid.UUID | None = None) -> list[SystemConfigResponse]:
        """Return system configuration with secrets masked."""
        settings = get_settings()
        config_items = [
            ("APP_NAME", settings.APP_NAME),
            ("APP_VERSION", settings.APP_VERSION),
            ("DEBUG", str(settings.DEBUG)),
            ("DATABASE_URL", settings.DATABASE_URL),
            ("REDIS_URL", settings.REDIS_URL),
            ("SECRET_KEY", settings.SECRET_KEY),
            ("ID_CARD_ENCRYPTION_KEY", settings.ID_CARD_ENCRYPTION_KEY),
            ("ACCESS_TOKEN_EXPIRE_MINUTES", str(settings.ACCESS_TOKEN_EXPIRE_MINUTES)),
            ("REFRESH_TOKEN_EXPIRE_DAYS", str(settings.REFRESH_TOKEN_EXPIRE_DAYS)),
        ]

        result = []
        for key, value in config_items:
            masked = key in _SENSITIVE_CONFIG_KEYS
            display_value = "****" if masked else value
            result.append(SystemConfigResponse(key=key, value=display_value, masked=masked))

        return result
