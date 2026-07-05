# Property Management System — Project Index

> **Quick Navigation for AI Agents & Developers**
>
> **For rules, workflow & global policies → [`AGENTS.md`](AGENTS.md) (READ FIRST)**
>
> **Last sync:** 2026-07-05

---

## 🔑 Essential Entry Points

| File | Purpose | When to Read |
|------|---------|--------------|
| [`AGENTS.md`](AGENTS.md) | **Global workflow, rules, project status** | **Always first** — every session |
| [`INDEX.md`](INDEX.md) | This file — project map & commands | When lost or need quick nav |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System architecture, C4 diagrams, ADRs | When designing or debugging |
| [`docs/DECISIONS/README.md`](docs/DECISIONS/README.md) | Architecture Decision Records (ADR) index | When checking past decisions |

---

## 📁 Project Structure

```
property-management-system/
├── AGENTS.md                    # 📜 Global workflow & rules (READ FIRST)
├── INDEX.md                     # 🗺️ This file — project map & commands
├── Makefile                     # 🐳 Docker shortcuts (make dev, make test, etc.)
├── docker-compose.dev.yml       # 🐳 Dev environment (backend, db, redis, minio)
├── docker-compose.prod.yml      # 🐳 Production stack
├── .github/workflows/ci.yml     # 🔄 CI/CD pipeline
│
├── docs/                        # 📚 Strategic Documentation
│   ├── ARCHITECTURE.md          # C4 diagrams, tech stack, ADRs
│   ├── REQUIREMENTS.md          # FR/NFR/BR, Actors
│   ├── DOMAIN_MODEL.md          # Entities, Aggregates
│   ├── GLOSSARY.md              # Terminology
│   ├── USER_STORIES.md          # User journeys
│   ├── RETROSPECTIVES/          # Sprint retrospectives
│   │
│   ├── DECISIONS/               # 📋 Architecture Decision Records (ADR)
│   │   ├── README.md            # Decision index & workflow
│   │   ├── 000-discussion-hermes-multi-agent.md  # 🟢 Accepted
│   │   ├── 001-adopt-hermes-single-e2e-profile.md # ✅ Accepted (Phase 1)
│   │   └── templates/           # Discussion & Decision templates
│   │
│   └── AI_AGENT_WORKFLOW/       # 🤖 Hermes usage guides (to be created)
│
├── backend/                     # 🐍 FastAPI Backend (Python 3.14+)
│   ├── app/
│   │   ├── modules/             # 9 modules: auth, property, tenant, billing, contract, maintenance, dashboard, notification, admin
│   │   ├── shared/              # database, security, audit, events, storage
│   │   └── workers/             # celery, tasks, schedulers
│   ├── docs/                    # Backend-specific docs
│   │   ├── 02-design/SDD/       # Modular SDD (11 files)
│   │   └── sprints/             # Sprint 1-8 plans
│   ├── tests/                   # 139 tests (unit + integration + load)
│   ├── alembic/                 # 7 migrations
│   └── Dockerfile               # Multi-stage, non-root
│
├── frontend/                    # ⚛️ React 19 + Vite 8 + PWA
│   ├── src/                     # 9 feature modules + shared kernel
│   ├── e2e/                     # Playwright E2E tests
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
make dev              # Start dev environment (hot-reload)
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
| **Understand architecture** | Read `docs/ARCHITECTURE.md` |
| **Check decisions** | Browse `docs/DECISIONS/README.md` |
| **Current Phase** | Phase 1: Single `pms-e2e` Profile (Decision 001) |
| **Run E2E Campaign** | `hermes -p pms-e2e -w chat -q "Execute E2E Campaign..."` |
| **Monitor Kanban** | `hermes kanban list` / `hermes kanban show` |
| **Stop everything** | `make dev-down` |

---

## 📌 Current Status (2026-07-05)

| Component | Status |
|-----------|--------|
| **Backend** | ✅ v1.0.0 Ready (9 modules, 139 tests) |
| **Frontend** | ✅ v1.0.0 Ready (React 19, PWA) |
| **Infrastructure** | ✅ Docker, CI/CD, MinIO, Redis |
| **Testing** | ✅ 139/139 pass, coverage ≥85% |
| **Hermes Integration** | 🟢 **Phase 1 Approved** — `pms-e2e` Profile |
| **Next** | Execute E2E Campaign → Phase 1 Gate Review |

---

## 🎯 Current Phase: Phase 1 — Single `pms-e2e` Profile

| Decision | File | Status |
|----------|------|--------|
| **Phase 1: Single `pms-e2e` Profile** | [`docs/DECISIONS/001-adopt-hermes-single-e2e-profile.md`](docs/DECISIONS/001-adopt-hermes-single-e2e-profile.md) | ✅ **Accepted** |
| **Discussion & Analysis** | [`docs/DECISIONS/000-discussion-hermes-multi-agent.md`](docs/DECISIONS/000-discussion-hermes-multi-agent.md) | 🟢 **Accepted** |

### Phase 1 Exit Criteria (Gate Review)
- [ ] `pms-e2e` profile สร้างและรันได้
- [ ] Kanban board `pms-sprint-e2e` ทำงาน (create/assign/complete tasks)
- [ ] E2E Campaign รันครบ 3-5 features (Auth, Billing, Property minimum)
- [ ] Master Bug Report ออกมาเป็น Markdown/JSON actionable
- [ ] Kanban tasks update Pass/Fail + Evidence (screenshots, traces, logs) ได้
- [ ] **Decision Gate:** Proceed to Phase 2 (Parallel/Orchestrator)? Yes/No/Modify

---

## 🚀 Quick Start: Phase 1 Implementation

```bash
# 1. สร้าง Profile
hermes profile create pms-e2e --clone

# 2. ตั้งค่า Tools
hermes -p pms-e2e tools enable terminal,file,code_execution,web,skills,memory,session_search,cronjob,kanban,browser,delegation

# 3. Init Kanban Board
hermes kanban init --name pms-sprint-e2e
hermes kanban lane add test-worker

# 4. Populate Tasks (5 features)
hermes kanban create "E2E-Auth: Login, Register, JWT refresh" --lane test-worker
hermes kanban create "E2E-Billing: Invoice CRUD, Payment, Meter reading" --lane test-worker
hermes kanban create "E2E-Property: Building, Floor, Room CRUD" --lane test-worker
hermes kanban create "E2E-Contract: Lease, Renewal, Expiry" --lane test-worker
hermes kanban create "E2E-Maintenance: Request, Assign, Complete" --lane test-worker

# 5. Run Agent (tmux)
tmux new-session -d -s pms-e2e 'hermes -p pms-e2e -w chat -q "Execute E2E Campaign: read Kanban board pms-sprint-e2e, execute all tasks in test-worker lane sequentially, run pytest + playwright + schemathesis for each feature, generate Master Bug Report, update Kanban with Pass/Fail + Evidence"'

# 6. Monitor
tmux attach -t pms-e2e
```

---

## 🔗 Related Repositories / Links

- **Hermes Agent Docs**: https://hermes-agent.nousresearch.com/docs/
- **Hermes Skills Hub**: https://github.com/NousResearch/hermes-agent-skills
- **Project GitHub**: (local only — no remote configured)

---

> **Navigation:** For rules, workflow & global policies → [`AGENTS.md`](AGENTS.md) | For architecture decisions → [`docs/DECISIONS/README.md`](docs/DECISIONS/README.md) | For architecture diagrams → [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)