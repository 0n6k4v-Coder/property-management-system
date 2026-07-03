# Sprint 7 Implementation Plan — Backend (Admin & Security Hardening)

**Frozen Contract v1.0** — Effective Date: 2026-05-30
**Status:** ✅ COMPLETE — Admin module + RBAC + migration 006/007 verified 2026-05-27

---

## 🎯 Sprint Overview

| Attribute | Value |
|-----------|-------|
| **Sprint Goal** | สร้าง Security Middleware (Rate Limiting, Security Headers, CORS Hardening) + Admin APIs (Audit Log Viewer, System Config) ที่บังคับใช้ Data Scoping & RBAC Checks — รันผ่าน Docker เท่านั้น |
| **Duration** | 5-7 วันทำงาน |
| **SDD Reference** | `docs/SDD.md` v1.4: §4.5 (Security & Access Control), §3.3 (API Contract), §7.4 (Audit Compliance), §4.3 (Query Optimization) |
| **Docker Profile** | `--profile dev` สำหรับพัฒนา, `--profile test` สำหรับทดสอบ |
| **Output** | Running FastAPI app with `/admin/*` endpoints + Security Middleware active + full test coverage + contract validation |

> 📌 **สำคัญ:** `Makefile` อยู่ที่ **root ของโปรเจกต์** (`/property-management-system/Makefile`)  
> ✅ **คำสั่ง `make` ทุกคำสั่งต้องรันจากที่นี่** — ไม่ใช่จากใน `backend/`  
> ♻️ **Resource Policy:** รัน `make dev-down` ทันทีเมื่อเสร็จ — ห้ามทิ้งคอนเทนเนอร์รันค้าง

---

## 🐳 Docker Environment Setup (ก่อนเริ่มงาน)

### 1. ตรวจสอบระบบโฮสต์
```bash
docker --version          # ≥ 24.0
docker compose version    # ≥ 2.20
make --version
```

### 2. เตรียมฐานข้อมูล & Migration
```bash
docker compose -f docker-compose.dev.yml --profile dev run --rm backend \
  alembic upgrade head
docker compose -f docker-compose.dev.yml --profile dev exec db \
  psql -U user -d pms_test -c "\dt"
```

### 3. เริ่มสภาพแวดล้อมพัฒนา
```bash
make dev
docker compose -f docker-compose.dev.yml --profile dev ps
curl http://localhost:8000/health
curl http://localhost:8000/docs
```

---

## 📋 Sprint 7 TODO List (Docker-First)

### 🔹 Phase 0: Bootstrap (Day 1 AM) — ~1 ชั่วโมง
| ลำดับ | งาน | Acceptance Criteria |
|------|-----|-------------------|
| 0.1 | สร้างโฟลเดอร์ `app/middleware/`, `app/modules/admin/` | โครงสร้างถูกต้องตาม §9.1 |
| 0.2 | อัปเดต `main.py` | เพิ่ม middleware registration + `include_router(admin_router)` |
| 0.3 | อัปเดต `conftest.py` | เพิ่ม fixtures: `admin_user_factory`, `rate_limit_test_client` |

### 🔹 Phase 1: Security Middleware (Day 1 PM - Day 3) — ~10 ชั่วโมง
| ลำดับ | งาน | Acceptance Criteria |
|------|-----|-------------------|
| 1.1 | `middleware/security.py` | Rate limiting (Redis/In-memory fallback), Security Headers (HSTS, X-Frame, CSP), CORS hardening |
| 1.2 | `middleware/rbac.py` | Permission decorator `@require_role("owner")`, property scope validation |
| 1.3 | `tests/middleware/test_security.py` | Unit tests: header injection, rate limit threshold, CORS preflight |

### 🔹 Phase 2: Admin Module (Day 3 PM - Day 5) — ~12 ชั่วโมง
| ลำดับ | งาน | Acceptance Criteria |
|------|-----|-------------------|
| 2.1 | `admin/schemas.py` | `AuditLogQueryRequest`, `AuditLogResponse`, `SystemConfigResponse` (Pydantic v2 strict) |
| 2.2 | `admin/repository.py` | Paginated audit log queries (`OFFSET/LIMIT`), config lookup by key |
| 2.3 | `admin/services/admin_service.py` | `get_audit_logs(property_id, filters)`, `get_system_config()`, fail-safe |
| 2.4 | `admin/routers/admin_router.py` | `GET /admin/audit-logs`, `GET /admin/config`, `PATCH /admin/config` (RBAC protected) |
| 2.5 | `admin/{constants,events}.py` | Error codes `ADMIN-001` ~ `ADMIN-009`, events stub |

### 🔹 Phase 3: Testing & CI (Day 6) — ~4 ชั่วโมง
| ลำดับ | งาน | Acceptance Criteria |
|------|-----|-------------------|
| 3.1 | Unit tests (services + middleware) | Coverage ≥90% services, ≥85% middleware logic |
| 3.2 | Integration tests | 5 endpoints — **ต้องใช้ `async_client` pattern ตาม CODE_STYLE.md §7.5** |
| 3.3 | Contract testing (Schemathesis) | `/admin/*` endpoints ผ่าน schema/status/error checks |

### 🔹 Phase 4: Documentation & Handoff (Day 7) — ~2 ชั่วโมง
| ลำดับ | งาน | Acceptance Criteria |
|------|-----|-------------------|
| 4.1 | Migration `007_add_audit_indexes.py` | GIN index on `metadata`, BRIN on `timestamp` |
| 4.2 | อัปเดต `SDD.md` §9.6 & `README.md` | ตารางแสดงไฟล์ Sprint 7 พร้อม FR/BR |
| 4.3 | Sprint 7 Retrospective | บันทึก lessons learned สำหรับ Sprint 8 |

---

## ✅ Verification Checklist (Docker-Based)

```bash
# 🔹 1. ตรวจสอบ Security Headers
curl -s -I http://localhost:8000/health | grep -E "X-Frame-Options|X-Content-Type-Options|Strict-Transport-Security"
# → ต้องเห็น header ถูก inject

# 🔹 2. ตรวจสอบ Rate Limiting
for i in {1..110}; do curl -s http://localhost:8000/health > /dev/null; done
# → ต้องได้ 429 Too Many Requests เมื่อเกิน阈值

# 🔹 3. OpenAPI endpoints ใหม่
curl -s http://localhost:8000/openapi.json | jq '.paths | keys[] | select(test("admin"))'
# → ["/api/v1/admin/audit-logs", "/api/v1/admin/config", ...]

# 🔹 4. Test รันในคอนเทนเนอร์
docker compose -f docker-compose.dev.yml --profile test run --rm backend-test \
  pytest tests/middleware/ tests/modules/admin/ -v --cov=app.middleware,app.modules.admin --cov-report=term-missing
```

---

## 🚀 Quick Start Commands (Docker-Only — รันจาก root)
```bash
make dev                          # เริ่มเฉพาะเมื่อจำเป็น
make test-unit                    # รันเทสต์ security/admin
make test-coverage                # รายงานความครอบคลุม
make test-contract                # Contract testing
make db-migrate                   # รัน migration audit indexes
make dev-down                     # 🔴 ปิดทันทีเมื่อเสร็จ
```

---

## 🎯 Sprint 7 Exit Criteria (ต้องผ่านก่อนเริ่ม Sprint 8)

```markdown
## ✅ Sprint 7 Done Definition — Docker-Verified

### Security & Middleware
- [ ] Rate limiting ทำงานถูกต้อง (Redis fallback → in-memory)
- [ ] Security headers ถูก inject ทุก response (HSTS, X-Frame, CSP, X-Content-Type)
- [ ] RBAC decorator `@require_role()` block non-owner access → 403
- [ ] CORS hardening: อนุญาตเฉพาะ allowed origins ใน production mode

### Admin APIs
- [ ] `GET /admin/audit-logs` → paginated, filtered by property_id, status 200
- [ ] `GET /admin/config` → returns system settings (masked secrets)
- [ ] Data scoping: Owner เห็นเฉพาะ audit log ของ property ตัวเอง
- [ ] ทุก endpoint ตอบกลับตรง §3.3 (ตรวจสอบด้วย Schemathesis)

### Quality & Integration
- [ ] `make lint` ผ่าน, coverage ≥85% overall
- [ ] Alembic migration 007 รันผ่านทั้ง upgrade/downgrade
- [ ] Frontend สามารถ generate types สำหรับ `/admin/*` ได้
- [ ] **ทรัพยากรปิดเรียบร้อย:** `make dev-down` รันแล้ว — ไม่มีคอนเทนเนอร์ค้าง
```

---

## 🐳 Docker Troubleshooting Guide (Sprint 7)

| ปัญหา | คำสั่งตรวจสอบ | วิธีแก้ |
|-------|-------------|--------|
| **Rate limit ไม่ทำงาน** | `docker compose exec redis redis-cli KEYS "*"` | ตรวจสอบ Redis connection, fallback to in-memory dict หาก Redis unavailable |
| **Security headers ขาด** | `curl -I http://localhost:8000/health` | ตรวจสอบ middleware registration order ใน `main.py` (ต้องอยู่ก่อน router) |
| **Audit query ช้า** | `EXPLAIN ANALYZE SELECT ... FROM audit_logs` | ตรวจสอบ GIN/BRIN indexes, เพิ่ม `LIMIT/OFFSET` pagination |
| **Integration test ล้ม** | `pytest tests/modules/admin/test_admin_api.py -v --tb=short` | ตรวจสอบ `async_client` fixture + `httpx.AsyncClient` pattern |
| **RBAC 403 ผิดพลาด** | ทดสอบด้วย token ที่ไม่มี role owner | ตรวจสอบ `@require_role()` decorator อ่าน `current_user["role"]` ถูกต้อง |

---

## 🔄 Change Control Reminder (Docker Context)
```text
1️⃣ หยุดเขียนโค้ด → 2️⃣ เสนอการเปลี่ยนแปลง (SPRINT_7.md §X.Y) → 3️⃣ รอ Human approve
4️⃣ อัปเดตเอกสาร → 5️⃣ รัน make test → 6️⃣ Commit พร้อมระบุ Docker test command
❌ ห้าม: แก้โค้ดไม่แก้เอกสาร, ข้าม propose/approve, รันนอกคอนเทนเนอร์
```

> ℹ️ **หมายเหตุ:** เอกสารนี้เป็น **Frozen Contract**  
> 🔄 **เปลี่ยนอะไรในโค้ด → อัปเดต SPRINT_7.md + Traceability + Tests**  
> 🐳 **ทุกคำสั่งพัฒนา/ทดสอบต้องรันผ่าน `docker compose` เท่านั้น**  
> 📌 **รัน `make` จาก root เสมอ**  
> ♻️ **ทรัพยากร:** หลังทำคำสั่งใด ๆ เสร็จ → รัน `make dev-down` ทันที  
> 🤖 **สำหรับ AI Agent:** อ่านไฟล์นี้ + `docs/SDD.md` §4.5 + §3.3 + `docs/CODE_STYLE.md` ก่อนสร้างโค้ด  
> 👨‍💻 **สำหรับ Human:** ใช้ Exit Criteria อนุมัติ Sprint 7 + Troubleshooting Guide เมื่อพบปัญหา

✅ **Status:** FROZEN — Ready for Autonomous Implementation (Sprint 7, Docker-First)  
🐳 **Quick Start:** `make dev` → `make test-unit` → `make test-coverage` → `make test-contract` → `make dev-down`  
📅 **Sprint 7 Start Date:** 2026-05-31 (ตัวอย่าง)  
🎯 **Next:** Sprint 8 — Production Ready & CI/CD (Docker-First)