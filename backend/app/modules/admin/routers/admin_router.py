"""Admin REST API endpoints — 3 routes (SDD §2.7, §3.3).

Protected by ``@require_role("owner")`` decorator (RBAC).
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.admin.schemas import (
    AuditLogListResponse,
    SystemConfigListResponse,
    SystemConfigResponse,
    UpdateSystemConfigRequest,
)
from app.modules.admin.services.admin_service import AdminService
from app.middleware.rbac import require_role
from app.shared.deps import get_current_user, get_db

router = APIRouter(tags=["admin"], redirect_slashes=False)


@router.get(
    "/audit-logs",
    response_model=AuditLogListResponse,
    summary="View audit logs (paginated)",
    description="Returns paginated audit logs for a property. Owner role required.",
)
@require_role("owner")
async def get_audit_logs(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    property_id: uuid.UUID = Query(..., description="Filter by property"),
    action: str | None = Query(None, description="Filter by action type"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(50, ge=1, le=200, description="Items per page"),
) -> dict:
    """GET /api/v1/admin/audit-logs."""
    service = AdminService(db)
    result = await service.get_audit_logs(
        property_id=property_id,
        action=action,
        page=page,
        limit=limit,
        requested_by=uuid.UUID(current_user["user_id"]),
    )
    return result


@router.get(
    "/config",
    response_model=SystemConfigListResponse,
    summary="View system configuration",
    description="Returns system settings with secrets masked. Owner role required.",
)
@require_role("owner")
async def get_system_config(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
) -> dict:
    """GET /api/v1/admin/config."""
    service = AdminService(db)
    config = await service.get_system_config(
        requested_by=uuid.UUID(current_user["user_id"]),
    )
    return {"data": config, "meta": None}