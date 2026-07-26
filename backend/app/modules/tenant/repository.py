"""Data access layer for Tenant module (SDD §2.4 — Infrastructure layer).

References:
- CODE_STYLE.md §3.2: Async query patterns (SQLAlchemy 2.0 select())
- SDD.md §4.2: Physical schema — tenants table
"""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.tenant.models import Tenant


class TenantRepository:
    """Database queries for the Tenant entity."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(self, tenant: Tenant) -> Tenant:
        """Persist a new Tenant and return it."""
        self.db.add(tenant)
        await self.db.flush()
        await self.db.refresh(tenant)
        return tenant

    async def get_by_id(self, tenant_id: uuid.UUID) -> Tenant | None:
        """Retrieve a Tenant by primary key."""
        stmt = select(Tenant).where(Tenant.id == tenant_id)
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def get_by_phone_and_property(
        self,
        phone: str,
        property_id: uuid.UUID,
    ) -> Tenant | None:
        """Check for duplicate phone within a property (BR-15).

        Uses the ``ix_tenants_property_phone_unique`` index.
        """
        stmt = select(Tenant).where(
            Tenant.phone == phone,
            Tenant.property_id == property_id,
        )
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def search(
        self,
        property_id: uuid.UUID,
        query: str,
        search_by: str = "name",
        limit: int = 20,
        offset: int = 0,
    ) -> list[Tenant]:
        """Search tenants by name, phone, or email within a property.

        Parameters
        ----------
        property_id
            Scoping property UUID.
        query
            Search string (min 3 characters, enforced in service layer).
        search_by
            Field to search: ``"name"``, ``"phone"``, or ``"email"``.
        limit
            Max results per page.
        offset
            Pagination offset.

        Returns
        -------
        list[Tenant]
            Matching tenant records.
        """
        pattern = f"%{query}%"
        if search_by == "phone":
            stmt = (
                select(Tenant)
                .where(
                    Tenant.property_id == property_id,
                    Tenant.phone == query,
                )
                .offset(offset)
                .limit(limit)
            )
        elif search_by == "email":
            stmt = (
                select(Tenant)
                .where(
                    Tenant.property_id == property_id,
                    Tenant.email.ilike(pattern),
                )
                .offset(offset)
                .limit(limit)
            )
        elif search_by == "name":
            stmt = (
                select(Tenant)
                .where(
                    Tenant.property_id == property_id,
                    Tenant.full_name.ilike(pattern),
                )
                .offset(offset)
                .limit(limit)
            )
        else:
            # Invalid value — should be unreachable now that the router
            # constrains ``search_by`` to a Literal, but fail loudly rather
            # than silently falling back to a name search (anti-pattern #7).
            raise ValueError(f"Unsupported search_by value: {search_by!r}")

        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def count_search(
        self,
        property_id: uuid.UUID,
        query: str,
        search_by: str = "name",
    ) -> int:
        """Count matching tenants for pagination metadata."""
        pattern = f"%{query}%"
        if search_by == "phone":
            stmt = (
                select(Tenant)
                .where(
                    Tenant.property_id == property_id,
                    Tenant.phone == query,
                )
            )
        elif search_by == "email":
            stmt = (
                select(Tenant)
                .where(
                    Tenant.property_id == property_id,
                    Tenant.email.ilike(pattern),
                )
            )
        elif search_by == "name":
            stmt = (
                select(Tenant)
                .where(
                    Tenant.property_id == property_id,
                    Tenant.full_name.ilike(pattern),
                )
            )
        else:
            # Invalid value — unreachable via the router's Literal constraint;
            # fail loudly rather than silently falling back to a name count (#7).
            raise ValueError(f"Unsupported search_by value: {search_by!r}")

        result = await self.db.execute(stmt)
        return len(result.scalars().all())
