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
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.models import IdempotencyKey, User, UserPropertyScope


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

    async def get_property_scopes(
        self, user_id: uuid.UUID
    ) -> list[UserPropertyScope]:
        """Return the user's property scopes (``user_property_scopes`` rows).

        Parameters
        ----------
        user_id
            The UUID of the user whose scopes to load.

        Returns
        -------
        list[UserPropertyScope]
            All scope rows for the user (empty list if none).
        """
        stmt = select(UserPropertyScope).where(UserPropertyScope.user_id == user_id)
        result = await self._db.execute(stmt)
        return list(result.scalars().all())

    async def set_current_refresh_jti(
        self, user_id: uuid.UUID, jti: str
    ) -> None:
        """Persist the ``jti`` of the user's currently-valid refresh token.

        Used by refresh-token rotation to invalidate the previous refresh
        token the moment a new pair is issued.

        Parameters
        ----------
        user_id
            The UUID of the user.
        jti
            The JWT ID (``jti`` claim) of the issued refresh token.
        """
        user = await self.get_by_id(user_id)
        if user:
            user.current_refresh_jti = jti
            await self._db.flush()

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
            user.updated_at = datetime.now(UTC)
            await self._db.flush()

    async def get_idempotency(self, key: str) -> IdempotencyKey | None:
        """Return a non-expired idempotency record for ``key``, if any.

        Parameters
        ----------
        key
            The client-supplied ``Idempotency-Key`` header value.

        Returns
        -------
        IdempotencyKey | None
            The stored record if it exists and ``expires_at`` is in the
            future, else ``None``.
        """
        stmt = select(IdempotencyKey).where(IdempotencyKey.key == key)
        result = await self._db.execute(stmt)
        record = result.scalars().first()
        if record is None:
            return None
        if record.expires_at < datetime.now(UTC):
            return None
        return record

    async def save_idempotency(
        self, key: str, request_hash: str, response_body: str, expires_at: datetime
    ) -> None:
        """Persist an idempotency result (anti-pattern #1 fix).

        Parameters
        ----------
        key
            The client-supplied ``Idempotency-Key`` header value.
        request_hash
            A stable hash of the normalised request payload + path, used to
            reject a repeated key carrying a *different* body.
        response_body
            The JSON-serialised response body to replay on a repeat call.
        expires_at
            When this cached result should be discarded (24h window).
        """
        record = IdempotencyKey(
            key=key,
            request_hash=request_hash,
            response_body=response_body,
            expires_at=expires_at,
        )
        self._db.add(record)
        await self._db.flush()
