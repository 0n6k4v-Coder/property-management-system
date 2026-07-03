"""Add processed_by column to payments table.

Revision ID: 018
Revises: 017
Create Date: 2026-07-03

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision: str = "018"
down_revision: Union[str, None] = "017"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "payments",
        sa.Column("processed_by", UUID(as_uuid=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("payments", "processed_by")