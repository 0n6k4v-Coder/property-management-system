"""004_create_contract_tables

Revision ID: 004
Revises: 003
Create Date: 2026-05-27 00:00:00.000000

Sprint 4 — Contract & Lease Module:
    - contracts (Contract, BR-01 partial index)
    - lease_extensions (LeaseExtension)
    - contract_terminations (ContractTermination, BR-04)

References:
    - SDD.md §4.2: Physical Schema
    - SDD.md §6.2: Contract Status Machine
    - SDD.md §5.2: Contract Termination
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "004"
down_revision: str | None = "003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ── contracts ────────────────────────────────────────────────────────
    op.create_table(
        "contracts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("room_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("rooms.id", ondelete="RESTRICT"), nullable=False, index=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tenants.id", ondelete="RESTRICT"), nullable=False, index=True),
        sa.Column("property_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("properties.id", ondelete="RESTRICT"), nullable=False, index=True),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("monthly_rent", sa.Numeric(10, 2), nullable=False),
        sa.Column("deposit_amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft", index=True),
        sa.Column("special_conditions", sa.Text(), nullable=True),
        sa.Column("is_renewal", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("renewed_from_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("contracts.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # BR-01 partial unique index: only one active contract per room
    op.create_index(
        "ix_contracts_room_active_unique",
        "contracts",
        ["room_id"],
        unique=True,
        postgresql_where=sa.text("status = 'active'"),
    )
    op.create_index(
        "ix_contracts_property_status",
        "contracts",
        ["property_id", "status"],
    )
    op.create_index(
        "ix_contracts_tenant_status",
        "contracts",
        ["tenant_id", "status"],
    )

    # ── lease_extensions ─────────────────────────────────────────────────
    op.create_table(
        "lease_extensions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("contract_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("contracts.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("previous_end_date", sa.Date(), nullable=False),
        sa.Column("extended_to", sa.Date(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("extended_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # ── contract_terminations ────────────────────────────────────────────
    op.create_table(
        "contract_terminations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("contract_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("contracts.id", ondelete="CASCADE"), nullable=False, unique=True, index=True),
        sa.Column("reason", sa.String(100), nullable=False),
        sa.Column("termination_date", sa.Date(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("terminated_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("contract_terminations")
    op.drop_table("lease_extensions")
    op.drop_index("ix_contracts_tenant_status", table_name="contracts")
    op.drop_index("ix_contracts_property_status", table_name="contracts")
    op.drop_index("ix_contracts_room_active_unique", table_name="contracts")
    op.drop_table("contracts")