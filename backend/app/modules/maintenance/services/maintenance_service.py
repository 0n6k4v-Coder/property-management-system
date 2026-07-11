"""Maintenance module business logic — create, update status, assign (SDD §2.5).

Enforces Business Rules:
    - BR-08: Maintenance request tied to room + user (audit trail)
    - BR-09: Status workflow (pending → in_progress → resolved/cancelled)

References:
    - SDD.md §2.5: Maintenance Module Specification
    - SDD.md §6.3: Room Status Machine
"""

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.maintenance.constants import (
    ALLOWED_TRANSITIONS,
    ERROR_MESSAGES,
    EVENT_MAINTENANCE_CREATED,
    EVENT_MAINTENANCE_STATUS_CHANGED,
    MAINT_001_REQUEST_NOT_FOUND,
    MAINT_003_INVALID_STATUS_TRANSITION,
    MAINT_006_ALREADY_RESOLVED,
    MAINT_007_ALREADY_CANCELLED,
    MAINT_008_ASSIGN_USER_NOT_FOUND,
    MaintenanceStatus,
)
from app.modules.maintenance.events import publish_maintenance_event
from app.modules.maintenance.models import MaintenanceRequest
from app.modules.maintenance.repository import MaintenanceRepository
from app.shared.audit import log_audit
from app.shared.exceptions import APIError


class MaintenanceService:
    """Core business logic for the Maintenance module.

    Every public method performs validation, enforces business rules,
    and writes an audit log entry.
    """

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = MaintenanceRepository(db)

    async def create_request(
        self,
        property_id: uuid.UUID,
        room_id: uuid.UUID,
        title: str,
        description: str,
        created_by: uuid.UUID,
        priority: str = "medium",
    ) -> MaintenanceRequest:
        """Create a new maintenance request (BR-08).

        Parameters
        ----------
        property_id
            UUID of the property.
        room_id
            UUID of the room requiring maintenance.
        title
            Short title (min 3 chars).
        description
            Detailed description (min 10 chars).
        created_by
            UUID of the user creating the request.
        priority
            Priority level (default: medium).

        Returns
        -------
        MaintenanceRequest
            The newly created request ORM instance.

        Raises
        ------
        APIError
            MAINT-002: room not found (cross-module FK check).
        """
        # Validate room exists
        from sqlalchemy import select

        from app.modules.property.models import Room
        stmt = select(Room).where(Room.id == room_id)
        result = await self.db.execute(stmt)
        if result.scalars().first() is None:
            from app.modules.maintenance.constants import MAINT_002_ROOM_NOT_FOUND
            raise APIError(
                code=MAINT_002_ROOM_NOT_FOUND,
                message=ERROR_MESSAGES[MAINT_002_ROOM_NOT_FOUND],
                status_code=404,
            )

        request = MaintenanceRequest(
            property_id=property_id,
            room_id=room_id,
            title=title,
            description=description,
            priority=priority,
            status=MaintenanceStatus.PENDING,
            created_by=created_by,
        )
        request = await self.repo.create(request)

        # Audit log
        await log_audit(
            db=self.db,
            user_id=created_by,
            action="maintenance.created",
            resource_type="maintenance_request",
            resource_id=request.id,
            property_id=property_id,
            metadata={
                "room_id": str(room_id),
                "title": title,
                "priority": priority,
            },
        )

        # Publish event (fail-silent)
        await publish_maintenance_event(
            EVENT_MAINTENANCE_CREATED,
            str(request.id),
            {"room_id": str(room_id), "title": title},
        )

        return request

    async def update_status(
        self,
        request_id: uuid.UUID,
        new_status: str,
        changed_by: uuid.UUID,
    ) -> MaintenanceRequest:
        """Update the status of a maintenance request (BR-09).

        Validates that the transition is allowed per BR-09 workflow:

            pending ──→ in_progress
                        in_progress ──→ resolved
                        in_progress ──→ cancelled
                        pending ──→ cancelled

        Parameters
        ----------
        request_id
            UUID of the maintenance request.
        new_status
            Target status value.
        changed_by
            UUID of the user performing the update.

        Returns
        -------
        MaintenanceRequest
            The updated request ORM instance.

        Raises
        ------
        APIError
            MAINT-001: request not found.
            MAINT-006: already resolved.
            MAINT-007: already cancelled.
            MAINT-003: invalid status transition (BR-09).
        """
        request = await self.repo.get_by_id(request_id)
        if request is None:
            raise APIError(
                code=MAINT_001_REQUEST_NOT_FOUND,
                message=ERROR_MESSAGES[MAINT_001_REQUEST_NOT_FOUND],
                status_code=404,
            )

        current_status = request.status

        # Terminal states
        if current_status == MaintenanceStatus.RESOLVED:
            raise APIError(
                code=MAINT_006_ALREADY_RESOLVED,
                message=ERROR_MESSAGES[MAINT_006_ALREADY_RESOLVED],
                status_code=400,
            )
        if current_status == MaintenanceStatus.CANCELLED:
            raise APIError(
                code=MAINT_007_ALREADY_CANCELLED,
                message=ERROR_MESSAGES[MAINT_007_ALREADY_CANCELLED],
                status_code=400,
            )

        # BR-09: Check transition is allowed
        allowed = ALLOWED_TRANSITIONS.get(current_status, set())
        if new_status not in allowed:
            raise APIError(
                code=MAINT_003_INVALID_STATUS_TRANSITION,
                message=ERROR_MESSAGES[MAINT_003_INVALID_STATUS_TRANSITION].format(
                    current=current_status, target=new_status,
                ),
                status_code=400,
            )

        request.status = new_status
        request = await self.repo.update(request)

        # Audit log
        await log_audit(
            db=self.db,
            user_id=changed_by,
            action="maintenance.status_changed",
            resource_type="maintenance_request",
            resource_id=request.id,
            property_id=request.property_id,
            metadata={
                "previous_status": current_status,
                "new_status": new_status,
            },
        )

        # Publish event (fail-silent)
        await publish_maintenance_event(
            EVENT_MAINTENANCE_STATUS_CHANGED,
            str(request.id),
            {
                "previous_status": current_status,
                "new_status": new_status,
            },
        )

        return request

    async def assign_to(
        self,
        request_id: uuid.UUID,
        assigned_to: uuid.UUID,
        assigned_by: uuid.UUID,
    ) -> MaintenanceRequest:
        """Assign a maintenance request to a user.

        Parameters
        ----------
        request_id
            UUID of the maintenance request.
        assigned_to
            UUID of the user being assigned.
        assigned_by
            UUID of the user performing the assignment.

        Returns
        -------
        MaintenanceRequest
            The updated request ORM instance.

        Raises
        ------
        APIError
            MAINT-001: request not found.
            MAINT-008: assigned user not found.
        """
        request = await self.repo.get_by_id(request_id)
        if request is None:
            raise APIError(
                code=MAINT_001_REQUEST_NOT_FOUND,
                message=ERROR_MESSAGES[MAINT_001_REQUEST_NOT_FOUND],
                status_code=404,
            )

        # Validate assigned user exists
        from sqlalchemy import select

        from app.modules.auth.models import User
        stmt = select(User).where(User.id == assigned_to)
        result = await self.db.execute(stmt)
        if result.scalars().first() is None:
            raise APIError(
                code=MAINT_008_ASSIGN_USER_NOT_FOUND,
                message=ERROR_MESSAGES[MAINT_008_ASSIGN_USER_NOT_FOUND],
                status_code=404,
            )

        request.assigned_to = assigned_to
        request = await self.repo.update(request)

        # Audit log
        await log_audit(
            db=self.db,
            user_id=assigned_by,
            action="maintenance.assigned",
            resource_type="maintenance_request",
            resource_id=request.id,
            property_id=request.property_id,
            metadata={"assigned_to": str(assigned_to)},
        )

        # Publish event
        from app.modules.maintenance.constants import EVENT_MAINTENANCE_ASSIGNED
        await publish_maintenance_event(
            EVENT_MAINTENANCE_ASSIGNED,
            str(request.id),
            {"assigned_to": str(assigned_to)},
        )

        return request

    async def get_request(self, request_id: uuid.UUID) -> MaintenanceRequest:
        """Get a single maintenance request by ID.

        Raises
        ------
        APIError
            MAINT-001: request not found.
        """
        request = await self.repo.get_by_id(request_id)
        if request is None:
            raise APIError(
                code=MAINT_001_REQUEST_NOT_FOUND,
                message=ERROR_MESSAGES[MAINT_001_REQUEST_NOT_FOUND],
                status_code=404,
            )
        return request

    async def get_pending_by_property(self, property_id: uuid.UUID) -> list[MaintenanceRequest]:
        """Return all non-resolved requests for a property."""
        return await self.repo.get_by_property(property_id)
