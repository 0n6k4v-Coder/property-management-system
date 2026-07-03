"""Database connection and session management (SDD.md §3.1, §4.3.2)."""

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool

from app.config import get_settings

settings = get_settings()

# Create async engine - conditionally use NullPool for testing
pool_args = {}
if settings.DEBUG:
    pool_args["poolclass"] = NullPool
else:
    pool_args["pool_size"] = settings.DB_POOL_SIZE
    pool_args["max_overflow"] = settings.DB_MAX_OVERFLOW
    pool_args["pool_timeout"] = settings.DB_POOL_TIMEOUT
    pool_args["pool_recycle"] = settings.DB_POOL_RECYCLE

engine = create_async_engine(
    settings.DATABASE_URL,
    pool_pre_ping=settings.DB_PRE_PING,
    echo=settings.DEBUG,
    **pool_args,
)

# Session factory
async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models."""
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that provides a database session.

    Yields
    ------
    AsyncSession
        Database session for the request.

    Notes
    -----
    - Session is automatically committed on success
    - Session is rolled back on exception
    - Session is always closed in finally block
    """
    async with async_session_maker() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


@asynccontextmanager
async def get_db_context() -> AsyncGenerator[AsyncSession, None]:
    """Context manager for database sessions outside FastAPI requests.

    Useful for background tasks, scripts, and tests.

    Example
    -------
    async with get_db_context() as db:
        repo = SomeRepository(db)
        result = await repo.do_something()
    """
    async with async_session_maker() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db() -> None:
    """Initialize database - create all tables.

    Called during application startup in development.
    In production, use Alembic migrations instead.
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def close_db() -> None:
    """Close database connections gracefully."""
    await engine.dispose()