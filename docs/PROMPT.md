# PROMPT.md — Prompt Inventory (Reusable Templates)
**Purpose:** Central registry of reusable prompt templates. Attach any template to a conversation to enforce its rules.
**Version:** 2.1 | **Last Updated:** 2026-07-07

---

## 📋 TEMPLATE INDEX

| Template ID | Purpose | When to Attach |
|-------------|---------|----------------|
| `COMPREHENSIVE_AUDIT` | **Mandatory pre-requisite for ALL tasks** — Forces full codebase audit before any answer/plan/code | **Attach to EVERY conversation** by default |
| `E2E_TEST_CAMPAIGN` | Execute E2E campaign per features-to-test.md with priority gates | Sprint E2E testing sessions |
| `COMPONENT_AUDIT` | Deep-dive audit of specific frontend components | Before writing/updating test files |
| `DEBUG_INFRASTRUCTURE` | Systematic debugging of test infrastructure (ProtectedRoute, Suspense, hydration) | When tests hang on protected routes |
| `BACKEND_API_AUDIT` | Audit backend router→service→repo→model chain | Before backend API work |
| `AGENT_PROMPT_GENERATOR` | Turn the model into a Prompt Engineer + Technical Lead that drafts prompts for OTHER AI agents to execute (the model itself does not write code) | Delegating a task to a separate/background AI agent |

---

## 🔴 TEMPLATE: COMPREHENSIVE_AUDIT (DEFAULT — ATTACH TO ALL CONVERSATIONS)
**Name:** `comprehensive-audit`  
**Trigger:** Attach this template to enforce mandatory codebase audit before ANY response.

``````markdown
# 🔴 MANDATORY: COMPREHENSIVE CODEBASE AUDIT
**Attach this template to enforce: NO ANSWER, NO PLAN, NO CODE until audit complete.**

## 🎯 RULE
Before you respond to ANY user message (question, task, discussion, decision):
1. **IDENTIFY** all relevant source files for the topic
2. **READ** them (use search_files + read_file — don't assume paths)
3. **MAP** actual implementation vs any spec/requirement mentioned
4. **PRODUCE** a Component Audit Report (format below)
5. **ONLY THEN** answer/plan/propose

## 📋 AUDIT CHECKLIST (Run Every Time)

### 1. FIND & READ SOURCE FILES
- [ ] Search/read ALL relevant files: components, hooks, contexts, utils, types, API clients
- [ ] Backend: routers, services, repositories, models, schemas, migrations
- [ ] Config: Vite, Playwright, TypeScript, Docker, CI/CD
- [ ] Test files: existing specs, utilities, mocks, fixtures

### 2. MAP ACTUAL vs SPEC/REQUIREMENT
- [ ] Document actual behavior: fields, placeholders, validation, UI elements, error messages
- [ ] Document API contracts: request/response shapes, status codes, error formats
- [ ] Cross-reference with any spec, Test ID, requirement mentioned
- [ ] **Explicitly list discrepancies:** "Spec says X, code does Y"

### 3. VERIFY INFRASTRUCTURE
- [ ] Test utilities/helpers/mocks exist and work
- [ ] Shared patterns (auth, API client, state capture) available
- [ ] Build/dev tooling compatible

### 4. OUTPUT: COMPONENT AUDIT REPORT
```
## Component Audit Report — [Topic/Task]

### Source Files Read
- path/to/file.ts: [key findings]

### Actual vs Spec/Requirement
| Spec/Requirement | Actual Implementation | Match? | Gap |
|------------------|----------------------|--------|-----|
| ...              | ...                  | ✅/❌  | ... |

### Discrepancies Found
1. [Spec says X, code does Y] — Impact: High/Med/Low

### Conclusion
- Ready to answer/plan: YES/NO
- Blockers: [list]
- Recommended approach: [based on actual code]
```

## 🚫 FORBIDDEN (Auto-reject if violated)
- ❌ "90% compliant" without reading component source
- ❌ Planning test cases using spec placeholders without verifying in component
- ❌ Assuming mock patterns work without checking existing test files
- ❌ Proposing file structure without checking actual project layout
- ❌ Estimating effort without reading relevant service/router code
- ❌ "I'll fix as we go" without audit

## ✅ ONLY AFTER AUDIT COMPLETE
You MAY then: answer with evidence, propose plan with file refs, estimate from actual code, implement with correct patterns, create files in correct locations.

---

**ENFORCEMENT:** If you skip audit → STOP. Human will ask: "WHERE IS YOUR AUDIT REPORT?"
``````

---

## 🧪 TEMPLATE: E2E_TEST_CAMPAIGN
**Name:** `e2e-test-campaign`  
**Attach when:** Running Sprint E2E campaign per features-to-test.md

``````markdown
# E2E TEST CAMPAIGN — Property Management System

## 🎯 Mission
Execute Sprint 09 E2E Campaign per `docs/sprints/features-to-test.md` with priority gates.

## 📋 EXECUTION RULES (Non-Negotiable)

### 1. COMPREHENSIVE AUDIT FIRST (Attach comprehensive-audit template)
- [ ] Audit LoginPage.tsx, RegisterPage.tsx, AuthContext, fetchClient, test utils
- [ ] Map actual placeholders, fields, validation, UI elements vs Test IDs
- [ ] Document discrepancies before writing ANY test code

### 2. SPECIFICATION FIRST
- [ ] Read entire `features-to-test.md` BEFORE any code
- [ ] Map every Test ID → test case 1:1
- [ ] Create coverage tracking table

### 3. PRIORITY GATE EXECUTION (Strict Sequential)
| Order | Priority | Group | Routes | Test IDs |
|-------|----------|-------|--------|----------|
| 1 | P0 | Auth | `/login`, `/auth/register` | AUTH-LOGIN-01~10, AUTH-REG-01~09 |
| 2 | P0 | Billing | `/invoices`, `/invoices/:id` | INV-01~08, INV-DET-01~06 |
| 3 | P0 | Property | `/property`, `/property/:id`, `/property/rooms/:id` | PROP-01~08, PROP-DET-01~06, ROOM-01~06 |
| 4 | P0 | Dashboard | `/dashboard` | DASH-01~06 |
| 5 | P0 | Tenants/Meter/Reports | `/tenants`, `/meter-reading`, `/reports` | TENANT-01~06, METER-01~06, RPT-01~06 |
| 6 | P1 | Contract | `/contracts`, `/contracts/new`, `/contracts/:id` | CONT-01~08, CONT-NEW-01~05, CONT-DET-01~05 |
| 7 | P1 | Maintenance | `/maintenance`, `/maintenance/new` | MAINT-01~07, MAINT-NEW-01~05 |
| 8 | P1 | Settings | `/settings` | SET-01~08 |

- [ ] Cannot start Priority N until Priority N-1 COMPLETE (all pass)
- [ ] P0 blocking bug = IMMEDIATE STOP — Fix before proceeding

### 4. TEST STRATEGY (E2E_TEST_STRATEGY.md Article 1)
- [ ] **State Verification Engine** — Every test verifies: Result + Console + JS Errors + Network + Hydration + React Errors + Performance + A11y
- [ ] Comprehensive per route (5-20 tests), NOT smoke tests
- [ ] Mock APIs: `data` wrapper, Vite exclusion (`/@vite/`, `/@react-refresh`, `/@fs/`, `/src/`), catch-all `**/api/v1/**`
- [ ] Credentials: `admin@example.com` / `Admin123!` only
- [ ] Token check: `sessionStorage.getItem('pms_access_token')`
- [ ] Selectors: `getByRole`, `getByPlaceholder`, `.first()` for strict mode
- [ ] Wait: `expect(locator).toBeVisible({ timeout })` — NO `waitForTimeout`

### 5. DOCUMENTATION
- [ ] Update Report after EACH route: `E2E_TEST_REPORT_SPRINT_09.md`
- [ ] Log Test Bugs (C-xx) + Agent Errors (B-xx) in `docs/LOG/E2E_TEST.md`

## 🛑 STOP CONDITIONS
- Test Infrastructure broken (ProtectedRoute + Suspense hydration) → Fix FIRST
- P0 blocking bug → Stop, fix, re-verify
- Coverage < 100% Test IDs per route → Complete before next priority
``````

---

## 🔍 TEMPLATE: COMPONENT_AUDIT
**Name:** `component-audit`  
**Attach when:** Before writing/updating ANY test file for a frontend route

``````markdown
# COMPONENT AUDIT — [Component Name(s)]

## 🎯 Purpose
Deep-dive audit of specific frontend components to ensure tests match actual implementation.

## 📋 AUDIT CHECKLIST (Per Component)

### 1. FIELDS & PLACEHOLDERS
- [ ] List ALL input fields with exact `placeholder` text
- [ ] List all `type` attributes (email, password, tel, text)
- [ ] List all `label` text
- [ ] List all `required` attributes

### 2. VALIDATION BEHAVIOR
- [ ] When does validation run? (onBlur, onChange, onSubmit)
- [ ] Exact error messages per field
- [ ] Per-field vs form-level errors?
- [ ] Does form prevent submit on validation error?

### 3. UI ELEMENTS
- [ ] Submit button text + accessibility attributes
- [ ] Links (forgot password, register, back to login)
- [ ] Checkboxes (remember me, accept terms) — **verify existence**
- [ ] Loading states, disabled states
- [ ] Password visibility toggles

### 4. SPECIAL REQUIREMENTS
- [ ] URL parameters required (e.g., `?token=` for register)
- [ ] Redirect behavior after submit
- [ ] Token storage mechanism (sessionStorage key)

### 5. CROSS-REFERENCE WITH SPEC
- [ ] Map each Test ID from features-to-test.md to component capability
- [ ] Identify gaps: Test IDs component CANNOT support
- [ ] Document discrepancies for human review

## 📤 OUTPUT: Component Audit Report
```
## Component Audit Report — [Component Name]

### Fields & Placeholders
| Field | Placeholder | Type | Label | Required |
|-------|-------------|------|-------|----------|

### Validation
| Trigger | Field | Error Message | Blocks Submit? |
|---------|-------|---------------|----------------|

### UI Elements
| Element | Text/Attributes | Exists? |
|---------|-----------------|---------|

### Spec vs Component
| Test ID | Component Supports? | Gap/Discrepancy |
|---------|---------------------|-----------------|

### Conclusion
- Test cases need adjustment: [list]
- Cannot test: [Test IDs with reason]
```
``````

---

## 🐛 TEMPLATE: DEBUG_INFRASTRUCTURE
**Name:** `debug-infrastructure`  
**Attach when:** Tests hang on protected routes (ProtectedRoute + Suspense hydration issues)

``````markdown
# DEBUG TEST INFRASTRUCTURE — ProtectedRoute + Suspense Hydration

## 🎯 Problem
- Login works → dashboard renders
- Navigate to protected route → "Loading..." spinner forever
- ProtectedRoute shows `isLoading: true` indefinitely
- Suspense never resolves lazy page component

## 🔍 ROOT CAUSE HYPOTHESIS
AuthProvider state update after `/auth/me` mock doesn't trigger ProtectedRoute + Suspense re-render.

## 📋 DEBUG CHECKLIST

### 1. VERIFY AUTH PROVIDER FLOW
- [ ] `/auth/me` mock returns `data: { user }` with correct shape
- [ ] `sessionStorage.setItem('pms_access_token')` called on login
- [ ] AuthProvider `useEffect` calls `/auth/me` on mount
- [ ] `LOGIN_SUCCESS` dispatch includes user from `/auth/me`

### 2. VERIFY PROTECTEDROUTE
- [ ] Reads `isAuthenticated` from AuthContext
- [ ] Shows `<Navigate to="/login" />` when `!isAuthenticated && !isLoading`
- [ ] Renders children when `isAuthenticated`
- [ ] **Does NOT block on `isLoading` indefinitely**

### 3. VERIFY SUSPENSE BOUNDARY
- [ ] Lazy page component wrapped in `<Suspense fallback={<Spinner />} />`
- [ ] Fallback renders while component loads
- [ ] Component resolves after AuthProvider provides user

### 4. TEST FIX PATTERN
```typescript
// In test: wait for Suspense resolution after navigation
await page.goto('/protected-route');
await page.waitForFunction(() => {
  const h1 = document.querySelector('h1');
  return h1 && h1.textContent && h1.textContent.includes('Expected Heading');
}, { timeout: 30000 });
```

### 5. APPLY TO AFFECTED TEST FILES
- [ ] `meter-offline-sync.spec.ts`
- [ ] `maintenance-flow.spec.ts`
- [ ] `contract-flow.spec.ts`
- [ ] Any new protected route test
``````

---

## ⚙️ TEMPLATE: BACKEND_API_AUDIT
**Name:** `backend-api-audit`  
**Attach when:** Before any backend API work (new endpoint, refactor, bug fix)

``````markdown
# BACKEND API AUDIT — [Module/Endpoint]

## 🎯 Purpose
Audit router → service → repository → model chain before backend work.

## 📋 AUDIT CHECKLIST

### 1. ROUTER (app/modules/X/routers/*)
- [ ] Endpoint path, method, status codes
- [ ] Request/response schemas (Pydantic)
- [ ] Dependencies: auth, DB, current_user
- [ ] Error handling: catches service exceptions → HTTP responses

### 2. SERVICE (app/modules/X/services/*)
- [ ] Business logic methods
- [ ] Repository calls (NOT direct DB)
- [ ] Transaction boundaries
- [ ] Audit logging calls
- [ ] Domain events published

### 3. REPOSITORY (app/modules/X/repository.py)
- [ ] Query methods (async, SQLAlchemy 2.0)
- [ ] No business logic
- [ ] Proper relationship loading (selectinload, joinedload)

### 4. MODEL (app/modules/X/models.py)
- [ ] SQLAlchemy 2.0 declarative mapping
- [ ] Constraints, indexes, relationships
- [ ] No methods with logic

### 5. SCHEMA (app/modules/X/schemas.py)
- [ ] Request/response models (Pydantic v2)
- [ ] Validators for business rules
- [ ] `model_config = ConfigDict(strict=True, extra="forbid")`

### 6. TESTS
- [ ] Unit tests for service (mock repository) — coverage ≥90%
- [ ] Integration tests for router (real DB, async_client) — coverage ≥85%
- [ ] Contract tests against openapi.json

## 📤 OUTPUT: Backend API Audit Report
```
## Backend API Audit Report — [Module]

### Router
| Endpoint | Method | Status | Schema | Auth | Errors |
|----------|--------|--------|--------|------|--------|

### Service
| Method | Repo Calls | Transaction | Audit | Events |
|--------|------------|-------------|-------|--------|

### Gaps/Discrepancies
1. [Spec says X, code does Y]

### Conclusion
- Ready for work: YES/NO
- Blockers: [list]
```
``````

---

## 🎭 TEMPLATE: AGENT_PROMPT_GENERATOR
**Name:** `agent-prompt-generator`
**Attach when:** The task is to delegate work to a separate AI agent (a spawned subagent, a different model/session, a background worker) rather than to write the code yourself.

``````markdown
# AGENT PROMPT GENERATOR — Prompt Engineer + Technical Lead Mode

## 🎯 Rule
You are acting as Prompt Engineer + Technical Lead for this project. You do NOT write application code yourself in this mode. Your only deliverable is a complete, self-contained prompt that another AI agent will execute to do the actual work. If you find yourself editing a source file, stop and go back to drafting the prompt instead.

The prompt you generate is instructions for an agent with no memory of this conversation — it must stand alone. Assume it can read the repo but knows nothing you have not told it.

## MANDATORY STRUCTURE (all 4 sections required, in this order)

### 1. Role
Define who the receiving agent is for this task, its scope of authority, and what decisions it is trusted to make on its own vs. what needs to come back to a human. Ground it in this project's context (Property Management System, FastAPI + React/TypeScript, fullstack E2E via real backend + Postgres, conventions in docs/LOG/E2E_TEST.md and docs/sprints/E2E_TEST_STRATEGY.md).

### 2. Responsibility
The non-negotiable process the agent must follow before/while doing the task. At minimum for this project:
- Component/backend audit BEFORE writing any test or fix
- No mocks in E2E tests — real backend, real DB, reset-e2e-db.sh before every run
- If a real application/backend bug is found, fix the source, do not work around it in the test
- Verify before declaring done: chmod 644 on new files, tsc --noEmit, real Docker Playwright run
- Report back findings in a form that can be folded into docs/LOG/E2E_TEST.md and the Sprint report

### 3. Task
The concrete, scoped deliverable — files to create/modify, Test IDs or bugs to address, what done looks like, verification commands to run.

### 4. User Requirements
LEAVE THIS SECTION BLANK IN THE TEMPLATE. Fill it in fresh each time this template is used, with whatever the user has actually asked for.

[ FILL IN PER USE ]

## OUTPUT FORMAT
Produce the final prompt as a single self-contained markdown block, ready to hand to the receiving agent as-is.

## FORBIDDEN
- Writing or editing application source code yourself in this mode
- Omitting any of the 4 mandatory sections
- Leaving Role/Responsibility/Task vague when specifics are knowable
- Filling in User Requirements with your own assumptions instead of the actual user ask
``````

---

## TEMPLATE: SELF_CRITIC
**Name:** `self-critic`
**Attach when:** 

``````markdown
ช่วย Self Critic การทำงานของตัวเองใน Session นี้หน่อย คิดว่าตัวเองใช้เวลาเหมาะสมกับ Task ไหม ทั้ง Session คิดว่ามี Bottleneck ตรงจุดไหน มีข้อบกพร่องตรงไหน และควร Improve ตรงไหนบ้าง ช่วยวิเคราะห์ แล้ว Generate ออกมาทาง Conversation หน่อย
``````

---


## 📝 USAGE INSTRUCTIONS

### How to Attach a Template
**In your message to the model, include:**
```
[ATTACH TEMPLATE: comprehensive-audit]
Your question/task here...
```

**Or attach multiple:**
```
[ATTACH TEMPLATE: comprehensive-audit, e2e-test-campaign]
Continue Sprint 09 E2E campaign...
```

### Template Priority
1. **`comprehensive-audit`** — ALWAYS attached (default)
2. Task-specific template — attached based on work type
3. Debug template — attached when specific issue arises

---

## 🎯 DEFAULT BEHAVIOR
**If no template explicitly attached → `comprehensive-audit` is implicitly active.**
Model MUST produce Component Audit Report before any other output.

---

**End of PROMPT.md v2.0**