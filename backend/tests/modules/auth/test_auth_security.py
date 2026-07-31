"""Unit tests for the Auth module redesign fixes (anti-patterns #1, #3, #5, #7, #11).

All database access is mocked — these tests validate the security/contract
logic in isolation: property-scope enforcement, idempotency replay, refresh
token rotation + full token set, and the unified validation error envelope.

References:
    - CODE_STYLE.md §7.2: Unit-test pattern (AsyncMock, no real Postgres)
    - docs/API.md "Proposed Redesign — Auth Module"
"""

import uuid
from unittest.mock import AsyncMock

import pytest
from fastapi import status

from app.modules.auth.constants import AUTH_005
from app.shared.deps import require_property_scope
from app.shared.exceptions import APIError
from app.shared.idempotency import check_idempotency, store_idempotency


class _FakeRequest:
    """Minimal stand-in for a FastAPI ``Request`` with a JSON body."""

    def __init__(self, body: dict) -> None:
        self._body = body

    async def json(self) -> dict:
        return self._body


class _ScopeRow:
    """Lightweight stand-in for a ``user_property_scopes`` row."""

    def __init__(self, property_id: uuid.UUID) -> None:
        self.user_id = uuid.uuid4()
        self.property_id = property_id
        self.role = "staff"


def _make_scope_row(property_id: uuid.UUID) -> _ScopeRow:
    return _ScopeRow(property_id)


class _IdemRow:
    """Lightweight stand-in for an ``idempotency_keys`` row.

    Mirrors the attributes ``check_idempotency`` reads off the ORM row so
    the unit test can stub a persisted record without constructing a real
    (instrumented) ``IdempotencyKey`` instance.
    """

    def __init__(self, *, key: str, request_hash: str, response_body: str) -> None:
        self.key = key
        self.request_hash = request_hash
        self.response_body = response_body


@pytest.mark.unit
class TestRequirePropertyScope:
    """``require_property_scope()`` dependency (anti-pattern #5 fix)."""

    async def test_owner_bypasses_scope_check(self) -> None:
        """A global owner/admin is allowed regardless of scope rows."""
        dep = require_property_scope()
        enforce = dep.dependency  # type: ignore[attr-defined]

        current_user = {"user_id": str(uuid.uuid4()), "is_owner": True}
        request = _FakeRequest({"property_id": str(uuid.uuid4())})

        # Should not raise.
        await enforce(current_user, request, AsyncMock())

    async def test_staff_with_scope_row_passes(self) -> None:
        """A staff user holding the property's scope row is allowed."""
        dep = require_property_scope()
        enforce = dep.dependency  # type: ignore[attr-defined]

        property_id = uuid.uuid4()
        user_id = uuid.uuid4()
        current_user = {"user_id": str(user_id), "is_owner": False, "is_superuser": False}
        request = _FakeRequest({"property_id": str(property_id)})

        from app.modules.auth.repository import UserRepository

        fake_repo = AsyncMock()
        fake_repo.get_property_scopes.return_value = [_make_scope_row(property_id)]
        with pytest.MonkeyPatch().context() as mp:
            mp.setattr(UserRepository, "get_property_scopes", fake_repo.get_property_scopes)
            await enforce(current_user, request, AsyncMock())

    async def test_staff_without_scope_row_denied(self) -> None:
        """A staff user with no scope row for the property gets AUTH-005 (403)."""
        dep = require_property_scope()
        enforce = dep.dependency  # type: ignore[attr-defined]

        property_id = uuid.uuid4()
        user_id = uuid.uuid4()
        current_user = {"user_id": str(user_id), "is_owner": False, "is_superuser": False}
        request = _FakeRequest({"property_id": str(property_id)})

        from app.modules.auth.repository import UserRepository

        fake_repo = AsyncMock()
        fake_repo.get_property_scopes.return_value = []  # no scope
        with pytest.MonkeyPatch().context() as mp:
            mp.setattr(UserRepository, "get_property_scopes", fake_repo.get_property_scopes)
            with pytest.raises(APIError) as exc:
                await enforce(current_user, request, AsyncMock())

        assert exc.value.code == "AUTH-005"
        assert exc.value.status_code == status.HTTP_403_FORBIDDEN
        assert exc.value.message == AUTH_005


@pytest.mark.unit
class TestIdempotency:
    """``Idempotency-Key`` replay (anti-pattern #1 fix)."""

    async def test_check_returns_none_when_no_record(self) -> None:
        """No stored record → caller should proceed with the handler."""
        from app.modules.auth.repository import UserRepository

        fake_repo = AsyncMock()
        fake_repo.get_idempotency.return_value = None
        with pytest.MonkeyPatch().context() as mp:
            mp.setattr(UserRepository, "get_idempotency", fake_repo.get_idempotency)
            result = await check_idempotency(
                AsyncMock(), "key-1", "POST:/x", {"a": 1}
            )
        assert result is None

    async def test_check_replays_stored_body_on_repeat(self) -> None:
        """Same key + same body → returns the cached response verbatim."""
        import datetime as _dt

        from app.modules.auth.repository import UserRepository
        from app.shared.idempotency import _hash_request

        stored_body = '{"data": {"id": "1", "email": "x@e.com"}}'
        # Build a plain stand-in row (no real DB session needed) and set its
        # request_hash to the hash of the body we will replay.
        record = _IdemRow(
            key="key-1",
            request_hash=_hash_request("POST:/x", {"a": 1}),
            response_body=stored_body,
        )
        _ = _dt  # keep import for parity with other tests; unused here

        fake_repo = AsyncMock()
        fake_repo.get_idempotency.return_value = record
        with pytest.MonkeyPatch().context() as mp:
            mp.setattr(UserRepository, "get_idempotency", fake_repo.get_idempotency)

            # Mismatched body → VAL-409 (body hash guard).
            with pytest.raises(APIError) as exc:
                await check_idempotency(AsyncMock(), "key-1", "POST:/x", {"a": 999})
            assert exc.value.code == "VAL-409"

            # Matching body → replay the stored response verbatim.
            replayed = await check_idempotency(
                AsyncMock(), "key-1", "POST:/x", {"a": 1}
            )
        assert replayed == {"data": {"id": "1", "email": "x@e.com"}}

    async def test_store_persists_response(self) -> None:
        """``store_idempotency`` writes the response via the repository."""
        import datetime as _dt

        from app.modules.auth.repository import UserRepository

        fake_repo = AsyncMock()
        fake_repo.save_idempotency = AsyncMock()
        with pytest.MonkeyPatch().context() as mp:
            mp.setattr(UserRepository, "save_idempotency", fake_repo.save_idempotency)
            await store_idempotency(
                AsyncMock(),
                "key-2",
                "POST:/x",
                {"a": 1},
                {"data": {"ok": True}},
                UserRepository,
            )
        assert fake_repo.save_idempotency.await_count == 1
        # Verify persisted payload: key carried, expiry is a future
        # timezone-aware datetime, and response_body is JSON-encoded.
        _, kwargs = fake_repo.save_idempotency.call_args
        assert kwargs["key"] == "key-2"
        assert kwargs["expires_at"] > _dt.datetime.now(_dt.UTC)
        assert kwargs["response_body"] == '{"data": {"ok": true}}'


@pytest.mark.unit
class TestRefreshFullTokenSet:
    """``/refresh`` returns full ``TokenResponse`` (anti-patterns #7, #11)."""

    async def test_refresh_returns_user_with_real_scopes(self) -> None:
        """Refresh output carries ``user`` with real ``property_scopes``."""
        from app.modules.auth.models import User
        from app.modules.auth.services.auth_service import AuthService
        from app.shared.security import hash_password

        user_id = uuid.uuid4()
        property_id = uuid.uuid4()
        user = User(
            id=user_id,
            email="refresh@example.com",
            password_hash=hash_password("RefreshPass1"),
            full_name="Refresh",
            phone="0888888888",
            is_active=True,
        )
        service = AuthService.__new__(AuthService)
        service._repo = AsyncMock()
        service._db = AsyncMock()
        # refresh_access_token() reads the user back via get_by_id; return the
        # same in-memory user (its current_refresh_jti is set by the
        # set_current_refresh_jti side effect below) so the rotation guard
        # (AUTH-008) matches the presented jti.
        service._repo.get_by_id.return_value = user
        # Make the claim reflect a real scope row.
        service._repo.get_property_scopes.return_value = [_make_scope_row(property_id)]
        # Mirror refresh-token rotation on the in-memory user so the
        # rotation guard (AUTH-008) accepts the presented token.
        async def _persist_jti(uid, jti):
            user.current_refresh_jti = jti

        service._repo.set_current_refresh_jti.side_effect = _persist_jti

        tokens = await service.generate_tokens(user)
        result = await service.refresh_access_token(tokens["refresh"])

        assert "access" in result and "refresh" in result
        assert result["user"]["property_scopes"] == [str(property_id)]


@pytest.mark.unit
class TestValidationErrorEnvelope:
    """Unified ``{"error": {...}}`` envelope for 422 (anti-pattern #3)."""

    async def test_invalid_login_body_returns_val_001_envelope(self, async_client) -> None:
        """A 422 returns ``{"error": {"code": "VAL-001"}}`` not ``{"detail"}``."""
        response = await async_client.post(
            "/api/v1/auth/login",
            json={"email": "not-an-email", "password": "weak"},
        )
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
        body = response.json()
        assert "error" in body
        assert body["error"]["code"] == "VAL-001"
        assert "detail" not in body
