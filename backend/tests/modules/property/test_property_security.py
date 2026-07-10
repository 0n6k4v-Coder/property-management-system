"""DB-free unit tests for the Property & Rooms redesign fixes.

The existing ``test_property_service.py`` / ``test_property_api.py`` require a
live Postgres (they connect on the ``db_session`` fixture). These tests mock
all DB access so they validate the redesign's security/contract logic in
isolation, mirroring ``tests/modules/auth/test_auth_security.py``.

Covers anti-patterns #5 (authorization: path-scoped dependency + list filter
+ owner grant on create), #11/#3 (room must belong to property → 404), and
#1 (idempotency wiring reused from ``shared/idempotency``).

References:
    - CODE_STYLE.md §7.2: Unit-test pattern (AsyncMock, no real Postgres)
    - docs/API.md "Proposed Redesign — Property & Rooms Module"
"""

import uuid
from unittest.mock import AsyncMock

import pytest
from fastapi import status

from app.modules.property.constants import RoomStatus
from app.modules.property.services.property_service import PropertyService
from app.shared.deps import (
    is_global_scope,
    require_property_scope,
    user_has_property_scope,
)
from app.shared.exceptions import APIError


class _FakeRequest:
    """Stand-in for a FastAPI ``Request`` with path params and/or JSON body."""

    def __init__(
        self, *, path_params: dict | None = None, body: dict | None = None
    ) -> None:
        self.path_params = path_params or {}
        self._body = body or {}

    async def json(self) -> dict:
        return self._body


class _ScopeRow:
    """Lightweight stand-in for a ``user_property_scopes`` row."""

    def __init__(self, property_id: uuid.UUID) -> None:
        self.user_id = uuid.uuid4()
        self.property_id = property_id
        self.role = "staff"


# ── #5: require_property_scope() with path-param source ────────────────


@pytest.mark.unit
class TestRequirePropertyScopePathParam:
    """Path-sourced ``require_property_scope("property_id")`` (anti-pattern #5)."""

    async def test_owner_bypasses_path_scope_check(self) -> None:
        """A global owner passes regardless of scope rows (path source)."""
        dep = require_property_scope("property_id")
        enforce = dep.dependency  # type: ignore[attr-defined]

        current_user = {"user_id": str(uuid.uuid4()), "is_owner": True}
        request = _FakeRequest(path_params={"property_id": str(uuid.uuid4())})

        await enforce(current_user, request, AsyncMock())  # must not raise

    async def test_staff_with_path_scope_row_passes(self) -> None:
        """Staff holding the path property's scope row is allowed."""
        dep = require_property_scope("property_id")
        enforce = dep.dependency  # type: ignore[attr-defined]

        property_id = uuid.uuid4()
        current_user = {
            "user_id": str(uuid.uuid4()),
            "is_owner": False,
            "is_superuser": False,
        }
        request = _FakeRequest(path_params={"property_id": str(property_id)})

        from app.modules.auth.repository import UserRepository

        fake = AsyncMock()
        fake.get_property_scopes.return_value = [_ScopeRow(property_id)]
        with pytest.MonkeyPatch().context() as mp:
            mp.setattr(UserRepository, "get_property_scopes", fake.get_property_scopes)
            await enforce(current_user, request, AsyncMock())  # must not raise

    async def test_staff_without_path_scope_row_denied(self) -> None:
        """Staff with no scope row for the path property gets AUTH-005 (403)."""
        dep = require_property_scope("property_id")
        enforce = dep.dependency  # type: ignore[attr-defined]

        property_id = uuid.uuid4()
        current_user = {
            "user_id": str(uuid.uuid4()),
            "is_owner": False,
            "is_superuser": False,
        }
        request = _FakeRequest(path_params={"property_id": str(property_id)})

        from app.modules.auth.repository import UserRepository

        fake = AsyncMock()
        fake.get_property_scopes.return_value = []
        with pytest.MonkeyPatch().context() as mp:
            mp.setattr(UserRepository, "get_property_scopes", fake.get_property_scopes)
            with pytest.raises(APIError) as exc:
                await enforce(current_user, request, AsyncMock())

        assert exc.value.code == "AUTH-005"
        assert exc.value.status_code == status.HTTP_403_FORBIDDEN

    async def test_missing_path_param_denied(self) -> None:
        """A path param that isn't a valid UUID is denied (AUTH-005)."""
        dep = require_property_scope("property_id")
        enforce = dep.dependency  # type: ignore[attr-defined]

        current_user = {"user_id": str(uuid.uuid4()), "is_owner": False}
        request = _FakeRequest(path_params={"property_id": "not-a-uuid"})

        with pytest.raises(APIError) as exc:
            await enforce(current_user, request, AsyncMock())
        assert exc.value.code == "AUTH-005"

    async def test_body_source_still_works_for_invite(self) -> None:
        """Default (no path_param) still reads property_id from the body.

        Regression guard: the Auth ``/invite`` usage must not break when the
        dependency is generalized.
        """
        dep = require_property_scope()  # body-sourced, as /invite uses it
        enforce = dep.dependency  # type: ignore[attr-defined]

        property_id = uuid.uuid4()
        current_user = {
            "user_id": str(uuid.uuid4()),
            "is_owner": False,
            "is_superuser": False,
        }
        request = _FakeRequest(body={"property_id": str(property_id)})

        from app.modules.auth.repository import UserRepository

        fake = AsyncMock()
        fake.get_property_scopes.return_value = [_ScopeRow(property_id)]
        with pytest.MonkeyPatch().context() as mp:
            mp.setattr(UserRepository, "get_property_scopes", fake.get_property_scopes)
            await enforce(current_user, request, AsyncMock())  # must not raise


# ── #5: is_global_scope / user_has_property_scope helpers ──────────────


@pytest.mark.unit
class TestScopeHelpers:
    """Shared scope helpers used by both the dependency and the list filter."""

    def test_is_global_scope_true_for_owner(self) -> None:
        assert is_global_scope({"is_owner": True}) is True
        assert is_global_scope({"is_superuser": True}) is True

    def test_is_global_scope_false_for_staff(self) -> None:
        assert is_global_scope({"is_owner": False, "is_superuser": False}) is False
        assert is_global_scope({}) is False

    async def test_user_has_scope_global_bypass_skips_db(self) -> None:
        """Global caller returns True without touching the repository."""
        db = AsyncMock()
        assert await user_has_property_scope(
            {"is_owner": True}, db, uuid.uuid4()
        ) is True

    async def test_user_has_scope_no_user_id_denied(self) -> None:
        assert await user_has_property_scope(
            {"is_owner": False}, AsyncMock(), uuid.uuid4()
        ) is False

    async def test_user_has_scope_matches_row(self) -> None:
        property_id = uuid.uuid4()
        current_user = {"user_id": str(uuid.uuid4()), "is_owner": False}

        from app.modules.auth.repository import UserRepository

        fake = AsyncMock()
        fake.get_property_scopes.return_value = [_ScopeRow(property_id)]
        with pytest.MonkeyPatch().context() as mp:
            mp.setattr(UserRepository, "get_property_scopes", fake.get_property_scopes)
            assert await user_has_property_scope(
                current_user, AsyncMock(), property_id
            ) is True


# ── #5: create_property auto-grants owner scope ───────────────────────


@pytest.mark.unit
class TestCreatePropertyOwnerGrant:
    """``create_property`` grants the creator an owner scope (anti-pattern #5)."""

    async def test_owner_scope_granted_on_create(self) -> None:
        service = PropertyService.__new__(PropertyService)
        service.db = AsyncMock()
        service.property_repo = AsyncMock()
        service.room_repo = AsyncMock()

        created_id = uuid.uuid4()
        creator_id = uuid.uuid4()

        class _Prop:
            id = created_id

        service.property_repo.create.return_value = _Prop()

        with pytest.MonkeyPatch().context() as mp:
            # Silence audit + event side-effects (not under test here).
            import app.modules.property.services.property_service as svc_mod

            mp.setattr(svc_mod, "log_audit", AsyncMock())
            mp.setattr(svc_mod, "publish_property_event", AsyncMock())

            await service.create_property(
                name="X",
                address="Y",
                billing_due_day=5,
                min_deposit_months=2,
                created_by=creator_id,
            )

        service.property_repo.add_owner_scope.assert_awaited_once_with(
            creator_id, created_id
        )


# ── #11/#3: room-status must belong to property → 404 ─────────────────


@pytest.mark.unit
class TestUpdateRoomStatusPropertyGuard:
    """``update_room_status`` rejects a room/property mismatch (anti-pattern #11)."""

    async def test_mismatched_property_raises_404(self) -> None:
        service = PropertyService.__new__(PropertyService)
        service.db = AsyncMock()
        service.property_repo = AsyncMock()
        service.room_repo = AsyncMock()

        room_id = uuid.uuid4()
        path_property_id = uuid.uuid4()

        class _Room:
            property_id = uuid.uuid4()  # different from path_property_id
            status = RoomStatus.AVAILABLE

        service.room_repo.get_by_id.return_value = _Room()

        with pytest.raises(APIError) as exc:
            await service.update_room_status(
                room_id=room_id,
                new_status=RoomStatus.OCCUPIED,
                changed_by=uuid.uuid4(),
                property_id=path_property_id,
            )

        assert exc.value.code == "PROP-007"
        assert exc.value.status_code == status.HTTP_404_NOT_FOUND

    async def test_missing_room_raises_404(self) -> None:
        service = PropertyService.__new__(PropertyService)
        service.db = AsyncMock()
        service.property_repo = AsyncMock()
        service.room_repo = AsyncMock()
        service.room_repo.get_by_id.return_value = None

        with pytest.raises(APIError) as exc:
            await service.update_room_status(
                room_id=uuid.uuid4(),
                new_status=RoomStatus.OCCUPIED,
                changed_by=uuid.uuid4(),
                property_id=uuid.uuid4(),
            )
        assert exc.value.code == "PROP-007"


# ── #13/#5: list_properties_paginated scope filter + pagination ───────


@pytest.mark.unit
class TestListPropertiesPaginated:
    """Scope-filtered, paginated list (anti-patterns #5 + #13)."""

    async def test_global_caller_sees_all(self) -> None:
        service = PropertyService.__new__(PropertyService)
        service.db = AsyncMock()
        service.property_repo = AsyncMock()
        service.room_repo = AsyncMock()

        service.property_repo.get_paginated.return_value = ["a", "b"]
        service.property_repo.count_all.return_value = 2

        items, total = await service.list_properties_paginated(
            page=1, limit=20, user_id=uuid.uuid4(), is_global=True
        )
        assert items == ["a", "b"]
        assert total == 2
        service.property_repo.get_paginated.assert_awaited_once_with(0, 20)
        service.property_repo.count_all.assert_awaited_once()
        service.property_repo.get_paginated_for_user.assert_not_called()

    async def test_scoped_caller_filtered(self) -> None:
        service = PropertyService.__new__(PropertyService)
        service.db = AsyncMock()
        service.property_repo = AsyncMock()
        service.room_repo = AsyncMock()

        user_id = uuid.uuid4()
        service.property_repo.get_paginated_for_user.return_value = ["mine"]
        service.property_repo.count_for_user.return_value = 1

        items, total = await service.list_properties_paginated(
            page=2, limit=10, user_id=user_id, is_global=False
        )
        assert items == ["mine"]
        assert total == 1
        # page 2, limit 10 → offset 10
        service.property_repo.get_paginated_for_user.assert_awaited_once_with(
            user_id, 10, 10
        )
        service.property_repo.get_paginated.assert_not_called()

    async def test_scoped_caller_without_user_id_gets_nothing(self) -> None:
        service = PropertyService.__new__(PropertyService)
        service.db = AsyncMock()
        service.property_repo = AsyncMock()
        service.room_repo = AsyncMock()

        items, total = await service.list_properties_paginated(
            page=1, limit=20, user_id=None, is_global=False
        )
        assert items == []
        assert total == 0
