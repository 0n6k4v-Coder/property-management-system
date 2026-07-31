"""Unit tests for MaintenanceService — BR-08, BR-09, audit (SDD §2.5, §6).

References:
    - CODE_STYLE.md §7.2: Unit-Test Pattern
    - BR-08: Request tied to room + user (audit)
    - BR-09: Status workflow (pending → in_progress → resolved/cancelled)
"""

import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.models import User
from app.modules.maintenance.constants import MaintenanceStatus, Priority
from app.modules.maintenance.services.maintenance_service import MaintenanceService
from app.modules.property.constants import RoomStatus, RoomType
from app.modules.property.models import Building, Property, Room
from app.shared.exceptions import APIError


@pytest.fixture
def any_user_id() -> uuid.UUID:
    return uuid.uuid4()


async def _seed_room(db_session: AsyncSession, uid: uuid.UUID) -> tuple:
    """Seed user + property + building + room. Returns (prop, room)."""
    db_session.add(
        User(id=uid, email=f"{uid.hex[:8]}@test.com", password_hash="hashed",
             full_name="Test User", is_active=True)
    )
    await db_session.flush()

    prop = Property(name="P", address="A", billing_due_day=5, min_deposit_months=2, created_by=uid)
    db_session.add(prop)
    await db_session.flush()
    await db_session.refresh(prop)

    bld = Building(property_id=prop.id, name="B", display_order=1)
    db_session.add(bld)
    await db_session.flush()
    await db_session.refresh(bld)

    room = Room(property_id=prop.id, building_id=bld.id, room_number="101",
                room_type=RoomType.STUDIO, status=RoomStatus.AVAILABLE)
    db_session.add(room)
    await db_session.flush()
    await db_session.refresh(room)

    return prop, room


@pytest.mark.unit
class TestCreateRequest:
    """``MaintenanceService.create_request()`` — BR-08."""

    async def test_create_request_success(self, db_session: AsyncSession, any_user_id: uuid.UUID) -> None:
        """Valid input → maintenance request created with status=pending."""
        prop, room = await _seed_room(db_session, any_user_id)

        service = MaintenanceService(db_session)
        req = await service.create_request(
            property_id=prop.id,
            room_id=room.id,
            title="AC broken",
            description="The air conditioner is not cooling at all.",
            created_by=any_user_id,
            priority=Priority.HIGH,
        )

        assert req.id is not None
        assert req.status == MaintenanceStatus.PENDING
        assert req.title == "AC broken"
        assert req.priority == Priority.HIGH
        assert req.room_id == room.id
        assert req.property_id == prop.id
        assert req.created_by == any_user_id

    async def test_create_request_room_not_found(self, db_session: AsyncSession, any_user_id: uuid.UUID) -> None:
        """Non-existent room → 404 MAINT-002."""
        prop, _ = await _seed_room(db_session, any_user_id)
        service = MaintenanceService(db_session)

        with pytest.raises(APIError) as exc:
            await service.create_request(
                property_id=prop.id,
                room_id=uuid.uuid4(),
                title="Broken AC",
                description="The AC unit needs replacement.",
                created_by=any_user_id,
            )
        assert exc.value.code == "MAINT-002"
        assert exc.value.status_code == 404


@pytest.mark.unit
class TestUpdateStatus:
    """``MaintenanceService.update_status()`` — BR-09."""

    async def test_pending_to_in_progress(self, db_session: AsyncSession, any_user_id: uuid.UUID) -> None:
        """pending → in_progress: allowed by BR-09."""
        prop, room = await _seed_room(db_session, any_user_id)

        service = MaintenanceService(db_session)
        req = await service.create_request(
            property_id=prop.id, room_id=room.id,
            title="Fix light", description="Light bulb is broken in room 101.",
            created_by=any_user_id,
        )

        updated = await service.update_status(
            request_id=req.id,
            new_status=MaintenanceStatus.IN_PROGRESS,
            changed_by=any_user_id,
        )
        assert updated.status == MaintenanceStatus.IN_PROGRESS

    async def test_in_progress_to_resolved(self, db_session: AsyncSession, any_user_id: uuid.UUID) -> None:
        """in_progress → resolved: allowed by BR-09."""
        prop, room = await _seed_room(db_session, any_user_id)
        service = MaintenanceService(db_session)

        req = await service.create_request(
            property_id=prop.id, room_id=room.id,
            title="Fix door", description="Bedroom door handle is broken.",
            created_by=any_user_id,
        )
        await service.update_status(req.id, MaintenanceStatus.IN_PROGRESS, any_user_id)
        updated = await service.update_status(req.id, MaintenanceStatus.RESOLVED, any_user_id)
        assert updated.status == MaintenanceStatus.RESOLVED

    async def test_in_progress_to_cancelled(self, db_session: AsyncSession, any_user_id: uuid.UUID) -> None:
        """in_progress → cancelled: allowed by BR-09."""
        prop, room = await _seed_room(db_session, any_user_id)
        service = MaintenanceService(db_session)

        req = await service.create_request(
            property_id=prop.id, room_id=room.id,
            title="Fix window", description="Window won't close properly.",
            created_by=any_user_id,
        )
        await service.update_status(req.id, MaintenanceStatus.IN_PROGRESS, any_user_id)
        updated = await service.update_status(req.id, MaintenanceStatus.CANCELLED, any_user_id)
        assert updated.status == MaintenanceStatus.CANCELLED

    async def test_invalid_transition_br09(self, db_session: AsyncSession, any_user_id: uuid.UUID) -> None:
        """pending → resolved: NOT allowed by BR-09 → 400 MAINT-003."""
        prop, room = await _seed_room(db_session, any_user_id)
        service = MaintenanceService(db_session)

        req = await service.create_request(
            property_id=prop.id, room_id=room.id,
            title="Fix pipe", description="Water pipe is leaking under the sink.",
            created_by=any_user_id,
        )

        with pytest.raises(APIError) as exc:
            await service.update_status(req.id, MaintenanceStatus.RESOLVED, any_user_id)
        assert exc.value.code == "MAINT-003"
        assert exc.value.status_code == 400

    async def test_resolved_terminal(self, db_session: AsyncSession, any_user_id: uuid.UUID) -> None:
        """After resolved → any further transition fails."""
        prop, room = await _seed_room(db_session, any_user_id)
        service = MaintenanceService(db_session)

        req = await service.create_request(
            property_id=prop.id, room_id=room.id,
            title="Fix AC", description="AC making loud noise.",
            created_by=any_user_id,
        )
        await service.update_status(req.id, MaintenanceStatus.IN_PROGRESS, any_user_id)
        await service.update_status(req.id, MaintenanceStatus.RESOLVED, any_user_id)

        with pytest.raises(APIError) as exc:
            await service.update_status(req.id, MaintenanceStatus.IN_PROGRESS, any_user_id)
        assert exc.value.code == "MAINT-006"

    async def test_request_not_found(self, db_session: AsyncSession) -> None:
        """Non-existent request → 404 MAINT-001."""
        service = MaintenanceService(db_session)
        with pytest.raises(APIError) as exc:
            await service.update_status(
                request_id=uuid.uuid4(),
                new_status=MaintenanceStatus.IN_PROGRESS,
                changed_by=uuid.uuid4(),
            )
        assert exc.value.code == "MAINT-001"
        assert exc.value.status_code == 404


@pytest.mark.unit
class TestAssignRequest:
    """``MaintenanceService.assign_to()``."""

    async def test_assign_success(self, db_session: AsyncSession, any_user_id: uuid.UUID) -> None:
        """Valid assign → request.assigned_to is set."""
        prop, room = await _seed_room(db_session, any_user_id)

        # Seed a user to assign
        assignee_id = uuid.uuid4()
        db_session.add(
            User(id=assignee_id, email=f"{assignee_id.hex[:8]}@test.com",
                 password_hash="hashed", full_name="Assignee", is_active=True)
        )
        await db_session.flush()

        service = MaintenanceService(db_session)
        req = await service.create_request(
            property_id=prop.id, room_id=room.id,
            title="Fix door", description="Main door needs painting.",
            created_by=any_user_id,
        )

        assigned = await service.assign_to(
            request_id=req.id,
            assigned_to=assignee_id,
            assigned_by=any_user_id,
        )
        assert assigned.assigned_to == assignee_id

    async def test_assign_user_not_found(self, db_session: AsyncSession, any_user_id: uuid.UUID) -> None:
        """Non-existent assignee → 404 MAINT-008."""
        prop, room = await _seed_room(db_session, any_user_id)
        service = MaintenanceService(db_session)

        req = await service.create_request(
            property_id=prop.id, room_id=room.id,
            title="Fix pipe", description="Leaking pipe under the sink.",
            created_by=any_user_id,
        )

        with pytest.raises(APIError) as exc:
            await service.assign_to(
                request_id=req.id,
                assigned_to=uuid.uuid4(),
                assigned_by=any_user_id,
            )
        assert exc.value.code == "MAINT-008"
        assert exc.value.status_code == 404
