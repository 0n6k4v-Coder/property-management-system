"""Tenant HTTP routes (SDD §2.4, §3.3).

References:
- SDD.md §2.4: Tenant Module Specification (FR-TENANT-01, FR-TENANT-04)
- SDD.md §3.3: Complete API Contract — /tenants endpoints
- CODE_STYLE.md §4.1: Router structure, dependency injection
"""

import uuid as _uuid_module
from http import HTTPStatus
from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.tenant.schemas import (
    CreateTenantRequest,
    TenantCreateResponse,
    TenantResponse,
)
from app.modules.tenant.services.tenant_service import TenantService
from app.shared.deps import get_db, get_current_user

router = APIRouter(prefix="/api/v1", tags=["tenant"])


@router.post(
    "/tenants",
    response_model=TenantCreateResponse,
    status_code=HTTPStatus.CREATED,
    summary="Create a new tenant (FR-TENANT-01, FR-TENANT-02)",
)
async def create_tenant(
    payload: CreateTenantRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> TenantCreateResponse:
    """Register a new tenant with encrypted ID card.

    The ID card number is encrypted with Fernet before storage
    and is **never** returned in the response.
    Audit log is recorded automatically.
    """
    service = TenantService(db)
    user_id: str = current_user["user_id"]

    tenant = await service.create_tenant(
        property_id=payload.property_id,
        full_name=payload.full_name,
        id_card_number=payload.id_card_number,
        phone=payload.phone,
        email=payload.email,
        emergency_contact_name=payload.emergency_contact_name,
        emergency_contact_phone=payload.emergency_contact_phone,
        created_by=_uuid_module.UUID(user_id),
    )

    return TenantCreateResponse(
        data=TenantResponse.model_validate(tenant),
    )


@router.get(
    "/tenants/search",
    status_code=HTTPStatus.OK,
    summary="Search tenants (FR-TENANT-04)",
)
async def search_tenants(
    property_id: str = Query(..., description="Scoping property UUID"),
    query: str = Query(..., min_length=3, description="Search query (min 3 chars)"),
    search_by: str = Query("name", description="Field to search: name, phone, or email"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Search for tenants by name, phone, or email within a property.

    Response follows SDD §3.1 pagination format:
    ``{"data": [...], "meta": {"page", "limit", "total", "has_next"}}``
    """
    service = TenantService(db)
    result = await service.search_tenants(
        property_id=_uuid_module.UUID(property_id),
        query=query,
        search_by=search_by,
        page=page,
        limit=limit,
    )

    # Decorate data with TenantResponse serialization
    result["data"] = [TenantResponse.model_validate(t) for t in result["data"]]
    return result
