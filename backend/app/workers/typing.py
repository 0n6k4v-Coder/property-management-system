"""Celery task typing utilities — simplified approach.

Celery's @shared_task is a runtime decorator that transforms functions.
Static typing with Protocol + overload is too complex for this dynamic behavior.
Use celery's shared_task directly with a single type ignore.
"""

from celery import Task as CeleryTask
from celery import shared_task as _celery_shared_task

# Re-export for convenience
__all__ = ["shared_task", "CeleryTask"]

# Use celery's shared_task directly with type ignore for mypy
# The overload approach is too complex for Celery's dynamic decorator
shared_task = _celery_shared_task
