"""Unit tests for worker Prometheus monitoring."""

import time

from app.workers.monitoring import (
    get_worker_metrics,
    record_scheduler_job,
    record_task_end,
    record_task_retry,
    record_task_start,
    update_queue_depth,
    update_worker_counts,
)


def test_monitoring_functions():
    start = record_task_start("test_task", "default")
    assert isinstance(start, float)
    time.sleep(0.01)

    record_task_end("test_task", "default", start, success=True)
    record_task_end("test_task", "default", start, success=False, error_type="timeout")

    record_task_retry("test_task", "default")

    record_scheduler_job("job_1", 0.5, success=True)
    record_scheduler_job("job_1", 0.5, success=False, error_type="exception")

    update_queue_depth("default", 5)

    update_worker_counts(active=2, idle=1)

    metrics = get_worker_metrics()
    assert isinstance(metrics, bytes)
    assert b"worker_task_duration_seconds" in metrics
    assert b"worker_active_count" in metrics
