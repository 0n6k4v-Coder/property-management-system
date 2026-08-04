"""Celery task typing utilities — simplified approach.

Celery's @shared_task is a runtime decorator that transforms functions.
Static typing with Protocol + overload is too complex for this dynamic behavior.
Use celery's shared_task directly with a single type ignore.
"""

from typing import Any

from celery import shared_task as _celery_shared_task

# Re-export for convenience
__all__ = ["shared_task", "CeleryTask"]

# Use Any for CeleryTask since Task is a generic type requiring type arguments
# and the actual type depends on the decorated function's signature.
CeleryTask = Any

# Use celery's shared_task directly
shared_task = _celery_shared_task
