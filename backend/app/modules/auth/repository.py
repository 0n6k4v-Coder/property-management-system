"""User data-access layer — async CRUD operations (SDD.md §2.1, §4.1.1).

The repository encapsulates all SQLAlchemy queries against the ``users``
table.  Each method is a thin wrapper around a ``select()`` statement.
No business logic is present here — that lives in ``services/``.

References:
    - SDD.md §2.1: Auth module specification
    - SDD.md §4.1.1: User entity in ERD
    - SDD.md §4.2: Physical schema — users table
"""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.models import User


class UserRepository:
    """Async repository for ``User`` persistence (SDD §4.2).

    Every method uses ``select(User)`` (SQLAlchemy 2.0 style) and
    passes the resulting ORM instance back to the service layer.
    The caller owns transaction boundaries — this class only flushes
    when it needs a generated value (e.g. UUID default).
    """

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def get_by_email(self, email: str) -> User | None:
        """Fetch a user by their unique email address.

        Parameters
        ----------
        email
            The exact email to search for (case-sensitive).

        Returns
        -------
        User | None
            The matching user, or ``None`` if no such email exists.
        """
        stmt = select(User).where(User.email == email)
        result = await self._db.execute(stmt)
        return result.scalars().first()

    async def get_by_id(self, user_id: uuid.UUID) -> User | None:
        """Fetch a user by their primary key.

        Parameters
        ----------
        user_id
            The UUID primary key of the user.

        Returns
        -------
        User | None
            The matching user, or ``None`` if not found.
        """
        stmt = select(User).where(User.id == user_id)
        result = await self._db.execute(stmt)
        return result.scalars().first()

    async def create(self, user: User) -> User:
        """Persist a new user to the database.

        The user instance is added to the session, flushed (to obtain
        server-side defaults), then refreshed so the returned object
        reflects the database state.

        Parameters
        ----------
        user
            A partially populated ``User`` ORM instance (without ``id``
            if letting the model generate it via ``uuid.uuid4``).

        Returns
        -------
        User
            The same instance after flush and refresh.
        """
        self._db.add(user)
        await self._db.flush()
        await self._db.refresh(user)
        return user

    async def update_last_login(self, user_id: uuid.UUID) -> None:
        """Update the ``updated_at`` timestamp to signal a recent login.

        Uses an efficient in-place UPDATE without loading the full row.
        The ``onupdate=func.now()`` on the model's ``updated_at`` column
        handles the timestamp assignment automatically after flush.

        Parameters
        ----------
        user_id
            The UUID of the user whose login timestamp to update.
        """
        stmt = select(User).where(User.id == user_id)
        result = await self._db.execute(stmt)
        user = result.scalars().first()
        if user:
            # Touch the row — onupdate will set updated_at on flush/commit
            user.updated_at = None  # Forces SQLAlchemy to re-apply onupdate
            await self._db.flush()