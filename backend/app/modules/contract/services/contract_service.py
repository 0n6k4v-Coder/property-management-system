"""Contract module business logic — create, terminate, extend, renew (SDD §2.5, §5.2).

Enforces Business Rules:
    - BR-01: One active contract per room (no two active contracts for same room)
    - BR-02: Deposit >= monthly_rent * property.min_deposit_months
    - BR-04: Termination requires reason + audit log

References:
    - SDD.md §2.5: Contract Module Specification
    - SDD.md §5.2: Contract Termination Sequence Diagram
    - SDD.md §6.2: Contract Status Machine
"""

import uuid
from datetime import date, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.contract.constants import (
    CONT_001_ROOM_HAS_ACTIVE_CONTRACT,
    CONT_002_DEPOSIT_TOO_LOW,
    CONT_003_DATE_OVERLAP,
    CONT_004_CONTRACT_NOT_ACTIVE,
    CONT_006_CONTRACT_NOT_FOUND,
    CONT_007_ROOM_NOT_FOUND,
    CONT_008_TENANT_NOT_FOUND,
    CONT_009_INVALID_TERMINATION_REASON,
    ERROR_MESSAGES,
    ContractStatus,
    EVENT_CONTRACT_CREATED,
    EVENT_CONTRACT_EXTENDED,
    EVENT_CONTRACT_RENEWED,
    EVENT_CONTRACT_TERMINATED,
)
from app.modules.contract.events import publish_contract_event
from app.modules.contract.models import Contract, ContractTermination, LeaseExtension
from app.modules.contract.repository import ContractRepository
from app.modules.property.models import Room
from app.modules.property.repository import RoomRepository
from app.modules.tenant.models import Tenant
from app.modules.tenant.repository import TenantRepository
from app.shared.audit import log_audit
from app.shared.exceptions import APIError


class ContractService:
    """Core business logic for the Contract module.

    Every public method performs validation, enforces business rules,
    and writes an audit log entry.  Cross-module communication uses
    repository calls (no direct ``from modules.X import ...``).
    """

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = ContractRepository(db)
        self.room_repo = RoomRepository(db)
        self.tenant_repo = TenantRepository(db)

    # ── Create Contract ──────────────────────────────────────────────────

    async def create_contract(
        self,
        room_id: uuid.UUID,
        tenant_id: uuid.UUID,
        property_id: uuid.UUID,
        start_date: date,
        end_date: date,
        monthly_rent: float,
        deposit_amount: float,
        created_by: uuid.UUID,
        special_conditions: str | None = None,
    ) -> Contract:
        """Create a new active contract enforced with BR-01, BR-02.

        Steps:
            1. Validate room exists and is available.
            2. Validate tenant exists.
            3. Enforce BR-01: no active contract for this room.
            4. Enforce BR-02: deposit >= monthly_rent * min_deposit_months.
            5. Create contract with status=active.
            6. Update room status to occupied.
            7. Log audit.
            8. Publish event.

        Parameters
        ----------
        room_id
            UUID of the room being rented.
        tenant_id
            UUID of the tenant.
        property_id
            UUID of the property.
        start_date
            Lease start date.
        end_date
            Lease end date (must be after start_date).
        monthly_rent
            Monthly rent amount as a float.
        deposit_amount
            Security deposit amount as a float.
        created_by
            UUID of the user creating the contract.
        special_conditions
            Optional free-text special conditions.

        Returns
        -------
        Contract
            The newly created Contract ORM instance.

        Raises
        ------
        APIError
            CONT-007: room not found.
            CONT-008: tenant not found.
            CONT-001: room already has active contract (BR-01).
            CONT-002: deposit too low (BR-02).
            CONT-003: date overlap with existing contract.
        """
        # -- Validate room exists and get property config --
        room = await self.room_repo.get_by_id(room_id)
        if room is None:
            raise APIError(
                code=CONT_007_ROOM_NOT_FOUND,
                message=ERROR_MESSAGES[CONT_007_ROOM_NOT_FOUND],
                status_code=404,
            )
        if room.property_id != property_id:
            raise APIError(
                code=CONT_007_ROOM_NOT_FOUND,
                message="Room does not belong to the specified property",
                status_code=400,
            )

        # -- Validate tenant exists --
        from sqlalchemy import select
        stmt = select(Tenant).where(Tenant.id == tenant_id)
        result = await self.db.execute(stmt)
        tenant = result.scalars().first()
        if tenant is None:
            raise APIError(
                code=CONT_008_TENANT_NOT_FOUND,
                message=ERROR_MESSAGES[CONT_008_TENANT_NOT_FOUND],
                status_code=404,
            )

        # -- BR-01: No active contract for this room --
        if await self.repo.has_active_contract(room_id):
            raise APIError(
                code=CONT_001_ROOM_HAS_ACTIVE_CONTRACT,
                message=ERROR_MESSAGES[CONT_001_ROOM_HAS_ACTIVE_CONTRACT],
                status_code=409,
            )

        # -- BR-02: Deposit >= monthly_rent * min_deposit_months --
        from app.modules.property.models import Property
        stmt = select(Property).where(Property.id == property_id)
        result = await self.db.execute(stmt)
        prop = result.scalars().first()
        if prop is not None:
            min_deposit = monthly_rent * prop.min_deposit_months
            if deposit_amount < min_deposit:
                raise APIError(
                    code=CONT_002_DEPOSIT_TOO_LOW,
                    message=(
                        f"Deposit must be at least {min_deposit:.2f} "
                        f"({prop.min_deposit_months} months of rent)"
                    ),
                    status_code=400,
                )

        # -- Date overlap check --
        overlap = await self.repo.has_date_overlap(room_id, start_date, end_date)
        if overlap:
            raise APIError(
                code=CONT_003_DATE_OVERLAP,
                message=ERROR_MESSAGES[CONT_003_DATE_OVERLAP],
                status_code=400,
            )

        # -- Create contract --
        contract = Contract(
            room_id=room_id,
            tenant_id=tenant_id,
            property_id=property_id,
            start_date=start_date,
            end_date=end_date,
            monthly_rent=monthly_rent,
            deposit_amount=deposit_amount,
            status=ContractStatus.ACTIVE,
            special_conditions=special_conditions,
            created_by=created_by,
        )
        contract = await self.repo.create(contract)

        # -- Update room status to occupied --
        from app.modules.property.constants import RoomStatus
        await self.room_repo.update_status(room_id, RoomStatus.OCCUPIED)

        # -- Audit log --
        await log_audit(
            db=self.db,
            user_id=created_by,
            action="contract.created",
            resource_type="contract",
            resource_id=contract.id,
            property_id=property_id,
            metadata={
                "room_id": str(room_id),
                "tenant_id": str(tenant_id),
                "monthly_rent": str(monthly_rent),
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
            },
        )

        # -- Publish event (fail-silent) --
        await publish_contract_event(
            EVENT_CONTRACT_CREATED,
            str(contract.id),
            {"room_id": str(room_id), "tenant_id": str(tenant_id)},
        )

        return contract

    # ── Terminate Contract ───────────────────────────────────────────────

    async def terminate_contract(
        self,
        contract_id: uuid.UUID,
        reason: str,
        terminated_by: uuid.UUID,
        termination_date: date | None = None,
        notes: str | None = None,
    ) -> Contract:
        """Terminate an active contract (BR-04).

        Steps:
            1. Validate contract exists and is active.
            2. Validate reason is non-empty.
            3. Create ContractTermination record.
            4. Update contract status to terminated.
            5. Update room status to available.
            6. Log audit.
            7. Publish event.

        Parameters
        ----------
        contract_id
            UUID of the contract to terminate.
        reason
            Termination reason (must be non-empty).
        terminated_by
            UUID of the user performing the termination.
        termination_date
            Effective termination date (defaults to today).
        notes
            Optional free-text notes about the termination.

        Returns
        -------
        Contract
            The updated Contract ORM instance.

        Raises
        ------
        APIError
            CONT-006: contract not found.
            CONT-004: contract not active.
            CONT-009: termination reason missing.
        """
        # -- Validate contract exists --
        contract = await self.repo.get_by_id(contract_id)
        if contract is None:
            raise APIError(
                code=CONT_006_CONTRACT_NOT_FOUND,
                message=ERROR_MESSAGES[CONT_006_CONTRACT_NOT_FOUND],
                status_code=404,
            )

        # -- BR-04: Must be active --
        if contract.status != ContractStatus.ACTIVE:
            raise APIError(
                code=CONT_004_CONTRACT_NOT_ACTIVE,
                message=ERROR_MESSAGES[CONT_004_CONTRACT_NOT_ACTIVE],
                status_code=409,
            )

        # -- Reason is required --
        if not reason or not reason.strip():
            raise APIError(
                code=CONT_009_INVALID_TERMINATION_REASON,
                message=ERROR_MESSAGES[CONT_009_INVALID_TERMINATION_REASON],
                status_code=400,
            )

        term_date = termination_date or date.today()

        # -- Create termination record --
        termination = ContractTermination(
            contract_id=contract_id,
            reason=reason,
            termination_date=term_date,
            notes=notes,
            terminated_by=terminated_by,
        )
        await self.repo.create_termination(termination)

        # -- Update contract status --
        contract.status = ContractStatus.TERMINATED
        contract = await self.repo.update(contract)

        # -- Update room status to available --
        from app.modules.property.constants import RoomStatus
        await self.room_repo.update_status(contract.room_id, RoomStatus.AVAILABLE)

        # -- Audit log --
        await log_audit(
            db=self.db,
            user_id=terminated_by,
            action="contract.terminated",
            resource_type="contract",
            resource_id=contract.id,
            property_id=contract.property_id,
            metadata={
                "reason": reason,
                "termination_date": term_date.isoformat(),
                "room_id": str(contract.room_id),
            },
        )

        # -- Publish event (fail-silent) --
        await publish_contract_event(
            EVENT_CONTRACT_TERMINATED,
            str(contract.id),
            {
                "room_id": str(contract.room_id),
                "reason": reason,
            },
        )

        return contract

    # ── Extend Lease ─────────────────────────────────────────────────────

    async def extend_lease(
        self,
        contract_id: uuid.UUID,
        new_end_date: date,
        extended_by: uuid.UUID,
        reason: str | None = None,
    ) -> Contract:
        """Extend a contract's end date and record the extension.

        Parameters
        ----------
        contract_id
            UUID of the contract to extend.
        new_end_date
            The new end date (must be after current end_date).
        extended_by
            UUID of the user performing the extension.
        reason
            Optional reason for the extension.

        Returns
        -------
        Contract
            The updated Contract ORM instance with extensions loaded.

        Raises
        ------
        APIError
            CONT-006: contract not found.
            CONT-004: contract not active.
        """
        contract = await self.repo.get_by_id(contract_id)
        if contract is None:
            raise APIError(
                code=CONT_006_CONTRACT_NOT_FOUND,
                message=ERROR_MESSAGES[CONT_006_CONTRACT_NOT_FOUND],
                status_code=404,
            )
        if contract.status != ContractStatus.ACTIVE:
            raise APIError(
                code=CONT_004_CONTRACT_NOT_ACTIVE,
                message=ERROR_MESSAGES[CONT_004_CONTRACT_NOT_ACTIVE],
                status_code=409,
            )

        previous_end = contract.end_date

        # -- Create extension record --
        extension = LeaseExtension(
            contract_id=contract_id,
            previous_end_date=previous_end,
            extended_to=new_end_date,
            reason=reason,
            extended_by=extended_by,
        )
        await self.repo.create_extension(extension)

        # -- Update contract end_date --
        contract.end_date = new_end_date
        contract = await self.repo.update(contract)

        # -- Audit log --
        await log_audit(
            db=self.db,
            user_id=extended_by,
            action="contract.extended",
            resource_type="contract",
            resource_id=contract.id,
            property_id=contract.property_id,
            metadata={
                "previous_end_date": previous_end.isoformat(),
                "new_end_date": new_end_date.isoformat(),
                "reason": reason or "",
            },
        )

        # -- Publish event --
        await publish_contract_event(
            EVENT_CONTRACT_EXTENDED,
            str(contract.id),
            {
                "previous_end_date": previous_end.isoformat(),
                "new_end_date": new_end_date.isoformat(),
            },
        )

        return contract

    # ── Renew Contract ───────────────────────────────────────────────────

    async def renew_contract(
        self,
        original_contract_id: uuid.UUID,
        new_start_date: date,
        new_end_date: date,
        new_monthly_rent: float,
        new_deposit_amount: float,
        renewed_by: uuid.UUID,
    ) -> Contract:
        """Renew a terminated/expired contract by creating a new one.

        The original contract must be in ``terminated`` or ``expired``
        state.  A new contract is created for the same room/tenant with
        updated terms and ``is_renewal=True``.

        Parameters
        ----------
        original_contract_id
            UUID of the original (terminated/expired) contract.
        new_start_date
            Start date for the renewed contract.
        new_end_date
            End date for the renewed contract.
        new_monthly_rent
            Updated monthly rent amount.
        new_deposit_amount
            Updated deposit amount.
        renewed_by
            UUID of the user performing the renewal.

        Returns
        -------
        Contract
            The newly created Contract ORM instance.
        """
        original = await self.repo.get_by_id(original_contract_id)
        if original is None:
            raise APIError(
                code=CONT_006_CONTRACT_NOT_FOUND,
                message=ERROR_MESSAGES[CONT_006_CONTRACT_NOT_FOUND],
                status_code=404,
            )

        # Must be terminated or expired
        if original.status not in (ContractStatus.TERMINATED, ContractStatus.EXPIRED):
            raise APIError(
                code=CONT_005_RENEW_INVALID_STATE,
                message=ERROR_MESSAGES[CONT_005_RENEW_INVALID_STATE],
                status_code=409,
            )

        # BR-02 validation
        from app.modules.property.models import Property
        from sqlalchemy import select

        stmt = select(Property).where(Property.id == original.property_id)
        result = await self.db.execute(stmt)
        prop = result.scalars().first()
        if prop is not None:
            min_deposit = new_monthly_rent * prop.min_deposit_months
            if new_deposit_amount < min_deposit:
                raise APIError(
                    code=CONT_002_DEPOSIT_TOO_LOW,
                    message=(
                        f"Deposit must be at least {min_deposit:.2f} "
                        f"({prop.min_deposit_months} months of rent)"
                    ),
                    status_code=400,
                )

        # Check if room is available (no active contract besides possibly the original)
        # Since the original is terminated/expired, the room should be available
        if await self.repo.has_active_contract(original.room_id):
            raise APIError(
                code=CONT_001_ROOM_HAS_ACTIVE_CONTRACT,
                message=ERROR_MESSAGES[CONT_001_ROOM_HAS_ACTIVE_CONTRACT],
                status_code=409,
            )

        # Create new contract
        new_contract = Contract(
            room_id=original.room_id,
            tenant_id=original.tenant_id,
            property_id=original.property_id,
            start_date=new_start_date,
            end_date=new_end_date,
            monthly_rent=new_monthly_rent,
            deposit_amount=new_deposit_amount,
            status=ContractStatus.ACTIVE,
            is_renewal=True,
            renewed_from_id=original_contract_id,
            created_by=renewed_by,
        )
        new_contract = await self.repo.create(new_contract)

        # Update room status to occupied
        from app.modules.property.constants import RoomStatus
        await self.room_repo.update_status(original.room_id, RoomStatus.OCCUPIED)

        # Audit log
        await log_audit(
            db=self.db,
            user_id=renewed_by,
            action="contract.renewed",
            resource_type="contract",
            resource_id=new_contract.id,
            property_id=original.property_id,
            metadata={
                "original_contract_id": str(original_contract_id),
                "new_monthly_rent": str(new_monthly_rent),
                "new_start_date": new_start_date.isoformat(),
                "new_end_date": new_end_date.isoformat(),
            },
        )

        # Publish event
        await publish_contract_event(
            EVENT_CONTRACT_RENEWED,
            str(new_contract.id),
            {
                "original_contract_id": str(original_contract_id),
                "room_id": str(original.room_id),
            },
        )

        return new_contract

    # ── Query Methods ────────────────────────────────────────────────────

    async def get_active_contracts(self, property_id: uuid.UUID | None = None) -> list[Contract]:
        """Return all active contracts, optionally filtered by property.

        Uses the ``ix_contracts_property_status`` partial index.
        """
        return await self.repo.get_active_contracts(property_id)

    async def get_contract(self, contract_id: uuid.UUID) -> Contract:
        """Get a single contract by ID with all relations loaded.

        Raises
        ------
        APIError
            CONT-006: contract not found.
        """
        contract = await self.repo.get_by_id(contract_id)
        if contract is None:
            raise APIError(
                code=CONT_006_CONTRACT_NOT_FOUND,
                message=ERROR_MESSAGES[CONT_006_CONTRACT_NOT_FOUND],
                status_code=404,
            )
        return contract

    async def get_lease_history(self, room_id: uuid.UUID) -> list[Contract]:
        """Return all contracts for a room (lease history), newest first."""
        return await self.repo.get_lease_history(room_id)