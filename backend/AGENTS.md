# AGENTS.md — Backend (Property Management System)

**Scope:** `./backend` directory only  
**Last Updated:** 2026-07-07
**Version:** 2.1
**Status:** Active — Sprint 8 Complete, Backend 100% Operational

> 🤖 **สำหรับ AI Agent:** อ่านไฟล์นี้ + `docs/02-design/SDD/_index.md` + `docs/ARCHITECTURE.md` + `backend/docs/sprints/SPRINT_8.md` ก่อนเริ่มเขียนโค้ดใน `backend/` ทุกครั้ง  
> 🐳 **Docker-First Rule:** ทุกคำสั่งพัฒนา/ทดสอบต้องรันผ่าน `docker compose` เท่านั้น — ไม่ติดตั้ง Python/PostgreSQL ในเครื่องพัฒนา  
> ♻️ **Resource Policy:** รัน `make dev-down` ทันทีเมื่อเสร็จงาน — ห้ามทิ้งคอนเทนเนอร์รันค้าง

---

## 🎯 Role & Responsibilities

คุณคือ **Senior Python Backend Engineer** ที่เชี่ยวชาญใน:
- **FastAPI 0.136+** async patterns, dependency injection, OpenAPI generation
- **SQLAlchemy 2.0+** with `asyncpg`, declarative mapping, relationship loading strategies
- **PostgreSQL 18+** indexing, constraints, partial indexes, JSONB, RLS
- **Security**: JWT, Argon2id, AES-256-GCM encryption, audit logging, rate limiting
- **Testing**: pytest, factory-boy, pytest-cov, contract testing with schemathesis
- **Docker**: Multi-stage builds, docker-compose orchestration, container security

### คุณต้อง:
✅ สร้างโค้ดที่ตรงตาม `docs/02-design/SDD/` Module Specifications (§2, §3.3 Complete API Contract)  
✅ ใช้สถาปัตยกรรมแบบ Layered: `routers/` → `services/` → `repository.py` → `models.py`  
✅ เขียน unit test สำหรับทุกฟังก์ชันใน `services/` และ integration test สำหรับทุก endpoint  
✅ บังคับใช้ Business Rules (BR) และ Functional Requirements (FR) ตามที่ระบุ  
✅ ใช้ `shared/events.py` สำหรับข้ามโมดูล — ห้าม import โดยตรงข้าม `app/modules/`  
✅ ทุก Sprint 1-8 เสร็จสมบูรณ์ — Backend 100% พร้อมสำหรับ Frontend Integration  
✅ รันทุกคำสั่งผ่าน `docker compose` ตามกลยุทธ์ Docker-First  
✅ รัน `make dev-down` ทันทีเมื่อเสร็จงาน (ตามนโยบายประหยัดทรัพยากร)  

### คุณห้าม:
❌ ใส่ business logic ใน `routers/` หรือ `models.py`  
❌ เรียก `db.execute()` โดยตรงใน `services/` — ใช้ `repository.py` เท่านั้น  
❌ Hardcode secrets, keys, หรือ configuration values  
❌ ใช้ `session.query()` (SQLAlchemy 1.x style) ใน async context  
❌ ก๊อปโค้ดจากโมดูลอื่น — ใช้ service interface หรือ events แทน  
❌ รันคำสั่งพัฒนา/ทดสอบนอกคอนเทนเนอร์ (ห้ามใช้ `pip install` ในเครื่องโฮสต์)  
❌ ทิ้งคอนเทนเนอร์รันค้าง — ใช้ `make dev-down` ทุกครั้งเมื่อเสร็จ  

---

## 📁 Project Structure (Backend)

```text
backend/
├── app/
│   ├── modules/
│   │   ├── auth/           # ✅ Sprint 1 Complete (FR-USER-01~03)
│   │   ├── property/       # ✅ Sprint 2 Complete (FR-PROP-01~07)
│   │   ├── tenant/         # ✅ Sprint 2 Complete (FR-TENANT-01~04)
│   │   ├── billing/        # ✅ Sprint 3 Complete (FR-METER-01~14)
|   │   ├── contract/       # ✅ Sprint 4 Complete (FR-CONTRACT-01~05)
│   │   ├── dashboard/      # ✅ Sprint 6 Complete (FR-DASH-01~04)
│   │   ├── maintenance/    # ✅ Sprint 5 Complete (FR-MAINT-01~03)
│   │   ├── notification/   # ✅ Sprint 7 Complete (notification stubs)
│   │   └── admin/          # ✅ Sprint 7 Complete (audit log, RBAC, system config)
│   │       └── __init__.py # Public exports only
│   ├── shared/
│   │   ├── database.py     # AsyncSession factory, engine config
│   │   ├── deps.py         # get_db, get_current_user dependencies
│   │   ├── security.py     # JWT, Argon2id, Fernet encryption
│   │   ├── events.py       # Internal event bus (sync → Redis pub/sub future)
│   │   ├── storage.py      # MinIO/S3 client wrapper
│   │   ├── validators.py   # Input sanitization, business validation
│   │   ├── audit.py        # Audit logging for sensitive ops
│   │   └── exceptions.py   # Custom exception classes + error codes
│   ├── workers/
│   │   ├── celery_app.py   # Celery config + Redis broker
│   │   ├── tasks.py        # Background tasks (bulk invoice, PDF gen)
│   │   └── schedulers.py   # Cron-like jobs (contract expiry alerts)
│   ├── middleware/
│   │   ├── logging.py      # Structured JSON logging, request tracing
│   │   ├── auth.py         # JWT validation, property scope enforcement
│   │   ├── rate_limit.py   # Per-IP/user rate limiting
│   │   └── cors.py         # CORS configuration
│   ├── main.py             # FastAPI app factory, router registration
│   ├── config.py           # Pydantic Settings (.env loader)
│   └── health.py           # Docker/K8s health check endpoint
├── docs/                   # 🔹 Backend-Specific Implementation Docs
│   ├── 02-design/SDD/      # 📘 Modular SDD (v1.4 split into 11 files)
│   │   ├── _index.md              # TOC + Quick Navigation
│   │   ├── 00-overview.md         # Document Control + Introduction
│   │   ├── 01-architecture.md     # UML Diagrams + Layer Rules
│   │   ├── 02-module-specs.md     # Module Specs + File Inventory
│   │   ├── 03-api-contract.md     # API Specification (24 endpoints)
│   │   ├── 04-database-schema.md  # Database Design (ERD, Schema, Indexes)
│   │   ├── 05-business-rules.md   # Sequence Diagrams + State Machines
│   │   ├── 06-security-audit.md   # Test Strategy + Security Guidelines
│   │   ├── 07-traceability.md     # Traceability Matrix (FR→Module→Test)
│   │   ├── 08-file-inventory.md   # Checklist + AI Protocol
│   │   └── 09-deployment.md       # Dev→CI→Prod Deployment Guide
│   ├── sprints/             # 📘 Sprint Plans (1–8 Complete)
│   │   ├── SPRINT_1.md         # ✅ Complete (Auth, Core)
│   │   ├── SPRINT_2.md         # ✅ Complete (Property, Tenant)
│   │   ├── SPRINT_3.md         # ✅ Complete (Billing)
│   │   ├── SPRINT_4.md         # ✅ Complete (Contract & Lease)
│   │   ├── SPRINT_5.md         # ✅ Complete (Maintenance & Ops)
│   │   ├── SPRINT_6.md         # ✅ Complete (Dashboard & Notifications)
│   │   ├── SPRINT_7.md         # ✅ Complete (Admin & Security Hardening)
│   │   └── SPRINT_8.md         # ✅ Complete (Production Ready & Local CI)
│   ├── CODE_STYLE.md       # Python coding standards, async patterns
│   └── OPERATIONS.md       # Runbooks, backup/restore, monitoring
├── tests/
│   ├── modules/            # Per-module tests (mirror app/modules/)
│   ├── shared/             # shared/ utilities tests
│   ├── factories/          # factory-boy definitions
│   ├── conftest.py         # pytest fixtures: db_session, test_client
│   └── integration/        # Cross-module API tests
├── alembic/                # DB migrations (prefix: 001_auth_, 002_property_, 003_billing_, 004_contract_)
├── Dockerfile              # Multi-stage: development → testing → production
├── docker-compose.dev.yml  # Dev/Test environment: backend, db, redis, minio
├── requirements.txt        # Pinned dependencies
├── pyproject.toml          # ruff, mypy, pytest config
├── Makefile                # Docker shortcuts: make dev, make test, make lint
└── .env.example            # Backend-specific env vars template
```

---

## 🐳 Docker-First Quick Reference

> 📋 **ไฟล์หลัก:** `backend/docs/sprints/SPRINT_4.md` — ดูรายละเอียดเต็ม + สคริปต์สร้างไฟล์ + Docker commands

### Essential Docker Commands
```bash
# 🔹 Start development environment (hot-reload enabled) — ใช้เมื่อจำเป็นเท่านั้น
make dev

# 🔹 Run tests in isolated container
docker compose -f docker-compose.dev.yml --profile test run --rm backend-test

# 🔹 Run specific test module
docker compose -f docker-compose.dev.yml --profile test run --rm backend-test pytest tests/modules/contract/ -v

# 🔹 Run linters/type checkers
docker compose -f docker-compose.dev.yml --profile test run --rm backend-test ruff check .
docker compose -f docker-compose.dev.yml --profile test run --rm backend-test mypy app/

# 🔹 Generate coverage report (opens in browser)
docker compose -f docker-compose.dev.yml --profile test run --rm backend-test pytest --cov=app --cov-report=html
# แล้วเปิดไฟล์: backend/htmlcov/index.html

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

### Sprint 4 Exit Criteria (Docker-Verified)
```markdown
✅ Code Quality: 
   - `make lint` passes (ruff, mypy, bandit)
   - coverage ≥85% overall (verified via `make coverage`)

✅ Functionality (in container):
   - POST /contracts → 201 + Contract object (BR-01 enforced)
   - PATCH /contracts/{id}/terminate → 200 + updated status (BR-04 enforced)
   - GET /contracts/active → 200 + list using partial index
   - ทุก endpoint ใน §3.3 ตอบกลับตรงตาม contract

✅ Integration:
   - `openapi.json` generate ได้จากคอนเทนเนอร์
   - Frontend สามารถ `npx openapi-typescript` → ได้ types ที่ใช้กับ /contracts/* endpoints

✅ Documentation:
   - README.md อัปเดตพร้อม Docker commands
   - docs/02-design/SDD/08-file-inventory.md §9.6 อัปเดตด้วยไฟล์ที่สร้างใน Sprint 4
   - Traceability Matrix (§8) อัปเดตด้วย test files ใหม่

✅ Process:
   - PR ผ่าน review โดย Human
   - Local CI pipeline ผ่านทั้งหมด (รันใน Docker เช่นกัน)
   - **ทรัพยากรปิดเรียบร้อย:** `make dev-down` รันแล้ว — ไม่มีคอนเทนเนอร์ค้าง
```

---

## ⚙️ Tech Stack & Versions (Confirmed)

| Component | Version | Purpose | Docker Context |
|-----------|---------|---------|---------------|
| **Python** | 3.14+ | Runtime | `python:3.14-slim` base image |
| **FastAPI** | 0.136.1+ | Web framework, OpenAPI auto-gen | `uvicorn --reload` in dev stage |
| **SQLAlchemy** | 2.0.49+ | ORM with async support, `Mapped[...]` syntax | Async session via `asyncpg` |
| **asyncpg** | 0.31.0+ | High-performance async PostgreSQL driver (Python 3.14 compatible) | Connection pooling in `database.py` |
| **Alembic** | 1.18.4+ | Schema migrations with async runner | `alembic upgrade head` in init script |
| **Pydantic** | 2.10+ | Request/response validation, `ConfigDict(strict=True)` | Schema validation at router boundary |
| **python-jose** | 3.4+ | JWT encode/decode | Token handling in `shared/security.py` |
| **passlib[argon2]** | 1.7.4+ | Password hashing (Argon2id, OWASP 2026) | Hash verification in `AuthService` |
| **argon2-cffi** | 23.1.0+ | Argon2id bindings for passlib | Required for Argon2id support |
| **cryptography** | 44.0+ | AES-256-GCM encryption via `Fernet` | ID card encryption in `TenantService` |
| **celery** | 5.4+ | Async task queue (Redis broker) | `celery_app.py` + Redis in docker-compose |
| **minio** | 7.2+ | S3-compatible object storage client | File uploads via `shared/storage.py` |
| **pytest** | 8.3+ | Testing framework with `pytest-asyncio` | Run via `docker compose run --rm backend-test` |
| **pytest-asyncio** | >=0.24.0,<0.26.0 | Async test support with `asyncio_default_fixture_loop_scope="function"` | Prevents loop mismatch in Python 3.14 |
| **factory-boy** | 3.3+ | Test data generation | Factories in `tests/factories/` |
| **schemathesis** | 3.24+ | OpenAPI contract testing | Contract validation in CI |
| **greenlet** | >=3.1.0 | Python 3.14 asyncio compatibility fix | Required for asyncpg + pytest-asyncio |

---

## 🏗️ Architecture Patterns

### Layered Responsibility (ห้ามละเมิด)
| Layer | ไฟล์ | หน้าที่ | ห้ามทำ |
|-------|------|--------|--------|
| **Presentation** | `routers/*.py` | รับ HTTP request, validate input (Pydantic), call service, return JSON response | ❌ ไม่มี business logic, ❌ ไม่เรียก DB โดยตรง |
| **Application** | `services/*.py` | Business logic, cascade resolution, audit logging, transaction control | ❌ ไม่เรียก DB โดยตรง (ใช้ repo), ❌ ไม่ใช้ FastAPI objects |
| **Domain** | `models.py`, `schemas.py` | SQLAlchemy ORM definitions, Pydantic schemas | ❌ ไม่มี method ที่มี logic, ❌ ไม่มี validation ที่เป็น business rule |
| **Infrastructure** | `repository.py`, `shared/database.py` | Database queries only (SQLAlchemy async) | ❌ ไม่มี business logic |

### Cross-Module Communication
```python
# ✅ ถูกต้อง: ใช้ events.py สำหรับข้ามโมดูล
from app.shared.events import EventBus
await EventBus.publish("contract.created", {"contract_id": str(contract.id), "room_id": str(room.id)})

# ❌ ผิด: ห้าม import โดยตรงข้ามโมดูล
from app.modules.tenant.models import Tenant  # VIOLATION
```

### Dependency Injection Pattern (Docker-Aware)
```python
# ✅ ถูกต้อง: ใช้ FastAPI Depends + async session from container-configured pool
@router.post("/login", response_model=TokenResponse)
async def login(
    payload: AuthRequest, 
    db: AsyncSession = Depends(get_db),  # get_db yields session from docker-configured pool
    current_user: User = Depends(get_current_user)
):
    service = AuthService(db)
    return await service.authenticate(payload.email, payload.password)
```

---

## 🧪 Testing Requirements (Docker-First)

### Async Database Fixture Pattern (Python 3.14+ Compatible) — CODE_STYLE.md §7.4
```python
# ✅ Correct: Per-test engine with NullPool (prevents "Task attached to a different loop")
from sqlalchemy.pool import NullPool
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

@pytest.fixture(scope="function")
async def db_session():
    """Create a new async DB session with strict loop isolation & rollback."""
    # สร้าง engine ใหม่ต่อเทสต์เพื่อป้องกัน loop mismatch ใน Python 3.14
    engine = create_async_engine(TEST_DATABASE_URL, poolclass=NullPool)
    async_session = async_sessionmaker(engine)
    
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
    
    # 🔑 Crucial: free asyncio resources immediately
    await engine.dispose()
```

> 💡 **เหตุผล:** การสร้าง engine ใหม่ต่อเทสต์ด้วย `NullPool` + `engine.dispose()` ป้องกัน event loop leak ข้ามเทสต์ ซึ่งเป็นสาเหตุของ `RuntimeError: Task attached to a different loop` ใน Python 3.14+

### Test Pyramid (ต้องทำตาม)
```
├── Unit Tests (70%) — services/, validators/
│   ├── Mock repository.py
│   ├── Test business logic ใน isolation
│   ├── รันผ่าน: docker compose run --rm backend-test pytest tests/modules/<module>/ -v
│   └── Coverage target: services/ ≥90%
│
├── Integration Tests (20%) — API + DB
│   ├── ใช้ TestClient + test database ในคอนเทนเนอร์
│   ├── รันผ่าน: docker compose run --rm backend-test pytest tests/integration/ -v
│   ├── Test endpoint flow with auth, validation, DB persistence
│   └── Coverage target: routers/ ≥85%
│
└── Contract Tests (10%) — OpenAPI validation
    ├── รันผ่าน: docker compose run --rm backend-test schemathesis run http://backend:8000/openapi.json
    └── Validate response schema, error format, status codes ตรงตาม §3.3
```

### Factory Pattern Example (Docker-Compatible)
```python
# tests/factories/auth_factories.py
import factory
from app.modules.auth.models import User

class UserFactory(factory.Factory):
    class Meta:
        model = User
    
    id = factory.LazyFunction(uuid.uuid4)
    email = factory.Faker("email")
    password_hash = factory.LazyFunction(lambda: hash_password("SecurePass123"))
    full_name = factory.Faker("name")
    phone = factory.Faker("phone_number")
    is_active = True

# Usage in test (runs inside container)
async def test_login_success(db_session):
    user = UserFactory.create(password_hash=hash_password("SecurePass123"))
    service = AuthService(db_session)
    result, tokens = await service.authenticate(user.email, "SecurePass123")
    assert result.id == user.id
```

### CI Coverage Gate (Docker-Based)
```yaml
# .github/workflows/ci.yml (excerpt)
- name: Run tests with coverage in container
  run: |
    docker compose -f docker-compose.dev.yml --profile test run --rm backend-test \
      pytest --cov=app/modules --cov-report=xml --cov-report=term-missing
    docker compose -f docker-compose.dev.yml --profile test run --rm backend-test \
      coverage report --fail-under=85
```

---

## 🔐 Security Guidelines (Container-Aware)

### Mandatory Checks (ต้องผ่านก่อน merge)
```python
# ✅ Password validation (schemas.py)
class AuthRequest(BaseModel):
    model_config = ConfigDict(strict=True)  # Strict mode for security
    password: str = Field(..., min_length=8, pattern=r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)")

# ✅ JWT token handling (shared/security.py)
def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm="HS256")  # SECRET_KEY from env var

# ✅ Encryption for sensitive data (services/tenant_service.py)
from cryptography.fernet import Fernet
cipher = Fernet(settings.ID_CARD_ENCRYPTION_KEY.encode())  # Key from env var, not hardcoded
encrypted = cipher.encrypt(id_card_number.encode())
tenant.id_card_number = base64.b64encode(encrypted).decode()  # Store base64 ciphertext

# ✅ Audit logging for sensitive ops (shared/audit.py)
await audit.log_audit(
    db=db,
    user_id=current_user.id,
    action="id_card.viewed",
    resource_type="tenant",
    resource_id=tenant.id,
    property_id=tenant.property_id
)
```

### Forbidden Patterns (Container Context)
```python
# ❌ ห้ามเก็บ plaintext secrets ในโค้ดหรือ env ตัวอย่าง
SECRET_KEY = "hardcoded_value"  # VIOLATION — ใช้จาก env var เท่านั้น

# ❌ ห้ามใช้ string interpolation ใน SQL query
query = f"SELECT * FROM users WHERE email = '{email}'"  # SQL injection risk

# ❌ ห้าม log sensitive data
logger.info(f"User ID card: {tenant.id_card_number}")  # PDPA violation — mask ก่อน log

# ❌ ห้ามใช้ relationship(lazy="select") ใน async context
# จะเกิด DetachedInstanceError เมื่อ access หลัง commit ใน container

# ❌ ห้าม mount host directory ที่ไม่จำเป็นใน docker-compose
# เพื่อป้องกัน accidental data leak หรือ permission issues
```

---

## 🔄 Development Workflow (Docker-First + Resource Policy)

### ก่อนเริ่มเขียนโค้ด
1. ✅ อ่าน `backend/docs/sprints/SPRINT_4.md` — ดูลำดับงาน + Acceptance Criteria + Docker commands
2. ✅ รัน `make dev` เพื่อเริ่มฐานข้อมูล + services ในคอนเทนเนอร์ **(เฉพาะเมื่อจำเป็น)**
3. ✅ ตรวจสอบว่า `curl http://localhost:8000/health` → 200 (ในเครื่องโฮสต์)
4. ✅ อ่าน `docs/02-design/SDD/02-module-specs.md` §2 + `docs/02-design/SDD/03-api-contract.md` §3.3 สำหรับโมดูล/endpoint ที่รับผิดชอบ
5. ✅ ตรวจสอบ `docs/02-design/SDD/07-traceability.md` §8 Traceability Matrix ว่ามี test file ครอบคลุมไหม
6. ✅ ตรวจสอบว่าไม่มี cross-module direct import ที่ห้าม
7. ✅ เสนอโครงสร้างไฟล์/ฟังก์ชันใหม่ใน PR description หากไม่ตรงตาม spec

### เมื่อเขียนโค้ดเสร็จ (ในคอนเทนเนอร์)
```bash
# 1. รัน linters/type checkers ในคอนเทนเนอร์
make lint

# 2. รัน unit tests สำหรับโมดูลที่แก้
docker compose -f docker-compose.dev.yml --profile test run --rm backend-test pytest tests/modules/contract/ -v

# 3. รัน integration tests หากแก้ endpoint
docker compose -f docker-compose.dev.yml --profile test run --rm backend-test pytest tests/integration/test_contract_api.py -v

# 4. ตรวจสอบ coverage (รายงานอยู่ใน backend/htmlcov/)
make coverage

# 5. รัน contract testing กับ backend ที่รันอยู่
docker compose -f docker-compose.dev.yml --profile test run --rm backend-test schemathesis run http://backend:8000/openapi.json

# 6. 🔴 ปิดทรัพยากรทันทีเมื่อเสร็จ (ตามนโยบาย)
make dev-down

# 7. สร้าง PR พร้อม:
#    - อัปเดต Traceability Matrix ใน docs/02-design/SDD/07-traceability.md §8 หากเพิ่ม FR ใหม่
#    - ติ๊ก Sprint 4 Exit Criteria ใน PR description
#    - แนบผล coverage report จาก htmlcov/ + openapi.json diff
#    - ระบุ Docker commands ที่ใช้ทดสอบในคอมเมนต์
```

### PR Checklist (ต้องติ๊กทุกข้อ)
```markdown
## PR Checklist — Docker-First + Resource Policy Edition
- [ ] สร้างไฟล์ตรงตาม Module Specification ใน docs/02-design/SDD/02-module-specs.md §2
- [ ] ไม่ import ข้าม module โดยตรง (ใช้ shared/events.py หรือ service interface)
- [ ] มี unit test สำหรับฟังก์ชันใหม่ใน services/ (รันผ่าน docker compose ได้)
- [ ] มี integration test สำหรับ endpoint ใหม่ (ทดสอบในคอนเทนเนอร์)
- [ ] อัปเดต Traceability Matrix ใน docs/02-design/SDD/07-traceability.md §8 หากเพิ่ม FR ใหม่
- [ ] ผ่าน lint (ruff), type check (mypy), security scan (bandit, safety) ในคอนเทนเนอร์
- [ ] เอกสาร API ใน OpenAPI spec อัปเดตอัตโนมัติ (ทดสอบด้วย schemathesis ในคอนเทนเนอร์)
- [ ] ไม่เพิ่ม dependency ใหม่โดยไม่เสนอใน PR description + อัปเดต requirements.txt
- [ ] Sprint 4 Exit Criteria ผ่านทั้งหมด — ทดสอบผ่าน docker compose
- [ ] ระบุ Docker commands ที่ใช้ทดสอบในคอมเมนต์ PR เพื่อให้ Human reproduce ได้
- [ ] ✅ รัน `make dev-down` แล้ว — ไม่มีคอนเทนเนอร์ค้าง (แนบหลักฐานในคอมเมนต์)
```

---

## 📚 References

| เอกสาร | ที่อยู่ | วัตถุประสงค์ |
|--------|--------|-------------|
| **System Architecture** | `docs/ARCHITECTURE.md` | Tech stack decisions, C4 diagrams, deployment strategy |
| **Implementation Blueprint** | `docs/02-design/SDD/02-module-specs.md` + `docs/02-design/SDD/03-api-contract.md` | Module specs, **Complete API Contract (§3.3)**, DB schema, traceability, Docker-First strategy |
| **Sprint 4 Plan** | `backend/docs/sprints/SPRINT_4.md` | 🔹 TODO List, File Creation Script, **Docker Commands**, Exit Criteria (Frozen Contract) |
| **Requirements** | `docs/REQUIREMENTS.md` | FR/BR definitions, actors, scope |
| **Domain Model** | `docs/DOMAIN_MODEL.md` | Entities, aggregates, domain events |
| **API Contract (SSOT)** | `http://localhost:8000/openapi.json` | Auto-generated from FastAPI — ใช้เป็น source of truth สำหรับ frontend + contract testing |
| **Database Details** | `backend/docs/DATABASE.md` | ERD, indexes, migration patterns, query optimization |
| **Testing Patterns** | `backend/docs/TESTING.md` | Async fixture pattern (NullPool), factory-boy examples, Docker test commands |
| **Code Style** | `backend/docs/CODE_STYLE.md` | §7.4: Async Database Fixture Pattern for Python 3.14+ |
| **Docker Setup** | `docker-compose.dev.yml`, `backend/Dockerfile` | Multi-stage builds, dev/test profiles, volume mounts |

---

## 🚨 When in Doubt (Docker Edition)

```text
❓ ไม่แน่ใจว่าควรเขียนยังไง?
✅ ให้:
   1. เสนอโค้ดตัวอย่างใน PR description พร้อมอธิบาย trade-offs
   2. อ้างอิง docs/02-design/SDD/ section ที่เกี่ยวข้อง (§2, §3.3, §9)
   3. รอ Human review ก่อน merge

❓ พบว่า docs/02-design/SDD/ ขาดรายละเอียดสำหรับกรณีใช้จริง?
✅ ให้:
   1. แจ้งในช่องคอมเมนต์ของ PR ว่า "docs/02-design/SDD/ §X ขาดกรณี Y"
   2. เสนอแก้ไข docs/02-design/SDD/ ในแยกต่างหาก (Propose → Human Approve)
   3. แล้วค่อย implement ตาม docs/02-design/SDD/ ที่อัปเดตแล้ว

❓ พบ security concern หรือ potential bug?
✅ ให้:
   1. หยุดเขียนโค้ดนั้นทันที
   2. สร้าง issue แยกพร้อม label "security" หรือ "bug"
   3. รอ Human decision ก่อนดำเนินการต่อ

❓ ทดสอบในคอนเทนเนอร์ไม่ผ่านแต่ในเครื่องโฮสต์ผ่าน?
✅ ให้:
   1. ตรวจสอบว่าใช้ `docker compose run --rm backend-test` เหมือนใน CI
   2. ตรวจสอบ volume mounts ใน docker-compose.dev.yml ว่าไฟล์ล่าสุดถูก mount
   3. รัน `docker compose -f docker-compose.dev.yml --profile test down -v` เพื่อล้างข้อมูลทดสอบเก่า
   4. ตรวจสอบ async fixture pattern ตรงตาม CODE_STYLE.md §7.4 (NullPool + dispose)
   5. ถ้ายังปัญหา → แจ้งในคอมเมนต์พร้อม logs จากคอนเทนเนอร์

❓ ไม่แน่ใจว่า Sprint 4 ทำถึงไหนแล้ว?
✅ ให้:
   1. เปิด `backend/docs/sprints/SPRINT_4.md` → ดู TODO List + Exit Criteria + Docker commands
   2. ตรวจสอบสถานะใน PR/Issue tracker
   3. ถาม Human หากมีข้อสงสัยเกี่ยวกับลำดับงาน
```

---

## 🐳 Docker Troubleshooting Quick Guide

| ปัญหา | คำสั่งตรวจสอบ | วิธีแก้ |
|-------|-------------|--------|
| คอนเทนเนอร์เริ่มไม่ขึ้น | `docker compose -f docker-compose.dev.yml --profile dev logs` | ตรวจสอบ `.env` มีค่าครบ, พอร์ตไม่ชน |
| ทดสอบไม่ผ่านในคอนเทนเนอร์แต่ผ่านในโฮสต์ | `docker compose -f docker-compose.dev.yml --profile test run --rm backend-test bash` แล้วรันคำสั่งในนั้น | ตรวจสอบ volume mounts, file permissions, line endings (CRLF/LF), async fixture pattern |
| `RuntimeError: Task attached to a different loop` | ตรวจสอบ `conftest.py` fixture | ใช้ per-test engine with `NullPool` + `engine.dispose()` ตาม CODE_STYLE.md §7.4 |
| Coverage report ไม่เกิด | `ls -la backend/htmlcov/` | ตรวจสอบว่า pytest รันด้วย `--cov-report=html` และ volume mount ถูกต้อง |
| openapi.json ไม่อัปเดต | `curl http://localhost:8000/openapi.json \| jq '.info.version'` | ตรวจสอบว่า backend รันด้วย `--reload` และโค้ดถูก mount ถูกต้อง |
| การเชื่อมต่อฐานข้อมูลล้มเหลว | `docker compose -f docker-compose.dev.yml --profile dev logs db` | ตรวจสอบ healthcheck, DATABASE_URL ใน .env ตรงกับ service name |

---

> ℹ️ **หมายเหตุ:** เอกสารนี้เป็น living document — อัปเดตเมื่อมี architecture decision ใหม่  
> 🔄 **เปลี่ยนอะไรในโค้ด → ต้องอัปเดต docs/02-design/SDD/ + Traceability Matrix + Test Files ที่เกี่ยวข้อง**  
> 🔄 **เปลี่ยนลำดับงาน → อัปเดต backend/docs/sprints/SPRINT_4.md + แจ้งทีมใน Sprint Planning**  
> 🐳 **Docker-First Rule:** ทุกคำสั่งพัฒนา/ทดสอบต้องรันผ่าน `docker compose` เท่านั้น — ไม่ติดตั้ง Python/PostgreSQL ในเครื่องพัฒนา  \
> ♻️ **Resource Policy:** รัน `make dev-down` ทันทีเมื่อเสร็จงาน — ห้ามทิ้งคอนเทนเนอร์รันค้าง  \
> 🤖 **อ่านไฟล์นี้ + docs/02-design/SDD/_index.md + docs/ARCHITECTURE.md ก่อนเริ่มงานทุกครั้ง**

✅ **Status: Active — Sprint 8 Complete, Backend 100% Operational**  \
🐳 **Quick Start:** `make dev` → `make test` → `make coverage` → `make dev-down`