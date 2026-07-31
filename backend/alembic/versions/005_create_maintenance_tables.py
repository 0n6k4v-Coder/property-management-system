"""005_create_maintenance_tables

Revision ID: 005
Revises: 004
Create Date: 2026-05-28 00:00:00.000000

Sprint 5 — Maintenance & Ops Module:
    - maintenance_requests (MaintenanceRequest, BR-08/BR-09)

References:
    - SDD.md §4.2: Physical Schema
    - BR-08: Request tied to room + user (audit)
    - BR-09: Status workflow validation
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "005"
down_revision: str | None = "004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "maintenance_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("property_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("properties.id", ondelete="CASCADE"), nullable=False),
        sa.Column("room_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("rooms.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("priority", sa.String(20), nullable=False, server_default="medium"),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending", index=True),
        sa.Column("assigned_to", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_index(
        "ix_maintenance_requests_property_status",
        "maintenance_requests",
        ["property_id", "status"],
    )
    op.create_index(
        "ix_maintenance_requests_created_at_desc",
        "maintenance_requests",
        [sa.text("created_at DESC")],
    )


def downgrade() -> None:
    op.drop_index("ix_maintenance_requests_created_at_desc", table_name="maintenance_requests")
    op.drop_index("ix_maintenance_requests_property_status", table_name="maintenance_requests")
    op.drop_table("maintenance_requests")
