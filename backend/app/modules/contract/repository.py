"""Data access layer for Contract module (SDD §2.5 — Infrastructure layer).

References:
    - CODE_STYLE.md §3.2: Async query patterns (SQLAlchemy 2.0 select())
    - SDD.md §4.2: Physical schema
    - BR-01: One active contract per room (partial unique index)
"""

import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.contract.models import Contract, ContractTermination, LeaseExtension


class ContractRepository:
    """Database queries for the Contract aggregate."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ── CRUD ─────────────────────────────────────────────────────────────

    async def create(self, contract: Contract) -> Contract:
        """Persist a new Contract and return it with an ID assigned."""
        self.db.add(contract)
        await self.db.flush()
        await self.db.refresh(contract)
        return contract

    async def get_by_id(self, contract_id: uuid.UUID) -> Contract | None:
        """Retrieve a Contract by primary key with relations eagerly loaded."""
        stmt = (
            select(Contract)
            .where(Contract.id == contract_id)
            .options(
                selectinload(Contract.termination),
                selectinload(Contract.extensions),
            )
        )
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def update(self, contract: Contract) -> Contract:
        """Persist changes to an existing Contract."""
        await self.db.flush()
        await self.db.refresh(contract)
        return contract

    # ── Scope Resolution Helpers (fixes #5) ──────────────────────────────

    async def get_contract_property_id(self, contract_id: uuid.UUID) -> uuid.UUID | None:
        """Return the property_id of a contract, or None if not found.

        Used by the router for resolve-then-check authorization on endpoints
        that don't carry property_id directly.
        """
        stmt = select(Contract.property_id).where(Contract.id == contract_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_room_property_id(self, room_id: uuid.UUID) -> uuid.UUID | None:
        """Return the property_id of a room, or None if not found.

        Used by the router for resolve-then-check authorization on the
        lease history endpoint (GET /leases/{room_id}/history).
        """
        from app.modules.property.models import Room

        stmt = select(Room.property_id).where(Room.id == room_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    # ── Business Queries ─────────────────────────────────────────────────

    async def has_active_contract(self, room_id: uuid.UUID) -> bool:
        """Check if a room already has an active contract (BR-01).

        Uses the ``ix_contracts_room_active_unique`` partial index.
        Since the index enforces uniqueness at the DB level, this query
        is both fast and reliable.
        """
        stmt = (
            select(Contract)
            .where(Contract.room_id == room_id, Contract.status == "active")
            .limit(1)
        )
        result = await self.db.execute(stmt)
        return result.scalars().first() is not None

    async def get_active_contract_for_room(self, room_id: uuid.UUID) -> Contract | None:
        """Retrieve the single active contract for a room (BR-01).

        Leverages the partial unique index ``ix_contracts_room_active_unique``.
        """
        stmt = (
            select(Contract)
            .where(Contract.room_id == room_id, Contract.status == "active")
            .options(
                selectinload(Contract.termination),
                selectinload(Contract.extensions),
            )
        )
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def get_active_contracts(self, property_id: uuid.UUID | None = None) -> list[Contract]:
        """Return all active contracts, optionally filtered by property.

        Uses the ``ix_contracts_property_status`` composite index.
        """
        stmt = select(Contract).where(Contract.status == "active")
        if property_id:
            stmt = stmt.where(Contract.property_id == property_id)
        stmt = stmt.options(
            selectinload(Contract.termination),
            selectinload(Contract.extensions),
        ).order_by(Contract.created_at.desc())
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_active_contracts_paginated(
        self,
        property_ids: list[uuid.UUID] | None,
        page: int,
        limit: int,
    ) -> tuple[list[Contract], int]:
        """Return paginated active contracts for scope-filtered list.

        Returns (contracts, total_count).
        """
        from sqlalchemy import func as sqlfunc

        # Base query for active contracts
        base_stmt = select(Contract).where(Contract.status == "active")
        if property_ids:
            base_stmt = base_stmt.where(Contract.property_id.in_(property_ids))

        # Count total
        count_stmt = select(sqlfunc.count()).select_from(base_stmt.subquery())
        total_result = await self.db.execute(count_stmt)
        total = total_result.scalar_one()

        # Paginated query
        stmt = base_stmt.options(
            selectinload(Contract.termination),
            selectinload(Contract.extensions),
        ).order_by(Contract.created_at.desc()).offset((page - 1) * limit).limit(limit)

        result = await self.db.execute(stmt)
        contracts = list(result.scalars().all())
        return contracts, total

    async def get_contracts_by_status(self, status: str) -> list[Contract]:
        """Return contracts matching a given status."""
        stmt = (
            select(Contract)
            .where(Contract.status == status)
            .options(
                selectinload(Contract.termination),
                selectinload(Contract.extensions),
            )
            .order_by(Contract.created_at.desc())
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_contracts_by_tenant(self, tenant_id: uuid.UUID) -> list[Contract]:
        """Return all contracts for a given tenant, newest first."""
        stmt = (
            select(Contract)
            .where(Contract.tenant_id == tenant_id)
            .options(
                selectinload(Contract.termination),
                selectinload(Contract.extensions),
            )
            .order_by(Contract.created_at.desc())
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_lease_history(self, room_id: uuid.UUID) -> list[Contract]:
        """Return all contracts for a room (lease history), newest first."""
        stmt = (
            select(Contract)
            .where(Contract.room_id == room_id)
            .options(
                selectinload(Contract.termination),
                selectinload(Contract.extensions),
            )
            .order_by(Contract.start_date.desc())
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_lease_history_paginated(
        self,
        room_id: uuid.UUID,
        page: int,
        limit: int,
    ) -> tuple[list[Contract], int]:
        """Return paginated lease history for a room.

        Returns (contracts, total_count).
        """
        from sqlalchemy import func as sqlfunc

        base_stmt = select(Contract).where(Contract.room_id == room_id)

        # Count total
        count_stmt = select(sqlfunc.count()).select_from(base_stmt.subquery())
        total_result = await self.db.execute(count_stmt)
        total = total_result.scalar_one()

        # Paginated query
        stmt = base_stmt.options(
            selectinload(Contract.termination),
            selectinload(Contract.extensions),
        ).order_by(Contract.start_date.desc()).offset((page - 1) * limit).limit(limit)

        result = await self.db.execute(stmt)
        contracts = list(result.scalars().all())
        return contracts, total

    async def has_date_overlap(
        self,
        room_id: uuid.UUID,
        start_date: date,
        end_date: date,
        exclude_contract_id: uuid.UUID | None = None,
    ) -> bool:
        """Check if any non-terminated contract for a room has date overlap.

        Overlap condition: existing.start_date <= new.end_date
                         AND existing.end_date >= new.start_date

        Excludes a specific contract ID (for updates/renewals).
        """
        stmt = select(Contract).where(
            Contract.room_id == room_id,
            Contract.status.in_(["active", "draft"]),
            Contract.start_date <= end_date,
            Contract.end_date >= start_date,
        )
        if exclude_contract_id:
            stmt = stmt.where(Contract.id != exclude_contract_id)
        stmt = stmt.limit(1)
        result = await self.db.execute(stmt)
        return result.scalars().first() is not None

    # ── Expiry Management ────────────────────────────────────────────────

    async def get_expired_contracts(self, reference_date: date | None = None) -> list[Contract]:
        """Return all active contracts whose end_date is past the reference date."""
        ref_date = reference_date or date.today()
        stmt = (
            select(Contract)
            .where(
                Contract.status == "active",
                Contract.end_date < ref_date,
            )
            .options(
                selectinload(Contract.termination),
                selectinload(Contract.extensions),
            )
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    # ── Lease Extension ──────────────────────────────────────────────────

    async def create_extension(self, extension: LeaseExtension) -> LeaseExtension:
        """Persist a new LeaseExtension record."""
        self.db.add(extension)
        await self.db.flush()
        await self.db.refresh(extension)
        return extension

    # ── Termination ─────────────────────────────────────────────────────

    async def create_termination(self, termination: ContractTermination) -> ContractTermination:
        """Persist a new ContractTermination record."""
        self.db.add(termination)
        await self.db.flush()
        await self.db.refresh(termination)
        return termination

