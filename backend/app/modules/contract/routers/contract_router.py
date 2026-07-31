"""Contract & Lease REST API endpoints — 7 routes (SDD §2.5, §3.3).

References:
    - SDD.md §3.3: Critical Endpoint Specifications
    - SDD.md §5.2: Contract Termination → Room Status Update
    - CODE_STYLE.md §3.4: Router layer responsibility

Implements the Target Design from docs/API.md fixing anti-patterns #5, #13, #1, #20:
- #5  authorization: all 7 endpoints require auth + property scope
- #13 pagination: GET /active and GET /leases/{room_id}/history get page/limit + meta
- #1  idempotency: optional Idempotency-Key header on the 3 POST endpoints
- #20 Cache-Control: private, no-store on the 3 GET endpoints
"""

import uuid
from datetime import date
from typing import Annotated, Any

from fastapi import APIRouter, Body, Depends, Header, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.constants import AUTH_005
from app.modules.contract.repository import ContractRepository
from app.modules.contract.schemas import (
    ContractCreateResponse,
    ContractListResponse,
    ContractResponse,
    CreateContractRequest,
    ExtendLeaseRequest,
    LeaseHistoryResponse,
    RenewContractRequest,
    TerminateContractRequest,
)
from app.modules.contract.services.contract_service import ContractService
from app.shared.database import get_db
from app.shared.deps import (
    CurrentUser,
    GET_CURRENT_USER,
    get_current_user,
    require_property_scope,
    user_has_property_scope,
)
from app.shared.exceptions import APIError
from app.shared.idempotency import check_idempotency, store_idempotency

router = APIRouter(tags=["contracts"], redirect_slashes=False)


async def _check_scope(
    current_user: dict[str, Any],
    db: AsyncSession,
    property_id: uuid.UUID | None,
) -> None:
    """Resolve-then-check authorization helper.

    Raises ``AUTH-005`` (403) unless the caller is a global owner/admin or
    holds a scope row for ``property_id``. A ``None`` ``property_id`` (entity
    not found) is treated as "no scope" so the caller cannot read/guess
    non-existent resources across properties.
    """
    if property_id is None:
        raise APIError(
            code="AUTH-005",
            message=AUTH_005,
            status_code=status.HTTP_403_FORBIDDEN,
        )
    if not await user_has_property_scope(current_user, db, property_id):
        raise APIError(
            code="AUTH-005",
            message=AUTH_005,
            status_code=status.HTTP_403_FORBIDDEN,
        )


# ── POST /contracts/ ──────────────────────────────────────────────────

@router.post(
    "/",
    response_model=ContractCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new rental contract",
    description="Creates an active contract for a room+tenant. Enforces BR-01 (one active per room) and BR-02 (min deposit).",
)
@router.post(
    "",
    response_model=ContractCreateResponse,
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False,
)
async def create_contract(
    body: CreateContractRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, GET_CURRENT_USER],
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> ContractCreateResponse:
    """POST /api/v1/contracts/ — SDD §3.3.

    Authorization (fixes #5): ``property_id`` is in the body, so
    ``require_property_scope()`` (body-sourced form) enforces it directly.
    Idempotency (fixes #1): an optional ``Idempotency-Key`` header replays a
    prior 201 within the 24h dedupe window; reusing a key with a different
    body raises ``409 VAL-409``.
    """
    # Additional explicit scope check (the dependency checks body.property_id)
    await _check_scope(current_user, db, body.property_id)

    if idempotency_key:
        cached = await check_idempotency(
            db,
            idempotency_key,
            "POST:/api/v1/contracts/",
            body.model_dump(mode="json"),
        )
        if cached is not None:
            return ContractCreateResponse.model_validate(cached)

    service = ContractService(db)
    contract = await service.create_contract(
        room_id=body.room_id,
        tenant_id=body.tenant_id,
        property_id=body.property_id,
        start_date=body.start_date,
        end_date=body.end_date,
        monthly_rent=body.monthly_rent,
        deposit_amount=body.deposit_amount,
        created_by=uuid.UUID(current_user["user_id"]),
        special_conditions=body.special_conditions,
    )
    response = ContractCreateResponse(
        data=ContractResponse.model_validate(contract)
    )

    if idempotency_key:
        await store_idempotency(
            db,
            idempotency_key,
            "POST:/api/v1/contracts/",
            body.model_dump(mode="json"),
            response.model_dump(mode="json"),
            ContractRepository,
        )
    return response


# ── GET /contracts/active ──────────────────────────────────────────────

@router.get(
    "/active",
    response_model=ContractListResponse,
    summary="List active contracts",
    description="Returns all active contracts, optionally filtered by property_id, with pagination.",
)
async def list_active_contracts(
    response: Response,
    current_user: Annotated[CurrentUser, GET_CURRENT_USER],
    db: Annotated[AsyncSession, Depends(get_db)],
    property_id: uuid.UUID | None = None,
    page: int = 1,
    limit: int = 20,
) -> ContractListResponse:
    """GET /api/v1/contracts/active — SDD §3.3.

    Authorization (#5): if ``property_id`` is supplied, it is scope-checked
    directly; if omitted, results are filtered to only the properties the
    caller holds a scope for (global owner/admin see everything). Never
    returns the unfiltered global contract list to a non-owner/admin caller.
    Pagination (#13): ``page``/``limit`` query params; response ``meta``
    gains ``{"page", "limit", "total", "has_next"}``.
    Caching (#20): ``Cache-Control: private, no-store`` (financial data).
    """
    # Fixes #20: financial-adjacent list must never be cached/shared.
    response.headers["Cache-Control"] = "private, no-store"

    service = ContractService(db)
    if property_id is not None:
        # Direct field: check the supplied property's scope directly.
        await _check_scope(current_user, db, property_id)
        allowed_property_ids: list[uuid.UUID] | None = [property_id]
    else:
        allowed_property_ids = await service.get_current_user_property_ids(current_user)

    contracts, total = await service.get_active_contracts_paginated(
        property_ids=allowed_property_ids,
        page=page,
        limit=limit,
    )
    return ContractListResponse(
        data=[ContractResponse.model_validate(c) for c in contracts],
        meta={
            "page": page,
            "limit": limit,
            "total": total,
            "has_next": page * limit < total,
        },
    )


# ── GET /contracts/{contract_id} ───────────────────────────────────────

@router.get(
    "/{contract_id}",
    response_model=ContractCreateResponse,
    summary="Get a contract by ID",
    description="Returns full contract details including termination and extensions.",
)
async def get_contract(
    response: Response,
    contract_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, GET_CURRENT_USER],
) -> ContractCreateResponse:
    """GET /api/v1/contracts/{id} — SDD §3.3.

    Authorization (#5): the contract's ``property_id`` is resolved and checked
    via ``user_has_property_scope`` (resolve-then-check pattern).
    Caching (#20): ``Cache-Control: private, no-store``.
    """
    # Fixes #20: contract detail must never be cached/shared.
    response.headers["Cache-Control"] = "private, no-store"

    repo = ContractRepository(db)
    prop_id: uuid.UUID | None = await repo.get_contract_property_id(contract_id)
    await _check_scope(current_user, db, prop_id)

    service = ContractService(db)
    contract = await service.get_contract(contract_id)
    return ContractCreateResponse(
        data=ContractResponse.model_validate(contract)
    )


# ── PATCH /contracts/{contract_id}/terminate ───────────────────────────

@router.patch(
    "/{contract_id}/terminate",
    response_model=ContractCreateResponse,
    summary="Terminate an active contract",
    description="Terminates an active contract (BR-04). Requires reason. Sets room to available.",
)
async def terminate_contract(
    contract_id: uuid.UUID,
    body: TerminateContractRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, GET_CURRENT_USER],
) -> ContractCreateResponse:
    """PATCH /api/v1/contracts/{id}/terminate — SDD §3.3.

    Authorization (#5): the contract's ``property_id`` is resolved and checked
    via ``user_has_property_scope`` (resolve-then-check pattern).
    """
    repo = ContractRepository(db)
    prop_id: uuid.UUID | None = await repo.get_contract_property_id(contract_id)
    await _check_scope(current_user, db, prop_id)

    service = ContractService(db)
    contract = await service.terminate_contract(
        contract_id=contract_id,
        reason=str(body.reason),
        terminated_by=uuid.UUID(current_user["user_id"]),
        termination_date=body.termination_date or date.today(),
        notes=body.notes,
    )
    return ContractCreateResponse(
        data=ContractResponse.model_validate(contract)
    )


# ── POST /contracts/{contract_id}/extend ───────────────────────────────

@router.post(
    "/{contract_id}/extend",
    response_model=ContractCreateResponse,
    summary="Extend a contract's lease",
    description="Extends the end date of an active contract and records the extension.",
)
async def extend_lease(
    contract_id: uuid.UUID,
    body: ExtendLeaseRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, GET_CURRENT_USER],
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> ContractCreateResponse:
    """POST /api/v1/contracts/{id}/extend — SDD §3.3.

    Authorization (#5): the contract's ``property_id`` is resolved and checked
    via ``user_has_property_scope`` (resolve-then-check pattern).
    Idempotency (#1): optional ``Idempotency-Key`` header (24h dedupe).
    """
    repo = ContractRepository(db)
    prop_id: uuid.UUID | None = await repo.get_contract_property_id(contract_id)
    await _check_scope(current_user, db, prop_id)

    if idempotency_key:
        cached = await check_idempotency(
            db,
            idempotency_key,
            f"POST:/api/v1/contracts/{contract_id}/extend",
            body.model_dump(mode="json"),
        )
        if cached is not None:
            return ContractCreateResponse.model_validate(cached)

    service = ContractService(db)
    contract = await service.extend_lease(
        contract_id=contract_id,
        new_end_date=body.new_end_date,
        extended_by=uuid.UUID(current_user["user_id"]),
        reason=body.reason,
    )
    response = ContractCreateResponse(
        data=ContractResponse.model_validate(contract)
    )

    if idempotency_key:
        await store_idempotency(
            db,
            idempotency_key,
            f"POST:/api/v1/contracts/{contract_id}/extend",
            body.model_dump(mode="json"),
            response.model_dump(mode="json"),
            ContractRepository,
        )
    return response


# ── POST /contracts/{contract_id}/renew ────────────────────────────────

@router.post(
    "/{contract_id}/renew",
    response_model=ContractCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Renew a terminated/expired contract",
    description="Creates a new contract from a terminated/expired original. Same room/tenant, updated terms.",
)
async def renew_contract(
    contract_id: uuid.UUID,
    body: RenewContractRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, GET_CURRENT_USER],
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> ContractCreateResponse:
    """POST /api/v1/contracts/{id}/renew — SDD §3.3.

    Authorization (#5): the **original** contract's ``property_id`` is resolved
    and checked via ``user_has_property_scope`` (resolve-then-check pattern).
    Idempotency (#1): optional ``Idempotency-Key`` header (24h dedupe).
    """
    repo = ContractRepository(db)
    prop_id: uuid.UUID | None = await repo.get_contract_property_id(contract_id)
    await _check_scope(current_user, db, prop_id)

    if idempotency_key:
        cached = await check_idempotency(
            db,
            idempotency_key,
            f"POST:/api/v1/contracts/{contract_id}/renew",
            body.model_dump(mode="json"),
        )
        if cached is not None:
            return ContractCreateResponse.model_validate(cached)

    service = ContractService(db)
    contract = await service.renew_contract(
        original_contract_id=contract_id,
        new_start_date=body.new_start_date,
        new_end_date=body.new_end_date,
        new_monthly_rent=body.new_monthly_rent,
        new_deposit_amount=body.new_deposit_amount,
        renewed_by=uuid.UUID(current_user["user_id"]),
    )
    response = ContractCreateResponse(
        data=ContractResponse.model_validate(contract)
    )

    if idempotency_key:
        await store_idempotency(
            db,
            idempotency_key,
            f"POST:/api/v1/contracts/{contract_id}/renew",
            body.model_dump(mode="json"),
            response.model_dump(mode="json"),
            ContractRepository,
        )
    return response


# ── GET /contracts/leases/{room_id}/history ────────────────────────────

@router.get(
    "/leases/{room_id}/history",
    response_model=LeaseHistoryResponse,
    summary="Get lease history for a room",
    description="Returns all contracts (past and present) for a given room, newest first, with pagination.",
)
async def get_lease_history(
    response: Response,
    room_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[CurrentUser, GET_CURRENT_USER],
    page: int = 1,
    limit: int = 20,
) -> LeaseHistoryResponse:
    """GET /api/v1/contracts/leases/{room_id}/history — SDD §3.3.

    Authorization (#5): the room's ``property_id`` is resolved and checked
    via ``user_has_property_scope`` (resolve-then-check pattern).
    Pagination (#13): ``page``/``limit`` query params; response ``meta``
    gains ``{"page", "limit", "total", "has_next"}``.
    Caching (#20): ``Cache-Control: private, no-store`` (financial data).
    """
    # Fixes #20: financial-adjacent history must never be cached/shared.
    response.headers["Cache-Control"] = "private, no-store"

    repo = ContractRepository(db)
    prop_id: uuid.UUID | None = await repo.get_room_property_id(room_id)
    await _check_scope(current_user, db, prop_id)

    service = ContractService(db)
    contracts, total = await service.get_lease_history_paginated(
        room_id=room_id,
        page=page,
        limit=limit,
    )

    from app.modules.contract.schemas import LeaseHistoryItem
    return LeaseHistoryResponse(
        data=[LeaseHistoryItem.model_validate(c) for c in contracts],
        meta={
            "page": page,
            "limit": limit,
            "total": total,
            "has_next": page * limit < total,
        },
    )
