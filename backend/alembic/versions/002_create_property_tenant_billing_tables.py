"""Create property, tenant & billing tables for Sprint 2.

Tables created
--------------
- ``properties`` — Property aggregate (SDD §4.1.1, §4.2)
- ``buildings`` — Building within a Property
- ``floors`` — Floor within a Building
- ``rooms`` — Rentable room (SDD §6 state machine)
- ``tenants`` — Tenant with encrypted ID card (SDD §2.4)

Note:
- Billing tables (meter_readings, utility_rates, invoices) are created
  in migration 003 to avoid duplicate table creation.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "002"
down_revision: str | None = "001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # properties table (SDD §4.1.1)
    # ------------------------------------------------------------------
    op.create_table(
        "properties",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("address", sa.Text(), nullable=False),
        sa.Column("billing_due_day", sa.Integer(), nullable=False),
        sa.Column("min_deposit_months", sa.Integer(), nullable=False, server_default=sa.text("2")),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # ------------------------------------------------------------------
    # buildings table
    # ------------------------------------------------------------------
    op.create_table(
        "buildings",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("property_id", UUID(as_uuid=True), sa.ForeignKey("properties.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("display_order", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("description", sa.Text(), nullable=True),
    )
    op.create_index("ix_buildings_property_id", "buildings", ["property_id"])
    op.create_index("ix_buildings_property_order", "buildings", ["property_id", "display_order"])

    # ------------------------------------------------------------------
    # floors table
    # ------------------------------------------------------------------
    op.create_table(
        "floors",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("building_id", UUID(as_uuid=True), sa.ForeignKey("buildings.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("display_order", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("description", sa.Text(), nullable=True),
    )
    op.create_index("ix_floors_building_id", "floors", ["building_id"])
    op.create_index("ix_floors_building_order", "floors", ["building_id", "display_order"])

    # ------------------------------------------------------------------
    # rooms table (SDD §4.1.1, §6 — status state machine)
    # ------------------------------------------------------------------
    op.create_table(
        "rooms",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("property_id", UUID(as_uuid=True), sa.ForeignKey("properties.id", ondelete="CASCADE"), nullable=False),
        sa.Column("building_id", UUID(as_uuid=True), sa.ForeignKey("buildings.id", ondelete="CASCADE"), nullable=False),
        sa.Column("floor_id", UUID(as_uuid=True), sa.ForeignKey("floors.id", ondelete="SET NULL"), nullable=True),
        sa.Column("room_number", sa.String(20), nullable=False),
        sa.Column("room_type", sa.String(50), nullable=False, server_default=sa.text("'studio'")),
        sa.Column("base_rent", sa.Numeric(10, 2), nullable=False, server_default=sa.text("0.00")),
        sa.Column("status", sa.String(20), nullable=False, server_default=sa.text("'available'")),
        sa.Column("images", JSONB(), nullable=True),
    )
    op.create_index("ix_rooms_property_status", "rooms", ["property_id", "status"])
    op.create_index(
        "ix_rooms_number_unique_per_building",
        "rooms",
        ["building_id", "room_number"],
        unique=True,
    )

    # ------------------------------------------------------------------
    # tenants table (SDD §2.4 — encrypted ID card)
    # ------------------------------------------------------------------
    op.create_table(
        "tenants",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("property_id", UUID(as_uuid=True), sa.ForeignKey("properties.id", ondelete="CASCADE"), nullable=False),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("id_card_number_encrypted", sa.String(500), nullable=False),
        sa.Column("phone", sa.String(20), nullable=False),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("emergency_contact_name", sa.String(255), nullable=True),
        sa.Column("emergency_contact_phone", sa.String(20), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_tenants_property_phone_unique", "tenants", ["property_id", "phone"], unique=True)
    op.create_index("ix_tenants_phone", "tenants", ["phone"])
    op.create_index("ix_tenants_property", "tenants", ["property_id", "full_name"])


def downgrade() -> None:
    """Drop tables in reverse dependency order."""
    op.drop_index("ix_tenants_property", table_name="tenants")
    op.drop_index("ix_tenants_phone", table_name="tenants")
    op.drop_index("ix_tenants_property_phone_unique", table_name="tenants")
    op.drop_table("tenants")
    op.drop_index("ix_rooms_number_unique_per_building", table_name="rooms")
    op.drop_index("ix_rooms_property_status", table_name="rooms")
    op.drop_table("rooms")
    op.drop_index("ix_floors_building_order", table_name="floors")
    op.drop_index("ix_floors_building_id", table_name="floors")
    op.drop_table("floors")
    op.drop_index("ix_buildings_property_order", table_name="buildings")
    op.drop_index("ix_buildings_property_id", table_name="buildings")
    op.drop_table("buildings")
    op.drop_table("properties")
