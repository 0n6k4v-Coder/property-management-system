# File: 02-design/SDD/06-security-audit.md
# Test Strategy & Quality Assurance + Security Guidelines
## Property Management System

---

## 7. Test Strategy & Quality Assurance

### 7.1 Test Pyramid per Module (Functional)
```text
Billing Module Example:
├── Unit Tests (70%) — services/, validators/
│   ├── test_meter_service.py — validate_meter_values, record_reading logic
│   ├── test_invoice_service.py — resolve_utility_rate cascade, calculate_invoice
│   └── test_validators.py — sanitize_filename, validate_thai_id_card
│
├── Integration Tests (20%) — API + DB
│   ├── test_meter_api.py — POST /meter-readings with auth, validation, DB persistence
│   ├── test_invoice_api.py — bulk-generate → task queue → invoice creation
│   └── test_auth_integration.py — login → token → protected endpoint
│
└── E2E Tests (10%) — Browser flow
    ├── test_meter_reading_mobile.py — Mobile viewport, offline queue, sync
    └── test_bulk_invoice_flow.py — Full flow: meter → generate → LINE preview
```

### 7.2 Critical Test Cases per FR

| FR ID | Test Case | Type | Assertion |
|-------|----------|------|-----------|
| FR-METER-03 | `test_current_must_be_gte_previous` | Unit | `ValueError` raised if current < previous |
| FR-METER-05 | `test_resolve_rate_cascade_room_not_found` | Unit | Falls back to floor → building → property |
| FR-METER-07 | `test_bulk_generate_creates_one_invoice_per_active_contract` | Integration | Count of created invoices == count of active contracts |
| FR-CONTRACT-01 | `test_create_contract_fails_if_room_has_active_contract` | Integration | `ValueError` with BR-01 message |
| FR-TENANT-02 | `test_id_card_encrypted_before_storage` | Unit | `id_card_number` in DB is base64 ciphertext, not plaintext |
| FR-DASH-01 | `test_dashboard_occupancy_rate_calculation` | Unit | `(occupied_rooms / total_rooms) * 100` matches expected |

### 7.3 Test Data Factories (factory-boy)
```python
# tests/factories/billing_factories.py
class MeterReadingFactory(factory.Factory):
    class Meta:
        model = MeterReading
    
    room_id = factory.LazyFunction(uuid.uuid4)
    billing_month = factory.Faker("random_int", min=1, max=12)
    billing_year = factory.Faker("random_int", min=2020, max=2030)
    electric_previous = factory.Faker("pydecimal", left_digits=5, right_digits=2, positive=True)
    electric_current = factory.LazyAttribute(lambda o: o.electric_previous + factory.Faker("pydecimal", left_digits=2, right_digits=2, positive=True).generate({}))

# Usage in test:
def test_record_reading_creates_entry(db_session):
    reading = MeterReadingFactory.create(room_id=test_room.id, recorded_by=test_user.id)
    assert reading.id is not None
    assert reading.electric_used == reading.electric_current - reading.electric_previous
```

### 7.4 Coverage Requirements
| Component | Minimum Coverage | Measurement Tool | CI Gate |
|-----------|-----------------|------------------|---------|
| `services/` | 90% | `pytest-cov` | Fail if < 90% |
| `routers/` | 85% | `pytest-cov` | Fail if < 85% |
| `repository.py` | 80% | `pytest-cov` | Fail if < 80% |
| `validators.py` | 95% | `pytest-cov` | Fail if < 95% |
| **Overall** | **85%** | `coverage report` | **Fail if < 85%** |

### 7.5 Static Analysis & Security Checks (Non-Functional) — Docker-First
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

### 7.6 Contract & E2E Testing
| ประเภท | เครื่องมือ | ขอบเขต | Assertion หลัก | Docker Command |
|--------|----------|--------|---------------|---------------|
| **API Contract** | `Schemathesis` | Backend response ตรงตาม `openapi.json` จริงไหม | Status code, schema, error format (§3.5.2) | `docker compose run --rm backend-test schemathesis run http://backend:8000/openapi.json` |
| **Critical Flow E2E** | `Playwright` | Login → Meter Reading → Bulk Invoice → LINE Preview | UI state, offline sync, toast messages, mobile viewport | `docker compose run --rm frontend-test playwright test` |
| **Offline/PWA** | `Playwright` + `idb` mocking | IndexedDB queue → Background Sync → Retry | Data persistence, sync status, fallback UI | Same as above with network throttling |

### 7.7 CI Pipeline Execution Strategy (Docker-First)
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

> ✅ **กฎเหล็ก (Docker-First):** 
> 1. ทุกคำสั่งพัฒนา/ทดสอบต้องรันผ่าน `docker compose` เท่านั้น — ไม่ติดตั้ง Python/Node ในเครื่องพัฒนา
> 2. อย่ารัน E2E/Contract Test ก่อน Lint/Type/Unit เพราะถ้าโค้ดผิดพื้นฐานจะเสียเวลาสร้างคอนเทนเนอร์เปล่าๆ
> 3. ทุก PR ต้องผ่าน `fast-checks` + `unit-integration` ในคอนเทนเนอร์ก่อน Merge
> 4. `contract-e2e` รันเฉพาะบน `main` หรือ PR ที่ถูก approve แล้ว (ประหยัดทรัพยากร)

---

## Security Guidelines (จาก §4.4 Database Security)

### PostgreSQL Roles (Least Privilege)
```sql
-- App runtime role (no DDL, limited DML)
CREATE ROLE app_user LOGIN PASSWORD '${DB_PASSWORD}';
GRANT CONNECT ON DATABASE pms TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
REVOKE DELETE ON invoices, payments, audit_logs FROM app_user; -- Soft-delete only

-- Migration role (separate credentials)
CREATE ROLE app_admin LOGIN PASSWORD '${DB_ADMIN_PASSWORD}';
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO app_admin;
```

### Application-Layer Encryption (AES-256-GCM)
```python
# shared/security.py
from cryptography.fernet import Fernet
import base64

class SecurityService:
    def __init__(self, key: str):
        self.cipher = Fernet(key.encode())  # Key must be 32-byte URL-safe base64
    
    def encrypt(self, plaintext: str) -> str:
        return base64.b64encode(self.cipher.encrypt(plaintext.encode())).decode()
    
    def decrypt(self, ciphertext_b64: str) -> str:
        return self.cipher.decrypt(base64.b64decode(ciphertext_b64)).decode()
```

### Security Checklist
- [ ] ทุก endpoint ที่ไม่ใช่ `/auth/*` มี `Authorization: Bearer *** dependency
- [ ] ID card ถูก encrypt ด้วย `encrypt_sensitive()` ก่อนเก็บลง DB
- [ ] ทุก sensitive operation เรียก `audit.log_audit()`
- [ ] Password hash ใช้ `Argon2id` (OWASP 2026, RFC 9106)
- [ ] **ห้าม log plaintext** → Middleware logging ต้อง mask `id_card_number` เป็น `***********1234`
- [ ] ไม่ใช้ PostgreSQL `pgcrypto` → เพื่อรักษา Portability และควบคุม Key rotation ที่ App layer