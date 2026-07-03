"""Notification module constants: enums, error codes, domain events (SDD §2.7).

References:
    - SDD.md §2.7: Notifications
"""

from enum import StrEnum


# Error codes
NOTIF_001_NOT_FOUND: str = "NOTIF-001"
NOTIF_002_SEND_FAILED: str = "NOTIF-002"
NOTIF_003_USER_NOT_FOUND: str = "NOTIF-003"
NOTIF_004_PROPERTY_MISMATCH: str = "NOTIF-004"
NOTIF_005_INVALID_CHANNEL: str = "NOTIF-005"

ERROR_MESSAGES: dict[str, str] = {
    NOTIF_001_NOT_FOUND: "Notification not found",
    NOTIF_002_SEND_FAILED: "Failed to send notification",
    NOTIF_003_USER_NOT_FOUND: "User not found",
    NOTIF_004_PROPERTY_MISMATCH: "Property mismatch",
    NOTIF_005_INVALID_CHANNEL: "Invalid notification channel",
}


class NotificationStatus(StrEnum):
    PENDING = "pending"
    SENT = "sent"
    FAILED = "failed"


class NotificationChannel(StrEnum):
    EMAIL = "email"
    LINE = "line"
    SMS = "sms"


# Events
EVENT_NOTIFICATION_SENT: str = "notification.sent"
EVENT_NOTIFICATION_FAILED: str = "notification.failed"
