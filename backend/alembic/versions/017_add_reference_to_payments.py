"""Add reference column to payments table.

Revision ID: 017
Revises: 016
Create Date: 2026-07-03

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "017"
down_revision: str | None = "016"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "payments",
        sa.Column("reference", sa.String(100), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("payments", "reference")
