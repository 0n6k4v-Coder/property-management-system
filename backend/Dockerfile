# syntax=docker/dockerfile:1

# =============================================================================
# Stage 1: Base — Shared foundation for all stages (Python 3.14 + Slim)
# =============================================================================
# 2026 Best Practice: ใช้ slim-bookworm แทน alpine เพื่อหลีกเลี่ยงปัญหา musl libc 
# กับ C-extensions (asyncpg, cryptography, python-magic) ที่ compile ล้มเหลวใน alpine
FROM python:3.14-slim-bookworm AS base
WORKDIR /app

# Python optimization & security flags
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONFAULTHANDLER=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install system dependencies required by Python packages
# libpq-dev: asyncpg
# libmagic1: python-magic (ไฟล์ upload validation)
# build-essential: compile C extensions
# curl: healthcheck endpoint
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    libmagic1 \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# =============================================================================
# Stage 2: Dependencies — Install Python packages (cached layer)
# =============================================================================
FROM base AS dependencies
COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# =============================================================================
# Stage 3: Development — Hot-reload & debugging tools
# =============================================================================
FROM dependencies AS development
# 2026 Best Practice: uvicorn[standard] รวม uvloop, httptools, watchfiles
RUN pip install --no-cache-dir uvicorn[standard] watchdog

# Copy application code (volume mount จะ override ใน docker-compose)
COPY . .

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload", "--log-level", "debug"]

# =============================================================================
# Stage 4: Testing — Linting, testing & contract validation
# =============================================================================
FROM development AS testing
# Install test & QA tools (แยกจาก production เพื่อลด image size)
RUN pip install --no-cache-dir \
    pytest pytest-asyncio pytest-cov pytest-benchmark \
    factory-boy schemathesis \
    ruff mypy bandit safety \
    apscheduler prometheus-client
RUN pip install --no-cache-dir locust

CMD ["pytest", "tests/", "-v", "--cov=app", "--cov-report=term-missing", "--cov-report=xml"]

# =============================================================================
# Stage 5: Production — Minimal, secure, non-root
# =============================================================================
FROM base AS production

# Create non-root user ก่อน copy (security best practice)
RUN groupadd -r appuser && useradd -r -g appuser -d /app -s /sbin/nologin appuser

# Copy เฉพาะ dependencies ที่ติดตั้งไว้ (ไม่มี dev/test packages)
COPY --from=dependencies /usr/local/lib/python3.14/site-packages /usr/local/lib/python3.14/site-packages
COPY --from=dependencies /usr/local/bin /usr/local/bin

# Copy เฉพาะ source code (tests/, docs/, .git ถูกกรองด้วย .dockerignore)
COPY --chown=appuser:appuser . .

USER appuser

EXPOSE 8000

# Healthcheck (สอดคล้องกับ health.py ใน SDD §10.2)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Async tuning สำหรับ FastAPI 2026
ENV UVICORN_WORKERS=4 \
    UVICORN_LIMIT_CONCURRENCY=1000 \
    UVICORN_BACKLOG=2048

CMD ["sh", "-c", "uvicorn app.main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --workers ${UVICORN_WORKERS} \
    --log-level info \
    --limit-concurrency ${UVICORN_LIMIT_CONCURRENCY} \
    --backlog ${UVICORN_BACKLOG}"]