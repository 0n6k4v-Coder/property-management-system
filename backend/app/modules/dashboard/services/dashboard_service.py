"""Dashboard business logic — orchestrate aggregation queries (SDD §2.6).

Data Scoping: All queries use property_id from the authenticated user's context.

References:
    - SDD.md §2.6: Dashboard Module Specification (FR-DASH-01~04)
    - SDD.md §4.3: Indexing & Query Optimization
"""

import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.dashboard.repository import DashboardRepository
from app.modules.dashboard.schemas import DashboardSummaryResponse


class DashboardService:
    """Orchestrates dashboard aggregation queries (read-only)."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = DashboardRepository(db)

    async def get_summary(self, property_id: uuid.UUID) -> DashboardSummaryResponse:
        """Compute the full dashboard summary for a property.

        Data Scoping: The caller MUST provide a property_id that the
        authenticated user is authorized to access.
        """
        total = await self.repo.get_total_rooms(property_id)
        occupied = await self.repo.get_occupied_rooms(property_id)
        rate = (occupied / total * 100.0) if total > 0 else 0.0
        revenue = await self.repo.get_monthly_revenue(property_id)
        overdue_count, overdue_amount = await self.repo.get_overdue_summary(property_id)
        pending_maint = await self.repo.get_pending_maintenance_count(property_id)
        active_contracts = await self.repo.get_active_contracts_count(property_id)

        return DashboardSummaryResponse(
            property_id=property_id,
            total_rooms=total,
            occupied_rooms=occupied,
            occupancy_rate=round(rate, 1),
            monthly_revenue=revenue,
            overdue_count=overdue_count,
            overdue_amount=overdue_amount,
            pending_maintenance=pending_maint,
            active_contracts=active_contracts,
        )

    async def get_revenue_report(
        self, property_id: uuid.UUID, start_date: date | None, end_date: date | None,
    ) -> list[dict]:
        """Revenue report for a date range (defaults to current year)."""
        now = datetime.now(timezone.utc)
        if not end_date:
            end_date = now.date()
        if not start_date:
            start_date = date(end_date.year, 1, 1)
        return await self.repo.get_revenue_report(property_id, start_date, end_date)
