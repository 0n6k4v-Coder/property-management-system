"""Add SLA fields and request_number to maintenance_requests

Revision ID: 020
Revises: 019
Create Date: 2026-07-29 10:55:00.000000

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '020'
down_revision = '019'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add SLA fields and request_number to maintenance_requests
    op.add_column('maintenance_requests',
        sa.Column('sla_response_due', sa.DateTime(timezone=True), nullable=True))
    op.add_column('maintenance_requests',
        sa.Column('sla_resolution_due', sa.DateTime(timezone=True), nullable=True))
    op.add_column('maintenance_requests',
        sa.Column('request_number', sa.String(50), nullable=True))

    # Make request_number unique and not null for existing rows
    # First update existing rows with a generated request_number
    op.execute("""
        UPDATE maintenance_requests
        SET request_number = 'REQ-' || substr(md5(random()::text || clock_timestamp()::text)::text, 1, 8)
        WHERE request_number IS NULL
    """)

    # Now make it not null and add unique constraint
    op.alter_column('maintenance_requests', 'request_number', nullable=False)
    op.create_unique_constraint('uq_maintenance_requests_request_number', 'maintenance_requests', ['request_number'])


def downgrade() -> None:
    op.drop_constraint('uq_maintenance_requests_request_number', 'maintenance_requests', type_='unique')
    op.drop_column('maintenance_requests', 'request_number')
    op.drop_column('maintenance_requests', 'sla_resolution_due')
    op.drop_column('maintenance_requests', 'sla_response_due')
