# Master Plan: Fix 273 mypy Errors Across 60 Files

**Project:** property-management-system (backend)
**Branch:** feat/property-rooms-redesign
**Target:** `make typecheck` → 0 errors
**Created:** 2026-07-27

---

## 📊 Error Categorization (273 errors, 60 files)

| Category | Code | Count | Files Affected | Fix Pattern |
|----------|------|-------|----------------|-------------|
| **1. Missing `dict` type args** | `type-arg` | ~35 | 15 | `dict` → `dict[str, Any]` |
| **2. Missing return type annotations** | `no-untyped-def` | ~55 | 25 | Add `-> ReturnType` |
| **3. Missing param type annotations** | `no-untyped-def` | ~25 | 12 | Add param types |
| **4. `Any` return from typed function** | `no-any-return` | ~15 | 8 | Fix return type or cast |
| **5. Unused `type: ignore`** | `unused-ignore` | 5 | 3 | Remove or fix underlying |
| **6. Missing imports / name errors** | `name-defined`, `attr-defined` | ~10 | 5 | Add imports |
| **7. Call to untyped function in typed context** | `no-untyped-call` | ~5 | 3 | Add types to called fn |
| **8. Assignment type mismatch** | `assignment` | ~8 | 4 | Fix type annotation |

---

## 🎯 Task Grouping Strategy

### ✅ PARALLELIZABLE (Independent — can run simultaneously)
Each group targets **different file sets** with **no cross-dependencies**.

| Group | Category | Files | Est. Errors | Agent |
|-------|----------|-------|-------------|-------|
| **A** | `dict` type args (shared + module events) | `app/shared/events.py`, `app/modules/*/events.py` (8 files) | 18 | Agent-A |
| **B** | `dict` type args (schemas) | `app/modules/*/schemas.py` (8 files) | 12 | Agent-B |
| **C** | Missing return/param types (workers/schedulers) | `app/workers/*.py`, `app/workers/schedulers/*.py` (12 files) | 28 | Agent-C |
| **D** | Missing return/param types (middleware, config, security) | `app/middleware/*.py`, `app/config.py`, `app/shared/security.py` | 15 | Agent-D |
| **E** | `no-any-return` / `unused-ignore` / `name-defined` | `app/shared/utils.py`, `app/shared/security.py`, `app/shared/database.py`, `app/shared/audit.py`, `app/modules/billing/services/*.py` | 20 | Agent-E |
| **F** | Router param/return types | `app/modules/*/routers/*.py` (6 files) | 15 | Agent-F |

### 🔄 SEQUENTIAL (Has dependencies — must run in order)

| Order | Task | Depends On | Reason |
|-------|------|------------|--------|
| 1 | **Fix `app/shared/events.py` first** | — | Base event bus; 8 modules import it |
| 2 | **Fix `app/shared/deps.py` (CurrentUser, etc.)** | Group A | Routers use `CurrentUser` type |
| 3 | **Fix `app/modules/billing/models.py` (legacy SQLAlchemy)** | — | Used by billing services |
| 4 | **Fix `app/modules/contract/models.py` (datetime.date issues)** | — | Used by contract services |
| 5 | **Fix router files** | Groups A, B, D, E | Routers depend on schemas, deps, services |
| 6 | **Fix `app/main.py`** | All above | Imports all routers/middleware |

---

## 🤖 Sub-Agent Spawn Plan

### Phase 1: Parallel Groups (A–F) — 6 agents in parallel
```python
delegate_task(tasks=[
  {"goal": "Fix Group A: dict type args in events", ...},
  {"goal": "Fix Group B: dict type args in schemas", ...},
  {"goal": "Fix Group C: worker/scheduler type annotations", ...},
  {"goal": "Fix Group D: middleware/config/security types", ...},
  {"goal": "Fix Group E: no-any-return, unused-ignore, name-defined", ...},
  {"goal": "Fix Group F: router param/return types", ...},
])
```

### Phase 2: Sequential Dependencies (run after Phase 1 completes)
```python
# Run sequentially, each waiting for previous
1. delegate_task(goal="Fix shared/events.py (base event bus)")
2. delegate_task(goal="Fix shared/deps.py (CurrentUser, require_property_scope)")
3. delegate_task(goal="Fix billing/models.py (legacy SQLAlchemy)")
4. delegate_task(goal="Fix contract/models.py (datetime.date)")
5. delegate_task(goal="Fix all router files")
6. delegate_task(goal="Fix app/main.py")
```

---

## ✅ Acceptance Criteria Per Task

Each sub-agent must:
1. **Read target files first** (`read_file`)
2. **Apply minimal fixes** (`patch` — prefer single-line changes)
3. **Run `make typecheck` on changed files only** to verify no regressions
4. **Report: files changed, errors fixed, remaining errors in scope**

---

## 📁 File Inventory by Group

### Group A: Event Bus Files (18 errors)
- `app/shared/events.py` — 1 error (`dict` type arg)
- `app/modules/auth/events.py` — 1 error
- `app/modules/tenant/events.py` — 1 error
- `app/modules/property/events.py` — 2 errors
- `app/modules/notification/events.py` — 1 error
- `app/modules/maintenance/events.py` — 1 error
- `app/modules/contract/events.py` — 1 error
- `app/modules/billing/events.py` — 1 error
- `app/modules/admin/events.py` — 1 error

### Group B: Schema Files (12 errors)
- `app/modules/property/schemas.py` — 4 errors (`dict` + meta)
- `app/modules/maintenance/schemas.py` — 1 error
- `app/modules/dashboard/schemas.py` — 1 error
- `app/modules/contract/schemas.py` — 4 errors (validators + meta)
- `app/modules/billing/schemas.py` — 10 errors (validators + meta + from_model)
- `app/modules/admin/schemas.py` — 1 error

### Group C: Workers & Schedulers (28 errors)
- `app/workers/monitoring.py` — 6 errors
- `app/workers/schedulers/meter_reminder_scheduler.py` — 3 errors
- `app/workers/schedulers/sla_monitoring_scheduler.py` — 3 errors
- `app/workers/schedulers/overdue_alert_scheduler.py` — 3 errors
- `app/workers/schedulers/contract_expiry_scheduler.py` — 3 errors
- `app/workers/tasks/notification_tasks.py` — ~5 errors
- `app/workers/tasks/maintenance_tasks.py` — ~5 errors
- `app/workers/tasks/invoice_tasks.py` — ~5 errors

### Group D: Middleware, Config, Security (15 errors)
- `app/middleware/cors.py` — 2 errors
- `app/middleware/rbac.py` — 3 errors
- `app/middleware/logging.py` — 3 errors
- `app/middleware/auth.py` — 4 errors
- `app/config.py` — 2 errors
- `app/shared/security.py` — 2 errors

### Group E: Utils, Security, Database, Audit, Billing Services (20 errors)
- `app/shared/utils.py` — 2 errors (unused-ignore)
- `app/shared/security.py` — 2 errors (no-any-return)
- `app/shared/database.py` — 4 errors (assignment)
- `app/shared/audit.py` — 2 errors (assignment)
- `app/modules/billing/services/billing_service.py` — 5 errors (no-any-return, name-defined)
- `app/modules/billing/services/bulk_service.py` — 5 errors (no-any-return, arg-type)

### Group F: Router Files (15 errors)
- `app/modules/property/routers/property_router.py` — 6 errors
- `app/modules/tenant/routers/tenant_router.py` — 3 errors
- `app/modules/billing/routers/billing_router.py` — 4 errors
- `app/modules/maintenance/routers/maintenance_router.py` — 5 errors
- `app/modules/contract/routers/contract_router.py` — 5 errors
- `app/modules/notification/routers/notification_router.py` — 5 errors
- `app/modules/dashboard/routers/dashboard_router.py` — 3 errors
- `app/modules/admin/routers/admin_router.py` — 2 errors

---

## 🚀 Execution Order

```
┌─────────────────────────────────────────────────────────────┐
│  PHASE 1: PARALLEL (6 agents, ~10 min each)                 │
├─────────────────────────────────────────────────────────────┤
│  Agent-A  Agent-B  Agent-C  Agent-D  Agent-E  Agent-F       │
│  (A)      (B)      (C)      (D)      (E)      (F)           │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  PHASE 2: SEQUENTIAL (6 steps, must wait for Phase 1)       │
├─────────────────────────────────────────────────────────────┤
│  1. shared/events.py      (base)                            │
│  2. shared/deps.py          (CurrentUser, deps)             │
│  3. billing/models.py       (legacy SQLAlchemy)             │
│  4. contract/models.py      (datetime.date)                 │
│  5. All router files        (depend on schemas, deps)       │
│  6. app/main.py             (imports all)                   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  PHASE 3: FINAL VERIFICATION                                 │
├─────────────────────────────────────────────────────────────┤
│  make typecheck  →  0 errors                                │
└─────────────────────────────────────────────────────────────┘
```

---

## 📝 Notes for Agents

1. **Use `from __future__ import annotations`** where forward refs needed
2. **Prefer `dict[str, Any]` over bare `dict`** — `Any` from `typing`
3. **Add `-> None`** for functions returning nothing
4. **Don't change logic** — only type annotations
5. **Run `make typecheck` after each file** to verify
6. **If stuck on a file**, report it and move to next — don't block