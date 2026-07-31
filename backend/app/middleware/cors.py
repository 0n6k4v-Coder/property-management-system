"""CORS configuration helper (production-hardened defaults).

Provides a single `setup_cors_middleware()` helper that applies CORS
headers with production-safe defaults.  In production the allowed
origins list MUST come from the env var (never a wildcard).

References:
  - SDD §3.3: API Contract / CORS
  - SDD §4.5: Security
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


def setup_cors_middleware(app: FastAPI, allowed_origins: list[str] | None = None) -> None:
    """Configure CORS for the FastAPI application.

    Defaults to the Vite dev-server origins expected during local
    development.  Production deployments MUST pass an explicit
    ``allowed_origins`` list from ``settings.CORS_ORIGINS``.
    """
    origins = allowed_origins or [
        "http://localhost:5173",  # Vite dev server
        "http://localhost:3000",  # React dev server (fallback)
    ]

    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID", "X-RateLimit-Remaining"],
    )
