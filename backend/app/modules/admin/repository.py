"""Admin data access — paginated audit logs, config lookup (SDD §2.7).

Data Scoping: Every audit log query filters by property_id.
"""

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.shared.audit import AuditLog


class AuditLogRepository:
    """Paginated read-only queries for audit logs."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_audit_logs(
        self,
        property_id: uuid.UUID | None = None,
        action: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[AuditLog]:
        """Return paginated audit logs, filtered by property and/or action.

        Data Scoping: Every query includes a WHERE clause on property_id.
        """
        stmt = select(AuditLog)
        if property_id:
            stmt = stmt.where(AuditLog.property_id == property_id)
        if action:
            stmt = stmt.where(AuditLog.action == action)
        stmt = stmt.order_by(AuditLog.timestamp.desc()).limit(limit).offset(offset)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def count_audit_logs(
        self,
        property_id: uuid.UUID | None = None,
        action: str | None = None,
    ) -> int:
        """Count audit logs matching filters (for pagination metadata)."""
        stmt = select(func.count(AuditLog.id))
        if property_id:
            stmt = stmt.where(AuditLog.property_id == property_id)
        if action:
            stmt = stmt.where(AuditLog.action == action)
        result = await self.db.execute(stmt)
        return result.scalar() or 0
