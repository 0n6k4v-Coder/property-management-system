"""Make recorded_by nullable in meter_readings table.

Revision ID: 011
Revises: 009
Create Date: 2026-07-02

"""
from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "011"
down_revision: str | None = "009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column("meter_readings", "recorded_by", nullable=True)


def downgrade() -> None:
    op.alter_column("meter_readings", "recorded_by", nullable=False)
