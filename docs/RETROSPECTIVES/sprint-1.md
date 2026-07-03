# Sprint 1 Retrospective

**Date:** 2026-05-25  
**Duration:** 5 days (May 25 – May 30)  
**Sprint Goal:** Foundation Layer (`shared/`) + Authentication Module (`auth/`) — Docker-First  
**Participants:** AI Agent (Senior Backend Engineer + QA Engineer + Tech Lead)

---

## ✅ What Went Well

### 1. Architecture-First Approach
- Following SDD.md §2 and §3.3 strictly prevented scope creep.
- Layered architecture (router → service → repository → model) kept concerns separated cleanly.
- Dependency injection via `Annotated[AsyncSession, Depends(get_db)]` made unit testing straightforward.

### 2. Docker-First Development
- No local Python/PostgreSQL installation needed — all work inside containers.
- Hot-reload with `uvicorn --reload` gave fast feedback loops.
- `docker compose exec` for DB inspection and script execution worked reliably.

### 3. Code Generation in Batch
- Creating all Phase 2 files in one pass saved significant time.
- The shared kernel (`shared/`) provided a single source of truth for exceptions, audit, and security.

### 4. Test Architecture
- Unit tests with mocked repository allowed fast, isolated validation of business logic (no DB needed).
- Integration tests with real DB + rollback fixtures gave confidence in end-to-end correctness.
- `factory-boy` made test data generation repeatable and readable.

---

## ⚠️ What Could Be Improved

### 1. `Annotated` + `Depends` Conflict in FastAPI
**Problem:** Initially used `db: CurrentUserDep = Depends(get_db)` which caused `AssertionError: Cannot specify Depends in Annotated and default value together`.

**Root Cause:** `CurrentUser` is already `Annotated[dict, Depends(get_current_user)]`. Adding `= Depends(get_db)` as a default created a conflict with the `Annotated` metadata.

**Fix:** Changed to `db: Annotated[AsyncSession, Depends(get_db)]` for parameters that only need `get_db`, and `current_user: CurrentUserDep` separately for auth.

**Lesson:** Never mix `Annotated[..., Depends(X)]` with a default `= Depends(Y)` — FastAPI resolves `Annotated`'s embedded `Depends` as the primary dependency.

### 2. Fernet Key Padding
**Problem:** `secrets.token_urlsafe(32)` produces a 43-character string without base64 padding (`=`), but Fernet requires a 44-character key with padding.

**Fix:** Use `cryptography.fernet.Fernet.generate_key()` which always returns a properly padded 44-byte base64-encoded key.

### 3. SECRET_KEY Not Pre-Configured
**Problem:** `main.py` was created before `config.py` had all required env vars (`BCRYPT_ROUNDS`, `ACCESS_TOKEN_EXPIRE_MINUTES`). The `.env.example` also lacked these.

**Fix:** Added all missing env vars to `config.py` with safe defaults for development. Updated `.env.example`.

### 4. Alembic Not Set Up Early
**Problem:** Alembic was listed as a dependency but no `alembic/` directory or `alembic.ini` was configured. Created `scripts/create_tables.py` as a temporary workaround.

**Mitigation:** Create migration scripts early (Phase 4) before Sprint 2 begins.

### 5. Model Imports Required for `create_all()`
**Problem:** The `scripts/create_tables.py` script initially forgot to import model modules, causing `Base.metadata.create_all` to create zero tables — no error, just silence.

**Fix:** Always import ALL model modules (`from app.modules.auth.models import User`) before calling `create_all()` so they register with `Base.metadata`.

### 6. Coverage Volume Permission
**Problem:** The `test-coverage` Makefile target mounts `backend/htmlcov/` to the container, but the container's `pytest` user may not have write permission to the host directory.

**Status:** Fixed by using `/tmp/coverage` as an intermediate writable mount point.

---

## 🚀 Action Items for Sprint 2

| # | Action Item | Owner | Priority | Effort |
|---|-------------|-------|----------|--------|
| 1 | Set up Alembic with async pattern before writing any models | Tech Lead | High | 1h |
| 2 | Add `shared/validators.py` with reusable validation functions (Thai ID, phone) | Backend | High | 2h |
| 3 | Add `shared/storage.py` and `shared/utils.py` stubs | Backend | Medium | 1h |
| 4 | Create `pyproject.toml` with pytest markers (`unit`, `integration`) | Tech Lead | Medium | 30m |
| 5 | Write `conftest.py` before writing integration tests (not after) | QA | Medium | 1h |
| 6 | Add property-scope checks to invite flow (AUTH-005) | Backend | High | 2h |
| 7 | Update `docs/SDD.md` Traceability Matrix (§8) with Sprint 1 tests | Tech Lead | Medium | 30m |
| 8 | Run full `make test-coverage` after Sprint 2 code to hit ≥85% | QA | High | 1h |
| 9 | Evaluate replacing `NOT ` with `~` for boolean negation in SQLAlchemy filters | Backend | Low | 30m |
| 10 | Document DevOps runbook for first-time developers | Tech Lead | Low | 1h |

---

## 📊 Sprint 1 Metrics

| Metric | Value | Target |
|--------|-------|--------|
| Phases Completed | Phase 0 ✅, Phase 1 ⏳ (5/6), Phase 2 ✅, Phase 3 ⏳ (8/8), Phase 4 ⏳ (5/8) | All ✅ |
| Files created | 25+ (shared/ + auth/ + tests/ + config) | — |
| Unit tests | 33 (auth_service: 11, invite_service: 6, security: 9, audit: 7) | ≥90% coverage |
| Integration tests | 11 (auth_api: 10, e2e flow: 1) | ≥85% coverage |
| Endpoints registered | 5 (/auth/*) | All 5 |
| Bugs found & fixed | 3 (Annotated conflict, missing model imports, missing env vars) | — |

---

## 💡 Key Takeaways

1. **Test EARLY** — Writing `conftest.py` after the code caused rework. Write fixtures and tests alongside services.
2. **Docker logs are your friend** — `make dev-logs` catches import errors, DB connection issues, and startup crashes instantly.
3. **Match docs to code** — SDD §3.3 is the single source of truth. If the code diverges, update the doc first.
4. **FastAPI exceptions propagate poorly** — Always test endpoints with `curl` or `TestClient` to catch FastAPI-specific issues (like the `Annotated` + `Depends` conflict) that unit tests miss.
5. **Alembic vs create_all** — `Base.metadata.create_all` is tempting for quick setups but it doesn't track history, can't roll back, and silently ignores unimported models. Use proper migrations from Sprint 2 onward.