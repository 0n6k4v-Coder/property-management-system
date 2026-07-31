# Master Plan: Fix 65 Lint Errors Across 40+ Files

**Project:** property-management-system (backend)
**Branch:** feat/property-rooms-redesign
**Target:** `make lint` → 0 errors
**Created:** 2026-07-27

---

## 📊 Error Categorization (65 errors, ~40 files)

| Category | Code | Count | Files Affected | Fix Pattern |
|----------|------|-------|----------------|-------------|
| **1. Import sorting (I001)** | `I001` | 12 | 12 | `isort` / reorder imports |
| **2. Unused imports (F401)** | `F401` | 5 | 5 | Remove unused import |
| **3. Unused variables (F841)** | `F841` | 3 | 3 | Remove or prefix `_` |
| **4. Unused function args (ARG001/ARG002)** | `ARG001/ARG002` | 8 | 6 | Prefix `_` or remove |
| **5. Mutable default args (B008)** | `B008` | 18 | 12 | Move to function body or module constant |
| **6. Exception chaining (B904)** | `B904` | 1 | 1 | Add `from err` |
| **7. Try/except/pass → contextlib.suppress (SIM105)** | `SIM105` | 2 | 2 | Use `contextlib.suppress` |
| **8. UP035: Import from collections.abc** | `UP035` | 2 | 2 | Fix import path |
| **9. UP037: Remove quotes from type annotations** | `UP037` | 2 | 1 | Remove quotes |
| **10. UP042: Use StrEnum** | `UP042` | 3 | 3 | `str, Enum` → `StrEnum` |
| **11. UP043: Unnecessary default type args** | `UP043` | 1 | 1 | Remove `[None, None]` |
| **12. F401 redundant alias** | `F401` | 1 | 1 | Use explicit re-export |

---

## 🎯 Task Grouping Strategy

### ✅ PARALLELIZABLE (Independent — can run simultaneously)

| Group | Category | Files | Est. Errors | Agent |
|-------|----------|-------|-------------|-------|
| **A** | Import sorting (I001) | 12 event/schema files | 12 | Agent-A |
| **B** | Unused imports (F401) | 5 files | 5 | Agent-B |
| **C** | Unused variables/args (F841, ARG001, ARG002) | 9 files | 11 | Agent-C |
| **D** | Mutable defaults (B008) | 12 router files | 18 | Agent-D |
| **E** | Modern Python upgrades (UP035, UP037, UP042, UP043) | 7 files | 8 | Agent-E |
| **F** | Exception handling (B904, SIM105) | 3 files | 3 | Agent-F |

### 🔄 SEQUENTIAL (Has dependencies — minor)

| Order | Task | Depends On |
|-------|------|------------|
| 1 | Run `ruff check --fix` first | — |
| 2 | Manual fixes for non-auto-fixable | After auto-fix |

---

## 🤖 Sub-Agent Spawn Plan

### Phase 1: Parallel Groups (A–F) — 6 agents in parallel

```python
delegate_task(tasks=[
  {"goal": "Fix Group A: Import sorting (I001) - 12 files", ...},
  {"goal": "Fix Group B: Unused imports (F401) - 5 files", ...},
  {"goal": "Fix Group C: Unused vars/args (F841, ARG001, ARG002) - 9 files", ...},
  {"goal": "Fix Group D: Mutable defaults (B008) - 12 router files", ...},
  {"goal": "Fix Group E: Modern Python upgrades (UP035, UP037, UP042, UP043) - 7 files", ...},
  {"goal": "Fix Group F: Exception handling (B904, SIM105) - 3 files", ...},
])
```

### Phase 2: Final Verification
```python
make lint  →  0 errors
```

---

## 📁 File Inventory by Group

### Group A: Import Sorting (I001) — 12 files, 12 errors
- `app/shared/events.py`
- `app/shared/deps.py` (if any)
- `app/modules/auth/events.py`
- `app/modules/auth/models.py`
- `app/modules/billing/events.py`
- `app/modules/billing/schemas.py`
- `app/modules/contract/events.py`
- `app/modules/contract/schemas.py`
- `app/modules/maintenance/events.py`
- `app/modules/notification/events.py`
- `app/modules/property/events.py`
- `app/modules/tenant/events.py`
- `app/modules/admin/events.py`

### Group B: Unused Imports (F401) — 5 files, 5 errors
- `app/modules/billing/routers/__init__.py` — `router` imported but unused
- `app/modules/contract/schemas.py` — `pydantic_core.core_schema` unused
- `app/modules/maintenance/routers/maintenance_router.py` — `MaintenanceRequestResponse` unused
- `app/middleware/logging.py` — `typing.Callable` unused
- `app/shared/deps.py` — `db` arg unused (ARG002 but also F401 if import)

### Group C: Unused Variables/Args (F841, ARG001, ARG002) — 9 files, 11 errors
- `app/modules/auth/services/auth_service.py` — `now` (F841), `property_scopes` (ARG002)
- `app/modules/admin/services/admin_service.py` — `requested_by` ×2 (ARG002)
- `app/modules/billing/services/bulk_service.py` — `billing_date` (F841)
- `app/modules/maintenance/routers/maintenance_router.py` — `current_user` (ARG001)
- `app/modules/property/routers/property_router.py` — `current_user` ×2 (ARG001)
- `app/modules/tenant/routers/tenant_router.py` — `current_user` (ARG001), `db` (ARG001)
- `app/shared/deps.py` — `db` (ARG002)

### Group D: Mutable Defaults (B008) — 12 files, 18 errors
**Routers with `Depends()` / `Query()` in defaults:**
- `app/modules/admin/routers/admin_router.py` — 1 (`Query`)
- `app/modules/billing/routers/billing_router.py` — 6 (`Depends`, `Query`)
- `app/modules/maintenance/routers/maintenance_router.py` — 5 (`Depends`, `Query`)
- `app/modules/property/routers/property_router.py` — 6 (`Depends`)
- `app/modules/tenant/routers/tenant_router.py` — 4 (`Depends`, `Query`)

### Group E: Modern Python Upgrades — 7 files, 8 errors
| File | Codes | Fix |
|------|-------|-----|
| `app/main.py` | UP035, UP043 | `AsyncGenerator` from `collections.abc`, remove `[None, None]` |
| `app/middleware/logging.py` | UP035 | `Callable` from `collections.abc` |
| `app/modules/auth/models.py` | UP042 | `PropertyRole`: `str, Enum` → `StrEnum` |
| `app/modules/billing/models.py` | UP042 ×2 | `InvoiceStatus`, `LineItemType` → `StrEnum` |
| `app/workers/tasks/invoice_tasks.py` | UP037 ×2 | Remove quotes from `CeleryTask` |

### Group F: Exception Handling — 3 files, 3 errors
- `app/modules/billing/services/billing_service.py` — SIM105 (try/except/pass → suppress)
- `app/modules/billing/services/bulk_service.py` — SIM105, B904 (raise from err)

---

## ✅ Acceptance Criteria Per Task

Each sub-agent must:
1. **Run `ruff check --fix <files>` first** for auto-fixable
2. **Read target files** (`read_file`)
3. **Apply manual fixes** (`patch` — minimal changes)
4. **Run `make lint` on changed files** to verify
5. **Report: files changed, errors fixed, remaining errors in scope**

---

## 🚀 Execution Order

```
┌─────────────────────────────────────────────────────────────┐
│  PHASE 1: AUTO-FIX (run once)                               │
├─────────────────────────────────────────────────────────────┤
│  ruff check --fix backend/app                               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  PHASE 2: PARALLEL MANUAL FIXES (6 agents)                  │
├─────────────────────────────────────────────────────────────┤
│  Agent-A  Agent-B  Agent-C  Agent-D  Agent-E  Agent-F       │
│  (I001)   (F401)   (F841/ARG) (B008)   (UP*)    (B904/SIM) │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  PHASE 3: FINAL VERIFICATION                                │
├─────────────────────────────────────────────────────────────┤
│  make lint  →  0 errors                                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 📝 Notes for Agents

1. **Run `ruff check --fix` first** — handles ~20 errors automatically
2. **B008 (mutable defaults)**: Move `Depends()`/`Query()` calls into function body or use module-level constants
3. **ARG001/ARG002**: Prefix unused params with `_` (e.g., `_current_user`)
4. **F841**: Remove or prefix unused vars with `_`
5. **UP035**: `from collections.abc import AsyncGenerator, Callable`
6. **UP037**: Remove quotes: `self: "CeleryTask"` → `self: CeleryTask` (needs TYPE_CHECKING import)
7. **UP042**: `class X(str, Enum)` → `class X(StrEnum)` (import from `enum`)
7. **UP043**: `AsyncGenerator[None, None]` → `AsyncGenerator[None]`
8. **SIM105**: `try/except/pass` → `with contextlib.suppress(Exception):`
9. **B904**: `raise ValueError(...) from err`
10. **Don't change logic** — only lint fixes