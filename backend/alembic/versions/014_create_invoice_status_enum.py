"""Create invoice_status_enum type and fix invoice status column.

Revision ID: 014
Revises: 012
Create Date: 2026-07-03

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision: str = "014"
down_revision: Union[str, None] = "012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create the enum type
    invoice_status_enum = sa.Enum(
        'draft', 'issued', 'paid', 'partial', 'overdue', 'cancelled',
        name='invoice_status_enum',
        create_type=True
    )
    invoice_status_enum.create(op.get_bind(), checkfirst=True)
    
    # Step 1: Drop default constraint
    op.alter_column('invoices', 'status',
                    existing_type=sa.String(20),
                    server_default=None,
                    existing_nullable=False)
    
    # Step 2: Change column type to enum
    op.alter_column('invoices', 'status',
                    type_=invoice_status_enum,
                    postgresql_using="status::invoice_status_enum",
                    existing_nullable=False)
    
    # Step 3: Re-add default with proper enum cast
    op.alter_column('invoices', 'status',
                    server_default=sa.text("'draft'::invoice_status_enum"))


def downgrade() -> None:
    # Step 1: Drop default
    op.alter_column('invoices', 'status',
                    server_default=None,
                    existing_nullable=False)
    
    # Step 2: Revert to string
    op.alter_column('invoices', 'status',
                    type_=sa.String(20),
                    postgresql_using="status::text",
                    existing_nullable=False)
    
    # Step 3: Re-add default
    op.alter_column('invoices', 'status',
                    server_default=sa.text("'draft'"))
    
    # Step 4: Drop enum type
    op.execute('DROP TYPE IF EXISTS invoice_status_enum')