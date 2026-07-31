"""Notification data-access layer — async CRUD operations (SDD.md §2.7).

The repository encapsulates all SQLAlchemy queries against the ``notifications``
table. Each method is a thin wrapper around a ``select()`` statement.
No business logic is present here — that lives in ``services/``.

References:
    - docs/API.md "Proposed Redesign — Notification Module"
    - SDD.md §2.7: Notification Module
"""

import uuid
from collections.abc import Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.notification.models import Notification


class NotificationRepository:
    """Async repository for ``Notification`` persistence."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def create(self, notif: Notification) -> Notification:
        """Persist a new notification to the database."""
        self._db.add(notif)
        await self._db.flush()
        await self._db.refresh(notif)
        return notif

    async def get_by_id(self, notif_id: uuid.UUID) -> Notification | None:
        """Fetch a notification by its primary key."""
        stmt = select(Notification).where(Notification.id == notif_id)
        result = await self._db.execute(stmt)
        return result.scalars().first()

    async def get_notification_property_id(self, notif_id: uuid.UUID) -> uuid.UUID | None:
        """Get the property_id of a notification (for resolve-then-check)."""
        stmt = select(Notification.property_id).where(Notification.id == notif_id)
        result = await self._db.execute(stmt)
        return result.scalar_one_or_none()

    async def update_status(self, notif_id: uuid.UUID, status: str) -> Notification | None:
        """Update notification status."""
        stmt = select(Notification).where(Notification.id == notif_id)
        result = await self._db.execute(stmt)
        notification = result.scalars().first()
        if notification:
            notification.status = status
            await self._db.flush()
            await self._db.refresh(notification)
        return notification

    async def update(self, notif: Notification) -> Notification:
        """Persist changes to an existing notification."""
        await self._db.flush()
        await self._db.refresh(notif)
        return notif

    async def get_by_property_paginated(
        self, property_id: uuid.UUID, page: int = 1, limit: int = 20
    ) -> tuple[Sequence[Notification], int]:
        """Get paginated notifications for a property.

        Returns (items, total_count) for pagination meta.
        """
        offset = (page - 1) * limit

        # Count total
        count_stmt = select(func.count(Notification.id)).where(
            Notification.property_id == property_id
        )
        total_result = await self._db.execute(count_stmt)
        total = total_result.scalar_one()

        # Get items
        stmt = (
            select(Notification)
            .where(Notification.property_id == property_id)
            .order_by(Notification.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        result = await self._db.execute(stmt)
        items = list(result.scalars().all())

        return items, total

    async def get_by_user_paginated(
        self, user_id: uuid.UUID, page: int = 1, limit: int = 20
    ) -> tuple[Sequence[Notification], int]:
        """Get paginated notifications for a user (for future use)."""
        offset = (page - 1) * limit

        count_stmt = select(func.count(Notification.id)).where(
            Notification.user_id == user_id
        )
        total_result = await self._db.execute(count_stmt)
        total = total_result.scalar_one()

        stmt = (
            select(Notification)
            .where(Notification.user_id == user_id)
            .order_by(Notification.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        result = await self._db.execute(stmt)
        items = list(result.scalars().all())

        return items, total

