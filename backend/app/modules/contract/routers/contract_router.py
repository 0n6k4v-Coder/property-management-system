"""Contract & Lease REST API endpoints — 6 routes (SDD §2.5, §3.3).

References:
    - SDD.md §3.3: Critical Endpoint Specifications
    - SDD.md §5.2: Contract Termination → Room Status Update
    - CODE_STYLE.md §3.4: Router layer responsibility
"""

import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

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
from app.shared.deps import get_current_user, get_db

router = APIRouter(tags=["contracts"], redirect_slashes=False)


@router.post(
    "/",
    response_model=ContractCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new rental contract",
    description="Creates an active contract for a room+tenant.  Enforces BR-01 (one active per room) and BR-02 (min deposit).",
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
    current_user: Annotated[dict, Depends(get_current_user)],
) -> dict:
    """POST /api/v1/contracts/ — SDD §3.3."""
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
    return {"data": ContractResponse.model_validate(contract), "meta": None}


@router.get(
    "/active",
    response_model=ContractListResponse,
    summary="List active contracts",
    description="Returns all active contracts, optionally filtered by property_id.",
)
async def list_active_contracts(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    property_id: uuid.UUID | None = Query(None, description="Filter by property"),
) -> dict:
    """GET /api/v1/contracts/active — SDD §3.3."""
    service = ContractService(db)
    contracts = await service.get_active_contracts(property_id)
    return {
        "data": [ContractResponse.model_validate(c) for c in contracts],
        "meta": None,
    }


@router.get(
    "/{contract_id}",
    response_model=ContractCreateResponse,
    summary="Get a contract by ID",
    description="Returns full contract details including termination and extensions.",
)
async def get_contract(
    contract_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
) -> dict:
    """GET /api/v1/contracts/{id} — SDD §3.3."""
    service = ContractService(db)
    contract = await service.get_contract(contract_id)
    return {"data": ContractResponse.model_validate(contract), "meta": None}


@router.patch(
    "/{contract_id}/terminate",
    response_model=ContractCreateResponse,
    summary="Terminate an active contract",
    description="Terminates an active contract (BR-04).  Requires reason.  Sets room to available.",
)
async def terminate_contract(
    contract_id: uuid.UUID,
    body: TerminateContractRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
) -> dict:
    """PATCH /api/v1/contracts/{id}/terminate — SDD §3.3."""
    service = ContractService(db)
    contract = await service.terminate_contract(
        contract_id=contract_id,
        reason=str(body.reason),
        terminated_by=uuid.UUID(current_user["user_id"]),
        termination_date=body.termination_date or date.today(),
        notes=body.notes,
    )
    return {"data": ContractResponse.model_validate(contract), "meta": None}


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
    current_user: Annotated[dict, Depends(get_current_user)],
) -> dict:
    """POST /api/v1/contracts/{id}/extend — SDD §3.3."""
    service = ContractService(db)
    contract = await service.extend_lease(
        contract_id=contract_id,
        new_end_date=body.new_end_date,
        extended_by=uuid.UUID(current_user["user_id"]),
        reason=body.reason,
    )
    return {"data": ContractResponse.model_validate(contract), "meta": None}


@router.post(
    "/{contract_id}/renew",
    response_model=ContractCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Renew a terminated/expired contract",
    description="Creates a new contract from a terminated/expired original.  Same room/tenant, updated terms.",
)
async def renew_contract(
    contract_id: uuid.UUID,
    body: RenewContractRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
) -> dict:
    """POST /api/v1/contracts/{id}/renew — SDD §3.3."""
    service = ContractService(db)
    contract = await service.renew_contract(
        original_contract_id=contract_id,
        new_start_date=body.new_start_date,
        new_end_date=body.new_end_date,
        new_monthly_rent=body.new_monthly_rent,
        new_deposit_amount=body.new_deposit_amount,
        renewed_by=uuid.UUID(current_user["user_id"]),
    )
    return {"data": ContractResponse.model_validate(contract), "meta": None}


@router.get(
    "/leases/{room_id}/history",
    response_model=LeaseHistoryResponse,
    summary="Get lease history for a room",
    description="Returns all contracts (past and present) for a given room, newest first.",
)
@router.get(
    "/leases/{room_id}/history",
    response_model=LeaseHistoryResponse,
    include_in_schema=False,
)
async def get_lease_history(
    room_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
) -> dict:
    """GET /api/v1/leases/{room_id}/history — SDD §3.3."""
    service = ContractService(db)
    contracts = await service.get_lease_history(room_id)
    return {
        "data": [ContractResponse.model_validate(c) for c in contracts],
        "meta": None,
    }