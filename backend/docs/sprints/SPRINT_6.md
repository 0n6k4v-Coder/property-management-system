# Sprint 6 Implementation Plan — Backend (Dashboard & Notifications Module)

**Frozen Contract v1.0** — Effective Date: 2026-05-29
**Status:** ✅ COMPLETE — Dashboard analytics + notification stubs verified 2026-05-27

---

## 🎯 Sprint Overview

| Attribute | Value |
|-----------|-------|
| **Sprint Goal** | สร้าง Dashboard APIs (Revenue, Occupancy, Overdue) + Notification Service (Email/LINE stubs, event triggers) ที่ใช้ Read-Optimized Queries และบังคับใช้ Data Scoping (Property Owner) — รันผ่าน Docker เท่านั้น |
| **Duration** | 5-7 วันทำงาน |
| **SDD Reference** | `docs/SDD.md` v1.4: §2.6 (Dashboard), §2.7 (Notifications), §4.3 (Indexing & Query Optimization), §3.3 (API Contract) |
| **Docker Profile** | `--profile dev` สำหรับพัฒนา, `--profile test` สำหรับทดสอบ |
| **Output** | Running FastAPI app with `/dashboard/*`, `/notifications/*` endpoints + full test coverage + contract validation |

> 📌 **สำคัญ:** `Makefile` อยู่ที่ **root ของโปรเจกต์** (`/property-management-system/Makefile`)  
> ✅ **คำสั่ง `make` ทุกคำสั่งต้องรันจากที่นี่** — ไม่ใช่จากใน `backend/`  
> ♻️ **Resource Policy:** รัน `make dev-down` ทันทีเมื่อเสร็จ — ห้ามทิ้งคอนเทนเนอร์รันค้าง

---

## 🐳 Docker Environment Setup (ก่อนเริ่มงาน)

### 1. ตรวจสอบระบบโฮสต์
```bash
# ✅ ต้องมีก่อนเริ่ม Sprint 6 (รันจาก /property-management-system/)
docker --version          # ≥ 24.0
docker compose version    # ≥ 2.20
make --version            # สำหรับใช้ Makefile shortcuts
```

### 2. เตรียมฐานข้อมูล & Migration
```bash
# รันจาก root ของโปรเจกต์
# อัปเดต migration จาก Sprint 1-5 (ถ้ายังไม่ได้ทำ)
docker compose -f docker-compose.dev.yml --profile dev run --rm backend \
  alembic upgrade head

# ตรวจสอบว่าตารางพื้นฐานมีอยู่
docker compose -f docker-compose.dev.yml --profile dev exec db \
  psql -U user -d pms_test -c "\dt"
# ควรเห็น: users, audit_logs, properties, rooms, tenants, contracts, invoices, payments, maintenance_requests, notifications, alembic_version
```

### 3. เริ่มสภาพแวดล้อมพัฒนา
```bash
# ✅ รันจาก root ของโปรเจกต์
make dev

# ตรวจสอบว่าทุกอย่างขึ้นปกติ
docker compose -f docker-compose.dev.yml --profile dev ps
# ควรเห็น: backend (healthy), db (healthy), redis (running), minio (running)

# ทดสอบเชื่อมต่อจากโฮสต์
curl http://localhost:8000/health          # → {"status":"ok"}
curl http://localhost:8000/docs            # → เปิด Swagger UI
```

---

## 📋 Sprint 6 TODO List (Docker-First)

> 📌 **หมายเหตุ:** ทุก Docker command รันจาก **root ของโปรเจกต์** (`/property-management-system/`)  
> ไฟล์ใน `backend/` จะถูก mount อัตโนมัติผ่าน volume ใน `docker-compose.dev.yml`

### 🔹 Phase 0: Sprint 6 Bootstrap (Day 1 AM) — ~1 ชั่วโมง
| ลำดับ | งาน | Docker Command | Acceptance Criteria | Estimated |
|------|-----|---------------|-------------------|-----------|
| 0.1 | สร้างโฟลเดอร์ตาม §9.1 | `mkdir -p backend/app/modules/{dashboard,notification}/{services,routers}` | โครงสร้างโฟลเดอร์ถูกต้อง | 15 min |
| 0.2 | อัปเดต `main.py` | เพิ่ม `include_router` สำหรับ dashboard_router, notification_router | OpenAPI เห็น endpoints ใหม่ | 30 min |
| 0.3 | อัปเดต `conftest.py` | เพิ่ม fixtures: dashboard_data_factory, notification_factory | `pytest --collect-only` เห็นเทสต์ใหม่ | 15 min |

### 🔹 Phase 1: Dashboard Models & Schemas (Day 1 PM - Day 2) — ~6 ชั่วโมง
| ลำดับ | งาน | Docker Command | Acceptance Criteria | Estimated |
|------|-----|---------------|-------------------|-----------|
| 1.1 | `dashboard/schemas.py` — DashboardSummaryResponse, RevenueMetricResponse, OccupancyResponse | `docker compose run --rm backend-test pytest tests/modules/dashboard/test_schemas.py -v` | Pydantic v2 strict mode, date range validation, response format ตรง §3.1 | 90 min |
| 1.2 | `dashboard/repository.py` — DashboardRepository | `docker compose run --rm backend-test pytest tests/modules/dashboard/test_repository.py -v` | Aggregation queries ใช้ `func.sum()`, `func.count()`, `case()` ถูกต้อง, ข้อมูล filter ตาม property_id (Data Scoping) | 120 min |

### 🔹 Phase 2: Notification Module (Day 3 - Day 4) — ~10 ชั่วโมง
| ลำดับ | งาน | Docker Command | Acceptance Criteria | Estimated |
|------|-----|---------------|-------------------|-----------|
| 2.1 | `notification/models.py` — Notification, NotificationTemplate | `docker compose run --rm backend-test pytest tests/modules/notification/test_models.py -v` | ตารางเก็บประวัติการส่ง, status (sent, failed, pending), FK → users/properties | 90 min |
| 2.2 | `notification/services/notification_service.py` — send_notification, trigger_overdue_alert, trigger_maintenance_alert | `docker compose run --rm backend-test pytest tests/modules/notification/test_notification_service.py -v` | Email/LINE stubs, fail-silent pattern, `log_audit()`, retry logic stub | 150 min |
| 2.3 | `notification/{constants,events}.py` — Error codes + domain events | `docker compose run --rm backend-test ruff check app/modules/notification/` | Error codes `NOTIF-001` ~ `NOTIF-009` ถูกนิยาม | 30 min |

### 🔹 Phase 3: Routers & API Endpoints (Day 4 PM - Day 5) — ~6 ชั่วโมง
| ลำดับ | งาน | Docker Command | Acceptance Criteria | Estimated |
|------|-----|---------------|-------------------|-----------|
| 3.1 | `dashboard/routers/dashboard_router.py` — 3 endpoints | `docker compose run --rm backend-test pytest tests/modules/dashboard/test_dashboard_api.py -v` | `GET /dashboard/summary`, `/revenue`, `/occupancy` ตอบกลับตรง §3.3, query ภายใน <100ms | 90 min |
| 3.2 | `notification/routers/notification_router.py` — 3 endpoints | `docker compose run --rm backend-test pytest tests/modules/notification/test_notification_api.py -v` | `POST /notifications/test`, `GET /notifications/history`, `PATCH /notifications/{id}/resend` ตรง §3.3 | 90 min |
| 3.3 | อัปเดต `shared/constants.py` + `shared/audit.py` | เพิ่ม action codes & error codes ใหม่ | `ruff check app/shared/` ผ่าน | 30 min |

> **📌 Redesign Note (2026-07-11):** The Notification module was subsequently redesigned during the API anti-pattern audit campaign. The original Sprint 6 build shipped `fail-silent` stubs (POST /test returning 201 synchronously). The redesign fixed anti-patterns `#5` (property-scope IDOR on GET /history), `#3`/`#15` (POST /test → 202 Accepted + async Celery), `#1` (Idempotency-Key on mutating endpoints), `#20` (Cache-Control: private, no-store), and `#13` (pagination on GET /history). The router now lives at `notification/routers/notification_router.py` with `require_property_scope()` enforcement, and `test_notification_security.py` (23 DB-free tests) replaces the original `test_notification_api.py` plan. See `docs/API.md` → "Proposed Redesign — Notification Module (Implemented in Code)".

### 🔹 Phase 4: Testing & CI Integration (Day 6) — ~4 ชั่วโมง
| ลำดับ | งาน | Docker Command | Acceptance Criteria | Estimated |
|------|-----|---------------|-------------------|-----------|
| 4.1 | Unit tests สำหรับ services | `docker compose run --rm backend-test pytest tests/modules/*/test_*_service.py --cov=app.modules.dashboard.services,app.modules.notification.services` | Coverage ≥90% สำหรับ services | 60 min |
| 4.2 | Integration tests สำหรับ endpoints | `docker compose run --rm backend-test pytest tests/modules/*/test_*_api.py --cov=app.modules.dashboard.routers,app.modules.notification.routers` | ใช้ `async_client` pattern, ตรวจสอบ response schema | 60 min |
| 4.3 | Contract testing ด้วย Schemathesis | `docker compose run --rm backend-test schemathesis run http://backend:8000/openapi.json --checks all --endpoint /dashboard --endpoint /notifications` | ทุก endpoint ผ่านการตรวจสอบ | 45 min |

### 🔹 Phase 5: Documentation & Handoff (Day 7) — ~2 ชั่วโมง
| ลำดับ | งาน | Docker Command | Acceptance Criteria | Estimated |
|------|-----|---------------|-------------------|-----------|
| 5.1 | สร้าง Alembic migration `006_create_notification_tables.py` | `docker compose run --rm backend alembic upgrade head --sql` | SQL ถูกต้อง | 45 min |
| 5.2 | อัปเดต `docs/SDD.md` §9.6 & `backend/README.md` | แก้ไขในโฮสต์ | ตารางแสดงไฟล์ที่สร้างใน Sprint 6 พร้อม FR/BR | 30 min |
| 5.3 | Sprint 6 Retrospective | สร้างไฟล์ `docs/RETROSPECTIVES/sprint-6.md` | ระบุสิ่งที่ทำดี/ควรปรับปรุงสำหรับ Sprint 7 | 15 min |

---

## ✅ Verification Checklist (Docker-Based)

```bash
# 🔹 1. โครงสร้างโฟลเดอร์ตรงตาม §9.1 (รันจาก root)
$ tree -L 3 backend/app/modules/dashboard backend/app/modules/notification

# 🔹 2. FastAPI รันในคอนเทนเนอร์ + Swagger UI เปิด + เห็น endpoints ใหม่
$ curl -s http://localhost:8000/openapi.json | jq '.paths | with_entries(select(.key | test("dashboard|notification"))) | keys'
[
  "/api/v1/dashboard/summary",
  "/api/v1/dashboard/revenue",
  "/api/v1/dashboard/occupancy",
  "/api/v1/notifications/test",
  "/api/v1/notifications/history",
  "/api/v1/notifications/{id}/resend"
]

# 🔹 3. Test รันในคอนเทนเนอร์ + coverage ≥85%
$ docker compose -f docker-compose.dev.yml --profile test run --rm backend-test \
    pytest tests/modules/dashboard/ tests/modules/notification/ -v --cov=app.modules.dashboard,app.modules.notification --cov-report=term-missing

# 🔹 4. Data Scoping Validation (Owner A ต้องไม่เห็นข้อมูลของ Owner B)
$ curl -s http://localhost:8000/api/v1/dashboard/summary \
  -H "Authorization: Bearer <owner_a_token>" | jq '.data.property_id'
# → ต้องได้ property_id ของ owner_a เท่านั้น

# 🔹 5. Contract testing ผ่าน
$ docker compose -f docker-compose.dev.yml --profile test run --rm backend-test \
    schemathesis run http://backend:8000/openapi.json --checks all --endpoint /dashboard --endpoint /notifications
✅ Passed: 6 endpoints, 32 checks
```

---

## 🚀 Quick Start Commands (Docker-Only — รันจาก root)

```bash
make dev                          # เริ่มสภาพแวดล้อมพัฒนา (เฉพาะเมื่อจำเป็น)
make test-unit                    # รันเทสต์เฉพาะ dashboard/notification
make test-coverage                # รายงานความครอบคลุม
make test-contract                # Contract testing
make db-migrate                   # รัน migration สร้างตาราง notification
make dev-down                     # 🔴 ปิดสภาพแวดล้อมทันทีเมื่อเสร็จ (ตามนโยบาย)
```

---

## 🎯 Sprint 6 Exit Criteria (ต้องผ่านก่อนเริ่ม Sprint 7)

```markdown
## ✅ Sprint 6 Done Definition — Docker-Verified

### Code Quality (รันในคอนเทนเนอร์)
- [ ] `make lint` ผ่านทั้งหมด — ruff, mypy, bandit — ไม่มี error/warning
- [ ] Coverage ≥90% สำหรับ `services/`, ≥85% สำหรับ `routers/`, ≥85% overall
- [ ] ทุกไฟล์มี module docstring + Google-style docstrings สำหรับ public functions

### Functionality & Data Scoping (ทดสอบในคอนเทนเนอร์)
- [ ] Dashboard APIs คำนวณ Revenue, Occupancy, Overdue count ถูกต้องตามช่วงวันที่
- [ ] Data Scoping: Owner เห็นเฉพาะข้อมูลใน property ของตัวเองเท่านั้น
- [ ] Notification service ส่ง test alert ได้ (stub), บันทึก history ลง DB, fail-silent
- [ ] ทุก endpoint ตอบกลับตรง §3.3 (ตรวจสอบด้วย Schemathesis)

### Security & Performance
- [ ] Aggregation queries ใช้ index ถูกต้อง (ตรวจสอบด้วย EXPLAIN)
- [ ] ไม่ expose raw SQL errors หรือ internal stack traces
- [ ] Error format ตรง §3.3: `{ error: { code, message, details } }`

### Integration Ready
- [ ] `openapi.json` generate อัตโนมัติ + ตรง §3.1-3.4
- [ ] Alembic migration `006_create_notification_tables.py` รันผ่านทั้ง upgrade และ downgrade
- [ ] **ทรัพยากรปิดเรียบร้อย:** `make dev-down` รันแล้ว — ไม่มีคอนเทนเนอร์ค้าง
```

---

## 🐳 Docker Troubleshooting Guide (Sprint 6)

| ปัญหา | คำสั่งตรวจสอบ (รันจาก root) | วิธีแก้ |
|-------|-------------|--------|
| **Aggregation query ช้า** | `docker compose exec db psql -U user -d pms_test -c "EXPLAIN ANALYZE SELECT ..."` | ตรวจสอบว่าใช้ index ถูกต้อง, เพิ่ม `INCLUDE` columns หากจำเป็น |
| **Data Scoping รั่ว** | สร้าง test user 2 คน, query dashboard ด้วย token คนละคน | ตรวจสอบ `WHERE property_id = :owner_property_id` ในทุก repository query |
| **Integration test ล้ม** | `docker compose run --rm backend-test pytest ... -v --tb=short` | ตรวจสอบ `async_client` fixture + `httpx.AsyncClient` pattern ตาม CODE_STYLE.md §7.5 |
| **Notification fail-silent ไม่ทำงาน** | Mock external provider ให้ raise error | ตรวจสอบ `try/except` ใน `notification_service.py` + `log_audit()` |
| **Schemathesis report error** | `docker compose run --rm backend-test schemathesis run ... --verbosity verbose` | ตรวจสอบ response model ตรง schema, ตรวจสอบ `status_code` ใน router |

---

## 🔄 Change Control Reminder (Docker Context)

```text
เมื่อพบระหว่างการพัฒนาว่าต้องปรับโครงสร้าง/ฟังก์ชัน:

1️⃣ หยุดเขียนโค้ดส่วนนั้นชั่วคราว
2️⃣ เสนอการเปลี่ยนแปลงในรูปแบบ:
   - "SPRINT_6.md §X.Y: แก้ไข [สิ่งที่เปลี่ยน] เพราะ [เหตุผล + ผลกระทบ]"
   - แสดงผลกระทบ: ไฟล์ใดต้องแก้, test ใดต้องอัปเดต, FR/BR ใดเกี่ยวข้อง
3️⃣ รอ Human approve (Owner/Tech Lead/QA)
4️⃣ อัปเดตเอกสารก่อน → รัน `make test` → กลับมาเขียนโค้ดต่อ
5️⃣ บันทึกใน commit message: "docs: update SPRINT_6 §3 for Dashboard query optimization + Docker test command"

❌ ห้าม:
- แก้โค้ดโดยไม่แก้เอกสารที่เกี่ยวข้อง
- ข้ามขั้นตอน propose → approve → implement
- เปลี่ยน public interface โดยไม่แจ้งทีม
- รันคำสั่งพัฒนา/ทดสอบนอกคอนเทนเนอร์
```

---

> ℹ️ **หมายเหตุ:** เอกสารนี้เป็น **Frozen Contract** — ห้ามแก้ไขโดยไม่ผ่านกระบวนการเปลี่ยนแปลง  
> 🔄 **เปลี่ยนอะไรในโค้ด → ต้องอัปเดต SPRINT_6.md + Traceability Matrix + Test Files**  
> 🐳 **ทุกคำสั่งพัฒนา/ทดสอบต้องรันผ่าน `docker compose` เท่านั้น**  
> 📌 **รัน `make` จาก root ของโปรเจกต์ (`/property-management-system/`) เสมอ**  
> ♻️ **ทรัพยากร:** หลังจากทำคำสั่งใด ๆ เสร็จ → รัน `make dev-down` ทันทีเพื่อประหยัดทรัพยากร  
> 🤖 **สำหรับ AI Agent (Deepseek):** อ่านไฟล์นี้ + `docs/SDD.md` §2.6 + §2.7 + `docs/CODE_STYLE.md` ก่อนเริ่มสร้างโค้ดทุกครั้ง  
> 👨‍💻 **สำหรับ Human:** ใช้ Exit Criteria ด้านบนเป็นเกณฑ์อนุมัติ Sprint 6 + ใช้ Troubleshooting Guide เมื่อพบปัญหา

✅ **Status:** FROZEN — Ready for Autonomous Implementation (Sprint 6, Docker-First)  
🐳 **Quick Start (จาก root):** `make dev` → `make test-unit` → `make test-coverage` → `make test-contract` → `make dev-down`  
📅 **Sprint 6 Start Date:** 2026-05-30 (ตัวอย่าง)  
🎯 **Next:** Sprint 7 — Admin & Security Hardening (Docker-First)