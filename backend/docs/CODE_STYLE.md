# Code Style Guide — Backend (Python/FastAPI)

**Version:** 1.0  
**Effective Date:** 2026-05-25  
**Applies To:** All Python code in `backend/` directory  
**Enforced By:** ruff, mypy, pre-commit hooks, CI pipeline  

---

## 1. Project Structure & Naming

### 1.1 Directory Layout

```
backend/
├── app/
│   ├── modules/          # Feature modules (auth, property, billing, …)
│   │   └── <module>/
│   │       ├── __init__.py      # Facade exports only
│   │       ├── models.py        # SQLAlchemy ORM models
│   │       ├── schemas.py       # Pydantic request/response schemas
│   │       ├── repository.py    # Database queries only
│   │       ├── services/        # Business logic layer
│   │       │   ├── __init__.py
│   │       │   └── <feature>_service.py
│   │       ├── routers/         # HTTP layer (FastAPI routes)
│   │       │   ├── __init__.py
│   │       │   └── <feature>_router.py
│   │       ├── events.py        # Domain events this module publishes
│   │       └── constants.py     # Module-specific enums, error codes
│   ├── shared/           # Cross-cutting concerns (kernel)
│   │   ├── __init__.py   # Re-exports for convenience (not required)
│   │   ├── database.py   # AsyncSession factory, Base, engine
│   │   ├── deps.py       # FastAPI dependencies (get_db, get_current_user)
│   │   ├── security.py   # JWT, Argon2id, Fernet utilities
│   │   ├── audit.py      # Audit logging for sensitive ops
│   │   ├── exceptions.py # Custom exception classes + error mapping
│   │   ├── events.py     # Internal event bus interface
│   │   ├── storage.py    # MinIO/S3 client wrapper
│   │   ├── validators.py # Input sanitisation, business validation
│   │   └── utils.py      # General-purpose helpers
│   ├── workers/          # Celery tasks, schedulers
│   ├── middleware/       # Custom middleware (logging, auth, rate_limit)
│   ├── main.py           # FastAPI app factory (no business logic)
│   ├── config.py         # Pydantic Settings (.env loader)
│   └── health.py         # Docker/K8s health check endpoint
├── tests/                # Mirror app/ structure
│   ├── modules/
│   ├── shared/
│   ├── factories/
│   ├── conftest.py
│   └── integration/
├── alembic/              # DB migrations
├── Dockerfile
├── requirements.txt
├── pyproject.toml        # ruff, mypy, pytest config
└── docs/
    ├── CODE_STYLE.md     # ← this file
    ├── SPRINT_1.md       # Sprint 1 implementation plan
    ├── DATABASE.md       # DB schema & indexing guide
    └── API.md            # API contract reference
```

### 1.2 Naming Conventions

| Item | Convention | Example |
|------|-----------|---------|
| Modules / packages | `snake_case`, no hyphens | `auth_service.py`, `user_repository.py` |
| Classes | `PascalCase` | `User`, `AuthService`, `APIError` |
| Functions / methods | `snake_case` | `get_user_by_email()`, `create_access_token()` |
| Variables | `snake_case` | `user_id`, `access_token`, `is_active` |
| Constants | `UPPER_SNAKE_CASE` | `ACCESS_TOKEN_EXPIRE_MINUTES`, `AUTH_001` |
| Type aliases | `PascalCase` + `Type` suffix | `UserIdType`, `TokenPayloadType` |
| Test files | `test_<module>.py` | `test_auth_service.py`, `test_auth_api.py` |
| Fixtures | descriptive noun (in `conftest.py`) | `db_session`, `test_user`, `client` |

### 1.3 File Headers

Every `.py` file **must** have a module-level docstring on the first line:

```python
"""Short description of this module's purpose.

Longer description if needed. Reference SDD section when applicable.
References:
- SDD.md §2.1: Auth Module Specification
"""
```

---

## 2. Python Language Rules

### 2.1 Version & Syntax

- **Python version:** 3.14+ only
- **Type hints:** mandatory for all function signatures, class attributes, and module-level variables
- **Async:** use native `async def` / `await` — no `@coroutine` decorators
- **Pattern matching:** use `match` / `case` for complex branching
- **Union types:** use `X | Y` syntax, not `Union[X, Y]`
- **Optional types:** use `X | None`, not `Optional[X]`

### 2.2 Import Order

Imports are grouped and sorted by ruff automatically.  The canonical order is:

```python
# 1. Standard library
import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated, Any

# 2. Third-party
from fastapi import FastAPI, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field, ConfigDict

# 3. First-party (app/)
from app.config import get_settings
from app.shared.database import Base, get_db

# 4. Local (same module)
from .models import User
from .schemas import AuthRequest
```

**Forbidden:** relative imports that go up multiple levels (`from ..shared.deps import …`).

### 2.3 Type-Hint Examples

```python
# ✅ Correct
def create_user(
    db: AsyncSession,
    email: str,
    password: str,
    property_scopes: list[uuid.UUID] | None = None,
) -> User:
    ...

async def get_user_by_email(
    db: AsyncSession,
    email: str,
) -> User | None:
    ...

# Type alias for complex types
UserIdType = uuid.UUID
TokenPayloadType = dict[str, str | int | bool]

# Pydantic v2 strict mode
class AuthRequest(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid")
    email: str = Field(..., max_length=255, pattern=r"^[^@]+@[^@]+\.[^@]+$")
```

---

## 3. SQLAlchemy 2.0+ Patterns

### 3.1 Model Definition

Use `Mapped[]` + `mapped_column()` syntax exclusively.  No `Column()` API.

```python
# ✅ Correct: SQLAlchemy 2.0 DeclarativeBase
import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, ForeignKey, Index, func, text
from sqlalchemy.dialects.postgresql import UUID, JSONB, INET
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.shared.database import Base

class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4,
    )
    email: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True,
    )
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )
```

**Rules:**
- ❌ No `Column()`, `session.query()`, `db.execute(text("…"))` — use `select()` instead.
- ✅ Use `selectinload()` / `joinedload()` for eager loading; avoid `lazy="select"` defaults in async context.
- ✅ Indexes go in `__table_args__` with explicit names:
  ```python
  __table_args__ = (
      Index("ix_audit_logs_property_time", "property_id", text("timestamp DESC")),
  )
  ```
- ❌ No `relationship()` in `AuditLog` to prevent accidental N+1 in async context.

### 3.2 Query Patterns (Async)

```python
# ✅ Correct
from sqlalchemy import select
from sqlalchemy.orm import selectinload

async def get_user_with_properties(db: AsyncSession, user_id: uuid.UUID) -> User | None:
    stmt = (
        select(User)
        .where(User.id == user_id)
        .options(selectinload(User.property_scopes))
    )
    result = await db.execute(stmt)
    return result.scalars().first()

# ❌ Forbidden — will be rejected in code review
# session.query(User).filter(User.id == user_id).first()
```

### 3.3 Session Management

```python
# ✅ Correct: commit/rollback in the dependency (shared/deps.py)
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

# In services: let the caller's dependency manage commit.
# Use db.flush() + db.refresh() if you need the returned object immediately.
async def create_user(db: AsyncSession, email: str, password_hash: str) -> User:
    user = User(email=email, password_hash=password_hash)
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user
```

---

## 4. FastAPI Conventions

### 4.1 Router Structure

```python
# modules/auth/routers/auth_router.py
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Annotated

from app.shared.deps import get_db, get_current_user
from app.modules.auth.services.auth_service import AuthService
from app.modules.auth.schemas import AuthRequest, TokenResponse

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

@router.post("/login", response_model=TokenResponse, status_code=status.HTTP_200_OK)
async def login(
    payload: AuthRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """Authenticate user and return JWT tokens (FR-USER-01)."""
    service = AuthService(db)
    user, tokens = await service.authenticate(payload.email, payload.password)
    return TokenResponse(access_token=tokens["access"], refresh_token=tokens["refresh"], user=user)
```

### 4.2 Dependency Injection

```python
# ✅ Correct: use Annotated for frequently combined deps
CurrentUser = Annotated[dict, Depends(get_current_user)]

@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    return UserResponse.model_validate(current_user)
```

- ❌ Never instantiate services inside routers — inject them or instantiate inline with `Depends()`.
- ✅ Services receive `db: AsyncSession` at construction time: `AuthService(db)`.

### 4.3 Response Format (SDD §3.1)

```json
// ✅ Success — single resource
{ "data": { … } }

// ✅ Success — paginated list
{ "data": [ … ], "meta": { "page": 1, "limit": 20, "total": 100, "has_next": true } }

// ✅ Error (consistent across all endpoints)
{ "error": { "code": "AUTH-001", "message": "Invalid credentials", "details": {} } }
```

Every error **must** carry a machine-readable `code` string.  See `shared/exceptions.py`.

---

## 5. Error Handling & Logging

### 5.1 Custom Exceptions

```python
# shared/exceptions.py
class APIError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 400, details: dict | None = None):
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details or {}
        super().__init__(message)

def create_api_error(status_code: int, message: str, code: str | None = None) -> APIError:
    return APIError(code=code or f"SYS-{status_code}", message=message, status_code=status_code)
```

### 5.2 Global Error Handler

Registered in `main.py`:

```python
@app.exception_handler(APIError)
async def handle_api_error(request: Request, exc: APIError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": exc.code, "message": exc.message, "details": exc.details}},
    )

@app.exception_handler(Exception)
async def handle_generic_error(request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content={"error": {"code": "SYS-500", "message": str(exc), "details": {}}},
    )
```

### 5.3 Audit Logging

For every sensitive operation (login, data-change, admin action), call `log_audit()` from `shared/audit.py`:

```python
from app.shared.audit import log_audit

await log_audit(
    db=db,
    user_id=current_user.id,
    action="user.logged_in",
    resource_type="user",
    resource_id=current_user.id,
    ip_address=request.client.host,
    metadata={"provider": "email"},
)
```

The function is **fail-silent** — audit must never break the primary business flow.

### 5.4 Logging Best Practices

```python
import structlog

logger = structlog.get_logger()
logger.info("user.logged_in", user_id=user.id, ip=client_ip)

# ❌ Forbidden — sensitive data in plain-text
logger.info(f"User password: {password}")       # VIOLATION
logger.info(f"Token: {access_token}")           # VIOLATION
```

---

## 6. Security Guidelines

### 6.1 Secrets Management

```python
# ✅ Correct: Pydantic Settings reads from .env
class Settings(BaseSettings):
    SECRET_KEY: str
    ID_CARD_ENCRYPTION_KEY: str

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

# ❌ Forbidden
SECRET_KEY = "hardcoded-value"  # VIOLATION — will be rejected
```

### 6.2 Password & Token Handling

```python
from passlib.context import CryptContext
from app.config import get_settings

# Argon2id — OWASP 2026 recommended, RFC 9106
pwd_context = CryptContext(
    schemes=["argon2"],
    deprecated="auto",
    argon2__time_cost=3,
    argon2__memory_cost=65536,   # 64 MB
    argon2__parallelism=1,
    argon2__type="ID",
)
_settings = get_settings()

def hash_password(plain: str) -> str:
    """Hash a password with Argon2id. Returns ``$argon2id$``-prefixed string."""
    return pwd_context.hash(plain)

def verify_password(plain: str, hashed: str) -> bool:
    """Verify password against an Argon2id hash."""
    return pwd_context.verify(plain, hashed)

def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire, "iat": datetime.now(timezone.utc)})
    return jwt.encode(to_encode, _settings.SECRET_KEY, algorithm="HS256")
```

### 6.3 Sensitive Data Encryption

```python
from cryptography.fernet import Fernet

_cipher = Fernet(settings.ID_CARD_ENCRYPTION_KEY.encode())

def encrypt_sensitive(plaintext: str) -> str:
    return _cipher.encrypt(plaintext.encode()).decode()

def decrypt_sensitive(ciphertext: str) -> str:
    return _cipher.decrypt(ciphertext.encode()).decode()
```

✅ All keys **must** be 32 url-safe base64 bytes (matching `Fernet.generate_key()` output).

---

## 7. Testing Conventions

### 7.1 Directory Layout

```
tests/
├── conftest.py          # Shared fixtures: db_session, client, mock services
├── factories/           # factory-boy definitions
│   └── __init__.py
├── modules/             # Mirror app/modules/ structure
│   └── <module>/
│       ├── test_<service>.py     # Unit tests (mock DB layer)
│       └── test_<router>.py      # Integration tests (TestClient + DB)
├── shared/              # Test shared utilities
└── integration/         # Cross-module API tests
```

### 7.2 Unit-Test Pattern

```python
# tests/modules/auth/test_auth_service.py
import pytest
from app.modules.auth.services.auth_service import AuthService

@pytest.mark.unit
async def test_authenticate_success(db_session, user_factory):
    user = user_factory(password_hash=hash_password("SecurePass123"))
    service = AuthService(db_session)

    result, tokens = await service.authenticate(user.email, "SecurePass123")

    assert result.id == user.id
    assert "access" in tokens
    assert "refresh" in tokens
```

### 7.3 Integration-Test Pattern

```python
# tests/modules/auth/test_auth_api.py
import pytest
from fastapi.testclient import TestClient

@pytest.mark.integration
def test_login_success(client: TestClient, test_user):
    payload = {"email": test_user.email, "password": "SecurePass123"}
    response = client.post("/api/v1/auth/login", json=payload)

    assert response.status_code == 200
    data = response.json()["data"]
    assert "access_token" in data
    assert data["user"]["email"] == test_user.email
```

### 7.4 Async Database Fixture Pattern (Python 3.14+)

On Python 3.14+, the module-level ``create_async_engine()`` creates a connection pool
**bound to pytest's collection-time event loop**, not to each test's function-scoped loop.
This causes ``RuntimeError: Task ... attached to a different loop`` when tests run.

**Correct pattern:** create a per-test engine with ``NullPool`` so the engine lifecycle
matches the test's event loop.

```python
import asyncio
from collections.abc import AsyncGenerator, Generator

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool

from app.config import get_settings


@pytest.fixture(scope="function")
def event_loop() -> Generator[asyncio.AbstractEventLoop, None, None]:
    """Create a fresh event loop per-test to match engine lifecycle."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Per-test engine + NullPool — no connection state leaks across tests.

    Rationale
    ---------
    - ``create_async_engine(…, poolclass=NullPool)`` creates connections
      in the *test's* event loop, not pytest's collection loop.
    - ``NullPool`` prevents connection state from leaking between tests.
    - ``engine.dispose()`` on teardown releases all resources cleanly.
    - Production still uses ``QueuePool`` (the default) for connection reuse.
    """
    settings = get_settings()
    test_engine = create_async_engine(
        settings.DATABASE_URL,
        poolclass=NullPool,
        echo=settings.DEBUG,
    )
    factory = async_sessionmaker(
        test_engine, class_=AsyncSession, expire_on_commit=False,
    )
    session = factory()
    try:
        yield session
    finally:
        await session.rollback()
        await session.close()
        await test_engine.dispose()


@pytest.fixture
def client(db_session):
    def _override():
        return db_session
    app.dependency_overrides[get_db] = _override
    with TestClient(app) as c:
        yield c
```
```


### 7.5 Async Integration Test Pattern (httpx.AsyncClient + ASGITransport)

> **Always use this pattern for NEW integration tests.** The old ``TestClient``
> from ``fastapi.testclient`` opens an ``anyio.BlockingPortal`` internally,
> which runs the ASGI app on a **different event loop** than the test.
> On Python 3.14+ this triggers ``RuntimeError: Task <...> attached to a
> different loop``.  ``httpx.AsyncClient`` + ``ASGITransport`` keeps the
> request life-cycle in the **same** event loop as ``pytest-asyncio``.

**Fixture** (defined in ``tests/conftest.py``):

```python
@pytest_asyncio.fixture
async def async_client(app: FastAPI, db_session: AsyncSession) -> AsyncGenerator[httpx.AsyncClient, None]:
    from app.shared.deps import get_db

    async def _override_db():
        return db_session

    app.dependency_overrides[get_db] = _override_db

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
```

**Test usage:**

```python
# tests/modules/auth/test_auth_api.py
import pytest
from httpx import AsyncClient

@pytest.mark.integration
async def test_login_success(async_client: AsyncClient, db_session):
    # ``get_db`` is already wired to ``db_session`` by the fixture
    response = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "test@example.com", "password": "SecurePass123"},
    )

    assert response.status_code == 200
    data = response.json()["data"]
    assert "access_token" in data
```

**Key rules:**
- Test function MUST be ``async def`` — no ``def``.
- Every HTTP call MUST be ``await client.XXX()`` — no blocking calls.
- ``get_db`` override is **automatic** — do not add ``client.app.dependency_overrides[get_db]``
  in the test body (the ``async_client`` fixture already did it).
- If you also need to override ``get_current_user``, do it in the test body via
  ``app.dependency_overrides[get_current_user] = lambda: payload`` (the fixture
  does not touch ``get_current_user``).
- Leave old ``TestClient``-based tests as-is — convert them gradually.


---
## 8. Documentation & Docstrings

### 8.1 Docstring Format (Google Style)

```python
async def create_user(
    db: AsyncSession,
    email: str,
    password: str,
    property_scopes: list[uuid.UUID] | None = None,
) -> User:
    """Create a new user account (FR-USER-01).

    Args:
        db: Active async database session.
        email: User's email address (must be unique across tenants).
        password: Plain-text password — will be hashed with Argon2id.
        property_scopes: Optional list of property UUIDs this user can access.

    Returns:
        User: The newly created user with server-generated fields (id, timestamps).

    Raises:
        APIError: If ``email`` already exists (code AUTH-004).

    Side Effects:
        - INSERT into ``users`` table.
        - Publish ``user.created`` event.
        - Log audit entry via ``log_audit()``.
    """
```

### 8.2 Module Docstring

```python
"""Auth module — user authentication and token management (FR-USER-01~03).

Endpoints:
- POST /api/v1/auth/login    — authenticate & return JWT tokens
- POST /api/v1/auth/register — create account via invite
- GET  /api/v1/auth/me       — current user profile

References:
- SDD.md §2.1: Auth Module Specification
- SDD.md §3.3: Endpoint Contracts
- SDD.md §4.2: User Model Schema
"""
```

---

## 9. Pre-commit & CI Checks

### 9.1 Required Tools (configured in `pyproject.toml`)

```toml
[tool.ruff]
line-length = 100
target-version = "py314"
select = ["E", "F", "W", "I", "N", "UP", "ASYNC", "S", "BLE", "B"]

[tool.mypy]
python_version = "3.14"
strict = true
warn_return_any = true
disallow_untyped_defs = true
plugins = ["pydantic.mypy"]

[tool.pytest.ini_options]
asyncio_mode = "auto"
addopts = ["-v", "--strict-markers", "--cov=app", "--cov-report=term-missing"]
markers = [
    "unit:  Unit tests — no external dependencies",
    "integration:  Integration tests — requires DB / external services",
]
```

### 9.2 CI Pipeline Gates (`make lint` / `make test`)

```yaml
# .github/workflows/backend-ci.yml  (to be created)
jobs:
  quality:
    steps:
      - run: make lint          # ruff + mypy + bandit
  test:
    steps:
      - run: make test-unit     # pytest —cov with service gate ≥90%
      - run: coverage report --fail-under=85
  contract:
    steps:
      - run: make test-contract  # schemathesis on running backend
```

Every `make` target runs inside a **Docker container** — never on bare metal.

### 9.3 Pre-commit Hooks (optional — `.pre-commit-config.yaml`)

To enable locally:
```bash
pip install pre-commit
pre-commit install
```

---

## 10. Docker-First Development Rules

This project uses a **Docker-first** workflow (SPRINT_1.md §0.4).  Every command must run inside a container.

| Action | Command (from project root) |
|--------|-----------------------------|
| Start dev | `make dev` |
| Stop dev | `make dev-down` |
| Run linters | `make lint` |
| Run tests | `make test` |
| Run unit tests | `make test-unit` |
| Run coverage | `make test-coverage` |
| Contract testing | `make test-contract` |
| DB migration | `make db-migrate` |

**Rules:**
- ✅ All Python code runs inside the Docker container.
- ✅ Source files live on the host and are auto-mounted via volume (hot-reload).
- ✅ Never `pip install` on the host.
- ✅ Never run `python` / `pytest` / `ruff` / `alembic` on the host — use `docker compose exec` or `docker compose run`.
- ❌ Running `pytest` or `ruff` on the host is forbidden by convention.

---

## 11. Quick Reference Checklist

### Before Committing Code

```markdown
- [ ] Type hints on every function signature and public attribute
- [ ] Docstring follows Google style (Args / Returns / Raises)
- [ ] No hardcoded secrets — all config via Pydantic Settings
- [ ] SQLAlchemy 2.0 syntax: `Mapped[]`, `mapped_column()`, `select()`
- [ ] No business logic in routers or models (service-layer only)
- [ ] Error raised via `APIError` with proper code string
- [ ] Audit logging added for sensitive operations
- [ ] Tests added: unit (service) + integration (router) where applicable
- [ ] Ruff, mypy, bandit pass (`make lint`)
- [ ] Coverage meets targets: services ≥90%, routers ≥85%, overall ≥85%
```

### Code Review Checklist

```markdown
- [ ] Follows layered architecture: router → service → repo → model
- [ ] No cross-module direct imports (use events.py for cross-module comms)
- [ ] Async patterns correct: no sync calls in async context
- [ ] Security: passwords hashed, tokens validated, sensitive data encrypted
- [ ] Performance: indexes on query-heavy columns, N+1 queries avoided
- [ ] Observability: structured logging (structlog), audit trails, error codes
```

---

> ℹ️ **หมายเหตุ:** เอกสารนี้เป็น living document — อัปเดตเมื่อมี pattern ใหม่ หรือเปลี่ยน tech stack  
> 🔄 **Change Control:** แก้ไขมาตรฐานนี้ต้องแจ้งทีม และอัปเดต pre-commit config พร้อมกัน  
> 🤖 **สำหรับ AI Agent:** อ่านไฟล์นี้ก่อนสร้างโค้ดทุกครั้ง — สิ่งที่ละเมิดกฎจะถูก reject ใน code review  
> 📖 **References:** `AGENTS.md`, `docs/SDD.md`, `docs/ARCHITECTURE.md`, `backend/docs/SPRINT_1.md`

✅ **Status:** Active — Enforced by pre-commit + CI pipeline

---

## 12. Performance Guidelines

### 12.1 Query Optimization (SQLAlchemy 2.0 + asyncpg)

```python
# ✅ ใช้ selectinload() สำหรับ 1:M relationships เพื่อป้องกัน N+1
stmt = select(User).options(selectinload(User.property_scopes))

# ✅ ใช้ joinedload() สำหรับ M:1 เมื่อต้องการ join ใน query เดียว
stmt = (
    select(Invoice)
    .options(joinedload(Invoice.contract).joinedload(Contract.tenant))
)

# ✅ ใช้ limit/offset + index สำหรับ pagination
stmt = (
    select(Room)
    .where(Room.property_id == prop_id)
    .order_by(Room.room_number)
    .limit(20).offset(40)
)

# ❌ หลีกเลี่ยง relationship(lazy="select") ใน async context
#    จะเกิด DetachedInstanceError เมื่อพยายาม access นอก session
```

### 12.2 Indexing Strategy (SDD §4.3)

| Query Pattern | Index Type | Example |
|--------------|-----------|---------|
| Exact match + sort | B-tree + INCLUDE | `Index("ix_users_email", "email", postgresql_include=["id", "is_active"])` |
| Partial unique constraint | Partial Unique | `Index("ix_contracts_active", "room_id", unique=True, postgresql_where=text("status='active'"))` |
| ILIKE search (tenant name) | GIN + pg_trgm | `Index("ix_tenants_name_trgm", "full_name", postgresql_using="gin", postgresql_ops={"full_name": "gin_trgm_ops"})` |
| JSONB field query | GIN on JSONB | `Index("ix_audit_metadata", "metadata", postgresql_using="gin")` |
| Time-series range (large tables) | BRIN | `Index("ix_audit_logs_time", "timestamp", postgresql_using="brin")` |

### 12.3 Caching Strategy (Redis)

```python
# ✅ ใช้ @lru_cache สำหรับ settings ที่อ่านบ่อยแต่เปลี่ยนยาก
@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()

# ✅ ใช้ Redis สำหรับ cached query results (TTL 5-15 นาที)
# รูปแบบ key: "cache:{entity}:{id}:{field}"
# ตัวอย่าง: "cache:user:abc123:property_scopes"

# ❌ ไม่ cache ข้อมูลที่เปลี่ยนบ่อย (เช่น invoice status)
#    โดยไม่มี invalidation strategy
```

### 12.4 Connection Pool Tuning

```python
# ใน shared/database.py — ค่าแนะนำสำหรับ production:
engine = create_async_engine(
    DATABASE_URL,
    pool_size=20,          # จำนวน connection ที่เปิดค้างไว้
    max_overflow=40,       # จำนวนที่เพิ่มได้ชั่วคราวเมื่อโหลดสูง
    pool_timeout=30,       # วินาทีที่รอได้ก่อนยกเว้น
    pool_recycle=1800,     # รีไซเคิลทุก 30 นาที ป้องกัน stale connection
    pool_pre_ping=True,    # ตรวจสอบว่า connection ยังใช้ได้ก่อน yield
)
```

---

## 13. API Versioning & Deprecation

### 13.1 Versioning Strategy

- ใช้ **URL path versioning**: `/api/v1/...`, `/api/v2/...` (ไม่ใช้ header versioning ในเฟส 1)
- เวอร์ชันใหม่ต้อง **ไม่ทำลายความเข้ากันได้ย้อนหลัง** (backward-compatible) กับเวอร์ชันเก่า
- Breaking change → สร้างเวอร์ชันใหม่ + แจ้งล่วงหน้า 1 sprint

### 13.2 Deprecation Pattern

```python
# ✅ แจ้ง deprecation ใน response header + docs
@router.get("/legacy-endpoint", deprecated=True)
async def legacy_endpoint():
    """⚠️ Deprecated since v1.2 — use /api/v1/new-endpoint instead."""
    ...

# ✅ เพิ่ม warning ใน response body (optional)
{
    "data": {...},
    "meta": {
        "warnings": [
            {"code": "DEP-001", "message": "This endpoint will be removed in v2.0"}
        ]
    }
}
```

### 13.3 OpenAPI Documentation

- ทุก endpoint ต้องมี `summary` และ `description` ชัดเจน
- ใช้ `tags` จัดกลุ่มตาม module (`auth`, `property`, `billing`, …)
- ระบุ `response_model` ทุกเส้นทางเพื่อให้ generate schema อัตโนมัติ

---

## 14. Database Migration Standards (Alembic)

### 14.1 Migration File Naming

```
alembic/versions/
├── 001_create_users_table.py          # Phase 1: auth
├── 002_create_property_structure.py   # Phase 1: property
├── 003_add_audit_logs.py              # Phase 1: shared
├── 004_create_billing_tables.py       # Phase 2: billing
└── ...
```

รูปแบบ: `{3-digit-seq}_{short_description}.py`

### 14.2 Zero-Downtime Patterns

| Pattern | ใช้เมื่อ | ขั้นตอน |
|---------|---------|---------|
| **Expand/Contract** | เพิ่มคอลัมน์ `NOT NULL` | 1. ADD COLUMN with DEFAULT → 2. Batch backfill → 3. SET NOT NULL → 4. DROP DEFAULT |
| **Concurrent Index** | สร้าง index บนตารางใหญ่ | `CREATE INDEX CONCURRENTLY …` (ไม่ lock write) |
| **Dual Write** | เปลี่ยน schema ที่มีการอ่าน/เขียนพร้อมกัน | 1. เขียนทั้งเก่า+ใหม่ → 2. อ่านจากใหม่ → 3. ลบเก่า (ใน migration ถัดไป) |

### 14.3 Migration Best Practices

```python
# ✅ ใช้ batch_operations=True สำหรับ SQLite compatibility
with op.batch_alter_table("users", schema=None) as batch_op:
    batch_op.add_column(sa.Column("phone", sa.String(20), nullable=True))

# ✅ ทดสอบ downgrade เสมอก่อนคอมมิต
# ❌ ห้ามใช้ op.execute("DROP TABLE …") โดยไม่มี migration ย้อนกลับ

# ✅ ใช้ data migration แยกจาก schema migration
# Schema: alembic/versions/xxx_*.py
# Data: backend/scripts/migrations/xxx_*.py (รันด้วย python scripts/xxx.py)
```

---

## 15. Error Code Management

### 15.1 Error Code Format

```
{MODULE}-{SEQ:03d}
ตัวอย่าง:
• AUTH-001: Invalid credentials
• AUTH-002: Account inactive
• PROP-001: Room number already exists
• BILL-001: Meter value decreased
```

### 15.2 Central Registry (`shared/constants.py`)

```python
# Error codes must be defined here before use
ERROR_CODES = {
    # Auth module
    "AUTH-001": {"message": "Invalid email or password", "http_status": 401},
    "AUTH-002": {"message": "Account is not active", "http_status": 403},

    # Property module
    "PROP-001": {"message": "Room number already exists in this building", "http_status": 409},

    # … (เพิ่มตามต้องการ)
}

# Helper to create APIError from code
def error_from_code(code: str, details: dict | None = None) -> APIError:
    if code not in ERROR_CODES:
        return APIError(code="SYS-999", message=f"Unknown error code: {code}", status_code=500)
    cfg = ERROR_CODES[code]
    return APIError(code=code, message=cfg["message"], status_code=cfg["http_status"], details=details)
```

### 15.3 Usage Pattern

```python
# ✅ ถูกต้อง: ใช้ helper จาก constants
from app.shared.constants import error_from_code

if not user:
    raise error_from_code("AUTH-001")

# ❌ ผิด: hardcode error message ตรง ๆ
raise APIError(code="AUTH-001", message="Invalid email or password")  # VIOLATION
```

---

## 16. Background Task Patterns (Celery)

### 16.1 Task Definition

```python
# workers/tasks.py
from celery import shared_task
from app.shared.database import engine
from sqlalchemy.orm import sessionmaker

@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def generate_monthly_invoices(self, property_id: str, month: int, year: int):
    """Generate invoices for all active contracts in a property."""
    try:
        # สร้าง session ใหม่ใน task (ไม่ reuse จาก request)
        async with engine.begin() as conn:
            # … business logic …
            pass
    except Exception as exc:
        # Retry with exponential backoff
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))
```

### 16.2 Idempotency Pattern

```python
# ใช้ idempotency key ป้องกันงานซ้ำเมื่อ retry
async def process_with_idempotency(key: str, func, *args, **kwargs):
    # ตรวจสอบว่า key นี้เคยประมวลผลไปแล้วไหม (เก็บใน Redis)
    if await redis.exists(f"idempotent:{key}"):
        return await redis.get(f"result:{key}")

    result = await func(*args, **kwargs)
    await redis.setex(f"idempotent:{key}", 3600, "1")     # TTL 1 ชม.
    await redis.setex(f"result:{key}", 3600, json.dumps(result))
    return result
```

### 16.3 Task Monitoring

- ทุก task ต้องบันทึก `task_id` ลง audit log เมื่อเริ่ม / จบ
- ใช้ `@shared_task(bind=True)` เพื่อเข้าถึง `self.request.id`
- เพิ่มเมตริก `celery_task_duration_seconds` สำหรับ monitoring (Prometheus)

---

## 17. File Upload & Storage (MinIO)

### 17.1 Upload Validation

```python
# ✅ ตรวจสอบทั้ง MIME type และ magic bytes
import magic

async def validate_upload(file: UploadFile, allowed_types: list[str], max_size: int) -> bool:
    if file.size and file.size > max_size:
        raise APIError(code="VAL-010", message=f"File too large (max {max_size} bytes)")

    # ตรวจสอบ MIME จาก header
    if file.content_type not in allowed_types:
        raise APIError(code="VAL-011", message=f"Invalid file type: {file.content_type}")

    # ตรวจสอบ magic bytes (ป้องกันไฟล์ปลอมแปลง extension)
    content = await file.read(1024)
    real_mime = magic.from_buffer(content, mime=True)
    if real_mime not in allowed_types:
        raise APIError(code="VAL-012", message="File content does not match declared type")

    return True
```

### 17.2 Storage Pattern (Presigned URLs)

```python
# ✅ ใช้ presigned URL สำหรับ upload/download — ไม่ expose raw MinIO endpoint
from minio import Minio

minio_client = Minio(
    settings.MINIO_ENDPOINT,
    access_key=settings.MINIO_ACCESS_KEY,
    secret_key=settings.MINIO_SECRET_KEY,
    secure=False,   # ใช้ HTTPS ใน production
)

def generate_presigned_upload_url(bucket: str, object_name: str, expires: int = 3600) -> str:
    return minio_client.presigned_put_object(bucket, object_name, expires=expires)

# Frontend ใช้ URL นี้ upload โดยตรง → Backend รับเฉพาะ object_name มาบันทึกใน DB
```

### 17.3 File Naming & Organization

```
MinIO bucket structure:
{bucket}/
├── {property_id}/
│   ├── tenants/
│   │   └── {tenant_id}/
│   │       ├── id_card_{timestamp}.jpg
│   │       └── contract_{timestamp}.pdf
│   ├── rooms/
│   │   └── {room_id}/
│   │       └── photos/
│   │           └── photo_{timestamp}.jpg
│   └── invoices/
│       └── {invoice_id}.pdf
```

- ใช้ UUID + timestamp สำหรับชื่อไฟล์ — ไม่ใช้ชื่อเดิมจากผู้ใช้
- จำกัดจำนวนไฟล์ต่อเอนทิตี (เช่น รูปห้องสูงสุด 5 รูป)

---

## 18. Observability & Monitoring

### 18.1 Structured Logging (structlog)

```python
# shared/logging.py
import structlog
from structlog.stdlib import filter_by_level

structlog.configure(
    processors=[
        filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.dict_tracebacks,
        structlog.processors.JSONRenderer(),   # JSON สำหรับ log aggregator
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    wrapper_class=structlog.stdlib.BoundLogger,
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()

# ใช้งาน:
logger.info(
    "user.logged_in",
    user_id=str(user.id),
    ip=request.client.host,
    user_agent=request.headers.get("user-agent"),
    property_scopes=[str(p) for p in user.property_scopes],
)
```

### 18.2 Metrics (Prometheus-compatible)

```python
# ใช้ prometheus-fastapi-instrumentator หรือเขียน middleware เอง
from prometheus_client import Counter, Histogram

REQUEST_COUNT = Counter("http_requests_total", "Total HTTP requests", ["method", "endpoint", "status"])
REQUEST_DURATION = Histogram("http_request_duration_seconds", "HTTP request duration", ["endpoint"])

# ใน middleware:
async def metrics_middleware(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    duration = time.time() - start_time

    REQUEST_COUNT.labels(
        method=request.method,
        endpoint=request.url.path,
        status=response.status_code,
    ).inc()
    REQUEST_DURATION.labels(endpoint=request.url.path).observe(duration)

    return response
```

### 18.3 Distributed Tracing (OpenTelemetry)

```python
# สำหรับระบบที่ขยายเป็น microservices ในอนาคต
# ใช้ opentelemetry-instrumentation-fastapi + Jaeger / Tempo
# เพิ่ม trace_id ในทุก log entry สำหรับ correlation
```

---

## 19. Internationalization (i18n)

### 19.1 Message Localization Strategy

```python
# ใช้ error code เป็น key สำหรับ lookup ข้อความหลายภาษา
# ไฟล์ภาษา: backend/locales/{lang}/messages.json

# ตัวอย่าง: backend/locales/th/messages.json
{
    "error.auth.AUTH-001": "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
    "error.auth.AUTH-002": "บัญชีนี้ไม่ได้รับการเปิดใช้งาน",
    "error.business.BR-01": "ห้องนี้มีสัญญาที่ใช้งานอยู่แล้ว"
}

# Helper ใน shared/i18n.py:
async def get_localized_message(code: str, lang: str = "th", context: dict | None = None) -> str:
    # โหลดไฟล์ภาษาจาก cache (Redis) หรือ disk
    # แทนที่ placeholder: "Room {room_number} is occupied" → "ห้อง {room_number} มีผู้พักอาศัยแล้ว"
    ...
```

### 19.2 Frontend Contract for i18n

```json
// Error response ที่ frontend ใช้สำหรับแสดงข้อความ
{
  "error": {
    "code": "AUTH-001",
    "message": "Invalid email or password",      // ภาษาอังกฤษเป็น fallback
    "details": {},
    "i18n_key": "error.auth.AUTH-001"            // Key สำหรับ frontend lookup ข้อความภาษาอื่น
  }
}
```

### 19.3 Date / Number Formatting

- ส่ง timestamp เป็น **ISO 8601** (``2026-05-25T14:30:00+07:00``) จาก backend เสมอ
- ให้ frontend จัดการ display format ตาม locale ของผู้ใช้
- ใช้ `pydantic.Field(..., json_schema_extra={"format": "date-time"})` สำหรับ datetime fields

---

## 20. Quick Reference: New Additions

### Extended Pre-Commit Checklist

```markdown
- [ ] Performance: Indexes added for new query patterns, N+1 verified
- [ ] API version: backwards-compatible? Need deprecation notice?
- [ ] Migration tested: upgrade + downgrade both verified
- [ ] Error code registered in `shared/constants.py`
- [ ] Audit logging: sensitive operations wrapped with `log_audit()`
- [ ] Background task idempotent: retry-safe with idempotency key
- [ ] File upload validated: MIME type + magic bytes + size limit
- [ ] Observability: structured log keys added, metrics considered
- [ ] i18n: error codes registered in locale files (if user-facing)
```

> ℹ️ **หมายเหตุ:** เอกสารนี้เป็น living document — อัปเดตเมื่อมี pattern ใหม่ หรือเปลี่ยน tech stack  
> 🔄 **Change Control:** แก้ไขมาตรฐานนี้ต้องแจ้งทีม และอัปเดต pre-commit config พร้อมกัน  
> 🤖 **สำหรับ AI Agent:** อ่านไฟล์นี้ก่อนสร้างโค้ดทุกครั้ง — สิ่งที่ละเมิดกฎจะถูก reject ใน code review  
> 📖 **References:** `AGENTS.md`, `docs/SDD.md`, `docs/ARCHITECTURE.md`, `backend/docs/SPRINT_1.md`

✅ **Version:** 1.1 — Added §12–§20 (Performance, Versioning, Migrations, Error Codes, Celery, MinIO, Observability, i18n)
<!--
ทดสอบ:
1. วางไฟล์นี้ทับ backend/docs/CODE_STYLE.md
2. รัน: make lint → ต้องผ่าน (ruff, mypy ไม่ฟ้องตัวอย่างในไฟล์)
3. ตรวจสอบว่าตัวอย่างโค้ดทุกบล็อกไม่มี syntax error:
   grep -A 20 "^```python" backend/docs/CODE_STYLE.md | python -m py_compile  # แบบคร่าว ๆ
4. เปิดไฟล์ใน Markdown viewer → ต้องแสดงตาราง / โค้ดบล็อกถูกต้อง
-->
