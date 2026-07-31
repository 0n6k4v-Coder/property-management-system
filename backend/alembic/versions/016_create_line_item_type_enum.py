"""Create line_item_type_enum type and fix invoice_line_items line_type column.

Revision ID: 016
Revises: 015
Create Date: 2026-07-03

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "016"
down_revision: str | None = "015"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Create the enum type
    line_item_type_enum = sa.Enum(
        'rent', 'electric', 'water', 'common_fee', 'deposit', 'penalty', 'discount', 'other',
        name='line_item_type_enum',
        create_type=True
    )
    line_item_type_enum.create(op.get_bind(), checkfirst=True)

    # Change line_type column to use the enum type
    op.alter_column('invoice_line_items', 'line_type',
                    existing_type=sa.String(50),
                    server_default=None,
                    existing_nullable=False)
    op.alter_column('invoice_line_items', 'line_type',
                    type_=line_item_type_enum,
                    postgresql_using="line_type::line_item_type_enum",
                    existing_nullable=False)
    op.alter_column('invoice_line_items', 'line_type',
                    server_default=sa.text("'rent'::line_item_type_enum"))


def downgrade() -> None:
    # Revert line_type column back to string
    op.alter_column('invoice_line_items', 'line_type',
                    server_default=None,
                    existing_nullable=False)
    op.alter_column('invoice_line_items', 'line_type',
                    type_=sa.String(50),
                    postgresql_using="line_type::text",
                    existing_nullable=False)
    op.alter_column('invoice_line_items', 'line_type',
                    server_default=sa.text("'rent'"))

    # Drop the enum type
    op.execute('DROP TYPE IF EXISTS line_item_type_enum')
