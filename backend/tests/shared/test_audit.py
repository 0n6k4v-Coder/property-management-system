"""Unit tests for shared/audit.py — audit logging (SDD §7.4).

Tests verify that the audit model works correctly, that the
``log_audit()`` helper creates proper records, that sensitive fields are
sanitised, and that the function is fail-silent when the database raises.

References:
    - CODE_STYLE.md §7.2: Unit-test pattern
    - SDD.md §7.4: Audit logging specification
    - SDD.md §7.4.2: Fail-silent requirement
    - SDD.md §7.4.3: Sensitive-field stripping
"""

import uuid
from unittest.mock import AsyncMock

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.shared.audit import AuditLog, _sanitize_metadata, log_audit


@pytest.mark.unit
class TestSanitizeMetadata:
    """Tests for ``_sanitize_metadata()`` — SDD §7.4.3."""

    def test_strips_password(self) -> None:
        """Metadata with ``password`` key → output excludes it."""
        raw = {"password": "secret123", "email": "user@test.com"}
        clean = _sanitize_metadata(raw)
        assert "password" not in clean
        assert clean["email"] == "user@test.com"

    def test_strips_token(self) -> None:
        """Metadata with ``access_token`` or ``refresh_token`` → excluded."""
        raw = {"access_token": "jwt...", "refresh_token": "jwt...", "action": "login"}
        clean = _sanitize_metadata(raw)
        assert "access_token" not in clean
        assert "refresh_token" not in clean
        assert clean["action"] == "login"

    def test_strips_id_card(self) -> None:
        """Metadata with ``id_card_number`` → excluded."""
        raw = {"id_card_number": "1234567890123", "name": "Alice"}
        clean = _sanitize_metadata(raw)
        assert "id_card_number" not in clean
        assert clean["name"] == "Alice"

    def test_handles_none(self) -> None:
        """``None`` input → returns empty dict."""
        assert _sanitize_metadata(None) == {}

    def test_case_insensitive(self) -> None:
        """``Password`` (capital P) is also stripped."""
        raw = {"Password": "secret"}
        clean = _sanitize_metadata(raw)
        assert "Password" not in clean


@pytest.mark.unit
class TestLogAudit:
    """Tests for ``log_audit()`` — SDD §7.4."""

    async def test_log_audit_success(self) -> None:
        """Valid parameters → insert succeeds, returns AuditLog with ``id``."""
        mock_session = AsyncMock(spec=AsyncSession)

        record = await log_audit(
            db=mock_session,
            user_id=uuid.uuid4(),
            action="user.logged_in",
            resource_type="user",
            resource_id=uuid.uuid4(),
            metadata={"ip": "127.0.0.1"},
        )

        assert isinstance(record, AuditLog)
        # The record should be a new AuditLog instance
        assert record.action == "user.logged_in"
        mock_session.add.assert_called_once()
        mock_session.flush.assert_awaited_once()

    async def test_log_audit_fail_silent(self) -> None:
        """DB error during flush → no exception raised, returns record."""
        mock_session = AsyncMock(spec=AsyncSession)
        # Simulate a database error on flush
        from sqlalchemy.exc import SQLAlchemyError

        mock_session.flush.side_effect = SQLAlchemyError("connection lost")

        # Must NOT raise — fail-silent per SDD §7.4.2
        record = await log_audit(
            db=mock_session,
            user_id=uuid.uuid4(),
            action="user.login_failed",
            resource_type="user",
            resource_id=uuid.uuid4(),
        )

        assert isinstance(record, AuditLog)
        mock_session.rollback.assert_awaited_once()

    async def test_log_audit_sanitizes_metadata(self) -> None:
        """Sensitive keys in metadata are stripped before persisting."""
        mock_session = AsyncMock(spec=AsyncSession)

        record = await log_audit(
            db=mock_session,
            user_id=uuid.uuid4(),
            action="user.registered",
            resource_type="user",
            metadata={"password": "should-not-appear", "email": "user@test.com"},
        )

        # Verify the AuditLog's metadata_ doesn't contain the password
        # (We can check this by inspecting the AuditLog instance directly)
        assert "password" not in record.metadata_
        assert record.metadata_["email"] == "user@test.com"

    async def test_log_audit_minimal_params(self) -> None:
        """Only required params → insert succeeds."""
        mock_session = AsyncMock(spec=AsyncSession)

        record = await log_audit(
            db=mock_session,
            user_id=None,
            action="system.startup",
            resource_type="system",
        )

        assert isinstance(record, AuditLog)
        assert record.action == "system.startup"
        assert record.resource_type == "system"
        mock_session.add.assert_called_once()