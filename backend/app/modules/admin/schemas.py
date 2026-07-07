"""Pydantic v2 schemas for Admin module (SDD §2.7, §3.1)."""
import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import MetaData as SQLAlchemyMetaData


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

    @field_validator("metadata", mode="before")
    @classmethod
    def _coerce_metadata(cls, v: Any) -> Any:
        """The AuditLog model's ``metadata`` column name collides with
        declarative ``Base.metadata``, so ``from_attributes`` can resolve the
        SQLAlchemy ``MetaData`` object instead of the audit payload. Coerce any
        non-serializable SQLAlchemy type to ``None`` to keep the response valid.
        """
        if isinstance(v, SQLAlchemyMetaData):
            return None
        return v


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
