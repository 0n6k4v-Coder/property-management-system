# Property Management System (PMS)

> **Production-ready property management system for dormitories, apartments, and rental properties.**
> Built with **FastAPI (Python 3.14+)** + **React 19 + Vite 8 + PWA** + **PostgreSQL 18 + Redis + MinIO**

---

## 🚀 Quick Start

### Prerequisites
- **Docker Desktop** (Docker Engine + Docker Compose v2)
- **Make** (for convenient commands)
- **Git**

### Start Development Environment
```bash
# 1. Clone and enter project
git clone <repository-url>
cd property-management-system

# 2. Configure environment (first time only)
cp backend/.env.example backend/.env
# Edit backend/.env with your SECRET_KEY and ID_CARD_ENCRYPTION_KEY

# 3. Start all services (backend, frontend, database, redis, minio)
make dev

# 4. Access the application
# Frontend: http://localhost:3000
# Backend API: http://localhost:8000
# API Docs (dev only): http://localhost:8000/docs
# MinIO Console: http://localhost:9001
```

### Stop Development Environment
```bash
make dev-down
```

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Docker Compose                            │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   Caddy     │  │  Frontend   │  │   Backend   │              │
│  │  (Proxy)    │──▶│  (React 19) │──▶│  (FastAPI)  │              │
│  └─────────────┘  └─────────────┘  └──────┬──────┘              │
│                                            │                     │
│         ┌─────────────┐  ┌─────────────┐   │   ┌─────────────┐  │
│         │ PostgreSQL  │  │    Redis    │◀──┼──▶│   MinIO     │  │
│         │    18.4+    │  │    7.4+     │   │   │   (S3)      │  │
│         └─────────────┘  └─────────────┘   │   └─────────────┘  │
│                                            │                     │
│                                 ┌──────────┴──────────┐        │
│                                 │   Celery Workers    │        │
│                                 │  (Background Jobs)  │        │
│                                 └─────────────────────┘        │
└─────────────────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| **Backend API** | FastAPI | 0.136+ |
| **Language** | Python | 3.14+ |
| **Database** | PostgreSQL + asyncpg | 18.4+ |
| **Cache/Queue** | Redis | 7.4+ |
| **Object Storage** | MinIO (S3-compatible) | RELEASE.2024+ |
| **Frontend** | React + TypeScript | 19.2+ |
| **Build Tool** | Vite | 8.0+ |
| **State Management** | TanStack Query | 5.100+ |
| **Routing** | React Router | 7.15+ |
| **Forms** | React Hook Form + Zod | 7.76+ / 4.4+ |
| **Charts** | Recharts | 3.8+ |
| **Testing** | Vitest + Playwright | 4.0+ / 1.60+ |
| **PWA** | Service Worker + IndexedDB | Native |
| **CI/CD** | GitHub Actions | - |

---

## 📁 Project Structure

```
property-management-system/
├── .github/workflows/ci.yml       # CI/CD pipeline
├── AGENTS.md                       # AI Agent guidelines
├── Makefile                        # Docker shortcuts (408 lines)
├── docker-compose.dev.yml          # Dev stack
├── docker-compose.prod.yml         # Prod stack
│
├── backend/                        # FastAPI Backend (v1.0.0)
│   ├── app/
│   │   ├── modules/                # 9 Feature modules
│   │   │   ├── auth/               # Authentication & Users
│   │   │   ├── property/           # Property → Building → Floor → Room
│   │   │   ├── tenant/             # Tenant Management (encrypted ID cards)
│   │   │   ├── billing/            # Meter readings, Invoices, Payments
│   │   │   ├── contract/           # Lease contracts (partial index BR-01)
│   │   │   ├── maintenance/        # Maintenance requests (state machine)
│   │   │   ├── dashboard/          # Aggregated business metrics
│   │   │   ├── notification/       # Notifications (fail-silent)
│   │   │   └── admin/              # Audit logs, system config
│   │   ├── shared/                 # Cross-cutting kernel
│   │   ├── workers/                # Celery tasks & schedulers
│   │   └── middleware/             # Security, RBAC, Rate limit, CORS
│   ├── tests/                      # 139 tests (≥85% coverage)
│   ├── alembic/                    # 7 migrations
│   ├── docs/                       # SDD, Sprints, CODE_STYLE, OPERATIONS
│   └── Dockerfile                  # Multi-stage, 254MB
│
├── frontend/                       # React 19 SPA + PWA (v1.0.0)
│   ├── src/
│   │   ├── features/               # 9 Feature modules
│   │   ├── shared/                 # AuthContext, fetchClient, PWA, UI Kit
│   │   ├── layouts/                # AuthLayout, MainLayout
│   │   └── routes/                 # ProtectedRoute, GuestRoute, lazy-load
│   ├── e2e/                        # Playwright E2E (3 flows + A11y)
│   ├── docs/                       # Frontend SDD, Screen specs
│   └── Dockerfile                  # Multi-stage
│
├── shared-contracts/               # OpenAPI → TypeScript types
│   ├── openapi.json                # Generated from backend
│   └── types/
│       ├── backend/                # Pydantic → JSON Schema
│       └── frontend/               # TypeScript + Zod schemas
│
├── docs/                           # Strategic documentation
│   ├── ARCHITECTURE.md             # C4 diagrams, ADRs, tech decisions
│   ├── REQUIREMENTS.md             # FR/NFR/BR, Actors
│   ├── DOMAIN_MODEL.md             # Entities, Aggregates
│   ├── GLOSSARY.md                 # Terminology
│   ├── USER_STORIES.md             # User journeys
│   └── RETROSPECTIVES/             # Sprint retrospectives
│
└── scripts/                        # DevOps automation
    ├── backup.sh                   # pg_dump → MinIO
    ├── restore.sh                  # Verified restore + integrity
    ├── release.sh                  # Tag → buildx → push → changelog
    ├── validate_prod_env.sh        # Pre-flight checks
    └── init-minio-buckets.sh       # Bucket initialization
```

---

## ✨ Features

### Core Modules (Backend 100% Complete)
- **🔐 Authentication** — JWT (15m/7d), Argon2id, Invite flow, Refresh rotation
- **🏢 Property Hierarchy** — Property → Building → Floor → Room (BR-11, BR-12)
- **👥 Tenant Management** — Encrypted ID cards (Fernet), Search, History
- **💰 Billing & Metering** — Meter readings, Cascade utility rates, Invoice generation, Payments
- **📝 Contracts** — Lease creation, Termination, Renewal alerts, Partial unique index (BR-01)
- **🔧 Maintenance** — Request tracking, Status transitions (BR-09), SLA monitoring
- **📊 Dashboard** — Revenue, Occupancy, Overdue, Real-time aggregates
- **🔔 Notifications** — In-app, Email, LINE (fail-silent, cron delivery)
- **⚙️ Admin** — Audit log viewer, System configuration, RBAC

### Frontend Features (v1.0.0)
- **📱 PWA Offline-First** — Service Worker (CacheFirst/NetworkFirst), IndexedDB queue, Background sync
- **⚡ Performance** — Bundle ≤150KB gzip, Lighthouse CI ≥90, Code-split lazy routes
- **♿ Accessibility** — axe-core 0 violations, WCAG 2.1 AA
- **🧪 Testing** — Vitest (unit), Playwright (E2E: auth, meter-offline-sync, invoice-payment)

---

## 🛠️ Development Commands

```bash
# Development
make dev              # Start dev environment (hot-reload)
make dev-down         # Stop dev environment
make dev-logs         # View backend logs
make dev-shell        # Shell into backend container

# Testing
make test             # All tests (backend + frontend)
make test-unit        # Backend unit tests only
make test-frontend    # Frontend Vitest tests
make test-e2e         # Playwright E2E tests
make test-coverage    # HTML coverage report

# Quality
make lint             # Backend: ruff, mypy, bandit
make lint-frontend    # Frontend: ESLint + TSC
make typecheck        # Backend mypy strict
make security         # Bandit + Safety scans

# Database
make db-migrate       # Run Alembic migrations
make db-reset         # Drop + Create + Migrate (⚠️ destroys data)
make db-shell         # psql shell

# Build & Deploy
make build            # Build production Docker image
make build-dev        # Build dev image
make prod-up          # Start production stack
make prod-down        # Stop production stack
make prod-validate    # Pre-flight production checks

# Backup & Restore
make backup           # Backup DB to MinIO
make restore          # Restore from latest backup

# Release
make release          # Full release pipeline
make release-dry-run  # Validate without publishing
```

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [Architecture](docs/ARCHITECTURE.md) | C4 diagrams, ADRs, tech decisions |
| [Requirements](docs/REQUIREMENTS.md) | FR/NFR/BR, Actors |
| [Domain Model](docs/DOMAIN_MODEL.md) | Entities, Aggregates, Domain Events |
| [Backend SDD](backend/docs/02-design/SDD/_index.md) | Implementation blueprint (11 files) |
| [Frontend SDD](frontend/docs/02-design/SDD/_index.md) | Frontend architecture, integration |
| [API Reference](API.md) | Generated from OpenAPI spec |
| [Security](SECURITY.md) | Threat model, encryption, reporting |
| [Operations](backend/docs/OPERATIONS.md) | Runbooks, backup/restore, monitoring |

---

## 🔐 Security

- **Authentication**: JWT with 15min access / 7day refresh tokens, rotation on use
- **Password Hashing**: Argon2id (OWASP 2026 recommended)
- **PII Encryption**: ID cards encrypted with Fernet (AES-256-GCM) at rest
- **Audit Logging**: All sensitive operations logged with user, IP, timestamp
- **Rate Limiting**: 100 req/min/IP on auth endpoints
- **CORS**: Configurable origins, credentials supported
- **Security Headers**: HSTS, CSP, X-Frame-Options via middleware

See [SECURITY.md](SECURITY.md) for full security policy and vulnerability reporting.

---

## 🧪 Testing

```bash
# Backend: 139 tests (unit + integration + load + contract)
# Coverage: ≥85% overall, ≥90% services, ≥85% routers
make test-coverage

# Frontend: Vitest + Playwright + Axe A11y
cd frontend && npm run test && npm run test:e2e && npm run test:a11y
```

---

## 📦 Production Deployment

```bash
# 1. Validate environment
make prod-validate

# 2. Start production stack
make prod-up

# 3. Verify health
curl https://your-domain/health

# 4. Set up scheduled backups (cron)
# See scripts/backup.sh and backend/docs/OPERATIONS.md
```

### Production Stack Includes
- Caddy reverse proxy with automatic HTTPS
- PostgreSQL with WAL archiving
- Redis with persistence
- MinIO with lifecycle policies
- Prometheus + Grafana (optional)
- Celery workers with health checks

---

## 🤝 Contributing

1. Read [AGENTS.md](AGENTS.md) for workflow rules
2. Follow [CODE_STYLE.md](backend/docs/CODE_STYLE.md)
3. Run `make lint && make test` before committing
4. Conventional commits: `feat(scope): message`, `fix(scope): message`

---

## 📄 License

Proprietary — Internal use only.

---

## 📞 Support

- **Issues**: GitHub Issues
- **Security**: See [SECURITY.md](SECURITY.md)
- **Documentation**: `/docs` and backend/frontend `docs/` folders