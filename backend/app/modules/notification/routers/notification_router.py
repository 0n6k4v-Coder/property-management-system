"""Notification REST API endpoints — 3 routes (SDD §2.7, §3.3).

References:
    - CODE_STYLE.md §3.4: Router layer responsibility
    - Fail-Silent: Send failures do not raise HTTP errors.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.notification.schemas import (
    SendNotificationRequest, NotificationCreateResponse,
    NotificationListResponse, NotificationResponse,
)
from app.modules.notification.services.notification_service import NotificationService
from app.shared.deps import get_current_user, get_db

router = APIRouter(prefix="/api/v1", tags=["notifications"])


@router.post(
    "/notifications/test",
    response_model=NotificationCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Send a test notification",
    description="Creates and sends a test notification (mock). Fail-silent — always returns 201.",
)
async def send_test_notification(
    body: SendNotificationRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
) -> dict:
    """POST /api/v1/notifications/test."""
    service = NotificationService(db)
    notif = await service.send_test(
        user_id=body.user_id, property_id=body.property_id,
        channel=body.channel, subject=body.subject, body=body.body,
        sent_by=uuid.UUID(current_user["user_id"]),
    )
    return {"data": NotificationResponse.model_validate(notif), "meta": None}


@router.get(
    "/notifications/history",
    response_model=NotificationListResponse,
    summary="Get notification history",
)
async def get_notification_history(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    property_id: uuid.UUID | None = Query(None, description="Filter by property"),
) -> dict:
    """GET /api/v1/notifications/history."""
    service = NotificationService(db)
    uid = uuid.UUID(current_user["user_id"])
    notifs = await service.get_history(user_id=uid, property_id=property_id)
    return {
        "data": [NotificationResponse.model_validate(n) for n in notifs],
        "meta": None,
    }


@router.patch(
    "/notifications/{notif_id}/resend",
    response_model=NotificationCreateResponse,
    summary="Resend a failed notification",
)
async def resend_notification(
    notif_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
) -> dict:
    """PATCH /api/v1/notifications/{id}/resend."""
    service = NotificationService(db)
    notif = await service.resend(
        notif_id=notif_id,
        resent_by=uuid.UUID(current_user["user_id"]),
    )
    return {"data": NotificationResponse.model_validate(notif), "meta": None}
