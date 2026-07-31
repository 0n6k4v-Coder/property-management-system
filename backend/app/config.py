"""Minimal Pydantic Settings for development (SDD.md §4.4, §9.1)."""

from functools import lru_cache
from typing import Any

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration loaded from environment / .env file.

    All secrets are read from environment variables only — never hardcoded.
    Default values are provided for local development only; production
    deployments MUST override every field without a safe default.
    """

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # ── Security: REQUIRED for production ──────────────────────────────
    SECRET_KEY: str = "dev-secret-key-change-in-prod"
    ID_CARD_ENCRYPTION_KEY: str = "txjtJSgQUueeioIEaLzpfazdlgwX8Gon4rMMK-CdpHE="

    # ── Argon2id password hashing (OWASP 2026, RFC 9106) ───────────────
    ARGON2_TIME_COST: int = 3
    ARGON2_MEMORY_COST: int = 65536   # 64 MB — OWASP recommended minimum
    ARGON2_PARALLELISM: int = 1

    @property
    def argon2_config(self) -> dict[str, Any]:
        """Return Argon2id parameters as a dict for passlib CryptContext."""
        return {
            "time_cost": self.ARGON2_TIME_COST,
            "memory_cost": self.ARGON2_MEMORY_COST,
            "parallelism": self.ARGON2_PARALLELISM,
            "type": "ID",
        }

    # ── Token lifetimes (minutes / days) ───────────────────────────────
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    INVITE_TOKEN_EXPIRE_DAYS: int = 7

    # ── Application metadata ───────────────────────────────────────────
    APP_NAME: str = "Property Management System"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    APP_DOMAIN: str = "http://localhost:3000"

    # ── Database (PostgreSQL via asyncpg) ──────────────────────────────
    DATABASE_URL: str = "postgresql+asyncpg://user:pass@db:5432/pms_test"
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20
    DB_POOL_TIMEOUT: int = 30
    DB_POOL_RECYCLE: int = 1800
    DB_PRE_PING: bool = True

    # ── External services ──────────────────────────────────────────────
    REDIS_URL: str = "redis://redis:6379/0"
    MINIO_ENDPOINT: str = "http://minio:9000"
    MINIO_ACCESS_KEY: str = "minio_7b255e23"
    MINIO_SECRET_KEY: str = "pr64JFuZnV6oEFYSCtBAK5uWig"
    MINIO_BUCKET_NAME: str = "pms-files"

    # ── CORS ───────────────────────────────────────────────────────────
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:5173"]

    # ── Admin access (RBAC owner-gated endpoints: /admin/*) ────────────
    # Emails granted owner + superuser privileges for admin views
    # (audit logs, system config). Schema-free: the JWT claim `is_owner`
    # is set at token-issuance time for these accounts (see auth_service).
    # Defaults to the seeded E2E admin account. Production deployments
    # SHOULD override this with their real admin email(s).
    ADMIN_EMAILS: str = "admin@example.com"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return a singleton Settings instance (cached after first call)."""
    return Settings()
