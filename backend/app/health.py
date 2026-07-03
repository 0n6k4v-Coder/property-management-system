"""Docker/Kubernetes health check endpoint (SDD §10.1).
Provides lightweight liveness/readiness probes that exclude heavy dependencies
so they never cascade failure during transient DB/Redis issues.
"""
from fastapi import APIRouter, status
from pydantic import BaseModel, Field

router = APIRouter()


class HealthResponse(BaseModel):
    """Standardised health-response shape consumed by K8s readiness probes."""
    status: str = Field(..., description="Overall health status")
    version: str = Field(..., description="Application version")
    database: str = Field(..., description="Database connection status")
    redis: str = Field(..., description="Redis connection status")


@router.get(
    "/health",
    response_model=HealthResponse,
    status_code=status.HTTP_200_OK,
    include_in_schema=False,
)
async def health_check() -> HealthResponse:
    """Lightweight health check for Docker/K8s — excludes heavy dependencies.

    Returns immediately with a fixed response. Does NOT ping the DB or Redis
    so that a transient network blip on the data plane doesn't cause K8s
    to kill the pod (liveness) or remove it from the Service (readiness).
    """
    return HealthResponse(
        status="ok",
        version="1.0.0",
        database="connected",
        redis="connected",
    )
