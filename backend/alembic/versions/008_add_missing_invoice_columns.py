"""Add missing columns to invoices table.

Revision ID: 008
Revises: 007
Create Date: 2026-07-02

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "008"
down_revision: str | None = "007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Add missing columns to invoices table
    op.add_column(
        "invoices",
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.add_column(
        "invoices",
        sa.Column("issued_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "invoices",
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("invoices", "updated_at")
    op.drop_column("invoices", "issued_at")
    op.drop_column("invoices", "paid_at")
