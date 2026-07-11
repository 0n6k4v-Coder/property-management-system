"""Pydantic v2 schemas for Notification module (SDD §2.7)."""
import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.modules.notification.constants import NotificationChannel


class SendNotificationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    user_id: uuid.UUID
    property_id: uuid.UUID
    channel: NotificationChannel = NotificationChannel.EMAIL
    subject: str = Field(..., min_length=1, max_length=255)
    body: str = Field(..., min_length=1)


class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID | None = None
    property_id: uuid.UUID
    channel: str
    subject: str
    body: str
    status: str
    error_message: str | None = None
    created_by: uuid.UUID | None = None
    created_at: datetime
    sent_at: datetime | None = None


class NotificationQueuedResponse(BaseModel):
    """Response for 202 Accepted — notification queued for async delivery."""
    model_config = ConfigDict(extra="forbid")

    notification_id: uuid.UUID
    status: Literal["queued"] = "queued"


class NotificationMeta(BaseModel):
    """Pagination metadata for notification list responses."""
    model_config = ConfigDict(extra="forbid")

    page: int
    limit: int
    total: int
    has_next: bool


class NotificationCreateResponse(BaseModel):
    data: NotificationResponse
    meta: None = None


class NotificationListResponse(BaseModel):
    data: list[NotificationResponse]
    meta: NotificationMeta | None = None
