"""Data access layer for Maintenance module (SDD §2.5 — Infrastructure layer).

References:
    - CODE_STYLE.md §3.2: Async query patterns (SQLAlchemy 2.0 select())
    - SDD.md §4.2: Physical schema
    - BR-08: Query filtering by property + status
"""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.maintenance.models import MaintenanceRequest


class MaintenanceRepository:
    """Database queries for MaintenanceRequest."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(self, request: MaintenanceRequest) -> MaintenanceRequest:
        """Persist a new MaintenanceRequest and return it with an ID."""
        self.db.add(request)
        await self.db.flush()
        await self.db.refresh(request)
        return request

    async def get_by_id(self, request_id: uuid.UUID) -> MaintenanceRequest | None:
        """Retrieve a MaintenanceRequest by primary key."""
        stmt = select(MaintenanceRequest).where(MaintenanceRequest.id == request_id)
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def update(self, request: MaintenanceRequest) -> MaintenanceRequest:
        """Persist changes to an existing MaintenanceRequest."""
        await self.db.flush()
        await self.db.refresh(request)
        return request

    async def get_by_property(
        self,
        property_id: uuid.UUID,
        status: str | None = None,
    ) -> list[MaintenanceRequest]:
        """Return requests for a property, optionally filtered by status.

        Uses the ``ix_maintenance_requests_property_status`` composite index
        when a status filter is provided.
        """
        stmt = select(MaintenanceRequest).where(
            MaintenanceRequest.property_id == property_id,
        )
        if status:
            stmt = stmt.where(MaintenanceRequest.status == status)
        stmt = stmt.order_by(MaintenanceRequest.created_at.desc())
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_pending_by_property(self, property_id: uuid.UUID) -> list[MaintenanceRequest]:
        """Return all pending/cancelled/in-progress (non-terminal) requests.

        Convenience wrapper around ``get_by_property(property_id, status)``.
        """
        return await self.get_by_property(property_id, status=None)