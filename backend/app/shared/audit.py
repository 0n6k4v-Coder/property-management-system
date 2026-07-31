"""Audit logging — Async SQLAlchemy 2.0 model + helper function (SDD §4.1.1, §4.2, §7.4)."""

import contextlib
import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, func, text
from sqlalchemy.dialects.postgresql import INET, JSONB, UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.database import Base


class AuditLog(Base):
    """Immutable audit trail for all domain operations (SDD §7.4).

    Every row records a single domain event with actor, resource, and context.
    This table is INSERT-only — no UPDATE or DELETE (audit integrity).
    """

    __tablename__ = "audit_logs"

    __table_args__ = (
        Index("ix_audit_logs_property_time", "property_id", text("timestamp DESC")),
        Index("ix_audit_logs_user_time", "user_id", text("timestamp DESC")),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    resource_type: Mapped[str] = mapped_column(String(50), nullable=False)
    resource_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    property_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("properties.id", ondelete="CASCADE"),
        nullable=True,
    )
    metadata_: Mapped[dict[str, Any]] = mapped_column(
        "metadata", JSONB, nullable=False, default=dict
    )
    ip_address: Mapped[str | None] = mapped_column(INET, nullable=True)
    user_agent: Mapped[str | None] = mapped_column(Text, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


# ---- Sensitive-field patterns that must NEVER appear in audit metadata ----
_SENSITIVE_KEYS = frozenset({
    "password",
    "password_hash",
    "secret",
    "token",
    "access_token",
    "refresh_token",
    "id_card",
    "id_card_number",
    "card_number",
    "bank_account",
    "cvv",
    "pin",
})


def _sanitize_metadata(raw: dict[str, Any] | None) -> dict[str, Any]:
    """Strip sensitive keys before persisting to audit log (SDD §7.4.3).

    Also converts Decimal values to JSON-serializable types (float for Decimal).
    """
    if not raw:
        return {}
    result: dict[str, Any] = {}
    for k, v in raw.items():
        if k.lower() in _SENSITIVE_KEYS:
            continue
        # Convert Decimal to float for JSON serialization
        if isinstance(v, Decimal):
            result[k] = float(v)
        elif isinstance(v, dict):
            result[k] = _sanitize_metadata(v)
        elif isinstance(v, list):
            result[k] = [
                float(item) if isinstance(item, Decimal) else item
                for item in v
            ]
        else:
            result[k] = v
    return result


async def log_audit(
    db: AsyncSession,
    user_id: uuid.UUID | None,
    action: str,
    resource_type: str,
    resource_id: uuid.UUID | None = None,
    property_id: uuid.UUID | None = None,
    metadata: dict[str, Any] | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> AuditLog:
    """Record an audit event asynchronously (SDD §7.4).

    Inserts a single row into ``audit_logs``.  Failures are silently caught
    so that an audit write never interrupts the primary business flow.

    Parameters
    ----------
    db
        Active async database session (from FastAPI dependency injection).
    user_id
        UUID of the acting user, or ``None`` for system / anonymous actions.
    action
        Machine-readable action code, e.g. ``"user.logged_in"``.
    resource_type
        Domain resource kind, e.g. ``"tenant"``, ``"invoice"``.
    resource_id
        UUID of the affected resource (optional).
    property_id
        UUID of the property scope for multi-tenancy filtering (optional).
    metadata
        Free-form key-value payload stored as JSONB.  Sensitive fields
        (passwords, tokens, ID card numbers, …) are automatically stripped.
    ip_address
        Client IP address (IPv4 or IPv6) from the request.
    user_agent
        ``User-Agent`` header value from the request.

    Returns
    -------
    AuditLog
        The ORM instance added to the session (not flushed - caller owns commit).
    """
    record = AuditLog(
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        property_id=property_id,
        metadata_=_sanitize_metadata(metadata),
        ip_address=ip_address,
        user_agent=user_agent,
    )
    # Add to session but DO NOT flush - let caller's transaction handle commit/rollback
    # This avoids PendingRollbackError from nested savepoints
    # Fail-silent: catch any exception so audit never interrupts business flow (SDD §7.4.2)
    with contextlib.suppress(Exception):
        db.add(record)
    return record
