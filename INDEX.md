# Property Management System — Project Index

> **Quick Navigation for AI Agents & Developers**
>
> **For rules, workflow & global policies → [`AGENTS.md`](AGENTS.md) (READ FIRST)**
>
> **Last sync:** 2026-08-31

---

## 🔑 Essential Entry Points

| File | Purpose | When to Read |
|------|---------|--------------|
| [`AGENTS.md`](AGENTS.md) | **Global workflow, rules, project status** | **Always first** — every session |
| [`INDEX.md`](INDEX.md) | This file — project map & commands | When lost or need quick nav |
| [`ROADMAP.md`](ROADMAP.md) | High-level project roadmap and execution plan link | When tracking milestone progress |
| [`docs/ROADMAP/PHASE-01-DETAIL.md`](docs/ROADMAP/PHASE-01-DETAIL.md) | Detailed Phase 1 Release Readiness execution plan & evidence | Authoritative release readiness status |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System architecture, C4 diagrams, ADRs | When designing or debugging |
| [`docs/DECISIONS/README.md`](docs/DECISIONS/README.md) | Architecture Decision Records (ADR) index | When checking past decisions |

---

## 📚 Additional Documentation

| File | Purpose |
|------|---------|
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | Contributing guidelines, branch strategy, PR process |
| [`docs/README.md`](docs/README.md) | Documentation index and entry point |
| [`docs/reports/`](docs/reports/) | Quality gate reports & verification records |
| [`docs/DECISIONS/`](docs/DECISIONS/) | Architecture Decision Records (ADRs) |

---

## 📁 Project Structure

```
property-management-system/
├── AGENTS.md                    # 📜 Global workflow & rules (READ FIRST)
├── INDEX.md                     # 🗺️ This file — project map & commands
├── ROADMAP.md                   # 🗺️ Project roadmap
├── Makefile                     # 🐳 Docker shortcuts (make dev, make test, etc.)
├── docker-compose.dev.yml       # 🐳 Dev environment (backend, db, redis, minio)
├── docker-compose.prod.yml      # 🐳 Production stack
├── .github/workflows/ci.yml     # 🔄 CI/CD pipeline
│
├── docs/                        # 📚 Strategic Documentation
│   ├── ROADMAP/                 # Phase execution plans (PHASE-01-DETAIL.md)
│   ├── ARCHITECTURE.md          # C4 diagrams, tech stack, ADRs
│   ├── REQUIREMENTS.md          # FR/NFR/BR, Actors
│   ├── DOMAIN_MODEL.md          # Entities, Aggregates
│   ├── GLOSSARY.md              # Terminology
│   ├── USER_STORIES.md          # User journeys
│   ├── RETROSPECTIVES/          # Sprint retrospectives
│   │
│   ├── DECISIONS/               # 📋 Architecture Decision Records (ADR)
│   │   ├── README.md            # Decision index & workflow
│   │   ├── 000-discussion-hermes-multi-agent.md
│   │   ├── 001-adopt-hermes-single-e2e-profile.md
│   │   ├── 002-login-dark-mode-color-scheme.md
│   │   ├── 003-login-physics-easing.md
│   │   ├── 004-login-view-transitions.md
│   │   ├── 005-adopt-orchestrator-evaluation-checklist.md
│   │   └── templates/           # Discussion & Decision templates
│   │
│   └── reports/                 # Quality & verification reports
│
├── backend/                     # 🐍 FastAPI Backend (Python 3.14+)
│   ├── app/
│   │   ├── modules/             # 9 modules: auth, property, tenant, billing, contract, maintenance, dashboard, notification, admin
│   │   ├── shared/              # database, security, audit, events, storage
│   │   └── workers/             # celery, tasks, schedulers
│   ├── docs/                    # Backend-specific docs
│   │   ├── 02-design/SDD/       # Modular SDD (11 files)
│   │   └── sprints/             # Sprint 1-8 plans
│   ├── tests/                   # 361 tests (unit + integration + load + contract)
│   ├── alembic/                 # 7 migrations
│   └── Dockerfile               # Multi-stage, non-root
│
├── frontend/                    # ⚛️ React 19 + Vite 8 + PWA (TypeScript 6.0+ Strict)
│   ├── src/                     # 9 feature modules + shared kernel
│   ├── e2e/                     # Playwright E2E tests (148 scenarios)
│   └── Dockerfile               # Multi-stage
│
├── scripts/                     # 🛠️ DevOps & Maintenance
│   ├── backup.sh | restore.sh   # pg_dump → MinIO
│   ├── release.sh               # Git tag → buildx → push → changelog
│   └── validate_prod_env.sh     # Pre-flight checks
│
└── shared-contracts/            # 📄 Shared TypeScript/Python contracts
```

---

## 🔑 Key Workflows (Commands)

### Development
```bash
make dev              # Start dev environment (self-contained: migrate + seed admin, hot-reload)
make dev-restart      # Restart dev environment (dev-down + dev)
make dev-down         # 🔴 STOP dev environment (MANDATORY when done)
```

### Testing
```bash
make test             # All tests in isolated container
make test-unit        # Unit tests only
make test-coverage    # Coverage report (backend/htmlcov/index.html)
make test-frontend    # Frontend tests (Vitest)
make test-e2e         # End-to-End tests with Playwright
```

### Quality
```bash
make lint             # Ruff, mypy, bandit
make typecheck        # mypy type checking
make security         # Security scans (bandit, safety)
```

### Database
```bash
make db-migrate       # Run Alembic migrations
make db-reset         # DROP + CREATE + migrate (⚠️)
make db-shell         # Open psql shell in database container
```

### Build & Deploy
```bash
make build            # Production Docker image
make prod-up          # Production stack
make prod-down        # Stop production
make backup           # pg_dump → MinIO
make restore          # Restore from backup
make release          # Git tag → buildx → push → changelog
```

---

## 🤖 AI Agent Quick Reference

| Task | Command / File |
|------|----------------|
| **Start here** | Read `AGENTS.md` → Read this `INDEX.md` |
| **Current Roadmap** | Read `docs/ROADMAP/PHASE-01-DETAIL.md` |
| **Understand architecture** | Read `docs/ARCHITECTURE.md` |
| **Check decisions** | Browse `docs/DECISIONS/README.md` |
| **Current Phase** | Phase 1: Release Readiness / P1-W06 Documentation Reconciliation |
| **Stop everything** | `make dev-down` |

---

## 📌 Current Status (2026-08-31)

| Component | Status |
|-----------|--------|
| **Current Phase** | Phase 1: Release Readiness — P1-W06 Documentation Reconciliation |
| **Backend** | ✅ 361/361 tests passed, 84.89% coverage (target 85%) |
| **Frontend** | ✅ 53 test files, 955/955 unit tests passed, React 19, PWA, A11y |
| **E2E Suite** | ✅ 148 scenarios: 116 passed, 32 skipped, 0 failed |
| **Infrastructure** | ✅ Docker, CI/CD, MinIO, Redis |
| **Next** | P1-W06 Documentation Reconciliation → P1-W07 Production Preflight |

---

## 🎯 Current Phase: Phase 1 — Release Readiness

See authoritative execution detail in [`docs/ROADMAP/PHASE-01-DETAIL.md`](docs/ROADMAP/PHASE-01-DETAIL.md).

### Architecture Decision Records (ADR Inventory)

| ID | Title | Status | Link |
|----|-------|--------|------|
| 000 | Adopt Hermes Multi-Agent Profiles + Kanban Board | 🟢 Accepted | [`docs/DECISIONS/000-discussion-hermes-multi-agent.md`](docs/DECISIONS/000-discussion-hermes-multi-agent.md) |
| 001 | Adopt Hermes Single E2E Profile (pms-e2e) for Phase 1 E2E Campaign | ✅ Accepted | [`docs/DECISIONS/001-adopt-hermes-single-e2e-profile.md`](docs/DECISIONS/001-adopt-hermes-single-e2e-profile.md) |
| 002 | Login Page — Respect User Preferences (Dark Mode + color-scheme) | ✅ Accepted | [`docs/DECISIONS/002-login-dark-mode-color-scheme.md`](docs/DECISIONS/002-login-dark-mode-color-scheme.md) |
| 003 | Login Page — Natural Interactions (Physics-based Easing) | ✅ Accepted | [`docs/DECISIONS/003-login-physics-easing.md`](docs/DECISIONS/003-login-physics-easing.md) |
| 004 | Login Page — Guided Navigation (View Transitions) | ✅ Accepted | [`docs/DECISIONS/004-login-view-transitions.md`](docs/DECISIONS/004-login-view-transitions.md) |
| 005 | Adopt Orchestrator Evaluation Checklist as Mandatory Standard | ✅ Accepted | [`docs/DECISIONS/005-adopt-orchestrator-evaluation-checklist.md`](docs/DECISIONS/005-adopt-orchestrator-evaluation-checklist.md) |

---

> **Navigation:** For rules, workflow & global policies → [`AGENTS.md`](AGENTS.md) | For roadmap & execution → [`docs/ROADMAP/PHASE-01-DETAIL.md`](docs/ROADMAP/PHASE-01-DETAIL.md) | For architecture decisions → [`docs/DECISIONS/README.md`](docs/DECISIONS/README.md) | For architecture diagrams → [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)