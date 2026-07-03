"""Make recorded_by nullable in meter_readings table.

Revision ID: 011
Revises: 009
Create Date: 2026-07-02

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision: str = "011"
down_revision: Union[str, None] = "009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("meter_readings", "recorded_by", nullable=True)


def downgrade() -> None:
    op.alter_column("meter_readings", "recorded_by", nullable=False)