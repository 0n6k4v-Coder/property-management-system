"""Create billing tables for Sprint 3: MeterReading, UtilityRate, Invoice,
InvoiceLineItem, Payment.

Tables created
--------------
- ``meter_readings`` — Electric/water meter records (SDD §4.1.1, BR-07)
- ``utility_rates`` — Polymorphic rate config (BR-10 cascade)
- ``invoices`` — Monthly invoices (SDD §6 state machine)
- ``invoice_line_items`` — Individual charges per invoice (BR-12)
- ``payments`` — Payment records against invoices

Revision ID: 003
Revises: 002
Create Date: 2026-05-27
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # meter_readings table (SDD §4.1.1, BR-07)
    # ------------------------------------------------------------------
    op.create_table(
        "meter_readings",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("room_id", UUID(as_uuid=True), sa.ForeignKey("rooms.id", ondelete="CASCADE"), nullable=False),
        sa.Column("billing_month", sa.Integer(), nullable=False),
        sa.Column("billing_year", sa.Integer(), nullable=False),
        sa.Column("electric_previous", sa.Numeric(10, 2), nullable=False, server_default=sa.text("0")),
        sa.Column("electric_current", sa.Numeric(10, 2), nullable=False),
        sa.Column("electric_used", sa.Numeric(10, 2), nullable=False, server_default=sa.text("0")),
        sa.Column("water_previous", sa.Numeric(10, 2), nullable=False, server_default=sa.text("0")),
        sa.Column("water_current", sa.Numeric(10, 2), nullable=False),
        sa.Column("water_used", sa.Numeric(10, 2), nullable=False, server_default=sa.text("0")),
        sa.Column("read_date", sa.Date(), nullable=False, server_default=sa.func.current_date()),
        sa.Column("recorded_by", UUID(as_uuid=True), nullable=False),
    )
    op.create_index(
        "ix_meter_readings_unique_per_room_month",
        "meter_readings",
        ["room_id", "billing_year", "billing_month"],
        unique=True,
    )
    op.create_index("ix_meter_readings_room_date", "meter_readings", ["room_id", "read_date"])

    # ------------------------------------------------------------------
    # utility_rates table (BR-10 cascade)
    # ------------------------------------------------------------------
    op.create_table(
        "utility_rates",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("scope_type", sa.String(50), nullable=False, index=True),
        sa.Column("scope_id", UUID(as_uuid=True), nullable=False),
        sa.Column("electric_rate_per_unit", sa.Numeric(10, 2), nullable=False),
        sa.Column("water_rate_per_unit", sa.Numeric(10, 2), nullable=False),
        sa.Column("common_fee", sa.Numeric(10, 2), nullable=False, server_default=sa.text("0.00")),
        sa.Column("effective_from", sa.Date(), nullable=False),
        sa.Column("effective_to", sa.Date(), nullable=True),
        sa.Column("created_by", UUID(as_uuid=True), nullable=False),
    )
    op.create_index(
        "ix_utility_rates_scope_period",
        "utility_rates",
        ["scope_type", "scope_id", sa.text("effective_from DESC")],
    )

    # ------------------------------------------------------------------
    # invoices table (SDD §4.1.1, §6 state machine)
    # ------------------------------------------------------------------
    op.create_table(
        "invoices",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("invoice_number", sa.String(50), nullable=False),
        sa.Column("contract_id", UUID(as_uuid=True), nullable=False),
        sa.Column("room_id", UUID(as_uuid=True), sa.ForeignKey("rooms.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tenant_id", UUID(as_uuid=True), nullable=False),
        sa.Column("property_id", UUID(as_uuid=True), nullable=False),
        sa.Column("billing_month", sa.Integer(), nullable=False),
        sa.Column("billing_year", sa.Integer(), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default=sa.text("'draft'")),
        sa.Column("total_amount", sa.Numeric(12, 2), nullable=False, server_default=sa.text("0.00")),
        sa.Column("paid_amount", sa.Numeric(12, 2), nullable=False, server_default=sa.text("0.00")),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by", UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_invoices_room_month", "invoices", ["room_id", "billing_year", "billing_month"])
    op.create_index("ix_invoices_status_prop", "invoices", ["property_id", "status"])

    # ------------------------------------------------------------------
    # invoice_line_items table (SDD §4.1.1, BR-12)
    # ------------------------------------------------------------------
    op.create_table(
        "invoice_line_items",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("invoice_id", UUID(as_uuid=True), sa.ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False),
        sa.Column("line_type", sa.String(50), nullable=False),
        sa.Column("description", sa.String(255), nullable=False),
        sa.Column("quantity", sa.Numeric(10, 2), nullable=False, server_default=sa.text("1.00")),
        sa.Column("unit_price", sa.Numeric(10, 2), nullable=False, server_default=sa.text("0.00")),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False, server_default=sa.text("0.00")),
    )
    op.create_index("ix_line_items_invoice", "invoice_line_items", ["invoice_id"])

    # ------------------------------------------------------------------
    # payments table (SDD §4.1.1)
    # ------------------------------------------------------------------
    op.create_table(
        "payments",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("invoice_id", UUID(as_uuid=True), sa.ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("payment_date", sa.Date(), nullable=False, server_default=sa.func.current_date()),
        sa.Column("method", sa.String(50), nullable=False),
        sa.Column("reference_number", sa.String(100), nullable=True),
        sa.Column("slip_image_url", sa.String(500), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("recorded_by", UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_payments_invoice", "payments", ["invoice_id"])


def downgrade() -> None:
    """Drop tables in reverse dependency order."""
    op.drop_index("ix_payments_invoice", table_name="payments")
    op.drop_table("payments")
    op.drop_index("ix_line_items_invoice", table_name="invoice_line_items")
    op.drop_table("invoice_line_items")
    op.drop_index("ix_invoices_status_prop", table_name="invoices")
    op.drop_index("ix_invoices_room_month", table_name="invoices")
    op.drop_table("invoices")
    op.drop_index("ix_utility_rates_scope_period", table_name="utility_rates")
    op.drop_table("utility_rates")
    op.drop_index("ix_meter_readings_room_date", table_name="meter_readings")
    op.drop_index("ix_meter_readings_unique_per_room_month", table_name="meter_readings")
    op.drop_table("meter_readings")