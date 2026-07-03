# File: 02-design/SDD/08-file-inventory.md
# Backend Implementation Blueprint — File Inventory & Contracts
## Property Management System

ส่วนนี้ออกแบบเพื่อเป็น **พิมพ์เขียวการเขียนโค้ด (Implementation Blueprint)** สำหรับ AI Agent และ Human Developer โดยระบุ:
- ✅ โครงสร้างโฟลเดอร์และไฟล์ที่คาดว่าจะมี (ประมาณการ)
- ✅ แต่ละไฟล์มีหน้าที่อะไร, มีฟังก์ชัน/คลาสอะไรบ้าง
- ✅ Input/Output ของแต่ละฟังก์ชันเป็นอย่างไร
- ✅ ไฟล์นี้ขึ้นกับไฟล์ไหนบ้าง (Dependencies)
- ✅ ต้องทดสอบด้วย test ไฟล์ไหน (Traceability)

> 🎯 **วัตถุประสงค์:** AI Agent อ่านแล้วสามารถ **generate ไฟล์ได้ถูกต้องตามสถาปัตยกรรม** โดยไม่ต้องเดา, Human สามารถ **ตรวจสอบโค้ดที่ generate มา** ว่าตรงกับออกแบบไว้หรือไม่

> ⚠️ **หมายเหตุ:** จำนวนไฟล์และบรรทัดเป็น **ประมาณการเบื้องต้น** อาจปรับเปลี่ยนได้ตามความจำเป็นระหว่างการพัฒนา โดยต้องอัปเดตเอกสารนี้ให้สอดคล้อง

---

### 9.4 Implementation Checklist (สำหรับ Human Verify)

ใช้ตรวจสอบว่าโค้ดที่ AI Agent generate มา **ตรงกับสถาปัตยกรรมที่ออกแบบไว้** หรือไม่:

#### ✅ Structure & Naming
- [ ] ไฟล์ทั้งหมดสร้างตรงตามโครงสร้างใน §9.1 (ไม่มีไฟล์เพิ่ม/ขาดโดยไม่จำเป็น)
- [ ] ชื่อฟังก์ชัน/คลาสตรงตามตารางใน §9.2 (ไม่เปลี่ยนชื่อโดยไม่มีเหตุผล)
- [ ] ใช้ `Mapped[...]` syntax ของ SQLAlchemy 2.0+ ใน `models.py` ทุกที่
- [ ] ใช้ `ConfigDict(strict=True)` ใน Pydantic schemas ทุกที่

#### ✅ Layer Responsibility
- [ ] `routers/` ไม่มี business logic — เรียกเฉพาะ `service.method()`
- [ ] `services/` ไม่เรียก `db.execute()` โดยตรง — ใช้ `repository.method()` เท่านั้น
- [ ] `repository.py` มีเฉพาะ database queries — ไม่มี business rule
- [ ] `models.py` มีเฉพาะ SQLAlchemy definitions — ไม่มี method ที่มี logic

#### ✅ Cross-Module Rules
- [ ] ไม่มีการ `from app.modules.X import ...` ใน `app/modules/Y`
- [ ] การสื่อสารข้ามโมดูลใช้ `shared/events.py` หรือ service interface เท่านั้น
- [ ] Dependency graph เป็น DAG (ไม่มี circular import) — ตรวจสอบด้วย `pydeps`

#### ✅ Security & Audit
- [ ] ทุก endpoint ที่ไม่ใช่ `/auth/*` มี `Authorization: Bearer *** dependency
- [ ] ID card ถูก encrypt ด้วย `encrypt_sensitive()` ก่อนเก็บลง DB
- [ ] ทุก sensitive operation เรียก `audit.log_audit()`
- [ ] Password hash ใช้ `Argon2id` (OWASP 2026, RFC 9106)

#### ✅ Testing Coverage (Docker-First)
- [ ] ทุกฟังก์ชันใน `services/` มี unit test ที่ mock `repository.py`
- [ ] ทุก endpoint ใน `routers/` มี integration test ที่ใช้ `TestClient`
- [ ] ทดสอบผ่าน `docker compose run --rm backend-test pytest ...` ได้ผลลัพธ์เหมือนรันในเครื่อง
- [ ] Coverage ตรงตามเป้าหมายใน §7.4 (`services/` ≥90%, `routers/` ≥85%)
- [ ] Test ชื่อสื่อถึง FR/BR ที่ทดสอบ (เช่น `test_current_must_be_gte_previous`)

#### ✅ API Contract
- [ ] Response format ตรงกับ §3.1: `{ "data": {...}, "meta": {...} }` หรือ `{ "error: { code, message, details } }`
- [ ] Error codes ตรงกับตารางใน §3.3 (เช่น `AUTH-001`, `BILL-001`)
- [ ] OpenAPI spec generate อัตโนมัติจาก FastAPI — ไม่เขียนมือ

---

### 9.5 AI Agent Implementation Protocol (Docker-First)

เมื่อคุณ (AI Agent) ต้องสร้างหรือแก้ไฟล์ใน `backend/`:

```text
1️⃣ อ่าน Module Spec ใน §9.2 สำหรับไฟล์ที่รับผิดชอบ
   → สร้างไฟล์ตรงตามโครงสร้างใน §9.1
   → ใช้ function signature ตรงตามตาราง (ชื่อ, input, output)

2️⃣ อ่าน Critical Flow Diagrams ใน §9.3
   → เขียน control flow ตามลำดับที่ระบุ
   → ใช้ dependency injection ผ่าน `Depends()` ตามตัวอย่าง

3️⃣ อ่าน Layer Responsibility ใน §9.4
   → ตรวจสอบว่าโค้ดอยู่ถูกชั้น (router/service/repo/model)
   → ไม่ละเมิดกฎข้ามโมดูล

4️⃣ อ่าน Security & Audit Guidelines
   → เพิ่ม `audit.log_audit()` สำหรับทุก sensitive op
   → ใช้ `encrypt_sensitive()` สำหรับข้อมูลอ่อนไหว

5️⃣ สร้าง test files ตรงตาม §9.2 ตาราง "Test File" column
   → Unit test สำหรับ services/ (mock repository)
   → Integration test สำหรับ routers/ (ใช้ TestClient)

6️⃣ ทดสอบผ่าน Docker ก่อนเสนอ PR
   → รัน `docker compose run --rm backend-test pytest tests/modules/<module>/ -v`
   → รัน `docker compose run --rm backend-test ruff check . && mypy app/`
   → แนบผล coverage report จาก `htmlcov/` ในคอมเมนต์ PR

7️⃣ ก่อนเสนอ PR → รัน Implementation Checklist ใน §9.4
   → ติ๊กทุกข้อที่ผ่าน → แนบผล coverage report

8️⃣ หากพบเอกสารไม่ครอบคลุม → เสนอแก้ไขในแยกต่างหาก
   → อย่าเดาหรือสมมติเอง → แจ้ง Human เพื่อตัดสินใจ
```

> ✅ **ผลลัพธ์ที่คาดหวัง:**  
> - AI Agent generate โค้ดที่ **ตรงตามสถาปัตยกรรม** โดยไม่ต้องถามซ้ำ  
> - Human สามารถ **verify โค้ดด้วย checklist** ใน §9.4 ภายใน 5 นาที  
> - เอกสารนี้เป็น **Single Source of Truth** สำหรับ backend implementation

> ℹ️ **หมายเหตุ:** เอกสารส่วนนี้เป็น **Backend-Specific Implementation Blueprint**
> 🔄 **Change Control:** แก้ไขโครงสร้างไฟล์/ฟังก์ชัน → อัปเดต §9.1-9.2 → อัปเดต Traceability Matrix ใน §8 → แจ้งใน PR description
> 🐳 **Docker-First Rule:** ทุกคำสั่งพัฒนา/ทดสอบต้องรันผ่าน `docker compose` เท่านั้น
> 🤖 **สำหรับ AI Agent:** อ่านส่วนนี้ + `docs/SDD.md` §2 + `docs/ARCHITECTURE.md` ก่อนเริ่มเขียนโค้ดทุกครั้ง

---

### 9.6 Dynamic File Registration (สำหรับเอกสารที่อัปเดตอัตโนมัติ)

เพื่อให้เอกสารนี้คงความถูกต้องแม้จำนวนไฟล์เปลี่ยนแปลง:

```markdown
## 🔄 ไฟล์ที่เพิ่ม/แก้ไขล่าสุด (Auto-Updated by PR)

| วันที่ | ไฟล์ที่เพิ่ม/แก้ | โมดูล | FR/BR ที่เกี่ยวข้อง | ผู้แก้ไข | สถานะ |
|--------|----------------|-------|-------------------|----------|--------|
| 2026-05-25 | `app/shared/events.py` | shared | §9.2 Cross-Module Communication | AI Agent | ✅ |
| 2026-05-25 | `app/shared/deps.py` | shared | §9.1 Dependency Injection | AI Agent | ✅ (upgraded — raise 401) |
| 2026-05-25 | `app/config.py` | shared | §4.4 Security, §9.1 Config | AI Agent | ✅ (upgraded — added env vars) |
| 2026-05-25 | `app/modules/auth/constants.py` | auth | §3.3 Error Table, §5 Events | AI Agent | ✅ |
| 2026-05-25 | `app/modules/auth/events.py` | auth | §9.2 Event Bus | AI Agent | ✅ |
| 2026-05-25 | `app/modules/auth/repository.py` | auth | §2.1, §4.2 User Repository | AI Agent | ✅ |
| 2026-05-25 | `app/modules/auth/services/auth_service.py` | auth | FR-USER-01, §3.3 Login | AI Agent | ✅ |
| 2026-05-25 | `app/modules/auth/services/invite_service.py` | auth | FR-USER-02, §3.3 Invite | AI Agent | ✅ |
| 2026-05-25 | `app/modules/auth/routers/auth_router.py` | auth | FR-USER-01~03, §3.3 | AI Agent | ✅ |
| 2026-05-25 | `app/modules/auth/__init__.py` | auth | §2.1 Facade | AI Agent | ✅ |
| 2026-05-25 | `app/main.py` | app | §3.3 Router Registration | AI Agent | ✅ |
| 2026-05-25 | `tests/conftest.py` | tests | §7.2-7.4 Fixtures | AI Agent | ✅ |
| 2026-05-25 | `tests/factories/auth_factories.py` | tests | §7.3 Factory Pattern | AI Agent | ✅ |
| 2026-05-25 | `tests/modules/auth/test_auth_service.py` | tests | §7.2 Unit Tests | AI Agent | ✅ |
| 2026-05-25 | `tests/modules/auth/test_invite_service.py` | tests | §7.2 Unit Tests | AI Agent | ✅ |
| 2026-05-25 | `tests/modules/auth/test_auth_api.py` | tests | §7.3 Integration Tests | AI Agent | ✅ |
| 2026-05-25 | `tests/shared/test_security.py` | tests | §4.4, §7.2 | AI Agent | ✅ |
| 2026-05-25 | `tests/shared/test_audit.py` | tests | §7.4, §7.2 | AI Agent | ✅ |
| 2026-05-25 | `tests/integration/test_auth_flow.py` | tests | §5, §7.3 E2E | AI Agent | ✅ |
| 2026-05-25 | `backend/README.md` | docs | Sprint 1 Quick Start | AI Agent | ✅ |
| 2026-05-25 | `docs/RETROSPECTIVES/sprint-1.md` | docs | Lessons Learned | AI Agent | ✅ |
| 2026-05-25 | `backend/scripts/create_tables.py` | infra | DB Bootstrap (temp) | AI Agent | ✅ |
| 2026-05-25 | `backend/alembic/env.py` | infra | Async Migration Config | AI Agent | ✅ |
| 2026-05-25 | `backend/alembic/versions/001_create_auth_tables.py` | infra | Auth Migration | AI Agent | ✅ |
| 2026-05-25 | `backend/alembic.ini` | infra | Alembic Config | AI Agent | ✅ |
| 2026-05-25 | `backend/pyproject.toml` | infra | Python Config | AI Agent | ✅ |
| 2026-05-25 | `backend/.gitignore` | infra | Git Ignore Rules | AI Agent | ✅ |
| 2026-05-25 | `Makefile` | root | Coverage Volume Fix | AI Agent | ✅ (upgraded) |

> ℹ️ ตารางนี้ควรอัปเดตอัตโนมัติผ่าน GitHub Actions เมื่อมีไฟล์ใหม่ใน `backend/app/modules/`  
> หรืออัปเดตด้วยมือโดยผู้พัฒนาเมื่อสร้างไฟล์ใหม่ที่ไม่มีในเอกสารเดิม
```