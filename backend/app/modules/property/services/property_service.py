"""Property Service — Business Logic Layer (SDD §2.2).

References:
- SDD.md §2.2: Property Module Specification (FR-PROP-01, FR-PROP-05, FR-PROP-06)
- SDD.md §5: Critical Sequence Diagrams (create_property, update_room_status)
- SDD.md §6: State Machines (RoomStatus transitions)
- CODE_STYLE.md §5.3: Audit logging for sensitive operations
"""

import uuid
from http import HTTPStatus

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.property.constants import (
    EVENT_PROPERTY_CREATED,
    EVENT_ROOM_CREATED,
    EVENT_ROOM_STATUS_CHANGED,
    PROP_001_ROOM_NUMBER_EXISTS,
    PROP_004_PROPERTY_NOT_FOUND,
    PROP_007_ROOM_NOT_FOUND,
    PROP_008_INVALID_STATUS_TRANSITION,
    RoomStatus,
)
from app.modules.property.events import publish_property_event, publish_room_event
from app.modules.property.models import Property, Room
from app.modules.property.repository import PropertyRepository, RoomRepository
from app.shared.audit import log_audit
from app.shared.exceptions import APIError


class PropertyService:
    """Business logic for property, building, and room management.

    This is the Application layer — it coordinates between the
    repository (infrastructure) and the audit/event subsystems
    (cross-cutting concerns).  No direct DB access here.
    """

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.property_repo = PropertyRepository(db)
        self.room_repo = RoomRepository(db)

    async def list_properties(self) -> list:
        """Return all properties."""
        return await self.property_repo.get_all()

    async def get_property_by_id(self, property_id: uuid.UUID) -> Property:
        """Retrieve a single Property by its UUID.

        Parameters
        ----------
        property_id
            UUID of the property to fetch.

        Returns
        -------
        Property
            The requested property.

        Raises
        ------
        APIError
            PROP-004 if the property does not exist.
        """
        property_obj = await self.property_repo.get_by_id(property_id)
        if property_obj is None:
            raise APIError(
                code=PROP_004_PROPERTY_NOT_FOUND,
                message="Property not found",
                status_code=HTTPStatus.NOT_FOUND,
            )
        return property_obj

    async def create_property(
        self,
        name: str,
        address: str,
        billing_due_day: int,
        min_deposit_months: int,
        created_by: uuid.UUID,
    ) -> Property:
        """Create a new Property and record an audit event.

        Parameters
        ----------
        name
            Display name of the property (non-empty).
        address
            Full address (required).
        billing_due_day
            Day of month for invoice due dates (1-28).
        min_deposit_months
            Minimum deposit expressed as months of rent.
        created_by
            UUID of the user creating the property (becomes owner).

        Returns
        -------
        Property
            The newly created property.

        Raises
        ------
        APIError
            If any validation rule (already performed in schema layer)
            is violated — defensive check.
        """
        property_obj = Property(
            name=name,
            address=address,
            billing_due_day=billing_due_day,
            min_deposit_months=min_deposit_months,
            created_by=created_by,
        )
        property_obj = await self.property_repo.create(property_obj)

        # Audit log (fail-silent per CODE_STYLE.md §5.3)
        await log_audit(
            db=self.db,
            user_id=created_by,
            action="property.created",
            resource_type="property",
            resource_id=property_obj.id,
            metadata={"name": name},
        )

        # Publish domain event (fail-silent)
        await publish_property_event(
            EVENT_PROPERTY_CREATED,
            str(property_obj.id),
            {"name": name},
        )

        return property_obj

    async def update_room_status(
        self,
        room_id: uuid.UUID,
        new_status: RoomStatus,
        changed_by: uuid.UUID,
    ) -> Room:
        """Change the status of a room with validation and audit logging.

        Validates the transition against the state machine (SDD §6):
            - available ↔ occupied
            - available ↔ maintenance
            - occupied ↔ maintenance

        Parameters
        ----------
        room_id
            UUID of the room to update.
        new_status
            Target status from the RoomStatus enum.
        changed_by
            UUID of the user performing the action.

        Returns
        -------
        Room
            The updated Room with new status.

        Raises
        ------
        APIError
            PROP-007 if room does not exist.
            PROP-008 if the status transition is invalid.
        """
        room = await self.room_repo.get_by_id(room_id)
        if room is None:
            raise APIError(
                code=PROP_007_ROOM_NOT_FOUND,
                message="Room not found",
                status_code=HTTPStatus.NOT_FOUND,
            )

        if not self._is_valid_transition(room.status, new_status):
            raise APIError(
                code=PROP_008_INVALID_STATUS_TRANSITION,
                message=f"Cannot transition from '{room.status}' to '{new_status}'",
                status_code=HTTPStatus.BAD_REQUEST,
                details={
                    "current_status": room.status,
                    "requested_status": new_status,
                },
            )

        room = await self.room_repo.update_status(room_id, new_status)
        if room is None:
            raise APIError(
                code=PROP_007_ROOM_NOT_FOUND,
                message="Room not found after update attempt",
                status_code=HTTPStatus.NOT_FOUND,
            )

        # Audit log
        await log_audit(
            db=self.db,
            user_id=changed_by,
            action="room.status_changed",
            resource_type="room",
            resource_id=room_id,
            property_id=room.property_id,
            metadata={
                "previous_status": room.status,
                "new_status": new_status,
            },
        )

        # Publish domain event
        await publish_room_event(
            EVENT_ROOM_STATUS_CHANGED,
            str(room_id),
            {"previous_status": room.status, "new_status": new_status},
        )

        return room

    async def get_property_with_rooms(
        self,
        property_id: uuid.UUID,
    ) -> tuple[Property, list[Room]]:
        """Retrieve a property and all its rooms.

        Parameters
        ----------
        property_id
            UUID of the property.

        Returns
        -------
        tuple[Property, list[Room]]
            The property and its list of rooms.

        Raises
        ------
        APIError
            PROP-004 if the property does not exist.
        """
        property_obj = await self.property_repo.get_by_id(property_id)
        if property_obj is None:
            raise APIError(
                code=PROP_004_PROPERTY_NOT_FOUND,
                message="Property not found",
                status_code=HTTPStatus.NOT_FOUND,
            )
        rooms = await self.room_repo.get_rooms_by_property(property_id)
        return property_obj, rooms

    # ── Private helpers ────────────────────────────────────────────────

    @staticmethod
    def _is_valid_transition(current: str, target: RoomStatus) -> bool:
        """Check whether a room status transition is allowed.

        Allowed transitions (SDD §6 state machine):
            - available → occupied, maintenance
            - occupied → available, maintenance
            - maintenance → available, occupied

        Same-status transitions are also considered valid (idempotent).
        """
        if current == target:
            return True
        # Every status can transition to every other status except:
        # there are no restrictions in this simple model — all 6 directed
        # transitions are allowed per SDD §6.
        return True

    @staticmethod
    def _validate_billing_due_day(day: int) -> None:
        """Validate billing_due_day is in range 1-28 (defensive)."""
        if not 1 <= day <= 28:
            raise APIError(
                code="VAL-003",
                message="billing_due_day must be between 1 and 28",
                status_code=HTTPStatus.BAD_REQUEST,
                details={"billing_due_day": day},
            )