"""Prometheus metrics for worker monitoring.

Exposes metrics for:
- Task execution duration
- Task success/failure counts
- Queue depths
- Scheduler job execution

References:
- SDD §10.4: Monitoring & Observability
- backend/docs/OPERATIONS.md: Monitoring setup
"""
import structlog
from prometheus_client import CollectorRegistry, Counter, Gauge, Histogram, generate_latest

logger = structlog.get_logger()

# Create a dedicated registry for workers
worker_registry = CollectorRegistry()

# Task metrics
TASK_DURATION = Histogram(
    "worker_task_duration_seconds",
    "Task execution duration in seconds",
    ["task_name", "queue"],
    registry=worker_registry,
)

TASK_SUCCESS = Counter(
    "worker_task_success_total",
    "Total successful task executions",
    ["task_name", "queue"],
    registry=worker_registry,
)

TASK_FAILURE = Counter(
    "worker_task_failure_total",
    "Total failed task executions",
    ["task_name", "queue", "error_type"],
    registry=worker_registry,
)

TASK_RETRY = Counter(
    "worker_task_retry_total",
    "Total task retries",
    ["task_name", "queue"],
    registry=worker_registry,
)

# Scheduler metrics
SCHEDULER_JOB_DURATION = Histogram(
    "worker_scheduler_job_duration_seconds",
    "Scheduler job execution duration in seconds",
    ["job_name"],
    registry=worker_registry,
)

SCHEDULER_JOB_SUCCESS = Counter(
    "worker_scheduler_job_success_total",
    "Total successful scheduler job executions",
    ["job_name"],
    registry=worker_registry,
)

SCHEDULER_JOB_FAILURE = Counter(
    "worker_scheduler_job_failure_total",
    "Total failed scheduler job executions",
    ["job_name", "error_type"],
    registry=worker_registry,
)

# Queue depth metrics (requires Celery inspection)
QUEUE_DEPTH = Gauge(
    "worker_queue_depth",
    "Current number of tasks in queue",
    ["queue"],
    registry=worker_registry,
)

# Worker metrics
WORKER_ACTIVE = Gauge(
    "worker_active_count",
    "Number of active worker processes",
    registry=worker_registry,
)

WORKER_IDLE = Gauge(
    "worker_idle_count",
    "Number of idle worker processes",
    registry=worker_registry,
)


def get_worker_metrics() -> bytes:
    """Generate Prometheus metrics output for worker monitoring.

    Returns
    -------
    bytes: Prometheus exposition format metrics
    """
    return generate_latest(worker_registry)


def record_task_start(_task_name: str, _queue: str) -> float:
    """Record task start time for duration tracking.

    Returns
    -------
    float: Start timestamp for later duration calculation
    """
    import time
    return time.time()


def record_task_end(
    task_name: str,
    queue: str,
    start_time: float,
    success: bool,
    error_type: str | None = None,
):
    """Record task completion metrics.

    Parameters
    ----------
    task_name: Name of the task
    queue: Queue the task ran on
    start_time: Start timestamp from record_task_start
    success: Whether task completed successfully
    error_type: Type of error if failed (e.g., 'timeout', 'validation_error')
    """
    import time
    duration = time.time() - start_time

    TASK_DURATION.labels(task_name=task_name, queue=queue).observe(duration)

    if success:
        TASK_SUCCESS.labels(task_name=task_name, queue=queue).inc()
    else:
        TASK_FAILURE.labels(
            task_name=task_name, queue=queue, error_type=error_type or "unknown"
        ).inc()


def record_task_retry(task_name: str, queue: str):
    """Record a task retry."""
    TASK_RETRY.labels(task_name=task_name, queue=queue).inc()


def record_scheduler_job(job_name: str, duration: float, success: bool, error_type: str | None = None):
    """Record scheduler job execution metrics."""
    SCHEDULER_JOB_DURATION.labels(job_name=job_name).observe(duration)

    if success:
        SCHEDULER_JOB_SUCCESS.labels(job_name=job_name).inc()
    else:
        SCHEDULER_JOB_FAILURE.labels(
            job_name=job_name, error_type=error_type or "unknown"
        ).inc()


def update_queue_depth(queue: str, depth: int):
    """Update queue depth gauge."""
    QUEUE_DEPTH.labels(queue=queue).set(depth)


def update_worker_counts(active: int, idle: int):
    """Update worker count gauges."""
    WORKER_ACTIVE.set(active)
    WORKER_IDLE.set(idle)
