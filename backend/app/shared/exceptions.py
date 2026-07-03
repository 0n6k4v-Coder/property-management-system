"""Minimal API error handling"""
from http import HTTPStatus
from typing import Any

class APIError(Exception):
    def __init__(
        self,
        code: str,
        message: str,
        status_code: HTTPStatus | int = HTTPStatus.BAD_REQUEST,
        details: dict[str, Any] | None = None,
    ):
        self.code = code
        self.message = message
        self.status_code = status_code if isinstance(status_code, int) else status_code.value
        self.details = details or {}
        super().__init__(message)

def create_api_error(status_code: int, message: str, code: str | None = None) -> APIError:
    return APIError(code=code or f"SYS-{status_code}", message=message, status_code=status_code)
