"""Dashboard data access — read-optimized aggregation queries (SDD §2.6).

References:
    - SDD.md §2.6: Dashboard Module Specification
    - SDD.md §4.3: Indexing & Query Optimization
    - Data Scoping: Every query filters by property_id.
"""

import uuid
from datetime import UTC, date
from decimal import Decimal

from sqlalchemy import String, case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.billing.models import Invoice
from app.modules.contract.models import Contract
from app.modules.maintenance.models import MaintenanceRequest
from app.modules.property.models import Room


class DashboardRepository:
    """Read-only repository for dashboard aggregations.

    Data Scoping: Every public method accepts a ``property_id``
    parameter and includes ``WHERE property_id = :property_id``
    in the query to prevent cross-property data leaks.
    """

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_total_rooms(self, property_id: uuid.UUID) -> int:
        """Count total rooms for a property (Data Scoping enforced)."""
        stmt = select(func.count(Room.id)).where(Room.property_id == property_id)
        result = await self.db.execute(stmt)
        return result.scalar() or 0

    async def get_occupied_rooms(self, property_id: uuid.UUID) -> int:
        """Count occupied rooms for a property (Data Scoping enforced)."""
        from app.modules.property.constants import RoomStatus

        stmt = (
            select(func.count(Room.id))
            .where(Room.property_id == property_id, Room.status == RoomStatus.OCCUPIED)
        )
        result = await self.db.execute(stmt)
        return result.scalar() or 0

    async def get_active_contracts_count(self, property_id: uuid.UUID) -> int:
        """Count active contracts for a property."""
        stmt = (
            select(func.count(Contract.id))
            .where(Contract.property_id == property_id, Contract.status == "active")
        )
        result = await self.db.execute(stmt)
        return result.scalar() or 0

    async def get_monthly_revenue(self, property_id: uuid.UUID) -> Decimal:
        """Sum of paid amounts for invoices this month (Data Scoping)."""
        from datetime import datetime

        from app.modules.billing.models import InvoiceStatus

        now = datetime.now(UTC)
        stmt = (
            select(
                func.coalesce(func.sum(Invoice.paid_amount), Decimal("0"))
            )
            .where(
                Invoice.property_id == property_id,
                Invoice.status.in_([InvoiceStatus.PAID, InvoiceStatus.ISSUED, InvoiceStatus.OVERDUE]),
                Invoice.billing_year == now.year,
                Invoice.billing_month == now.month,
            )
        )
        result = await self.db.execute(stmt)
        return Decimal(str(result.scalar() or 0))

    async def get_overdue_summary(self, property_id: uuid.UUID) -> tuple[int, Decimal]:
        """Count and total amount of overdue invoices (Data Scoping).

        Returns
        -------
        tuple[int, Decimal]
            (overdue_count, overdue_total_amount)
        """
        from datetime import datetime

        from app.modules.billing.models import InvoiceStatus

        now = datetime.now(UTC)
        stmt = (
            select(
                func.count(Invoice.id),
                func.coalesce(func.sum(Invoice.total_amount - Invoice.paid_amount), Decimal("0")),
            )
            .where(
                Invoice.property_id == property_id,
                Invoice.status.in_([InvoiceStatus.ISSUED, InvoiceStatus.OVERDUE]),
                Invoice.due_date < now.date(),
            )
        )
        result = await self.db.execute(stmt)
        row = result.one()
        return row[0] or 0, Decimal(str(row[1] or 0))

    async def get_pending_maintenance_count(self, property_id: uuid.UUID) -> int:
        """Count pending/in-progress maintenance requests."""
        stmt = (
            select(func.count(MaintenanceRequest.id))
            .where(
                MaintenanceRequest.property_id == property_id,
                MaintenanceRequest.status.in_(["pending", "in_progress"]),
            )
        )
        result = await self.db.execute(stmt)
        return result.scalar() or 0

    async def get_revenue_report(
        self, property_id: uuid.UUID, start_date: date, end_date: date
    ) -> list[dict]:
        """Revenue aggregation grouped by month (Data Scoping).

        Returns a list of dicts with keys: period, collected, outstanding.
        """
        from app.modules.billing.models import InvoiceStatus

        stmt = (
            select(
                func.concat(
                    func.cast(Invoice.billing_year, String),
                    "-",
                    func.lpad(func.cast(Invoice.billing_month, String), 2, "0"),
                ).label("period"),
                func.sum(
                    case(
                        (Invoice.status == "paid", Invoice.paid_amount),
                        else_=Decimal("0"),
                    )
                ).label("collected"),
                func.sum(
                    case(
                        (
                            Invoice.status.in_([InvoiceStatus.ISSUED, InvoiceStatus.PARTIAL, InvoiceStatus.OVERDUE]),
                            Invoice.total_amount - Invoice.paid_amount,
                        ),
                        else_=Decimal("0"),
                    )
                ).label("outstanding"),
                func.coalesce(func.sum(Invoice.total_amount), Decimal("0")).label("total_billed"),
            )
            .where(
                Invoice.property_id == property_id,
                # Date range via billing year/month, compared as a single
                # comparable "period key" (year * 12 + month) so the bound
                # is correct across year boundaries and doesn't require a
                # Python-level conditional inside the SQL where-clause.
                (Invoice.billing_year * 12 + Invoice.billing_month) >= (start_date.year * 12 + start_date.month),
                (Invoice.billing_year * 12 + Invoice.billing_month) <= (end_date.year * 12 + end_date.month),
            )
            .group_by("period")
            .order_by("period")
        )
        result = await self.db.execute(stmt)
        rows = await result.all()
        return [
            {
                "period": row.period,
                "collected": Decimal(str(row.collected or 0)),
                "outstanding": Decimal(str(row.outstanding or 0)),
                "total_billed": Decimal(str(row.total_billed or 0)),
            }
            for row in rows
        ]
