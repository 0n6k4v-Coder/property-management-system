"""Pydantic v2 schemas for Dashboard module (SDD §2.6, §3.1).

References:
    - SDD.md §2.6: Dashboard Module Specification (FR-DASH-01~04)
    - SDD.md §3.1: API Conventions
"""

import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class DashboardSummaryResponse(BaseModel):
    """Response for GET /api/v1/dashboard/summary."""

    model_config = ConfigDict(from_attributes=True)

    property_id: uuid.UUID
    total_rooms: int
    occupied_rooms: int
    occupancy_rate: float  # percentage (0-100)
    monthly_revenue: Decimal
    overdue_count: int
    overdue_amount: Decimal
    pending_maintenance: int
    active_contracts: int


class RevenueMetric(BaseModel):
    """Single revenue data point for a period."""

    period: str  # e.g. "2026-05"
    collected: Decimal
    outstanding: Decimal
    total_billed: Decimal


class RevenueReportResponse(BaseModel):
    """Response for GET /api/v1/dashboard/revenue."""

    data: list[RevenueMetric]
    meta: dict | None = None


class OccupancyResponse(BaseModel):
    """Response for GET /api/v1/dashboard/occupancy."""

    data: dict
    meta: None = None


class DashboardSummaryWrapper(BaseModel):
    """Wrapper for the summary endpoint."""

    data: DashboardSummaryResponse
    meta: None = None