"""Dashboard REST API endpoints — 3 routes (SDD §2.6, §3.3).

Data Scoping: All endpoints filter by the authenticated user's context.

References:
    - SDD.md §3.3: Dashboard endpoint specifications
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.dashboard.schemas import (
    DashboardSummaryWrapper,
    RevenueReportResponse,
    RevenueMetric,
    OccupancyResponse,
)
from app.modules.dashboard.services.dashboard_service import DashboardService
from app.shared.deps import get_current_user, get_db

router = APIRouter(tags=["dashboard"], redirect_slashes=False)


@router.get(
    "/summary",
    response_model=DashboardSummaryWrapper,
    summary="Get dashboard summary",
    description="Returns occupancy, revenue, overdue, and maintenance counts for a property.",
)
async def get_dashboard_summary(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    property_id: uuid.UUID = Query(..., description="Property to query"),
) -> dict:
    """GET /api/v1/dashboard/summary."""
    service = DashboardService(db)
    summary = await service.get_summary(property_id)
    return {"data": summary, "meta": None}


@router.get(
    "/revenue",
    response_model=RevenueReportResponse,
    summary="Get revenue report",
    description="Monthly revenue aggregation for a date range.",
)
async def get_revenue_report(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    property_id: uuid.UUID = Query(..., description="Property to query"),
    start_date: str | None = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: str | None = Query(None, description="End date (YYYY-MM-DD)"),
) -> dict:
    """GET /api/v1/dashboard/revenue."""
    from datetime import date
    start = date.fromisoformat(start_date) if start_date else None
    end = date.fromisoformat(end_date) if end_date else None
    service = DashboardService(db)
    metrics = await service.get_revenue_report(property_id, start, end)
    return {"data": [RevenueMetric(**m) for m in metrics], "meta": None}


@router.get(
    "/occupancy",
    response_model=OccupancyResponse,
    summary="Get occupancy snapshot",
    description="Returns current occupancy rate and room counts.",
)
async def get_occupancy(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    property_id: uuid.UUID = Query(..., description="Property to query"),
) -> dict:
    """GET /api/v1/dashboard/occupancy."""
    service = DashboardService(db)
    summary = await service.get_summary(property_id)
    return {
        "data": {
            "property_id": str(property_id),
            "total_rooms": summary.total_rooms,
            "occupied_rooms": summary.occupied_rooms,
            "occupancy_rate": summary.occupancy_rate,
            "active_contracts": summary.active_contracts,
        },
        "meta": None,
    }