# File: 02-design/SDD/09-deployment.md
# Deployment Guide — Property Management System v1.0.0
## Backend Software Design Document (SDD)

**Last Updated:** 2026-05-31
**Version:** 1.0
**Status:** ✅ Production-Ready (Sprint 8)

---

## 📋 Overview

This guide covers deploying the Property Management System in three modes:

| Mode | Description | Best For |
|------|------------|----------|
| **Self-hosted** | Docker Compose on single server | Small properties, individual owners |
| **On-premise** | Isolated stack on customer server | Managed deployments, data sovereignty |
| **Cloud** | Multi-arch container registry + orchestration | SaaS, multi-tenant future |

All modes share the same Docker image (`ghcr.io/yourorg/pms-backend:latest`) built from the multi-stage `Dockerfile` with `production` target.

---

## 🐳 Prerequisites

```bash
# Check versions
docker --version          # >= 24.0
docker compose version    # >= 2.20.0
git --version
make --version
bash --version            # >= 4.0
```

### Required Ports

| Port | Service | Purpose |
|------|---------|---------|
| 8000 | Backend API | FastAPI HTTP server |
| 5432 | PostgreSQL | Database |
| 6379 | Redis | Cache + Celery broker |
| 9000 | MinIO API | S3-compatible storage |
| 9001 | MinIO Console | Admin UI (optional) |

---

## 🧪 Docker-First Development Strategy

การพัฒนาและทดสอบทั้งหมดต้องรันภายใน Docker container เท่านั้น (`docker compose`) เพื่อรับประกันสภาพแวดล้อมที่สม่ำเสมอระหว่างพัฒนา, ทดสอบ, และผลิต (สอดคล้องกับ NFR Portability)

> ℹ️ **หมายเหตุ:** 
> - **Docker-First Strategy:** การพัฒนาและทดสอบทั้งหมดต้องรันภายใน Docker container เท่านั้น (`docker compose`) เพื่อรับประกันสภาพแวดล้อมที่สม่ำเสมอระหว่างพัฒนา, ทดสอบ, และผลิต (สอดคล้องกับ NFR Portability)

### Docker Commands Reference (Dev/Test)

```bash
# 🔹 Start development environment (hot-reload enabled)
docker compose -f docker-compose.dev.yml up

# 🔹 Run tests in isolated container
docker compose -f docker-compose.dev.yml --profile test run --rm backend-test

# 🔹 Run specific test module
docker compose -f docker-compose.dev.yml --profile test run --rm backend-test pytest tests/modules/contract/ -v

# 🔹 Run linters/type checkers
docker compose -f docker-compose.dev.yml --profile test run --rm backend-test ruff check .
docker compose -f docker-compose.dev.yml --profile test run --rm backend-test mypy app/

# 🔹 Generate coverage report (opens in browser)
docker compose -f docker-compose.dev.yml --profile test run --rm backend-test pytest --cov=app --cov-report=html

# 🔹 Run contract testing against running backend
docker compose -f docker-compose.dev.yml --profile test run --rm backend-test schemathesis run http://backend:8000/openapi.json

# 🔹 Clean up test environment
docker compose -f docker-compose.dev.yml --profile test down -v

# 🔹 Makefile shortcuts (recommended)
make dev          # Start dev environment (only when needed)
make test         # Run all tests
make test-unit    # Run unit tests only
make lint         # Run linters
make coverage     # Run tests + generate HTML coverage report
make dev-down     # 🔴 Mandatory: Stop containers immediately when done (Resource Policy)
```

### Docker-First Rules

> ✅ **กฎเหล็ก (Docker-First):** 
> 1. ทุกคำสั่งพัฒนา/ทดสอบต้องรันผ่าน `docker compose` เท่านั้น — ไม่ติดตั้ง Python/Node ในเครื่องพัฒนา
> 2. อย่ารัน E2E/Contract Test ก่อน Lint/Type/Unit เพราะถ้าโค้ดผิดพื้นฐานจะเสียเวลาสร้างคอนเทนเนอร์เปล่าๆ
> 3. ทุก PR ต้องผ่าน `fast-checks` + `unit-integration` ในคอนเทนเนอร์ก่อน Merge
> 4. `contract-e2e` รันเฉพาะบน `main` หรือ PR ที่ถูก approve แล้ว (ประหยัดทรัพยากร)

### Testing Coverage (Docker-First)
- [ ] ทุกฟังก์ชันใน `services/` มี unit test ที่ mock `repository.py`
- [ ] ทุก endpoint ใน `routers/` มี integration test ที่ใช้ `TestClient`
- [ ] ทดสอบผ่าน `docker compose run --rm backend-test pytest ...` ได้ผลลัพธ์เหมือนรันในเครื่อง
- [ ] Coverage ตรงตามเป้าหมาย (§7.4: `services/` ≥90%, `routers/` ≥85%)
- [ ] Test ชื่อสื่อถึง FR/BR ที่ทดสอบ (เช่น `test_current_must_be_gte_previous`)

### Static Analysis & Security Checks (Docker-First)

การทดสอบไม่ใช่แค่รันโค้ด แต่ต้องตรวจสอบคุณภาพโค้ดตั้งแต่ก่อน Commit และตรวจสอบสภาพแวดล้อมคอนเทนเนอร์:

| Layer | Tool | ตรวจสอบอะไร | รันเมื่อไหร่ | Docker Context |
|-------|------|-----------|------------|---------------|
| **Python Lint/Format** | `Ruff` | Syntax, unused imports, PEP8, complexity | Pre-commit + CI (Fast) | `docker compose run --rm backend-test ruff check .` |
| **Python Type Check** | `Mypy` (Strict) | Type mismatch, SQLAlchemy 2.0 mapping, Pydantic v2 | Pre-commit + CI | `docker compose run --rm backend-test mypy app/` |
| **Python Security** | `Bandit` | Hardcoded secrets, unsafe SQL, weak crypto | Pre-commit + CI | `docker compose run --rm backend-test bandit -r app/` |
| **Frontend Lint/Type** | `ESLint` + `tsc --noEmit` | TS strict mode, unused vars, React hooks rules | Pre-commit + CI | Frontend container |
| **Dependency CVE** | `Safety` / `pip-audit` | Known vulnerabilities in `requirements.txt` | CI (Medium) | `docker compose run --rm backend-test safety check` |
| **Container/OS Security** | `Trivy` | Vulnerability in Docker image, OS packages, Redis/MinIO | CI (Medium) | `trivy image --severity HIGH,CRITICAL pms-backend:latest` |
| **Secret Scanning** | `Gitleaks` | Hardcoded keys, tokens, passwords in git history | Pre-commit + CI (Fast) | `docker compose run --rm backend-test gitleaks detect` |

---

## 🔄 CI/CD Pipeline

รันตามลำดับ **Fast → Slow**, **Cheap → Expensive** เพื่อให้ Developer ได้ Feedback เร็วที่สุด:

```yaml
# .github/workflows/ci.yml (Docker-First Version)
jobs:
  fast-checks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build test image
        run: docker compose -f docker-compose.dev.yml build backend-test
      - name: Lint & Format (Ruff + ESLint + Prettier)
        run: docker compose -f docker-compose.dev.yml run --rm backend-test ruff check .
      - name: Type Check (Mypy + tsc --noEmit)
        run: docker compose -f docker-compose.dev.yml run --rm backend-test mypy app/
      - name: Secret Scan (Gitleaks)
        run: docker compose -f docker-compose.dev.yml run --rm backend-test gitleaks detect
      - name: Dependency + Container Scan (Safety + Trivy)
        run: |
          docker compose -f docker-compose.dev.yml run --rm backend-test safety check
          trivy image --severity HIGH,CRITICAL pms-backend:latest
  
  unit-integration:
    needs: fast-checks
    runs-on: ubuntu-latest
    services:
      postgres: { image: postgres:18.4-alpine, ... }
      redis: { image: redis:7.4-alpine, ... }
    steps:
      - uses: actions/checkout@v4
      - name: Run Backend Tests in Container
        run: docker compose -f docker-compose.dev.yml run --rm backend-test pytest --cov=app --cov-report=xml
      - name: Coverage Gate
        run: docker compose -f docker-compose.dev.yml run --rm backend-test coverage report --fail-under=85
  
  contract-e2e:
    needs: unit-integration
    runs-on: ubuntu-latest
    steps:
      - name: Spin up full stack via Docker Compose
        run: docker compose -f docker-compose.dev.yml up -d
      - name: Run Schemathesis Contract Test
        run: docker compose -f docker-compose.dev.yml run --rm backend-test schemathesis run http://backend:8000/openapi.json
      - name: Run Playwright E2E
        run: docker compose -f docker-compose.dev.yml run --rm frontend-test playwright test
      - name: Tear down
        run: docker compose -f docker-compose.dev.yml down
```

---

## 🚀 Quick Start (Self-hosted Production)

### Step 1: Clone and Configure

```bash
git clone https://github.com/yourorg/property-management-system.git
cd property-management-system

# Create production env file
cp backend/.env.production.example backend/.env
# EDIT backend/.env with your values (SECRET_KEY, DB_PASS, etc.)
```

### Step 2: Generate Security Keys

```bash
# Generate SECRET_KEY (32+ chars)
python3 -c "import secrets; print(secrets.token_urlsafe(32))"

# Generate Fernet encryption key for ID cards
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Update `backend/.env` with these values.

### Step 3: Start the Stack

```bash
# Validate environment
bash scripts/validate_prod_env.sh

# Start all services
docker compose -f docker-compose.prod.yml up -d

# Wait for health check
sleep 10
curl http://localhost:8000/health
# Expected: {"status":"ok","version":"1.0.0"}

# Run database migrations
docker compose -f docker-compose.prod.yml exec backend alembic upgrade head

# Check logs
docker compose -f docker-compose.prod.yml logs -f backend
```

### Step 4: Verify Deployment

```bash
# Check running services
docker compose -f docker-compose.prod.yml ps

# Test API endpoints
curl http://localhost:8000/health
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"SecurePass123!"}'

# Verify docs are disabled (production mode)
curl http://localhost:8000/docs
# Expected: 404 Not Found
```

---

## ☁️ Cloud Deployment (Docker Registry + Orchestrator)

### Build & Push Multi-Arch Image

```bash
# Build and push to registry (amd64 + arm64)
bash scripts/release.sh --registry=ghcr.io/yourorg --version=1.0.0

# Or manually:
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t ghcr.io/yourorg/pms-backend:1.0.0 \
  -t ghcr.io/yourorg/pms-backend:latest \
  --push \
  -f backend/Dockerfile \
  --target production \
  backend/
```

### Pull and Run on Server

```bash
docker pull ghcr.io/yourorg/pms-backend:latest
docker run -d \
  --name pms-backend \
  -p 8000:8000 \
  -e DATABASE_URL="postgresql+asyncpg://..." \
  -e SECRET_KEY="..." \
  -e ID_CARD_ENCRYPTION_KEY="..." \
  -e DEBUG=false \
  ghcr.io/yourorg/pms-backend:latest
```

---

## 🔐 Environment Variables Reference

### Required (NO default — must be set)

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL async connection string | `postgresql+asyncpg://user:pass@db:5432/pms_prod` |
| `SECRET_KEY` | JWT signing key (≥32 chars) | Generated via `secrets.token_urlsafe(32)` |
| `ID_CARD_ENCRYPTION_KEY` | Fernet key for ID card encryption | Generated via `Fernet.generate_key()` |

### Security (with defaults for dev, override for production)

| Variable | Default | Description |
|----------|---------|-------------|
| `DEBUG` | `false` | Enable debug mode (dev only) |
| `CORS_ORIGINS` | `http://localhost:3000` | Comma-separated allowed origins |
| `APP_DOMAIN` | `http://localhost:3000` | Frontend URL for CORS/cookies |
| `APP_NAME` | `Property Management System` | Display name |
| `APP_VERSION` | `1.0.0` | Version string |

### Database

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_POOL_SIZE` | `20` | Connection pool size |
| `DB_MAX_OVERFLOW` | `40` | Max overflow connections |
| `DB_POOL_TIMEOUT` | `30` | Pool timeout (seconds) |
| `DB_POOL_RECYCLE` | `1800` | Connection recycle time |
| `DB_PRE_PING` | `true` | Validate connections before use |

### Redis

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_URL` | N/A | Redis connection string |
| `REDIS_PASSWORD` | N/A | Redis password |

### MinIO

| Variable | Default | Description |
|----------|---------|-------------|
| `MINIO_ENDPOINT` | `http://minio:9000` | MinIO/S3 endpoint |
| `MINIO_ACCESS_KEY` | `minioadmin` | Storage access key |
| `MINIO_SECRET_KEY` | N/A | Storage secret key |

---

## 🩺 Health Checks & Monitoring

### Built-in Health Endpoint

```bash
# Always available (even in production mode)
curl http://localhost:8000/health

# Response:
{
  "status": "ok",
  "version": "1.0.0"
}
```

### Docker Healthcheck

The Dockerfile includes a `HEALTHCHECK` directive that runs every 30 seconds:

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 30s
```

### Monitoring Endpoints

| Endpoint | Description | Auth Required |
|----------|-------------|---------------|
| `GET /health` | Basic health check | No |
| `GET /openapi.json` | OpenAPI spec (dev only) | No |
| `GET /api/v1/admin/audit-logs` | Audit log viewer | Yes (admin) |
| `GET /api/v1/admin/config` | System configuration | Yes (admin) |

### Production Logging Format

When `DEBUG=false`, all logs are JSON-formatted via structlog:

```json
{
  "event": "request_completed",
  "request_id": "a1b2c3d4",
  "method": "GET",
  "path": "/api/v1/dashboard/summary",
  "status_code": 200,
  "duration_ms": 45,
  "has_auth": true,
  "timestamp": "2026-05-31T10:30:00.123456Z",
  "logger": "app.main",
  "level": "info"
}
```

---

## 🛠️ Graceful Shutdown

The application handles SIGTERM/SIGINT for zero-downtime shutdown:

```bash
# Graceful stop (30s timeout)
docker compose -f docker-compose.prod.yml stop backend

# Force stop
docker compose -f docker-compose.prod.yml kill backend

# Observe shutdown logs
docker compose -f docker-compose.prod.yml logs backend
# Expected output:
# {"event": "signal_received", "signal": "SIGTERM"}
# {"event": "shutdown_initiated"}
# {"event": "db_pool_closed"}
# {"event": "shutdown_complete"}
```

---

## 📦 Backup & Restore

### Backup

```bash
# Quick backup (uses environment vars)
bash scripts/backup.sh

# With explicit database URL
bash scripts/backup.sh --db-url="postgresql+asyncpg://user:pass@localhost:5432/pms_prod"
```

### Restore

```bash
# Restore latest backup
bash scripts/restore.sh

# Dry-run (show what would happen)
bash scripts/restore.sh --dry-run

# Restore specific file
bash scripts/restore.sh --file=backup_20260531_120000.sql.gz

# With custom DB URL
bash scripts/restore.sh --db-url="postgresql://user:***@localhost:5432/pms_prod"
```

---

## 🔧 Troubleshooting

| Problem | Check | Solution |
|---------|-------|----------|
| **Health check fails** | Container logs | Run `docker compose logs backend` — check DB connectivity |
| **DB connection refused** | DB logs | `docker compose logs db` — verify credentials in `.env` |
| **Rate limiting too strict** | Rate limit config | Increase `MAX_REQUESTS_PER_MINUTE` in config.py |
| **Image too large** | Image size | `docker image ls` — target ≤350MB; check .dockerignore |
| **Load test failing** | Locust report | Run `make load-test` — check p95 < 500ms |
| **Migration fails** | Alembic logs | `docker compose exec backend alembic history` — check head |
| **Redis auth failure** | Redis config | Verify `REDIS_PASSWORD` in env matches `redis-server` command |
| **CORS errors** | Browser console | Verify `CORS_ORIGINS` includes your frontend URL |

---

## 📚 Related Documents

| Document | Location |
|----------|----------|
| Operations Guide | `backend/docs/OPERATIONS.md` |
| Architecture | `docs/ARCHITECTURE.md` |
| Module Specifications | [02-module-specs.md](02-module-specs.md) |
| API Contract | `http://localhost:8000/openapi.json` (dev mode) |
| Code Style | `backend/docs/CODE_STYLE.md` |