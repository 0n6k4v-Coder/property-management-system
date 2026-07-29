"""Data access layer for Maintenance module (SDD §2.5 — Infrastructure layer).

References:
    - CODE_STYLE.md §3.2: Async query patterns (SQLAlchemy 2.0 select())
    - SDD.md §4.2: Physical schema
    - BR-08: Query filtering by property + status
"""

import uuid
from datetime import UTC, datetime

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

    async def get_request_property_id(self, request_id: uuid.UUID) -> uuid.UUID | None:
        """Return the property_id of a maintenance request, or None if not found.

        Used by the router for resolve-then-check authorization on endpoints
        that don't carry property_id directly.
        """
        stmt = select(MaintenanceRequest.property_id).where(
            MaintenanceRequest.id == request_id
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_sla_breaches(self, property_id: uuid.UUID | None = None) -> list[MaintenanceRequest]:
        """Return maintenance requests that have breached their SLA response or resolution times.

        Args:
            property_id: Optional filter by property. If None, checks all properties.

        Returns:
            List of MaintenanceRequest objects with breached SLA.
        """
        now = datetime.now(UTC)
        stmt = select(MaintenanceRequest).where(
            MaintenanceRequest.status.in_(["pending", "in_progress"]),
        )
        if property_id:
            stmt = stmt.where(MaintenanceRequest.property_id == property_id)

        # Check for response breach
        response_breach = (
            MaintenanceRequest.sla_response_due.is_not(None) &
            (MaintenanceRequest.sla_response_due < now)
        )
        # Check for resolution breach
        resolution_breach = (
            MaintenanceRequest.sla_resolution_due.is_not(None) &
            (MaintenanceRequest.sla_resolution_due < now)
        )

        stmt = stmt.where(response_breach | resolution_breach)
        stmt = stmt.order_by(MaintenanceRequest.created_at.asc())

        result = await self.db.execute(stmt)
        return list(result.scalars().all())
