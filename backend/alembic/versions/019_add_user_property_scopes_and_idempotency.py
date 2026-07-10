"""Add user_property_scopes, idempotency_keys, and property_role enum.

Revision ID: 019
Revises: 018
Create Date: 2026-07-10

Implements the Auth module redesign (anti-pattern #5 and #1 fixes):
  - ``property_role`` native enum (owner / admin / staff)
  - ``user_property_scopes`` join table (user_id, property_id, role)
  - ``idempotency_keys`` cache table for ``/register`` and ``/invite``

References:
    - docs/API.md "Proposed Redesign — Auth Module"
    - REVIEW-2026-07-10-api-anti-pattern-audit.md §4.1, #1
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, ENUM as PgEnum

# revision identifiers, used by Alembic.
revision: str = "019"
down_revision: Union[str, None] = "018"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Native enum for per-property roles
    sa.Enum("owner", "admin", "staff", name="property_role").create(op.get_bind(), checkfirst=True)

    # 2. user_property_scopes join table
    op.create_table(
        "user_property_scopes",
        sa.Column(
            "user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
            nullable=False,
        ),
        sa.Column(
            "property_id",
            UUID(as_uuid=True),
            sa.ForeignKey("properties.id", ondelete="CASCADE"),
            primary_key=True,
            nullable=False,
        ),
        sa.Column(
            "role",
            PgEnum("owner", "admin", "staff", name="property_role", native_enum=True),
            nullable=False,
            server_default="staff",
        ),
    )
    op.create_index(
        "ix_user_property_scopes_property_id",
        "user_property_scopes",
        ["property_id"],
    )

    # 3. idempotency_keys cache table
    op.create_table(
        "idempotency_keys",
        sa.Column("key", sa.String(255), primary_key=True, nullable=False),
        sa.Column("request_hash", sa.String(64), nullable=False),
        sa.Column("response_body", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_idempotency_keys_expires_at",
        "idempotency_keys",
        ["expires_at"],
    )

    # 4. current_refresh_jti column on users (refresh-token rotation)
    op.add_column(
        "users",
        sa.Column("current_refresh_jti", sa.String(64), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "current_refresh_jti")
    op.drop_index("ix_idempotency_keys_expires_at", table_name="idempotency_keys")
    op.drop_table("idempotency_keys")
    op.drop_index("ix_user_property_scopes_property_id", table_name="user_property_scopes")
    op.drop_table("user_property_scopes")
    sa.Enum(name="property_role").drop(op.get_bind(), checkfirst=True)
