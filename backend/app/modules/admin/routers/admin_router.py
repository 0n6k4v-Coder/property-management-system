"""Admin REST API endpoints — 3 routes (SDD §2.7, §3.3).

Protected by ``@require_role("owner")`` decorator (RBAC).
"""

import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.middleware.rbac import require_role
from app.modules.admin.schemas import (
    AuditLogListResponse,
    AuditLogResponse,
    SystemConfigListResponse,
)
from app.modules.admin.services.admin_service import AdminService
from app.shared.deps import GET_DB, get_current_user

router = APIRouter(tags=["admin"], redirect_slashes=False)

QUERY_PROPERTY_ID = Query(None, description="Filter by property (omit for all properties)")
QUERY_ACTION = Query(None, description="Filter by action type")
QUERY_PAGE = Query(1, ge=1, description="Page number")
QUERY_LIMIT = Query(20, ge=1, le=100, description="Items per page (1-100)")


@router.get(
    "/audit-logs",
    response_model=AuditLogListResponse,
    summary="Get paginated audit logs",
)
@require_role("owner")
async def get_audit_logs(
    response: Response,
    _current_user: Annotated[dict[str, Any], Depends(get_current_user)],
    db: AsyncSession = GET_DB,
    property_id: uuid.UUID | None = QUERY_PROPERTY_ID,
    action: str | None = QUERY_ACTION,
    page: int = QUERY_PAGE,
    limit: int = QUERY_LIMIT,
) -> AuditLogListResponse:
    """GET /api/v1/admin/audit-logs.

    Returns paginated audit logs with optional property/action filters.
    """
    service = AdminService(db)
    logs, total = await service.get_audit_logs(
        property_id=property_id,
        action=action,
        page=page,
        limit=limit,
    )
    response.headers["Cache-Control"] = "private, no-store"
    return AuditLogListResponse(
        data=[AuditLogResponse.model_validate(log) for log in logs],
        meta={"page": page, "limit": limit, "total": total, "has_next": page * limit < total},
    )


@router.get(
    "/system-config",
    response_model=SystemConfigListResponse,
    summary="Get system configuration",
)
@require_role("owner")
async def get_system_config(
    response: Response,
    _current_user: Annotated[dict[str, Any], Depends(get_current_user)],
    db: AsyncSession = GET_DB,
) -> SystemConfigListResponse:
    """GET /api/v1/admin/system-config.

    Returns system configuration (secrets masked).
    """
    service = AdminService(db)
    configs = await service.get_system_config()
    response.headers["Cache-Control"] = "private, no-store"
    return SystemConfigListResponse(data=configs, meta=None)
