# Sprint 4 Implementation Plan — Backend (Contract & Lease Module)

**Frozen Contract v1.0** — Effective Date: 2026-05-27
**Status:** ✅ COMPLETE — Full module (routers/services/models/schemas/repository/events/constants) + migration 004 verified 2026-05-27

---

## 🎯 Sprint Overview

| Attribute | Value |
|-----------|-------|
| **Sprint Goal** | สร้าง Contract & Lease Module ที่บังคับใช้ Business Rules (BR-01, BR-04) ครบถ้วน พร้อมจัดการวงจรชีวิตสัญญา (สร้าง/ต่ออายุ/ยกเลิก/ระงับ) — รันผ่าน Docker เท่านั้น |
| **Duration** | 5-7 วันทำงาน |
| **SDD Reference** | `docs/SDD.md` v1.4: §5 (Contract & Lease), §4.1.1 (ERD), §4.2 (Physical Schema), §3.3 (API Contract), §6 (Business Rules) |
| **Docker Profile** | `--profile dev` สำหรับพัฒนา, `--profile test` สำหรับทดสอบ |
| **Output** | Running FastAPI app with `/contracts/*`, `/leases/*` endpoints + full test coverage + contract validation |

> 📌 **สำคัญ:** `Makefile` อยู่ที่ **root ของโปรเจกต์** (`/property-management-system/Makefile`)  
> ✅ **คำสั่ง `make` ทุกคำสั่งต้องรันจากที่นี่** — ไม่ใช่จากใน `backend/`  
> ♻️ **Resource Policy:** รัน `make dev-down` ทันทีเมื่อเสร็จ — ห้ามทิ้งคอนเทนเนอร์รันค้าง

---

## 🐳 Docker Environment Setup (ก่อนเริ่มงาน)

### 1. ตรวจสอบระบบโฮสต์
```bash
# ✅ ต้องมีก่อนเริ่ม Sprint 4 (รันจาก /property-management-system/)
docker --version          # ≥ 24.0
docker compose version    # ≥ 2.20
make --version            # สำหรับใช้ Makefile shortcuts
```

### 2. เตรียมฐานข้อมูล & Migration
```bash
# รันจาก root ของโปรเจกต์
# อัปเดต migration จาก Sprint 1-3 (ถ้ายังไม่ได้ทำ)
docker compose -f docker-compose.dev.yml --profile dev run --rm backend \
  alembic upgrade head

# ตรวจสอบว่าตารางพื้นฐานมีอยู่
docker compose -f docker-compose.dev.yml --profile dev exec db \
  psql -U user -d pms_test -c "\dt"
# ควรเห็น: users, audit_logs, properties, rooms, tenants, meter_readings, invoices, contracts, alembic_version
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
curl http://localhost:8000/docs            # → เปิด Swagger UI (เห็น /auth, /properties, /tenants, /billing)
```

---

## 📋 Sprint 4 TODO List (Docker-First)

> 📌 **หมายเหตุ:** ทุก Docker command รันจาก **root ของโปรเจกต์** (`/property-management-system/`)  
> ไฟล์ใน `backend/` จะถูก mount อัตโนมัติผ่าน volume ใน `docker-compose.dev.yml`

### 🔹 Phase 0: Sprint 4 Bootstrap (Day 1 AM) — ~1 ชั่วโมง
| ลำดับ | งาน | Docker Command | Acceptance Criteria | Estimated |
|------|-----|---------------|-------------------|-----------|
| 0.1 | สร้างโฟลเดอร์ตาม §9.1 | `mkdir -p backend/app/modules/contract/{services,routers}` | `tree -L 3 backend/app/modules/contract` แสดงโครงสร้างถูกต้อง | 15 min |
| 0.2 | อัปเดต `main.py` | เพิ่ม `include_router` สำหรับ contract_router | `curl /openapi.json \| jq '.paths \| keys'` เห็น `/contracts`, `/leases` | 30 min |
| 0.3 | อัปเดต `conftest.py` | เพิ่ม fixtures: contract_factory, lease_extension_factory | `pytest --collect-only` เห็นเทสต์ใหม่ | 15 min |

### 🔹 Phase 1: Contract Models & Schemas (Day 1 PM - Day 2) — ~8 ชั่วโมง
| ลำดับ | งาน | Docker Command | Acceptance Criteria | Estimated |
|------|-----|---------------|-------------------|-----------|
| 1.1 | `contract/models.py` — Contract, LeaseExtension, ContractTermination | `docker compose run --rm backend-test pytest tests/modules/contract/test_models.py -v` | Models ตรงตาม SDD §4.2, FK constraints ถูกต้อง (Contract ↔ Room/Tenant), Partial index `ix_contracts_room_active_unique` (BR-01) | 120 min |
| 1.2 | `contract/schemas.py` — CreateContractRequest, TerminateContractRequest, ContractResponse, LeaseExtensionRequest | `docker compose run --rm backend-test pytest tests/modules/contract/test_schemas.py -v` | Pydantic validation ทำงาน, BR-01 (one active contract per room) validate ใน schema, response format ตรง §3.1 | 90 min |

### 🔹 Phase 2: Repository & Service Layer (Day 3 - Day 4) — ~12 ชั่วโมง
| ลำดับ | งาน | Docker Command | Acceptance Criteria | Estimated |
|------|-----|---------------|-------------------|-----------|
| 2.1 | `contract/repository.py` — ContractRepository | `docker compose run --rm backend-test pytest tests/modules/contract/test_repository.py -v` | CRUD methods ทำงาน, `get_active_contract_for_room()` query ใช้ partial index ถูกต้อง | 90 min |
| 2.2 | `contract/services/contract_service.py` — create_contract, terminate_contract, extend_lease, get_active_contracts | `docker compose run --rm backend-test pytest tests/modules/contract/test_contract_service.py -v` | BR-01/BR-04 บังใช้ใน service layer, log_audit ทุก operation, transaction rollback เมื่อล้มเหลว | 180 min |
| 2.3 | `contract/{constants,events}.py` — Error codes + domain events | `docker compose run --rm backend-test ruff check app/modules/contract/` | Error codes `CONT-001` ~ `CONT-009` ถูกนิยาม, event names ตรงตาม spec | 30 min |

### 🔹 Phase 3: Routers & API Endpoints (Day 4 PM - Day 5) — ~6 ชั่วโมง
| ลำดับ | งาน | Docker Command | Acceptance Criteria | Estimated |
|------|-----|---------------|-------------------|-----------|
| 3.1 | `contract/routers/contract_router.py` — 6 endpoints | `docker compose run --rm backend-test pytest tests/modules/contract/test_contract_api.py -v` | ทุก endpoint ตอบกลับตรง §3.3, error format ตรง, audit log ถูกบันทึก | 120 min |
| 3.2 | อัปเดต `shared/constants.py` + `shared/audit.py` | เพิ่ม action codes & error codes ใหม่ | `ruff check app/shared/` ผ่าน, import ได้ | 30 min |

### 🔹 Phase 4: Testing & CI Integration (Day 6) — ~4 ชั่วโมง
| ลำดับ | งาน | Docker Command | Acceptance Criteria | Estimated |
|------|-----|---------------|-------------------|-----------|
| 4.1 | Unit tests สำหรับ `contract_service.py` | `docker compose run --rm backend-test pytest tests/modules/contract/test_contract_service.py --cov=app.modules.contract.services` | Coverage ≥90% สำหรับ services, mock repository ถูกต้อง | 60 min |
| 4.2 | Integration tests สำหรับ `/contract/*` endpoints | `docker compose run --rm backend-test pytest tests/modules/contract/test_contract_api.py --cov=app.modules.contract.routers` | ใช้ `async_client` fixture + `httpx.AsyncClient` pattern ตาม CODE_STYLE.md §7.5, ตรวจสอบ response schema + status codes ตรง §3.3 | 60 min |
| 4.3 | Contract testing ด้วย Schemathesis | `docker compose run --rm backend-test schemathesis run http://backend:8000/openapi.json --checks all --endpoint /contracts --endpoint /leases` | ทุก endpoint ผ่านการตรวจสอบ: schema, status codes, error format | 45 min |

### 🔹 Phase 5: Documentation & Handoff (Day 7) — ~2 ชั่วโมง
| ลำดับ | งาน | Docker Command | Acceptance Criteria | Estimated |
|------|-----|---------------|-------------------|-----------|
| 5.1 | สร้าง Alembic migration `004_create_contract_tables.py` | `docker compose run --rm backend alembic upgrade head --sql` | SQL ถูกต้อง, upgrade/downgrade ปลอดภัย | 45 min |
| 5.2 | อัปเดต `docs/SDD.md` §9.6 & `backend/README.md` | แก้ไขในโฮสต์ | ตารางแสดงไฟล์ที่สร้างใน Sprint 4 พร้อม FR/BR ที่เกี่ยวข้อง | 30 min |
| 5.3 | Sprint 4 Retrospective | สร้างไฟล์ `docs/RETROSPECTIVES/sprint-4.md` | ระบุสิ่งที่ทำดี/ควรปรับปรุงสำหรับ Sprint 5 | 15 min |

---

## 🛠️ File Creation Script (Docker-Compatible)

```bash
#!/usr/bin/env bash
# scripts/sprint4_bootstrap.sh
set -euo pipefail
BACKEND_ROOT="backend"
CONTRACT_DIR="$BACKEND_ROOT/app/modules/contract"
TESTS_DIR="$BACKEND_ROOT/tests"

echo "🚀 Creating Sprint 4 backend structure (Docker-compatible)..."
mkdir -p "$CONTRACT_DIR/services" "$CONTRACT_DIR/routers" "$TESTS_DIR/modules/contract"
touch "$CONTRACT_DIR/__init__.py" "$CONTRACT_DIR/services/__init__.py" "$CONTRACT_DIR/routers/__init__.py"
touch "$TESTS_DIR/modules/contract/__init__.py"

echo "✅ Sprint 4 structure created."
```
> 💡 รันจาก root: `bash scripts/sprint4_bootstrap.sh`

---

## ✅ Verification Checklist (Docker-Based)

```bash
# 🔹 1. โครงสร้างโฟลเดอร์ตรงตาม §9.1 (รันจาก root)
$ tree -L 3 backend/app/modules/contract
backend/app/modules/contract
├── __init__.py
├── models.py
├── schemas.py
├── repository.py
├── services/
│   ├── __init__.py
│   └── contract_service.py
├── routers/
│   ├── __init__.py
│   └── contract_router.py
├── constants.py
└── events.py

# 🔹 2. FastAPI รันในคอนเทนเนอร์ + Swagger UI เปิด + เห็น endpoints ใหม่
$ curl -s http://localhost:8000/openapi.json | jq '.paths | with_entries(select(.key | test("contract|lease"))) | keys'
[
  "/api/v1/contracts",
  "/api/v1/contracts/{id}",
  "/api/v1/contracts/{id}/terminate",
  "/api/v1/contracts/{id}/extend",
  "/api/v1/contracts/active",
  "/api/v1/leases/{room_id}/history"
]

# 🔹 3. Test รันในคอนเทนเนอร์ + coverage ≥85%
$ docker compose -f docker-compose.dev.yml --profile test run --rm backend-test \
    pytest tests/modules/contract/ -v --cov=app.modules.contract --cov-report=term-missing

# 🔹 4. Business Rule BR-01 Validation (one active contract per room)
$ curl -s -X POST http://localhost:8000/api/v1/contracts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"room_id":"<existing-room-with-active-contract>","tenant_id":"<tenant>","start_date":"2026-06-01","end_date":"2027-05-31","monthly_rent":5000,"deposit_amount":10000}' | jq .
# → ต้องได้ 409 + error code "CONT-001" (room already has active contract)

# 🔹 5. Contract testing ผ่าน
$ docker compose -f docker-compose.dev.yml --profile test run --rm backend-test \
    schemathesis run http://backend:8000/openapi.json --checks all --endpoint /contracts --endpoint /leases
✅ Passed: 6 endpoints, 38 checks
```

---

## 🚀 Quick Start Commands (Docker-Only — รันจาก root)

```bash
make dev                          # เริ่มสภาพแวดล้อมพัฒนา (เฉพาะเมื่อจำเป็น)
make test-unit                    # รันเทสต์เฉพาะ contract module
make test-coverage                # รายงานความครอบคลุม
make test-contract                # Contract testing
make db-migrate                   # รัน migration สร้างตาราง contract
make dev-down                     # 🔴 ปิดสภาพแวดล้อมทันทีเมื่อเสร็จ (ตามนโยบาย)
```

---

## 🎯 Sprint 4 Exit Criteria (ต้องผ่านก่อนเริ่ม Sprint 5)

```markdown
## ✅ Sprint 4 Done Definition — Docker-Verified

### Code Quality (รันในคอนเทนเนอร์)
- [ ] `make lint` ผ่านทั้งหมด — ruff, mypy, bandit — ไม่มี error/warning
- [ ] Coverage ≥90% สำหรับ `services/`, ≥85% สำหรับ `routers/`, ≥85% overall
- [ ] ทุกไฟล์มี module docstring + Google-style docstrings สำหรับ public functions

### Functionality & Business Rules (ทดสอบในคอนเทนเนอร์)
- [ ] BR-01: ปฏิเสธการสร้างสัญญาใหม่หากห้องมีสัญญาที่ใช้งานอยู่แล้ว (schema + service layer)
- [ ] BR-04: การยกเลิกสัญญาต้องบันทึกเหตุผล + อัปเดต status + log_audit
- [ ] `POST /contracts` → 201 + Contract + audit log
- [ ] `PATCH /contracts/{id}/terminate` → 200 + updated Contract + termination record
- [ ] `GET /contracts/active` → 200 + list of active contracts (ใช้ partial index)
- [ ] ทุก endpoint ตอบกลับตรง §3.3 (ตรวจสอบด้วย Schemathesis)

### Security & Data Integrity
- [ ] Transaction isolation: ถ้าสร้างสัญญาไม่สำเร็จ → ไม่มีการบันทึกข้อมูลบางส่วน (rollback)
- [ ] Audit log บันทึกทุกการเปลี่ยนแปลงสัญญา (สร้าง/ต่ออายุ/ยกเลิก)
- [ ] Error format ตรง §3.3: `{ error: { code, message, details } }`

### Integration Ready
- [ ] `openapi.json` generate อัตโนมัติ + ตรง §3.1-3.4
- [ ] Frontend สามารถ generate types สำหรับ contract endpoints ได้
- [ ] Alembic migration `004_create_contract_tables.py` รันผ่านทั้ง upgrade และ downgrade

### Documentation & Process
- [ ] `backend/README.md` + `docs/SDD.md` §9.6 อัปเดตครบ
- [ ] บันทึก Sprint retrospective ใน `docs/RETROSPECTIVES/sprint-4.md`
- [ ] PR ผ่าน review, CI pipeline ผ่านทั้งหมด
- [ ] **ทรัพยากรปิดเรียบร้อย:** `make dev-down` รันแล้ว — ไม่มีคอนเทนเนอร์ค้าง
```

---

## 🐳 Docker Troubleshooting Guide (Sprint 4)

| ปัญหา | คำสั่งตรวจสอบ (รันจาก root) | วิธีแก้ |
|-------|-------------|--------|
| **Migration ล้มเหลว** | `docker compose run --rm backend alembic current` | ตรวจสอบว่า `003` รันสำเร็จแล้ว, แก้ `downgrade()` ให้ drop ในลำดับย้อนกลับ |
| **BR-01 ตรวจสอบไม่เจอสัญญาที่ใช้งานอยู่** | `docker compose exec backend python -c "from app.modules.contract.repository import ContractRepository; print('check partial index usage')"` | ตรวจสอบว่า query ใช้ `WHERE status='active'` และ partial index `ix_contracts_room_active_unique` ถูกสร้าง |
| **Transaction ไม่ rollback** | `docker compose exec db psql -U user -d pms_test -c "SELECT count(*) FROM contracts WHERE status='draft';"` | ตรวจสอบ `async with db.begin():` ใน service layer, ใช้ `db.flush()` แทน `commit()` |
| **Integration test ล้ม (loop mismatch)** | `docker compose run --rm backend-test pytest tests/modules/contract/test_contract_api.py -v --tb=short` | ตรวจสอบว่าใช้ `async_client` fixture + `httpx.AsyncClient` pattern ตาม CODE_STYLE.md §7.5 |
| **Schemathesis report error** | `docker compose run --rm backend-test schemathesis run ... --verbosity verbose` | ตรวจสอบ response model ตรง schema, ตรวจสอบ `status_code` ใน router |

---

## 🔄 Change Control Reminder (Docker Context)

```text
เมื่อพบระหว่างการพัฒนาว่าต้องปรับโครงสร้าง/ฟังก์ชัน:

1️⃣ หยุดเขียนโค้ดส่วนนั้นชั่วคราว
2️⃣ เสนอการเปลี่ยนแปลงในรูปแบบ:
   - "SPRINT_4.md §X.Y: แก้ไข [สิ่งที่เปลี่ยน] เพราะ [เหตุผล + ผลกระทบ]"
   - แสดงผลกระทบ: ไฟล์ใดต้องแก้, test ใดต้องอัปเดต, BR ใดเกี่ยวข้อง
   - ระบุ Docker command ที่ใช้ทดสอบการเปลี่ยนแปลง
3️⃣ รอ Human approve (Owner/Tech Lead/QA)
4️⃣ อัปเดตเอกสารก่อน → รัน `make test` → กลับมาเขียนโค้ดต่อ
5️⃣ บันทึกใน commit message: "docs: update SPRINT_4 §3 for BR-01 + Docker test command"

❌ ห้าม:
- แก้โค้ดโดยไม่แก้เอกสารที่เกี่ยวข้อง
- ข้ามขั้นตอน propose → approve → implement
- เปลี่ยน public interface โดยไม่แจ้งทีม
- รันคำสั่งพัฒนา/ทดสอบนอกคอนเทนเนอร์
```

---

> ℹ️ **หมายเหตุ:** เอกสารนี้เป็น **Frozen Contract** — ห้ามแก้ไขโดยไม่ผ่านกระบวนการเปลี่ยนแปลง  
> 🔄 **เปลี่ยนอะไรในโค้ด → ต้องอัปเดต SPRINT_4.md + Traceability Matrix + Test Files**  
> 🐳 **ทุกคำสั่งพัฒนา/ทดสอบต้องรันผ่าน `docker compose` เท่านั้น**  
> 📌 **รัน `make` จาก root ของโปรเจกต์ (`/property-management-system/`) เสมอ**  
> ♻️ **ทรัพยากร:** หลังจากทำคำสั่งใด ๆ เสร็จ → รัน `make dev-down` ทันทีเพื่อประหยัดทรัพยากร  
> 🤖 **สำหรับ AI Agent (Deepseek):** อ่านไฟล์นี้ + `docs/SDD.md` §5 + §6 + `docs/CODE_STYLE.md` ก่อนเริ่มสร้างโค้ดทุกครั้ง  
> 👨‍💻 **สำหรับ Human:** ใช้ Exit Criteria ด้านบนเป็นเกณฑ์อนุมัติ Sprint 4 + ใช้ Troubleshooting Guide เมื่อพบปัญหา

✅ **Status:** FROZEN — Ready for Autonomous Implementation (Sprint 4, Docker-First)  
🐳 **Quick Start (จาก root):** `make dev` → `make test-unit` → `make test-coverage` → `make test-contract` → `make dev-down`  
📅 **Sprint 4 Start Date:** 2026-05-28 (ตัวอย่าง)  
🎯 **Next:** Sprint 5 — Maintenance & Ops Module (Docker-First)