"""007_add_audit_indexes

Revision ID: 007
Revises: 006
Create Date: 2026-05-30 00:00:00.000000

Sprint 7 — Admin & Security:
    - Add GIN index on audit_logs.metadata (JSONB)
    - Add BRIN index on audit_logs.timestamp

References:
    - SDD.md §4.3: Indexing & Query Optimization
    - SDD.md §7.4: Audit Compliance (fast audit log queries)
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "007"
down_revision: str | None = "006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # GIN index on JSONB metadata for full-text search across audit metadata
    op.create_index(
        "ix_audit_logs_metadata_gin",
        "audit_logs",
        [sa.text("metadata")],
        postgresql_using="gin",
    )
    # BRIN index on timestamp for fast range queries on recent audit logs
    op.create_index(
        "ix_audit_logs_timestamp_brin",
        "audit_logs",
        [sa.text("timestamp")],
        postgresql_using="brin",
        postgresql_with={"pages_per_range": "32"},
    )


def downgrade() -> None:
    op.drop_index("ix_audit_logs_timestamp_brin", table_name="audit_logs")
    op.drop_index("ix_audit_logs_metadata_gin", table_name="audit_logs")