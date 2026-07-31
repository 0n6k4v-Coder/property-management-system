"""Create all database tables from SQLAlchemy models.

Usage (from root):
    docker compose -f docker-compose.dev.yml --profile dev exec -e PYTHONPATH=/app backend python3 /app/scripts/create_tables.py
"""

import asyncio

from sqlalchemy import text

# Import ALL model modules to register them with Base.metadata
from app.modules.auth.models import User  # noqa: F401
from app.shared.audit import AuditLog  # noqa: F401
from app.shared.database import Base, engine


async def create_tables() -> None:
    """Create registered tables, handling cross-module FK dependencies."""
    async with engine.begin() as conn:
        # Create users table first — no foreign-key dependencies
        await conn.run_sync(Base.metadata.create_all, tables=[User.__table__])
        print("✅ Table created: users")

        # AuditLog has FK to properties.id (Phase 2) — skip FK constraint for now
        try:
            await conn.run_sync(Base.metadata.create_all, tables=[AuditLog.__table__])
            print("✅ Table created: audit_logs")
        except Exception:
            # Create without FK constraints as a fallback
            raw_ddl = """
                CREATE TABLE IF NOT EXISTS audit_logs (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
                    action VARCHAR(100) NOT NULL,
                    resource_type VARCHAR(50) NOT NULL,
                    resource_id UUID,
                    property_id UUID,
                    metadata JSONB NOT NULL DEFAULT '{}',
                    ip_address INET,
                    user_agent TEXT,
                    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            """
            await conn.execute(text(raw_ddl))
            print("✅ Table created: audit_logs (without FK to properties)")

    await engine.dispose()


asyncio.run(create_tables())
