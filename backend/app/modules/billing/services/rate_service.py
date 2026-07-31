"""Rate Service — Cascade Utility Rate Resolution (SDD §2.3, BR-10).

Extracted from BillingService for single responsibility:
- Resolves utility rates via cascade: Room → Floor → Building → Property
- Handles effective date filtering
- Provides clean interface for rate lookups

References:
- SDD.md §2.3: Billing Module Specification
- SDD.md §6: Business Rules (BR-10)
- CODE_STYLE.md §5.3: Audit logging for sensitive operations
"""

import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.billing.constants import (
    BILL_003_RATE_NOT_FOUND,
)
from app.modules.billing.models import UtilityRate
from app.modules.billing.repository import BillingRepository
from app.shared.exceptions import APIError


class RateService:
    """Business logic for utility rate resolution via cascade.

    BR-10: Rates cascade from most specific to least specific:
    Room → Floor → Building → Property

    The first matching rate at any level is used.
    """

    # Scope priority for cascade (index = priority, lower = more specific)
    SCOPE_PRIORITY = {"room": 0, "floor": 1, "building": 2, "property": 3}

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = BillingRepository(db)

    async def resolve_utility_rate(
        self,
        room_id: uuid.UUID,
        billing_month: int,
        billing_year: int,
    ) -> UtilityRate:
        """BR-10: Resolve utility rate via cascade Room → Floor → Building → Property.

        Raises BILL-003 if no rate is found at any level of the cascade.

        Parameters
        ----------
        room_id: UUID of the room to resolve rates for.
        billing_month: Billing month for effective date (1-12).
        billing_year: Billing year for effective date.

        Returns
        -------
        UtilityRate: The most specific matching rate.

        Raises
        ------
        APIError: BILL-003 if no utility rate found for any scope level.
        """
        rate = await self.repo.resolve_rate_cascade(room_id, billing_month, billing_year)
        if rate is None:
            raise APIError(
                code=BILL_003_RATE_NOT_FOUND,
                message="No utility rate found for any scope in the cascade",
                status_code=500,
                details={"room_id": str(room_id)},
            )
        return rate

    async def get_rate_for_scope(
        self,
        scope_type: str,
        scope_id: uuid.UUID,
        billing_date: date | None = None,
    ) -> UtilityRate | None:
        """Get the effective rate for a specific scope at a given date.

        Parameters
        ----------
        scope_type: One of 'room', 'floor', 'building', 'property'.
        scope_id: UUID of the scope entity.
        billing_date: Date to check effectiveness (defaults to today).

        Returns
        -------
        UtilityRate | None: The most recent effective rate, or None if not found.
        """
        return await self.repo.get_rate_for_scope(scope_type, scope_id, billing_date)

    async def get_cascade_scopes(self, room_id: uuid.UUID) -> list[tuple[str, uuid.UUID]]:
        """Get the cascade scope chain for a room.

        Returns list of (scope_type, scope_id) tuples in priority order
        (most specific first): room → floor → building → property
        """
        from app.modules.property.models import Room

        room_result = await self.db.execute(
            select(Room).where(Room.id == room_id)
        )
        room = room_result.scalars().first()
        if not room:
            return []

        cascade_scopes: list[tuple[str, uuid.UUID]] = [("room", room.id)]
        if room.floor_id:
            cascade_scopes.append(("floor", room.floor_id))
        cascade_scopes.append(("building", room.building_id))
        cascade_scopes.append(("property", room.property_id))

        return cascade_scopes

    async def validate_cascade_has_rates(
        self,
        room_id: uuid.UUID,
        billing_month: int,
        billing_year: int,
    ) -> bool:
        """Check if the cascade has at least one rate configured.

        Useful for pre-validation before invoice generation.
        """
        billing_date = date(billing_year, billing_month, 1)
        scopes = await self.get_cascade_scopes(room_id)

        for scope_type, scope_id in scopes:
            rate = await self.get_rate_for_scope(scope_type, scope_id, billing_date)
            if rate:
                return True
        return False
