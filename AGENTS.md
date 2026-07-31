# AGENTS.md — Property Management System

**คู่มือสำหรับ AI Agent ที่ทำงานในโปรเจกต์นี้ อ่านก่อนเริ่มทำงานทุกครั้ง**    
**Last Updated:** 2026-07-07    
**Version:** 3.2    
**Status:** Backend v1.0.0 Complete — Frontend v1.0.0 Complete — **Phase 1: E2E Campaign (pms-e2e Profile)**

---

## 📊 Current Status Dashboard

| Component | Status | Details |
|-----------|--------|---------|
| **Backend** | ✅ v1.0.0 Ready | 9 modules, 139 tests, production Docker, Local CI preferred |
| **Frontend** | ✅ v1.0.0 Ready | 9 feature modules, E2E suite, PWA, Lighthouse CI, A11y audit |
| **Documentation** | ⚠️ 85% Complete | **Exists (referenced):** PROMPT.md, E2E_TEST_STRATEGY.md, shared-contracts/, backend SDD, frontend SDD, ARCHITECTURE.md, REQUIREMENTS.md, DOMAIN_MODEL.md, USER_STORIES.md, GLOSSARY.md, API.md (docs/API.md — central API contract, kept in sync with routers)  |  **Missing at root:** SECURITY.md, UX_SPEC/ |
| **Infrastructure** | ✅ Ready | Local CI preferred, backup/restore scripts, prod compose, MinIO, Redis |
| **Testing** | ✅ 100% Pass | 139/139 tests, coverage ≥85%, async_client pattern stable |

> ✅ **สรุป:** Backend + Frontend พร้อมใช้งานจริง 100% — Next Step: v1.0.0 Release & Production Deployment

---

## 🏗️ Project Structure (Verified & Actual)

**CRITICAL:** AI Agent ต้องสร้างไฟล์และอ้างอิง path ตรงตามโครงสร้างนี้เท่านั้น ห้ามสร้างไฟล์ข้ามชั้นหรือวางผิดที่

```text
property-management-system/
├── .github/workflows/ci.yml       # ✅ CI pipeline config (Local CI primary, GitHub Actions as backup)
├── AGENTS.md                      # 📜 Global Workflow & Rules (This file)
├── Makefile                       # ✅ Docker shortcuts (408 lines)
├── docker-compose.dev.yml         # ✅ Dev stack (backend, db, redis, minio)
├── docker-compose.prod.yml        # ✅ Prod stack (multi-service, healthchecks)
│
├── backend/                       # ✅ FastAPI Backend (Python 3.14+) — v1.0.0 Complete
│   ├── app/
│   │   ├── main.py                # App factory + 9 module routers + middleware
│   │   ├── config.py              # Pydantic Settings
│   │   ├── health.py              # ✅ Docker/K8s health check
│   │   ├── modules/
│   │   │   ├── auth/              # ✅ Sprint 1 (5 endpoints)
│   │   │   ├── property/          # ✅ Sprint 2 (Property→Building→Floor→Room)
│   │   │   ├── tenant/            # ✅ Sprint 2 (Fernet-encrypted ID card)
│   │   │   ├── billing/           # ✅ Sprint 3 (meter, rates, invoice, payment)
│   │   │   ├── contract/          # ✅ Sprint 4 (BR-01 partial index)
│   │   │   ├── maintenance/       # ✅ Sprint 5 (BR-09 status transition)
│   │   │   ├── dashboard/         # ✅ Sprint 6 (read-optimized aggregation)
│   │   │   ├── notification/      # ✅ Sprint 6 (fail-silent, cron delivery) + 2026-07-11 anti-pattern redesign: #5 scope, #3/#15 202+Celery, #1 idempotency, #20 Cache-Control, #13 pagination (23 DB-free tests)
│   │   │   └── admin/             # ✅ Sprint 7 (audit viewer, config)
│   │   ├── shared/                # ✅ database, deps, security(Argon2id), audit, events, etc.
│   │   ├── middleware/            # ✅ security.py, rbac.py, logging.py, auth.py, rate_limit.py, cors.py
│   │   └── workers/               # ✅ celery_app.py, tasks.py, schedulers.py (stubs)
│   ├── docs/                     # 🔹 Backend-Specific Implementation Docs
│   │   ├── 02-design/SDD/        # 📘 Modular SDD (v1.4 split into 11 ไฟล์)
│   │   │   ├── 00-overview.md ~ 09-deployment.md  # Document Control → Deployment
│   │   │   └── _index.md         # TOC + Quick Navigation
│   │   ├── sprints/              # 📘 Sprint Plans (1–8 Complete)
│   │   │   └── SPRINT_1.md ~ SPRINT_8.md          # ✅ All complete
│   │   ├── CODE_STYLE.md         # ✅ Coding standards (1,260 lines)
│   │   └── OPERATIONS.md         # ✅ Runbooks, backup/restore
│   ├── tests/                     # ✅ 139 tests (unit + integration + load + contract)
│   ├── alembic/                   # ✅ 7 migrations (001–007)
│   ├── Dockerfile                 # ✅ Multi-stage, non-root, 254MB
│   └── scripts/                   # ✅ init-prod-db.sql, create_tables.py
│
├── frontend/                      # ✅ Frontend v1.0.0 (React 19 + Vite 8 + PWA, **JS + JSDoc, no TypeScript**)
│   ├── src/                       # ✅ 9 feature modules + shared kernel (JS + JSDoc, jsconfig + checkJs, .js with JSX)
│   ├── e2e/                       # ✅ Playwright E2E (3 flows + A11y)
│   ├── docs/                      # ✅ SDD, screen specs, sprint plans
│   └── public/                    # ✅ PWA manifest, icons, offline fallback
│
├── docs/                          # 📘 Root-Level Strategic Docs
│   ├── ARCHITECTURE.md            # ✅ C4 diagrams, Tech stack, ADRs (1,525 lines)
│   ├── REQUIREMENTS.md            # ✅ FR/NFR/BR, Actors
│   ├── DOMAIN_MODEL.md            # ✅ Entities, Aggregates
│   ├── GLOSSARY.md                # ✅ Terminology
│   ├── USER_STORIES.md            # ✅ User journeys
│   └── RETROSPECTIVES/            # ✅ sprint-1.md
│
├── scripts/                       # 🛠️ DevOps & Maintenance
│   ├── backup.sh                  # pg_dump → MinIO
│   ├── restore.sh                 # Verified restore + integrity check
│   ├── release.sh                 # Git tag → buildx → push → changelog
│   ├── validate_prod_env.sh       # Pre-flight checks
│   └── init-minio-buckets.sh      # Bucket initialization
│
└── .dockerignore, .env*, .gitignore
```

### กฎการใช้โครงสร้าง (Structure Rules)
1. **Root Level:** เก็บเฉพาะ Config, CI/CD, Scripts และ Root Docs เท่านั้น — **ห้ามมี Source Code**
2. **แยก Docs ชัดเจน:**
   - `docs/` (Root) → เอกสารเชิงกลยุทธ์, Architecture, Business Rules
   - `backend/docs/02-design/SDD/` → Implementation Blueprint (modular)
   - `backend/docs/sprints/` → Sprint Plans (1–8)
   - `backend/docs/` → CODE_STYLE.md, OPERATIONS.md
   - `frontend/docs/` → Frontend Architecture, Integration, UX Specs
3. **Code Location:** Python → `backend/app/`, **JS + JSDoc** → `frontend/src/` (no TypeScript, uses `jsconfig.json` + `checkJs`)
4. **Missing Files Reference:** หากเอกสารอ้างอิงไฟล์ที่ยังไม่มี → ให้สร้างไฟล์นั้นก่อนเริ่มงาน หรือแจ้ง Human เพื่อปรับเอกสาร

---

## 🔄 AI Native SDLC Workflow

โปรเจกต์นี้ใช้ **AI-Driven Development** ซึ่ง AI มีส่วนร่วมทุกเฟส Human ทำหน้าที่ตัดสินใจและ review

### หลักการทำงาน

| บทบาท | AI | Human |
|---|---|---|
| **Propose** | วิเคราะห์, ออกแบบ, implement, ทดสอบ | — |
| **Decide** | — | approve, ปรับ scope, reject |
| **Execute** | เขียนโค้ด, สร้างเอกสาร, รัน CI/CD | review diff, verify output |
| **Domain** | — | กำหนด business rules, UX flow |

### กฎที่ต้องปฏิบัติ

```
❶ Propose ก่อนเสมอ — อย่า implement โดยไม่ได้รับ approve
❷ ทีละ feature — ทำให้ work + test pass ก่อน แล้วค่อยไปต่อ
❸ แก้เอกสารที่เกี่ยวข้องก่อนเสมอ แล้วค่อย propagate ลงโค้ด
❹ FR ID เป็น immutable — ห้าม reassign, append-only ต่อ prefix
❺ อ่าน docs/02-design/SDD/_index.md + CODE_STYLE.md + AGENTS.md ก่อนเขียนโค้ดเสมอ
❻ ตรวจสอบว่าโค้ดตรงตาม Traceability Matrix — FR → File → Test
❼ รัน `make dev-down` ทันทีเมื่อเสร็จงาน — ห้ามทิ้งคอนเทนเนอร์รันค้าง
```

---

## 🛡️ Architecture Guardrails (AI Agent ต้องปฏิบัติตาม)

### Layered Responsibility (ห้ามละเมิด)
| Layer | หน้าที่ | ห้ามทำ |
|-------|--------|--------|
| `routers/*.py` | รับ request, validate input (Pydantic), call service, return response | ❌ ไม่มี business logic, ❌ ไม่เรียก DB โดยตรง |
| `services/*.py` | Business logic, cascade resolution, audit logging, transaction control | ❌ ไม่เรียก DB โดยตรง (ใช้ repo), ❌ ไม่ใช้ HTTP framework objects |
| `repository.py` | Database queries เท่านั้น (SQLAlchemy async) | ❌ ไม่มี business logic |
| `models.py` | SQLAlchemy ORM definitions เท่านั้น | ❌ ไม่มี method ที่มี logic |
| `schemas.py` | Pydantic request/response models เท่านั้น | ❌ ไม่มี validation ที่เป็น business rule |

### Cross-Module Communication
- ❌ ห้าม `from modules.X import ...` ใน `modules.Y`
- ✅ ใช้ `shared/events.py` สำหรับ domain events
- ✅ ใช้ service interface สำหรับ sync calls ข้าม module
- ✅ Dependency ต้องเป็น DAG (ไม่มี circular import)

### Security & Audit
- ทุก sensitive operation ต้องเรียก `shared/audit.log_audit()`
- Password hashing: **Argon2id** (OWASP 2026) ผ่าน `passlib[argon2]`
- ID card ต้อง encrypt ด้วย Fernet ก่อนเก็บลง DB
- JWT access token expiry: 15 นาที, refresh token: 7 วัน
- ทุก API endpoint ที่ไม่ใช่ `/auth/*` ต้องมี `Authorization: Bearer <token>`
- Rate limiting: 100 req/min/IP บน auth endpoints (middleware fallback)

### Testing
- ทุกฟังก์ชันใน `services/` ต้องมี unit test (mock `repository.py`)
- ทุก endpoint ใน `routers/` ต้องมี integration test (`async_client` pattern)
- ใช้ `httpx.AsyncClient + ASGITransport` — ห้ามใช้ `TestClient` ใน Python 3.14+
- Coverage target: `services/` ≥90%, `routers/` ≥85%, overall ≥85%
- ❗ **ก่อนเขียน test สำหรับ backend error: ต้อง verify `fetchClient.ts` handle error format จริงของ backend** (FastAPI `HTTPException` ส่ง `{detail}` ไม่ใช่ `{error}`)

---

## 🐳 Docker-First & Resource Policy

> 📌 **สำคัญ:** `Makefile` อยู่ที่ **root ของโปรเจกต์** — รันจากที่นี่เสมอ

### Essential Commands
```bash
make dev           # เริ่มสภาพแวดล้อมพัฒนา (self-contained: migrate + seed admin)
make dev-restart   # รีสตาร์ทสภาพแวดล้อม (dev-down + dev)
make test-unit     # รัน unit tests
make test-coverage # รายงานความครอบคลุม
make lint          # ตรวจสอบคุณภาพโค้ด
make dev-down      # 🔴 ปิดสภาพแวดล้อมทันที (Resource Policy)
```

### Resource Policy (Effective 2026-05-27)
```text
✅ Default State: Containers OFF
✅ Start Condition: Only when actively developing/testing
✅ End Condition: Immediately run `make dev-down` when done
✅ Rationale: Save RAM/CPU/Disk I/O, prevent port conflicts, reduce noise

❌ Forbidden:
- make dev && sleep infinity  # Don't leave containers running idle
- Running pytest/ruff on host # Use docker compose run only
- Installing Python/Node on host # Use containers exclusively
```

---

## 📐 Documentation Standards

### Required Documents Before Coding
| Phase | Must-Have Docs | Optional/Deferred |
|-------|---------------|------------------|
| **Backend Dev** | docs/02-design/SDD/_index.md, CODE_STYLE.md, Sprint Plan | README.md, SECURITY.md (deferred) |
| **Frontend Dev** | frontend/docs/ARCHITECTURE.md, INTEGRATION.md, UX_SPEC/SCREEN_SPECS.md | Full UX spec, DATABASE.md |
|| **Production** | DEPLOYMENT.md, OPERATIONS.md, Local CI config | CHANGELOG.md, Release Notes |

### Cross-Reference Rules
- หากเอกสารอ้างอิงไฟล์ที่ไม่มีอยู่ → สร้างไฟล์นั้นก่อน หรือแจ้ง Human เพื่อปรับเอกสาร
- ห้ามอ้างอิง path ที่ผิด (เช่น `docs/SDD.md` → ต้องเป็น `backend/docs/02-design/SDD/`)
- อัปเดต Traceability Matrix ใน docs/02-design/SDD/07-traceability.md เมื่อเพิ่ม FR ใหม่

---

## 🚀 Implementation Readiness Checklist

### Backend ✅ Ready
```
✅ 9 Modules: auth, property, tenant, billing, contract, maintenance, dashboard, notification, admin
✅ Shared Kernel: database, security(Argon2id), audit, events, validators, storage
✅ Middleware: security, rbac, logging, auth, rate_limit, cors
✅ Workers: celery_app, tasks, schedulers (stubs)
✅ Tests: 139/139 pass, coverage ≥85%, async_client pattern stable
✅ Docker: multi-stage, non-root, 254MB, healthcheck, graceful shutdown
✅ CI/CD: Local CI preferred (unlimited-free), GitHub Actions config present but not primary
✅ Migration: 001–007 applied, upgrade/downgrade safe
```

### Frontend ✅ v1.0.0 Complete
```
✅ 9 Modules: auth, billing, dashboard, meter, property, reports, tenant, contract, maintenance
✅ Stack: React 19 + Vite 8 + **JS + JSDoc (NOT TypeScript), jsconfig + checkJs, .js with JSX**
✅ Shared Kernel: fetchClient, AuthContext, PWA (SW + IDB queue + sync), UI components
✅ Routing: React Router v7 lazy-load + ProtectedRoute + GuestRoute
✅ Testing: Vitest (unit), Playwright (E2E 3 flows), axe-core (A11y 0 violations)
✅ PWA: Service Worker (CacheFirst/NetworkFirst), offline fallback, manifest
✅ Performance: Bundle ≤150KB gzip, Lighthouse CI ≥90, visualizer treemap
✅ E2E: auth-flow, meter-offline-sync, invoice-payment (all mocked)
✅ Docker: multi-stage Dockerfile, docker-compose dev/test profiles
✅ Documentation: README.md, SPRINT_1–6.md all complete
```

---

## 🔄 Change Control Protocol

```text
เมื่อมีการเปลี่ยนแปลง:

1. แก้เอกสารที่เกี่ยวข้องก่อน (docs/02-design/SDD/_index.md, Sprint Plan, Architecture)
2. หากเปลี่ยน tech stack/pattern/boundary → แก้ docs/ARCHITECTURE.md
3. หากเปลี่ยน module spec/function signature → แก้ docs/02-design/SDD/02-module-specs.md
4. หากแก้ API Contract → แก้ docs/02-design/SDD/03-api-contract.md + frontend/docs/INTEGRATION.md
5. หากแก้ UX Spec → แก้ docs/UX_SPEC/SCREEN_SPECS.md
6. แจ้งทีม/บันทึกใน commit message ว่า "docs: update SDD for FR-XXX"

❌ ห้าม:
- แก้โค้ดโดยไม่แก้เอกสารที่เกี่ยวข้อง
- แก้เอกสารหลายไฟล์ใน commit เดียวโดยไม่อธิบายความสัมพันธ์
- ข้ามขั้นตอน propose → approve → implement
- เปลี่ยน public interface โดยไม่แจ้งทีม
```

---

## 🤖 AI Agent Quick Reference

### ก่อนเริ่มงานทุกครั้ง
```
1. อ่านไฟล์นี้ (AGENTS.md) → เข้าใจกฎและสถานะปัจจุบัน
2. อ่าน INDEX.md → เข้าใจโครงสร้างโปรเจกต์และคำสั่งเร็ว
3. อ่าน backend/docs/02-design/SDD/_index.md → เลือกไฟล์ที่เกี่ยวข้องกับงาน
4. อ่าน docs/ARCHITECTURE.md → เข้าใจภาพรวมระบบ
5. ตรวจสอบ frontend/docs/ (ถ้าทำ Frontend) → เข้าใจ integration patterns
6. 🔴 **อ่าน .agents/log/SELF_CRITIC.md** → ดู Mistakes Made + Improvements & Rules ป้องกันทำผิดซ้ำจาก Session เก่า
7. เริ่มงานตาม Sprint Plan → Propose → Implement → Test → PR
8. รัน `make dev-down` เมื่อเสร็จ
```

### เมื่อเจอปัญหา
```
❓ docs/02-design/SDD/ ไม่ชัดเจน → เสนอแก้ไข → รอ Human approve → ทำต่อ
❓ API spec เปลี่ยน → อัปเดต docs/02-design/SDD/03-api-contract.md → generate openapi.json → แจ้ง frontend
❓ Architecture เปลี่ยน → อัปเดต docs/ARCHITECTURE.md → อัปเดต docs/02-design/SDD/
❓ Async test loop mismatch → ตรวจสอบ CODE_STYLE.md §7.4/§7.5 (ใช้ NullPool + httpx.AsyncClient)
```

### Commit Message Convention
```
feat(auth): add login endpoint with JWT
fix(billing): validate meter reading current >= previous
docs: update docs/02-design/SDD/02-module-specs.md for FR-METER-05 cascade rate
test(auth): add integration test for login flow
infra: add health check endpoint + middleware stubs
```

---

## 🔗 Cross-References

| Document | Purpose | Cross-Reference |
|----------|---------|-----------------|
| **AGENTS.md** | Rules, workflow, global policies (SSOT for rules) | See `INDEX.md` for project map & commands |
| **INDEX.md** | Project map, commands, phase status (Navigation) | See `AGENTS.md` for rules & workflow |
| **DECISIONS/** | Architecture Decision Records (Immutable) | See `docs/DECISIONS/README.md` |

> **Rule:** When in doubt about rules → `AGENTS.md` | When lost about structure/commands → `INDEX.md`

---

## 📚 References (Verified Paths)

| เอกสาร | ที่อยู่ | วัตถุประสงค์ |
|--------|--------|-------------|
| **Project Index & Commands** | `INDEX.md` | Project map, quick commands, phase status |
| **System Architecture** | `docs/ARCHITECTURE.md` | C4 diagrams, Tech stack, ADRs |
| **Implementation Blueprint** | `backend/docs/02-design/SDD/` | Module specs (02-module-specs.md), API Contract (03-api-contract.md), DB schema (04-database-schema.md), traceability (07-traceability.md) |
| **Coding Standards** | `backend/docs/CODE_STYLE.md` | Python patterns, async fixtures, testing guidelines |
| **Sprint Plans** | `backend/docs/sprints/SPRINT_1.md ~ SPRINT_8.md` | Implementation steps, Docker commands, exit criteria |
| **Deployment & Ops** | `backend/docs/02-design/SDD/09-deployment.md`, `backend/docs/OPERATIONS.md` | Prod setup, Docker-First strategy, backup/restore, incident playbooks |
| **Requirements** | `docs/REQUIREMENTS.md` | FR/NFR/BR definitions, actors |
| **Domain Model** | `docs/DOMAIN_MODEL.md` | Entities, aggregates, domain events |
|| **Frontend Spec** | `frontend/docs/02-design/SDD/` | Frontend architecture (01-architecture.md), integration (04-api-integration.md), screen specs (02-screen-specs/), state/data flow (03-state-data-flow.md), implementation (08-implementation.md), testing (06-testing-quality.md) |
|| **Frontend Code Style** | `frontend/docs/CODE_STYLE.md` | JS + JSDoc patterns, React 19, testing rules, accessibility |
|| **E2E Test Strategy** | `docs/E2E_TEST_STRATEGY.md` | Constitution for E2E testing (State Verification Engine, Priority Gates, MVTF) |
|| **Prompt Templates** | `docs/PROMPT.md` | Reusable templates: COMPREHENSIVE_AUDIT (default), E2E_TEST_CAMPAIGN, COMPONENT_AUDIT, DEBUG_INFRASTRUCTURE, BACKEND_API_AUDIT |
|| **Shared Contracts** | `shared-contracts/` | Shared TypeScript/Python contracts between frontend & backend |
|| **Decision Records** | `docs/DECISIONS/README.md` | Architecture Decision Records index |

---

> ℹ️ **หมายเหตุ:** เอกสารนี้เป็น living document — อัปเดตเมื่อมี architecture decision ใหม่  
> 🔄 **เปลี่ยนอะไรในโค้ด → ต้องอัปเดต docs/02-design/SDD/ + Traceability Matrix + Test Files ที่เกี่ยวข้อง**  
> 🐳 **Docker-First Rule:** ทุกคำสั่งพัฒนา/ทดสอบต้องรันผ่าน `docker compose` เท่านั้น  
> ♻️ **Resource Policy:** รัน `make dev-down` ทันทีเมื่อเสร็จงาน — ห้ามทิ้งคอนเทนเนอร์รันค้าง  
> 🤖 **อ่านไฟล์นี้ + docs/02-design/SDD/_index.md + ARCHITECTURE.md + CODE_STYLE.md ก่อนเริ่มงานทุกครั้ง**

✅ **Status:** Backend v1.0.0 Complete — Frontend v1.0.0 Complete (Sprint 1–6)  
📅 **Last Updated:** 2026-07-06  
🎯 **Next:** v1.0.0 Release & Production Deployment