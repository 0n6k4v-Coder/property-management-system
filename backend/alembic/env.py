"""Async Alembic configuration — uses asyncpg for async migration support.

This ``env.py`` overrides Alembic's default synchronous runner with an
async equivalent so that SQLAlchemy async models (``AsyncSession``,
``async_engine``) are fully supported during migrations.

References:
    - Alembic docs: https://alembic.sqlalchemy.org/en/latest/
    - SDD.md §4.2: Physical schema
    - SDD.md §4.3: Migration patterns
"""

import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config

# Alembic Config object
config = context.config

# Set up logging from alembic.ini
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Import all models so that Base.metadata is fully populated
from app.shared.database import Base  # noqa: E402

# Import module models to register with Base.metadata
from app.modules.auth.models import User  # noqa: F401, E402
from app.shared.audit import AuditLog  # noqa: F401, E402
from app.modules.property.models import Property, Building, Floor, Room  # noqa: F401, E402
from app.modules.tenant.models import Tenant  # noqa: F401, E402
from app.modules.billing.models import Invoice, InvoiceLineItem, MeterReading, Payment, UtilityRate  # noqa: F401, E402
from app.modules.contract.models import Contract, ContractTermination, LeaseExtension  # noqa: F401, E402
from app.modules.maintenance.models import MaintenanceRequest  # noqa: F401, E402

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    Configures the context with just a URL and not an Engine,
    emitting SQL as a script rather than executing it directly.
    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    """Execute migrations against the provided connection."""
    context.configure(connection=connection, target_metadata=target_metadata)

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Run migrations in 'online' async mode.

    Creates an async engine from the config URL, obtains a connection,
    and runs the migration within a transaction.
    """
    configuration = config.get_section(config.config_ini_section)
    connectable = async_engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode — delegates to async runner."""
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()