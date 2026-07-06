# E2E Test Strategy — Property Management System

> **Document Type:** Test Strategy Constitution (รัฐธรรมนูญการทดสอบ E2E)  
> **Version:** 2.0  
> **Status:** Active — Mandatory for All Sprints  
> **Authority:** Highest — All Sprint E2E Plans Must Comply  
> **Last Updated:** 2026-07-06  
> **Owner:** @kawee / QA Lead  
> **Review Cycle:** Per Sprint Retrospective / Quarterly  

---

## 📜 Preamble (ข้อสมมติฐานและจุดประสงค์)

> **This document is the Constitution of E2E Testing for the Property Management System.**

> **Purpose:** Define the immutable baseline standards, principles, and mandatory practices for ALL End-to-End testing across every Sprint. This ensures consistency, quality, and reliability regardless of team changes, timeline pressure, or technical evolution.

> **Scope:** Applies to ALL E2E testing activities in ALL Sprints — past, present, and future.

> **Hierarchy:** This document supersedes any Sprint-specific plan, team preference, or individual interpretation. Sprint plans DERIVE from this strategy; they do not override it.

---

## ⚖️ Article 1: Core Principles (หลักการหลักที่ไม่สามารถยอมเปลี่ยนได้)

### 1.1 State Verification Over Result Assertion (หลักการตรวจสอบ State ทุกอย่าง)
> **E2E Test = State Verification Engine, NOT Result Assertion Checker**

> Every test MUST verify ALL states simultaneously in a single run:
> - ✅ Final Result (Expected UI/Behavior)
> - ✅ Console Logs (Zero unexpected errors/warnings)
> - ✅ JavaScript Errors (Zero uncaught exceptions)
> - ✅ Network Requests (All 2xx, correct payload/response)
> - ✅ Network Timing (No aborted/failed/timeout requests)
> - ✅ React Hydration (No hydration mismatches)
> - ✅ React Errors (No error boundary triggers)
> - ✅ Performance (No long tasks, layout shifts > thresholds)
> - ✅ Accessibility (Zero violations if enabled)

**Violation:** A test that only asserts final result without verifying other states is INCOMPLETE and NON-COMPLIANT.

### 1.2 Specification-First, Execution-Second (อ่าน Spec ก่อน เขียน Test ทีหลัง)
> **NO test code written before reading the relevant specification.**

> - Read `docs/sprints/features-to-test.md` (or equivalent) COMPLETELY first
> - Map every Test ID → Test Case 1:1
> - Create coverage tracking table BEFORE writing any test code

### 1.3 Priority Gate Execution (ลำดับความสำคัญเป็นกฎที่ต้องปฏิบัติ)
> **Strict Sequential Execution by Priority — No Skipping, No Reordering**

> - Cannot start Priority N until Priority N-1 is COMPLETE (all tests pass)
> - P0 blocking bug = IMMEDIATE STOP — Fix before proceeding
> - Priority Order defined in `features-to-test.md` Execution Order section

### 1.4 Comprehensive Over Smoke (ครอบคลุมทุก Scenario ไม่ใช่แค่ Smoke Test)
> **Test Coverage = Comprehensive per Route per Spec, NOT Smoke Test**

> - Each route: 5–20 detailed Test IDs (Happy Path, Negative, Edge Case, Security, Integration, UI, Performance, Accessibility)
> - Smoke test (1–3 tests/route) = NON-COMPLIANT
> - Target: 100% Test ID coverage per `features-to-test.md`

### 1.5 Test Infrastructure Health = Test Validity Prerequisite
> **Test Infrastructure Must Be Healthy Before Any Test Execution**

> - ProtectedRoute + Suspense hydration must work
> - Mock APIs must not intercept Vite dev server paths
> - Auth flow must work end-to-end
> - **Broken Test Infrastructure = ALL Tests Invalid

---

## 📋 Article 2: Mandatory Standards (มาตรฐานขั้นต่ำที่ต้องปฏิบัติทุก Sprint)

### 2.1 Test Coverage Baseline (Baseline = Minimum Acceptable)

| Metric | Baseline | Target |
|--------|----------|--------|
| Route Coverage | 100% (all 22 routes have test files) | 100% |
| Test ID Coverage | 100% (all ~230 scenarios executed) | 100% |
| Pass Rate | 100% for P0, ≥80% for P1 | 100% |
| Test Infrastructure | Zero blocking issues | Zero |

### 2.2 Test Quality Standards

| Standard | Requirement |
|----------|-------------|
| **Test Isolation** | Each test independent; no shared state between tests |
| **Deterministic** | Same input → Same result every run |
| **Self-Contained** | All mocks, data, setup within test file or shared helpers |
| **Idempotent** | Safe to run multiple times without side effects |
| **Traceable** | Each test maps to Test ID in `features-to-test.md` |

### 2.3 Mock API Standards

| Rule | Requirement |
|------|-------------|
| **Response Format** | ALL mocks wrap payload in `data` object: `{ data: { ... } }` |
| **Vite Path Exclusion** | Catch-all `**/api/v1/**` MUST exclude `/@vite/`, `/@react-refresh`, `/@fs/`, `/src/` |
| **Auth Mocks** | `/auth/login` AND `/auth/me` MUST return `data` wrapper with user object |
| **Catch-all** | Use `**/api/v1/**` NOT `**/api/**` |

### 2.4 Test Code Standards

| Standard | Requirement |
|--------|-------------|
| **Selectors** | Use `getByRole`, `getByPlaceholder`, `getByLabel` — NO CSS selectors |
| **Wait Strategy** | `expect(locator).toBeVisible({ timeout })` — NO `waitForTimeout` |
| **Strict Mode** | Use `.first()` for text locators matching multiple elements |
| **Credentials** | Seed credentials only: `admin@example.com` / `Admin123!` |
| **Token Storage** | Check `sessionStorage.getItem('pms_access_token')` |

---

## 🏗️ Article 3: Test Architecture (สถาปัตยกรรมการทดสอบ)

### 3.1 Test File Organization

```
frontend/e2e/
├── specs/
│   ├── auth-flow.spec.ts           # /login, /auth/register
│   ├── a11y.spec.ts                # Cross-cutting accessibility
│   ├── property-flow.spec.ts       # /property, /property/:id, /property/rooms/:id
│   ├── invoice-payment.spec.ts     # /invoices, /invoices/:id
│   ├── meter-offline-sync.spec.ts  # /meter-reading (offline + online)
│   ├── maintenance-flow.spec.ts    # /maintenance, /maintenance/new
│   ├── contract-flow.spec.ts       # /contracts, /contracts/new, /contracts/:id
│   ├── dashboard.spec.ts           # /dashboard (MUST CREATE)
│   ├── tenant-flow.spec.ts         # /tenants (MUST CREATE)
│   ├── reports.spec.ts             # /reports (MUST CREATE)
│   ├── property-detail.spec.ts     # /property/detail/:id (MUST CREATE)
│   ├── auth-register.spec.ts       # /auth/register (MUST CREATE)
│   ├── settings.spec.ts            # /settings (MUST CREATE)
├── utils/
│   ├── test-helpers.ts             # Shared: login(), navigate(), waitForPage()
│   ├── mock-helpers.ts             # Shared: mockAuthApis(), mockApiHelpers()
│   └── state-capture.ts            # Shared: captureAllStates()
├── fixtures/
│   ├── test-data.json              # Test data constants
│   └── mock-responses.json         # Mock response templates
```

### 3.2 Shared Helpers (Mandatory Reuse)

```typescript
// utils/test-helpers.ts — MUST USE in all test files
export const TEST_USER = { email: 'admin@example.com', password: 'Admin123!' };

export async function login(page: Page): Promise<void> { ... }
export async function navigateTo(page: Page, path: string, expectedHeading: string): Promise<void> { ... }
export async function captureAllStates(page: Page): Promise<CapturedStates> { ... }
export async function waitForPageReady(page: Page, expectedHeading: string): Promise<void> { ... }
```

### 3.3 State Capture Utility (Mandatory in Every Test)

```typescript
// utils/state-capture.ts — USE IN EVERY TEST
export async function captureAllStates(page: Page): Promise<CapturedStates> {
  const states = {
    consoleErrors: [] as string[],
    jsErrors: [] as string[],
    networkErrors: [] as string[],
    hydrationErrors: [] as string[],
  };
  
  page.on('console', msg => msg.type() === 'error' && states.consoleErrors.push(msg.text()));
  page.on('pageerror', e => states.jsErrors.push(e.message));
  page.on('response', r => r.status() >= 400 && states.networkErrors.push(`${r.status()} ${r.url()}`));
  
  return states;
}

// Usage in EVERY test:
const states = await captureAllStates(page);
// ... execute test actions ...
await expect(page.locator('h1')).toContainText(/Expected/);
expect(states.consoleErrors).toEqual([]);
expect(states.jsErrors).toEqual([]);
expect(states.networkErrors).toEqual([]);
```

---

## 🔄 Article 4: Professional E2E Test Writing Workflow (กระบวนการเขียน Test มืออาชีพ)

> **Purpose:** Define the mandatory 8-step process for writing E2E test files that are correct, maintainable, and debuggable. This workflow bridges Architecture (Article 3) and Execution (Article 5).

### 4.1 The 8-Step Professional Workflow

| Step | Phase | Action | Output |
|------|-------|--------|--------|
| **1** | **Specification-First** | Read `features-to-test.md` completely → Map Test ID → Test Case 1:1 → Create coverage tracking table | Coverage table (Test ID ↔ Test Case) |
| **2** | **Component Audit** | Read component source (`.tsx`) → Document: fields, placeholders, validation triggers, exact error messages, UI elements, special requirements (URL params, redirects) | Component Audit Report |
| **3** | **Infrastructure Setup** | Verify shared utilities exist (`test-helpers`, `mock-helpers`, `state-capture`) → Verify mock patterns work (data wrapper, Vite exclusion) → Run `auth-flow.spec.ts` as infrastructure gate | Infrastructure verified ✅ |
| **4** | **Write One Test (TDD)** | Write single failing test → Run `--headed` → Watch browser live → Debug in DevTools (Network, Console, React) → Fix root cause → Pass | 1 passing test |
| **5** | **State Verification** | Every test captures states at start → Verifies ALL: Result + Console + JS Errors + Network + Hydration + React Errors + Performance + A11y | Complete state verification |
| **6** | **Repeat Per Test ID** | Loop steps 4-5 for each Test ID in route → Commit after each pass → Refactor shared helpers as needed | All Test IDs implemented |
| **7** | **Quality Gate (Per File)** | Run MVTF checklist (Article 6.2) → Run all tests in file → 100% pass → Update Report | File passes MVTF |
| **8** | **Priority Gate (Per Route)** | Run all route tests → All pass → Update Report + Log → Cannot proceed to next priority until complete | Route complete ✅ |

### 4.2 Debugging Protocol (When Test Fails)

```bash
# MANDATORY sequence — NO guessing, NO patching symptoms
1. npx playwright test -g "TEST-ID" --headed --debug    # Watch live
2. npx playwright show-trace trace.zip                   # Analyze timeline
3. Check Network tab: request/response shapes, status codes
4. Check Console: React errors, fetch errors, warnings
5. Read component source: verify expected behavior matches actual
6. Fix ROOT CAUSE (test logic / mock / expectation) — NOT filter symptoms
```

### 4.3 Professional vs Amateur Behaviors

| Amateur (Forbidden) | Professional (Required) |
|---------------------|-------------------------|
| Write tests from assumptions | Read component source FIRST |
| Run full suite, hope for green | Run ONE test `--headed`, debug live |
| Fail → patch filter/assertion | Fail → root cause in DevTools/trace |
| Smoke tests (1-3/route) | Comprehensive (5-20/route per spec) |
| Hardcoded credentials everywhere | `TEST_USER` constant from shared helpers |
| CSS/class selectors | `getByRole`, `getByPlaceholder`, `.first()` |
| No state verification | Verify 8 states every test |
| "I'll fix as we go" | Fix root cause before next test |

### 4.4 Test Code = Production Code Principle

> **Test code must meet the same standards as production code:**

> - **Readability**: Clear test names (`Test ID: Description`), organized structure
> - **Maintainability**: Shared helpers, no duplication, single responsibility
> - **Debuggability**: State capture, meaningful errors, traceable to Test ID
> - **Reliability**: Deterministic, isolated, idempotent, self-contained

---

## 📋 Article 5: Execution Protocol (กระบวนการดำเนินการทุก Sprint)

### 5.1 Pre-Sprint Checklist (Mandatory Before Sprint Start)
- [ ] Read `docs/sprints/features-to-test.md` COMPLETELY
- [ ] Audit existing test files vs `features-to-test.md` routes
- [ ] Create missing test files for missing routes
- [ ] Map Test IDs → Test Cases 1:1 in tracking table
- [ ] Verify Test Infrastructure health (run auth-flow.spec.ts first)
- [ ] Confirm Priority Execution Order with team

### 5.2 Execution Phase Protocol

| Phase | Action | Gate |
|-------|--------|------|
| **0. Infrastructure** | Run `auth-flow.spec.ts` | All pass = ✅ Go |
| **1. Priority 1** | Execute P0 Auth (2 routes) | All pass = ✅ Next |
| **2. Priority 2** | Execute P0 Billing (2 routes) | All pass = ✅ Next |
| **3. Priority 3** | Execute P0 Property (3 routes) | All pass = ✅ Next |
| **4. Priority 4** | Execute P0 Dashboard (1 route) | All pass = ✅ Next |
| **5. Priority 5** | Execute P0 Tenants/Meter/Invoices/Reports | All pass = ✅ Next |
| **6. Priority 6** | Execute P1 Contract (3 routes) | All pass = ✅ Next |
| **7. Priority 7** | Execute P1 Maintenance (2 routes) | All pass = ✅ Next |
| **8. Priority 8** | Execute P1 Settings (1 route) | All pass = ✅ Complete |

### 5.3 Per-Route Execution Protocol

```bash
# Per route:
1. Create/Update test file per route (if missing)
2. Implement ALL Test IDs from features-to-test.md
3. Add state capture utility
4. Run test with --headed for visual verification
5. Verify ALL states: result + console + JS errors + network + hydration
6. Update Report: Pass/Fail/Not Run per Test ID
7. Update Log: Test Bugs (C-xx) or Agent Errors (B-xx)
8. Gate Check: Cannot proceed to next priority until ALL pass
```

### 5.4 Reporting Protocol

| Document | When to Update | Content |
|----------|----------------|---------|
| `E2E_TEST_REPORT_SPRINT_XX.md` | After EACH route | Pass/Fail/Not Run per Test ID, Root Cause, Action Plan |
| `E2E_TEST.md` (Log) | After EACH issue | Test Bugs (C-xx), Agent Behavior Errors (B-xx) |

---

## 📋 Article 6: Test File Quality Gates (ประตูคุณภาพไฟล์ Test)

### 6.1 Minimum Viable Test File (MVTF)

Every test file MUST contain:

```typescript
// 1. Imports + Constants
import { test, expect, type Page } from '@playwright/test';
import { TEST_USER, login, navigateTo, captureAllStates } from '../utils/test-helpers';

// 2. Test Data Constants
const TEST_SCENARIOS = { ... };

// 3. Mock API Helper
async function mockFeatureApis(page: Page): Promise<void> { ... }

// 4. Test Suite with State Capture
test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    await mockFeatureApis(page);
    const states = captureAllStates(page); // Capture from start
  });

  test('Test ID: Description', async ({ page }) => {
    const states = captureAllStates(page);
    
    // Execute
    await login(page);
    await navigateTo(page, '/route', 'Expected Heading');
    
    // Assert ALL states
    await expect(page.locator('h1')).toContainText(/Expected/);
    expect(states.consoleErrors).toEqual([]);
    expect(states.jsErrors).toEqual([]);
    expect(states.networkErrors).toEqual([]);
  });
});
```

### 6.2 Test File Quality Checklist (Per File)
- [ ] Imports from shared helpers only
- [ ] TEST_USER constant defined
- [ ] Mock APIs with correct format (data wrapper, Vite exclusion)
- [ ] State capture from test start
- [ ] All Test IDs from `features-to-test.md` implemented
- [ ] Each test verifies: result + console + JS errors + network + hydration
- [ ] No `waitForTimeout`, CSS selectors, hardcoded credentials
- [ ] Credentials = `admin@example.com` / `Admin123!`
- [ ] Token check = `sessionStorage.getItem('pms_access_token')`

---

## 📋 Article 7: Reporting & Documentation Standards

### 7.1 Report Structure (Mandatory Sections)

```
E2E_TEST_REPORT_SPRINT_XX.md
├── Executive Summary (Metrics Table)
├── Coverage by Group (Per features-to-test.md Groups)
├── Route-by-Route Test ID Status (All ~230 Test IDs)
├── Failed Tests (Root Cause, Category, Action Plan)
├── Not Run Tests (With Reason)
├── Failure Categories Summary
├── Root Cause Analysis (Primary/Secondary Blockers)
├── Action Plan (Phases with Owner/Effort/Sprint)
├── Test Health Dashboard (Visual Table)
└── Next Steps
```

### 7.2 Log Entry Format (Per Issue)

```markdown
### C-XX: Issue Title
| Aspect | Details |
|--------|---------|
| **Root Cause** | Test ID from `features-to-test.md` | INV-01 |
| **Error Symptom** | Empty invoice list |
| **Files Affected** | `invoice-payment.spec.ts` |
| **Fix** | Add mock for GET /invoices |
| **Prevention** | Mock API checklist |
```

### 7.3 Agent Behavior Error Log Format

```markdown
### B-XX: Error Title
| Aspect | Details |
|--------|---------|
| **Date** | 2026-07-06 |
| **Error Type** | Process/Decision Error |
| **What Happened** | ... |
| **Specification Violated** | `features-to-test.md` lines X-Y |
| **Impact** | Coverage 10% vs 100% |
| **Root Cause** | Assumed smoke tests first |
| **Correct Behavior** | Follow Execution Order 1→8 |
| **Prevention** | Read spec FIRST |
```

---

## 📋 Article 8: Amendment Process (กระบวนการแก้ไขเอกสารนี้)

### 8.1 When to Amend
- Strategy is **outdated** (tooling changed, new patterns emerged)
- Strategy has **gaps** (missing coverage for new test types)
- Strategy **contradicts** new project requirements
- **Retrospective** reveals systematic failures

### 8.2 Amendment Process

| Step | Action | Authority |
|------|--------|-----------|
| 1 | Propose change with rationale | Any team member |
| 2 | Impact analysis (coverage, effort, risk) | QA Lead |
| 3 | Team review & consensus | Whole team |
| 3 | Approve & version bump | QA Lead + Tech Lead |
| 4 | Update document + version | QA Lead |
| 5 | Communicate to all sprints | QA Lead |

### 8.3 Versioning

| Version | When |
|---------|------|
| **Major (X.0)** | Fundamental principle change, new Article |
| **Minor (X.Y)** | New standard, modified threshold, added section |
| **Patch (X.Y.Z)** | Typo fix, clarification, formatting |

---

## 📋 Article 9: Compliance & Enforcement

### 9.1 Non-Compliance Consequences

| Violation | Consequence |
|-----------|-------------|
| Skip Priority Gate | Sprint blocked until fixed |
| Test file below MVTF | Test file rejected; must fix before run |
| Skip state verification | Test marked INCOMPLETE; re-run required |
| Skip Priority Order | Sprint blocked; re-plan required |
| Test Infrastructure broken | ALL tests invalid; infrastructure fix mandatory first |

### 9.2 Audit Rights
- QA Lead may audit any Sprint test execution at any time
- Random audit of test files against MVTF checklist
- Report audit findings in Sprint Retrospective

---

## 📋 Article 10: Definitions (คำจำกัดความ)

| Term | Definition |
|------|------------|
| **Test ID** | Unique identifier from `features-to-test.md` (e.g., `AUTH-LOGIN-01`) |
| **Test Scenario** | Single test case mapping to one Test ID |
| **Route** | Frontend URL path (e.g., `/invoices`, `/invoices/:id`) |
| **Scenario Type** | Happy Path, Negative, Edge Case, Security, Integration, UI, Performance, Accessibility |
| **Priority** | P0 (Critical Path), P1 (Important), P2 (Nice to Have) |
| **Test Infrastructure** | ProtectedRoute, Suspense, AuthProvider, Mock API setup, Test helpers |
| **App Bug** | Defect in application code (backend/frontend) — logged in Report |
| **Test Bug** | Defect in test code (selector wrong, mock wrong, wait strategy wrong) — logged in Log |
| **Test Infra Issue** | Test environment issue (hydration, timing, mock setup) — logged in Log |
| **State Verification** | Simultaneous verification of ALL states (result + console + JS + network + hydration) |

---

## 📋 Article 11: Effective Date & Supersession

| Item | Item | Detail |
 |------|--------|
 | **Effective Date** | 2026-07-06 |
 | **Supersedes** | All prior E2E testing guidelines, conventions, verbal agreements |
 | **Applies To** | ALL Sprints (current and future) |
 | **Review Date** | 2026-10-06 (Quarterly) |

---

## 📜 Sign-Off (การลงนามรับรอง)

| Role | Name | Signature | Date |
|------|------|-----------|------|
| **QA Lead** | @kawee | | 2026-07-06 |
| **Tech Lead** | | | |
| **Product Owner** | | | |

---

## 📚 Appendix A: Quick Reference Card (การ์ดอ้างอิงด่วน)

### MVP Test File Template

```typescript
import { test, expect, type Page } from '@playwright/test';
import { TEST_USER, login, navigateTo, captureAllStates } from '../utils/test-helpers';

const TEST_USER = { email: 'admin@example.com', password: 'Admin123!' };

async function mockFeatureApis(page: Page): Promise<void> {
  // Mock login, auth/me, feature APIs with data wrapper
  // Exclude Vite paths in catch-all
}

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    await mockFeatureApis(page);
  });

  test('Test ID: Description', async ({ page }) => {
    const states = captureAllStates(page);
    await login(page);
    await navigateTo(page, '/route', 'Expected Heading');
    await expect(page.locator('h1')).toContainText(/Expected/);
    expect(states.consoleErrors).toEqual([]);
    expect(states.jsErrors).toEqual([]);
    expect(states.networkErrors).toEqual([]);
  });
});
```

### Verification Checklist (Per Test)
- [ ] Result Assertion ✅
- [ ] Console Errors = [] ✅
- [ ] JS Errors = [] ✅
- [ ] Network Errors = [] ✅
- [ ] No Hydration Mismatch ✅
- [ ] React Errors = [] ✅

---

## 📚 Appendix B: Priority Execution Order Reference

| Order | Priority | Group | Routes | Test IDs |
|-------|----------|-------|--------|----------|
| 1 | P0 | Auth | `/login`, `/auth/register` | AUTH-LOGIN-01~10, AUTH-REG-01~09 |
| 2 | P0 | Billing | `/invoices`, `/invoices/:id` | INV-01~08, INV-DET-01~06 |
| 3 | P0 | Property | `/property`, `/property/:id`, `/property/rooms/:id` | PROP-01~08, PROP-DET-01~06, ROOM-01~06 |
| 4 | P0 | Dashboard | `/dashboard` | DASH-01~06 |
| 5 | P0 | Tenants/Meter/Invoices/Reports | `/tenants`, `/meter-reading`, `/invoices`, `/reports` | TENANT-01~06, METER-01~06, INV-01~08, RPT-01~06 |
| 6 | P1 | Contract | `/contracts`, `/contracts/new`, `/contracts/:id` | CONT-01~08, CONT-NEW-01~05, CONT-DET-01~05 |
| 7 | P1 | Maintenance | `/maintenance`, `/maintenance/new` | MAINT-01~07, MAINT-NEW-01~05 |
| 8 | P1 | Settings | `/settings` | SET-01~08 |

---

## 📚 Appendix C: Component Audit Report Template

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

---

**End of Constitution — This Document Is Supreme for All E2E Testing Activities**  
**Version 2.0 | Effective 2026-07-06 | Next Review: 2026-10-06**