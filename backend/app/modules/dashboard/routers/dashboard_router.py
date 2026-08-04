"""Dashboard REST API endpoints — 3 routes (SDD §2.6, §3.3).

Data Scoping: All endpoints filter by the authenticated user's context.
Fixes API anti-patterns #5, #7, #13, #20, #11:
  - #5: require_property_scope on all 3 endpoints
  - #7: date params typed as date | None (Pydantic validates)
  - #13: max 24-month span validation in service
  - #20: Cache-Control: private, no-store on all 3 GETs
  - #11: OccupancyResponse is now a typed schema (not bare dict)

References:
    - SDD.md §3.3: Dashboard endpoint specifications
"""

import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.dashboard.schemas import (
    DashboardSummaryWrapper,
    OccupancyWrapper,
    RevenueReportResponse,
)
from app.modules.dashboard.services.dashboard_service import DashboardService
from app.shared.database import get_db
from app.shared.deps import (
    CurrentUser,
    get_current_user,
    require_property_scope,
)

router = APIRouter(tags=["dashboard"], redirect_slashes=False)

# Module-level constants for FastAPI dependencies (fixes B008 mutable default)
GET_DB = Depends(get_db)

PROPERTY_QUERY = Query(..., description="Property to query")
START_DATE_QUERY = Query(None, description="Start date (YYYY-MM-DD)")
END_DATE_QUERY = Query(None, description="End date (YYYY-MM-DD)")


@router.get(
    "/summary",
    response_model=DashboardSummaryWrapper,
    summary="Get dashboard summary",
    description="Returns occupancy, revenue, overdue, and maintenance counts for a property.",
)
async def get_dashboard_summary(
    _current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, GET_DB],
    _: Annotated[None, require_property_scope(query_param="property_id")],
    response: Response,
    property_id: uuid.UUID = PROPERTY_QUERY,
) -> DashboardSummaryWrapper:
    """GET /api/v1/dashboard/summary — fixes #5, #20."""
    # Fixes #20: financial-adjacent data must never be cached/shared.
    response.headers["Cache-Control"] = "private, no-store"

    service = DashboardService(db)
    summary = await service.get_summary(property_id)
    return DashboardSummaryWrapper(data=summary, meta=None)


@router.get(
    "/revenue",
    response_model=RevenueReportResponse,
    summary="Get revenue report",
    description="Monthly revenue aggregation for a date range.",
)
async def get_revenue_report(
    _current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, GET_DB],
    _: Annotated[None, require_property_scope(query_param="property_id")],
    response: Response,
    property_id: uuid.UUID = PROPERTY_QUERY,
    start_date: date | None = START_DATE_QUERY,
    end_date: date | None = END_DATE_QUERY,
) -> RevenueReportResponse:
    """GET /api/v1/dashboard/revenue — fixes #5, #7, #13, #20."""
    # Fixes #20.
    response.headers["Cache-Control"] = "private, no-store"

    service = DashboardService(db)
    # Pydantic validates date format (fixes #7); service validates cross-field (fixes #13).
    metrics = await service.get_revenue_report(property_id, start_date, end_date)
    from app.modules.dashboard.schemas import RevenueMetric

    return RevenueReportResponse(
        data=[RevenueMetric(**m) for m in metrics],
        meta=None,
    )


@router.get(
    "/occupancy",
    response_model=OccupancyWrapper,
    summary="Get occupancy snapshot",
    description="Returns current occupancy rate and room counts.",
)
async def get_occupancy(
    _current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, GET_DB],
    _: Annotated[None, require_property_scope(query_param="property_id")],
    response: Response,
    property_id: uuid.UUID = PROPERTY_QUERY,
) -> OccupancyWrapper:
    """GET /api/v1/dashboard/occupancy — fixes #5, #11, #20."""
    # Fixes #20.
    response.headers["Cache-Control"] = "private, no-store"

    service = DashboardService(db)
    occupancy = await service.get_occupancy(property_id)
    return OccupancyWrapper(data=occupancy, meta=None)
