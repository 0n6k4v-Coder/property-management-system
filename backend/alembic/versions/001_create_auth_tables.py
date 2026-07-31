"""Create auth core tables: users + audit_logs.

This is the initial schema migration for Sprint 1.  It creates the
two foundation tables used by the auth module and shared audit kernel.

Tables created
--------------
- ``users`` — Application user accounts (SDD §4.2)
- ``audit_logs`` — Immutable audit trail (SDD §4.1.1, §7.4)

Indexes
-------
- ``ix_users_email`` — Unique index on ``users.email``
- ``ix_audit_logs_property_time`` — Multi-column index on
  ``audit_logs.property_id`` + ``timestamp DESC``
- ``ix_audit_logs_user_time`` — Multi-column index on
  ``audit_logs.user_id`` + ``timestamp DESC``

Revision ID: 001
Revises: None
Create Date: 2026-05-25
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import INET, JSONB, UUID

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # users table (SDD §4.2)
    # ------------------------------------------------------------------
    op.create_table(
        "users",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("phone", sa.String(20), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    op.create_index(
        "ix_users_email",
        "users",
        ["email"],
        unique=True,
        postgresql_using="btree",
    )

    # ------------------------------------------------------------------
    # audit_logs table (SDD §4.1.1, §7.4)
    # ------------------------------------------------------------------
    op.create_table(
        "audit_logs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("resource_type", sa.String(50), nullable=False),
        sa.Column("resource_id", UUID(as_uuid=True), nullable=True),
        sa.Column("property_id", UUID(as_uuid=True), nullable=True),
        sa.Column("metadata", JSONB(), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("ip_address", INET(), nullable=True),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column(
            "timestamp",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    op.create_index(
        "ix_audit_logs_property_time",
        "audit_logs",
        ["property_id", sa.text("timestamp DESC")],
        postgresql_using="btree",
    )

    op.create_index(
        "ix_audit_logs_user_time",
        "audit_logs",
        ["user_id", sa.text("timestamp DESC")],
        postgresql_using="btree",
    )


def downgrade() -> None:
    """Drop tables in reverse dependency order."""
    op.drop_index("ix_audit_logs_user_time", table_name="audit_logs")
    op.drop_index("ix_audit_logs_property_time", table_name="audit_logs")
    op.drop_table("audit_logs")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
