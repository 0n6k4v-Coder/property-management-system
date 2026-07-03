"""Pydantic v2 schemas for Admin module (SDD §2.7, §3.1)."""
import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class AuditLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, arbitrary_types_allowed=True)

    id: uuid.UUID
    user_id: uuid.UUID | None = None
    action: str
    resource_type: str
    resource_id: uuid.UUID | None = None
    property_id: uuid.UUID | None = None
    metadata: Any = None
    ip_address: str | None = None
    timestamp: datetime


class AuditLogListResponse(BaseModel):
    data: list[AuditLogResponse]
    meta: dict | None = None


class SystemConfigResponse(BaseModel):
    key: str
    value: str
    masked: bool = False


class SystemConfigListResponse(BaseModel):
    data: list[SystemConfigResponse]
    meta: None = None


class UpdateSystemConfigRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    value: str = Field(..., min_length=1)
