"""Tenant HTTP routes (SDD §2.4, §3.3).

Implements the "Proposed Redesign — Tenant Module" target design from
``docs/API.md`` fixing API anti-patterns #5, #1, #7, #20:

- #5  authorization via ``require_property_scope`` — enforced on both
      ``POST /`` (body-sourced ``property_id``) and ``GET /search``
      (query-sourced ``property_id``); raises ``403 AUTH-005`` otherwise.
- #1  optional ``Idempotency-Key`` header on ``POST /`` (24h dedupe).
- #7  ``search_by`` constrained to ``Literal["name","phone","email"]`` so
      FastAPI rejects any other value with a clean 422.
- #20 ``Cache-Control: private, no-store`` on ``GET /search`` (returns PII).

References:
- SDD.md §2.4: Tenant Module Specification (FR-TENANT-01, FR-TENANT-04)
- SDD.md §3.3: Complete API Contract — /tenants endpoints
- CODE_STYLE.md §4.1: Router structure, dependency injection
- docs/API.md "Proposed Redesign — Tenant Module"
"""

import uuid as _uuid_module
from http import HTTPStatus
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, Header, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.tenant.schemas import (
    CreateTenantRequest,
    TenantCreateResponse,
    TenantResponse,
)
from app.modules.tenant.services.tenant_service import TenantService
from app.shared.deps import (
    get_current_user,
    get_db,
    require_property_scope,
)
from app.shared.idempotency import check_idempotency, store_idempotency

router = APIRouter(tags=["tenant"], redirect_slashes=False)


@router.post(
    "/",
    response_model=TenantCreateResponse,
    status_code=HTTPStatus.CREATED,
    summary="Create a new tenant (FR-TENANT-01, FR-TENANT-02)",
)
async def create_tenant(
    payload: CreateTenantRequest,
    _: Annotated[None, require_property_scope()],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> TenantCreateResponse:
    """Register a new tenant with encrypted ID card.

    The ID card number is encrypted with Fernet before storage
    and is **never** returned in the response.
    Audit log is recorded automatically.

    Authorization (fixes #5): requires a ``user_property_scopes`` row for
    the body's ``property_id`` (or global owner/admin), else ``403 AUTH-005``.
    Idempotency (fixes #1): an optional ``Idempotency-Key`` header replays a
    prior 201 response within the 24h dedupe window. Reusing a key with a
    different body raises ``409 VAL-409``.
    """
    from app.modules.auth.repository import UserRepository

    service = TenantService(db)
    user_id: str = current_user["user_id"]

    if idempotency_key:
        cached = await check_idempotency(
            db,
            idempotency_key,
            "POST:/api/v1/tenants/",
            payload.model_dump(mode="json"),
        )
        if cached is not None:
            return TenantCreateResponse.model_validate(cached)

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

    response = TenantCreateResponse(
        data=TenantResponse.model_validate(tenant),
    )

    if idempotency_key:
        await store_idempotency(
            db,
            idempotency_key,
            "POST:/api/v1/tenants/",
            payload.model_dump(mode="json"),
            response.model_dump(mode="json"),
            UserRepository,
        )

    return response


@router.get(
    "/search",
    status_code=HTTPStatus.OK,
    summary="Search tenants (FR-TENANT-04)",
)
async def search_tenants(
    response: Response,
    _: Annotated[None, require_property_scope(query_param="property_id")],
    property_id: str = Query(..., description="Scoping property UUID"),
    query: str = Query(..., min_length=3, description="Search query (min 3 chars)"),
    search_by: Literal["name", "phone", "email"] = Query(
        "name", description="Field to search: name, phone, or email"
    ),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Search for tenants by name, phone, or email within a property.

    Response follows SDD §3.1 pagination format:
    ``{"data": [...], "meta": {"page", "limit", "total", "has_next"}}``

    Authorization (fixes #5): ``property_id`` is also a scope gate — callers
    without a scope row (or global owner/admin) get ``403 AUTH-005``.
    Validation (fixes #7): ``search_by`` is constrained to ``name``/``phone``/
    ``email`` — any other value yields a clean ``422``.
    Caching (fixes #20): the response carries ``Cache-Control: private,
    no-store`` because it returns tenant PII (name, phone, email).
    """
    # Fixes #20: tenant PII must never be cached by a shared cache nor
    # stored by the client beyond the immediate request.
    response.headers["Cache-Control"] = "private, no-store"

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
