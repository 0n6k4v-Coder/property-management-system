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

    async def create_audit_log(
        self,
        user_id: uuid.UUID,
        action: str,
        resource_type: str,
        property_id: uuid.UUID | None = None,
        resource_id: uuid.UUID | None = None,
        metadata: dict | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> AuditLog:
        """Create a new audit log entry."""
        log = AuditLog(
            user_id=user_id,
            action=action,
            resource_type=resource_type,
            property_id=property_id,
            resource_id=resource_id,
            metadata=metadata or {},
            ip_address=ip_address,
            user_agent=user_agent,
        )
        self.db.add(log)
        await self.db.flush()
        await self.db.refresh(log)
        return log
