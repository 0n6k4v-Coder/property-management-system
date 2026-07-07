# E2E Test Issues & Fixes Log

> **Project:** Property Management System
> **Purpose:** Document all E2E test issues encountered and their fixes to prevent recurrence
> **Scope:** All E2E Test Files in `frontend/e2e/`
> **Last Updated:** 2026-07-06
> **Contributors:** @hermes-agent (nemotron-3-ultra-550b-a55b), @claude (claude-sonnet-5)

> **Session 3 note:** the entire suite was converted from mocked APIs to fullstack (real backend + real Postgres, no `page.route()` mocks) in this session. See [Part F](#part-f--fullstack-conversion-2026-07-06-session-3) for the real application/backend bugs this uncovered — several of them (missing DB commit, broken tenant creation, hung offline-sync) were invisible under mocks and would never have surfaced without running against the real stack.

---

## 📑 Table of Contents

1. [Overview](#overview)
2. [Session Index](#session-index)
3. [Part A — Blocking Infrastructure Bugs (2026-07-06, Session 2)](#part-a--blocking-infrastructure-bugs-2026-07-06-session-2)
   - [I-01: Spec Files Unreadable Inside Test Container (EACCES)](#i-01-spec-files-unreadable-inside-test-container-eacces)
   - [I-02: Syntax Errors from Unbalanced Braces](#i-02-syntax-errors-from-unbalanced-braces)
   - [I-03: Mock Route Precedence Bug — Catch-all Registered Last Shadows All Specific Mocks](#i-03-mock-route-precedence-bug--catch-all-registered-last-shadows-all-specific-mocks)
   - [I-04: `data` Wrapper Missing — Unmasked by I-03 Fix](#i-04-data-wrapper-missing--unmasked-by-i-03-fix)
   - [I-05: Shared `navigateTo()` Helper Matches Layout Chrome Instead of Page Heading](#i-05-shared-navigateto-helper-matches-layout-chrome-instead-of-page-heading)
   - [I-06: Strict Mode Violations in dashboard.spec.ts](#i-06-strict-mode-violations-in-dashboardspects)
   - [I-07: property-flow.spec.ts Rewritten — Wrong Page Model + Missing Component Audit](#i-07-property-flowspects-rewritten--wrong-page-model--missing-component-audit)
4. [Part B — Common Test Code Issues (Sprint 09)](#part-b--common-test-code-issues-sprint-09)
5. [Part C — File-Specific Issues & Fixes](#part-c--file-specific-issues--fixes)
6. [Part D — Agent Behavior Errors (Decision/Logic/Process)](#part-d--agent-behavior-errors-decisionlogicprocess)
7. [Part E — Best Practices Checklist](#part-e--best-practices-checklist)
8. [Part F — Fullstack Conversion (2026-07-06, Session 3)](#part-f--fullstack-conversion-2026-07-06-session-3)
9. [Reference: Correct Patterns](#reference-correct-patterns)

---

## Overview

This document consolidates all E2E test issues encountered while building out the Property Management System's Playwright suite. Each issue includes the root cause, error symptoms, and the fix applied. Use this as a reference when writing new E2E tests to avoid repeating the same mistakes.

Issues are grouped by **severity/kind**, not strictly by date:

| Prefix | Meaning | Where |
|--------|---------|-------|
| **I-xx** | Infrastructure Issue — broke test *execution* itself (permissions, syntax, mock plumbing, shared helpers) | Part A |
| **C-xx** | Common Test Code Issue — wrong pattern repeated across files (selectors, waits, credentials) | Part B |
| **B-xx** | Agent Behavior Error — a process/decision mistake made while doing the work, not a bug in the code | Part D |

---

## Session Index

| Session | Date | Author | Summary |
|---------|------|--------|---------|
| 1 | 2026-07-05 → 2026-07-06 | @hermes-agent (nemotron-3-ultra-550b-a55b) | Initial Sprint 09 E2E campaign. Wrote/repaired 7 spec files. Coverage stalled at 10.4% (24/230 scenarios) — see `docs/sprints/E2E_TEST_REPORT_SPRINT_09.md`. Logged C-01→C-15, B-01→B-05. |
| 2 | 2026-07-06 | @claude (claude-sonnet-5) | User reported the agent had been stuck for 5 hours with no forward progress. Diagnosed why the suite couldn't even start, fixed the blocking infrastructure bugs (I-01→I-06 below), took the suite from "won't collect" to 30/50 passing. |
| 3 | 2026-07-06 | @claude (claude-sonnet-5) | Converted the entire suite (9 spec files) from mocked APIs to fullstack — real backend + real Postgres via a deterministic seed script, no `page.route()` mocks anywhere. Added `reports-flow.spec.ts` (new) and full METER-03~06 coverage. Found and fixed 10 real application/backend bugs invisible under mocks (see Part F, F-01~F-12). Full suite: 85 passed, 12 skipped (documented N/A — real limitations, not test gaps), 0 failed. |
| 4 | 2026-07-07 | Hermes Agent (tencent/hy3:free), verified by @claude (claude-sonnet-5) | Extended `invoice-payment.spec.ts` from 4 → 14 tests, covering INV-02~08 and INV-DET-03~06 (Route 9/10). Found+documented F-13~F-19 (PaymentModal method mismatch, hardcoded property in Generate Invoice, genuine Payment History gap, etc.) — see Part F below. Independently re-verified by @claude: all 14 tests pass in isolation; full-file runs can be intermittently flaky, traced to severe host CPU contention from ~23 unrelated containers on this 4-core dev machine (not a test-logic bug). |

---

## Part A — Blocking Infrastructure Bugs (2026-07-06, Session 2)

> These bugs are why the previous session made no visible progress for 5 hours: the suite could not even **start** (permissions, syntax errors), and once it started, a systemic mock-ordering bug made passing tests validate garbage data while masking real failures. Fix these first, always, before writing new test scenarios.

### I-01: Spec Files Unreadable Inside Test Container (EACCES)

| Aspect | Details |
|--------|---------|
| **Root Cause** | `contract-flow.spec.ts`, `dashboard.spec.ts`, `maintenance-flow.spec.ts`, and all of `e2e/utils/*.ts` were saved on disk with `600` (owner-only, `rw-------`) permissions instead of `644`. The `frontend-test` service in `docker-compose.dev.yml` runs as `root` but sets `cap_drop: [ALL]`, which strips `CAP_DAC_OVERRIDE` — the capability the kernel normally uses to let root bypass file-permission checks. Without it, root is subject to the same owner/group/other bits as any user, so it could not read files whose "other" bits denied read access. |
| **Error Symptom** | `Error: EACCES: permission denied, open '/app/e2e/specs/contract-flow.spec.ts'` (and same for `dashboard.spec.ts`, `maintenance-flow.spec.ts`) at Playwright's test-collection step, before any test ran. |
| **Files Affected** | `contract-flow.spec.ts`, `dashboard.spec.ts`, `maintenance-flow.spec.ts`, `e2e/utils/mock-helpers.ts`, `e2e/utils/state-capture.ts`, `e2e/utils/test-helpers.ts` |
| **Fix** | `chmod 644` on all affected files so they match the other (working) spec files' permissions. |
| **Prevention** | When creating new spec/util files, verify `ls -la` shows `644` before running the suite in Docker. If a file-creation tool defaults to `600`, `chmod` it immediately after. |

---

### I-02: Syntax Errors from Unbalanced Braces

| Aspect | Details |
|--------|---------|
| **Root Cause** | Manual edits over a long session left mismatched `{`/`}` and `(`/`)` in three files:<br>• `auth-flow.spec.ts` — **two** `test.describe(...)` blocks (Login, Register) were never closed before the next `test.describe` started.<br>• `contract-flow.spec.ts` — the `/auth/me` mock had a duplicated/misplaced closing paren (`})),` followed by a stray `);`).<br>• `maintenance-flow.spec.ts` — an `if (...) { ... }` block inside a test was closed with `});` (paren + brace) instead of just `}` (brace only), leaving one extra `});` dangling at the end of the file. |
| **Error Symptom** | `SyntaxError: /app/e2e/specs/auth-flow.spec.ts: Unexpected token (754:0)` at Playwright's test-collection step — the whole file (and any file after it, in some reporters) fails to load. |
| **Files Affected** | `auth-flow.spec.ts`, `contract-flow.spec.ts`, `maintenance-flow.spec.ts` |
| **Fix** | Diagnosed with `npx tsc --noEmit -p tsconfig.e2e.json`, which pinpoints the exact unbalanced-brace line far more reliably than reading the file by eye. Added/removed the missing/extra brace in each file until `tsc --noEmit` reported zero errors. |
| **Prevention** | Run `npx tsc --noEmit -p tsconfig.e2e.json` after every edit to a spec file, *before* running Playwright — it catches structural errors in ~2 seconds instead of waiting for the full Docker + browser boot cycle to fail. |

---

### I-03: Mock Route Precedence Bug — Catch-all Registered Last Shadows All Specific Mocks

| Aspect | Details |
|--------|---------|
| **Root Cause** | Per Playwright's own docs: *"If a request matches multiple registered routes, the most recently registered route takes precedence."* Nearly every mock-setup function in this codebase registered specific mocks first (`/auth/login`, `/auth/me`, `/dashboard/**`, etc.) and the broad catch-all (`**/api/v1/**` or `**/api/**`) **last**. Because the catch-all is registered last, it wins for *every* matching URL — including the ones the specific mocks were supposed to handle — and the specific mocks silently never fire. |
| **Error Symptom** | Wildly inconsistent, hard-to-explain failures: some assertions pass with bogus data (e.g. `sessionStorage.getItem('pms_refresh_token')` returns `null` because the login mock's `refresh_token` field never reached the app), others fail with generic empty responses (`{ data: {} }`) where real mock data was expected. Nothing in the error message points at the mock file — it looks like an app bug. |
| **Files Affected** | `e2e/utils/mock-helpers.ts` (`setupAuthFlowMock`, `setupRegisterFlowMocks`), `auth-flow.spec.ts` (Register describe's inline `beforeEach`), `dashboard.spec.ts` (`setupDashboardMocks`), `invoice-payment.spec.ts` (`mockInvoiceApis`), `maintenance-flow.spec.ts` (`mockMaintenanceApis`), `meter-offline-sync.spec.ts` (`mockMeterApis`), `contract-flow.spec.ts` (`mockContractApis`), `property-flow.spec.ts` (`mockAllApis`), `a11y.spec.ts` (`mockAllApis`) |
| **Fix** | In every mock-setup function, moved the catch-all `page.route('**/api/v1/**', ...)` / `page.route('**/api/**', ...)` registration to the **top** of the function (registered first), and kept all specific mocks registered **after** it. Since Playwright gives precedence to the *most recently registered* matching route, the specific mocks now correctly override the catch-all default. |
| **Diagnosis Method** | Added a temporary `console.log` of `sessionStorage` keys inside the failing test, re-ran with `-g "<test name>"` to isolate it, and observed only `pms_access_token` was present — proving the login mock's `refresh_token` never reached `setStoredTokens()`. Traced backward from there to the route registration order. |
| **Prevention** | **Always register the broadest/most generic `page.route()` pattern first, and the most specific ones last**, in any mock-setup function. Add this as a mandatory line item in Article 2.3 (Mock API Standards) of `E2E_TEST_STRATEGY.md`. |

---

### I-04: `data` Wrapper Missing — Unmasked by I-03 Fix

| Aspect | Details |
|--------|---------|
| **Root Cause** | `a11y.spec.ts`'s login mock and `contract-flow.spec.ts`'s login mock both returned `{ access_token, refresh_token, token_type }` directly, without the `{ data: { ... } }` wrapper the frontend's `apiFetch` expects (same class of bug as C-01/C-08 below). This had been *masked* by I-03: since the catch-all was winning anyway, both the broken specific mock and the catch-all's `{ data: {} }` produced a `'data' in res` truthy check, so `AuthContext.login()` happened to proceed either way. Fixing I-03 (making the specific mock actually run) exposed that the specific mock itself was malformed. |
| **Error Symptom** | After fixing I-03 alone, `a11y.spec.ts` and `contract-flow.spec.ts` login flows stopped reaching `/dashboard` — `AuthContext.login()`'s `if ('data' in res)` check failed, so neither `LOGIN_SUCCESS` nor navigation fired. |
| **Files Affected** | `a11y.spec.ts`, `contract-flow.spec.ts` |
| **Fix** | Wrapped both mocks' response bodies in `{ data: { access_token, refresh_token, token_type, user: {...} } }`, matching the pattern in Part F "Reference: Correct Patterns" below. Also added the missing `/auth/me` mock to `a11y.spec.ts` (previously absent). |
| **Prevention** | This is a reminder that a "passing" test is not proof a mock is correct — a bug in one place can be masked by a bug in another. After any infrastructure-level fix (like I-03), re-run the full suite rather than assuming previously-green tests are still testing what they claim to. |

---

### I-05: Shared `navigateTo()` Helper Matches Layout Chrome Instead of Page Heading

| Aspect | Details |
|--------|---------|
| **Root Cause** | `MainLayout.tsx` renders a global header brand title as `<h2>Property Management</h2>` on **every** protected route, before the page's own content. The shared helper `navigateTo()` in `test-helpers.ts` asserted against `page.locator('h1, h2').first()` — combining both tag types meant it always matched the layout's `<h2>` brand title (which appears earlier in the DOM) instead of the page's actual `<h1>` heading. |
| **Error Symptom** | All 8 `dashboard.spec.ts` tests failed with `Expected substring: "Dashboard"` / `Received string: "Property Management"` — looked like a routing bug (wrong page rendered), but the page was actually correct; only the assertion's selector was wrong. |
| **Files Affected** | `e2e/utils/test-helpers.ts` (`navigateTo` function) — affects any spec file that calls it against a page under `MainLayout` |
| **Fix** | Changed the selector from `page.locator('h1, h2').first()` to `page.locator('h1').first()`, matching the pattern already used successfully elsewhere (e.g. `verifyTokenStored`, `AUTH-LOGIN-01`). Every feature page in this codebase uses `<h1>` for its real heading (`DashboardPage.tsx`, `PropertyListPage.tsx`, etc.) — only the layout chrome uses `<h2>`. |
| **Prevention** | When asserting on page headings for pages rendered inside a shared layout, always check what the layout itself renders first (`grep -n "<h1\|<h2" src/layouts/*.tsx`) before writing a combined-tag selector. Prefer the most specific tag (`h1`) over a broad combined selector (`h1, h2`) unless you've confirmed there's exactly one heading-level element on the page. |

---

### I-06: Strict Mode Violations in dashboard.spec.ts

| Aspect | Details |
|--------|---------|
| **Root Cause** | Same class of bug as C-06 below (pre-existing, documented pattern — just not applied consistently in `dashboard.spec.ts`). `page.locator('text=Overdue')` matched 3 elements (a stat-card label, an `<h3>Overdue Invoices</h3>`, and a table column header), and `page.locator('text=฿0')` matched 2 elements (the stat value and a "↓ ฿0.00" delta label). |
| **Error Symptom** | `strict mode violation: locator('text=Overdue') resolved to 3 elements` / same for `text=฿0` resolving to 2 elements. |
| **Files Affected** | `dashboard.spec.ts` (DASH-01, DASH-02) |
| **Fix** | Added `.first()` to both locators, per the existing C-06 pattern. |
| **Prevention** | No new prevention needed — this is exactly what C-06 already documents. Treat this as a reminder to actually apply documented patterns file-by-file rather than only when a test fails. |

---

### I-07: property-flow.spec.ts Rewritten — Wrong Page Model + Missing Component Audit

| Aspect | Details |
|--------|---------|
| **Root Cause** | The original `property-flow.spec.ts` (Session 1) had two compounding problems: (1) its `loginAsTestUser` helper filled the login form immediately with no hydration wait (the same C-09/I-0x-class bug found elsewhere), and (2) its "tab switching" test clicked a property card and then expected Contract/Meter tabs to appear immediately — but per component audit, `/property/:id` (`PropertyDetailPage.tsx`) has no tabs at all; the tabbed interface only exists one level deeper, on `/property/rooms/:id` (`RoomDetailPage.tsx`). The original file conflated the two pages because no component audit was done before writing the test (same class of mistake as B-05). |
| **Error Symptom** | All 5 original tests failed with `TimeoutError: locator.fill: Timeout 10000ms exceeded` waiting for `getByPlaceholder('you@example.com')`, so the page-model mistake was never even reached in practice. |
| **Files Affected** | `property-flow.spec.ts` |
| **Fix** | Rewrote the file from scratch using the shared `login()` / `captureAllStates()` helpers (fixing the hydration-wait bug) and the catch-all-first mock pattern (I-03), with a proper component audit against `PropertyListPage.tsx`, `PropertyDetailPage.tsx`, `RoomDetailPage.tsx`, and `api.ts` before writing any test. Result: full coverage of all 20 spec Test IDs (PROP-01~08, PROP-DET-01~06, ROOM-01~06), 23/23 passing. |
| **Component Audit Findings** | `PropertyListPage.tsx` has no search/filter/sort/pagination/delete controls (PROP-03~07 NOT IMPLEMENTED). `PropertyDetailPage.tsx` has no inline edit, add-building, delete-building, or tabs at all (PROP-DET-02~05 NOT IMPLEMENTED). `RoomDetailPage.tsx` fetches no real room data — Overview tab shows placeholder `—` values and a hardcoded "available" badge; Contract/Meter tabs are static "coming in Sprint 3/4+" placeholders with a disabled "Create Contract" button (ROOM-02~06 NOT IMPLEMENTED). A `useUpdateRoomStatus()` hook exists in `api.ts` but is never wired to any UI. |
| **Test Strategy for NOT IMPLEMENTED scenarios** | Per the `dashboard.spec.ts` precedent (see I-06 context), each NOT IMPLEMENTED scenario got a real, executable test that asserts the absence of the corresponding control (e.g. `expect(page.getByRole('button', { name: /delete/i })).toHaveCount(0)`) rather than being skipped or left NOT RUN — this keeps coverage honest and gives a regression signal if the feature is later added without updating the test. |
| **Prevention** | Always do the component audit (Article 4.1 Step 2 of `E2E_TEST_STRATEGY.md`) before writing a multi-page flow test — specifically, verify which page in the flow actually owns the behavior a scenario describes (tabs, edit controls, etc.), not just which page the spec loosely refers to. |

---

## Part B — Common Test Code Issues (Sprint 09)

> Historical log from Session 1 (2026-07-05 → 2026-07-06). These are per-file, style-level mistakes repeated across the original 7 spec files.

### C-01 / C-08 / C-10 / C-14: Mock API Response Missing `data` Wrapper

| Aspect | Details |
|--------|---------|
| **Root Cause** | Frontend `apiFetch` expects response format `{ data: { ... } }` but mocks returned raw objects |
| **Error Symptom** | Frontend fails to parse response, tokens not stored, user data missing |
| **Files Affected** | ALL test files (recurred again in Session 2 — see I-04) |
| **Fix** | Wrap all mock responses with `data` wrapper |

**❌ Wrong:**
```typescript
body: JSON.stringify({
  access_token: 'mock-token',
  refresh_token: 'mock-refresh',
  token_type: 'bearer'
})
```

**✅ Correct:**
```typescript
body: JSON.stringify({
  data: {
    access_token: 'mock-access-token',
    refresh_token: 'mock-refresh-token',
    token_type: 'bearer',
    user: { ... }
  }
})
```

---

### C-02 / C-12: Vite Dev Server Paths Intercepted by Mock API

| Aspect | Details |
|--------|---------|
| **Root Cause** | Catch-all `**/api/**` route intercepts Vite internal requests (`/@vite/`, `/@react-refresh`, `/src/`, `/@fs/`) |
| **Error Symptom** | Page loads empty HTML skeleton, React never hydrates, form not rendered |
| **Files Affected** | ALL test files with `page.route('**/api/**', ...)` |
| **Fix** | Use `**/api/v1/**` and exclude Vite paths |

**✅ Correct Pattern:**
```typescript
await page.route('**/api/v1/**', async (route) => {
  const url = route.request().url();
  // Skip Vite dev server internal routes
  if (url.includes('/@vite/') || url.includes('/@react-refresh') ||
      url.includes('/@fs/') || url.includes('/src/')) {
    return route.continue();
  }
  await route.fulfill({...});
});
```

> **Note (Session 2):** this exclusion logic is correct, but see I-03 — it must be the **first** `page.route()` call in the mock-setup function, not the last, or it will shadow the specific mocks below it.

---

### C-03: Hardcoded Wait Timeouts (Anti-pattern)

| Aspect | Details |
|--------|---------|
| **Root Cause** | Using `page.waitForTimeout(5000)` instead of Playwright's auto-waiting |
| **Error Symptom** | Tests are slow, flaky, timeout randomly |
| **Files Affected** | ALL test files |
| **Fix** | Use `expect(locator).toBeVisible({ timeout })` |

**❌ Wrong:**
```typescript
await page.waitForTimeout(5000);
await page.waitForSelector('input[placeholder="you@example.com"]', { timeout: 30000 });
```

**✅ Correct:**
```typescript
await expect(page.locator('input[placeholder="you@example.com"]').first())
  .toBeVisible({ timeout: 30000 });
```

---

### C-04: Incorrect Login Selectors (Placeholder Mismatch)

| Aspect | Details |
|--------|---------|
| **Root Cause** | Tests used old placeholders (`Username`, `Password`) but `LoginPage.tsx` uses email/password placeholders |
| **Error Symptom** | `locator.fill: Timeout` - element not found |
| **Files Affected** | ALL test files with login |
| **Fix** | Match exact placeholders from `LoginPage.tsx` |

**LoginPage.tsx Placeholders:**
```tsx
<Input placeholder="you@example.com" ... />        // Email
<Input placeholder="Enter your password" ... />   // Password
```

**❌ Wrong:**
```typescript
await page.getByPlaceholder('Username').fill('testuser');
await page.getByPlaceholder('Password').fill('Testpass123!');
```

**✅ Correct:**
```typescript
await page.locator('input[placeholder="you@example.com"]').first().fill('admin@example.com');
await page.locator('input[placeholder="Enter your password"]').first().fill('Admin123!');
```

---

### C-05 / C-11: Token Storage Key Mismatch (localStorage vs sessionStorage / wrong key name)

| Aspect | Details |
|--------|---------|
| **Root Cause** | Frontend uses `sessionStorage` with keys `pms_access_token` / `pms_refresh_token`, tests checked `localStorage.getItem('access_token')` |
| **Error Symptom** | Token verification fails, returns `null` |
| **Files Affected** | `auth-flow.spec.ts`, `property-flow.spec.ts` |
| **Fix** | Check `sessionStorage.getItem('pms_access_token')` / `sessionStorage.getItem('pms_refresh_token')` |

**❌ Wrong:**
```typescript
const accessToken = await page.evaluate(() =>
  localStorage.getItem('access_token'));
```

**✅ Correct:**
```typescript
const accessToken = await page.evaluate(() =>
  sessionStorage.getItem('pms_access_token'));
```

---

### C-06 / C-15: Multiple Elements Matching Selector (Strict Mode Violation)

| Aspect | Details |
|--------|---------|
| **Root Cause** | Selector matches multiple elements, Playwright strict mode throws error |
| **Error Symptom** | `strict mode violation: locator resolved to 2 elements` |
| **Files Affected** | `auth-flow.spec.ts`, `invoice-payment.spec.ts`, `dashboard.spec.ts` (see I-06) |
| **Fix** | Use `.first()` or more specific selector |

**❌ Wrong:**
```typescript
await expect(page.locator('text=/required|invalid/i')).toBeVisible();
```

**✅ Correct:**
```typescript
await expect(page.locator('text=/required|invalid/i').first()).toBeVisible();
```

---

### C-07: Login Credentials Don't Match Seed Data

| Aspect | Details |
|--------|---------|
| **Root Cause** | Tests used `testuser`/`Testpass123!` but seed uses `admin@example.com`/`Admin123!` |
| **Error Symptom** | Login fails with mock returning wrong user data |
| **Files Affected** | ALL test files |
| **Fix** | Use seed credentials from `seed_admin.py` |

**Seed Credentials (`backend/scripts/seed_admin.py`):**
```python
email = "admin@example.com"
password = "Admin123!"
```

---

### C-09: Login Form Wait Strategy Not Robust

| Aspect | Details |
|--------|---------|
| **Root Cause** | No wait for form hydration before filling credentials |
| **Error Symptom** | `locator.fill: Timeout` - form not ready |
| **Files Affected** | ALL test files with login |
| **Fix** | Wait for `domcontentloaded` + `networkidle` + element visibility |

**✅ Correct Login Pattern:**
```typescript
async function login(page: Page): Promise<void> {
  await page.goto('/login');

  // Wait for React app to hydrate
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle');

  // Wait for form elements
  await expect(page.locator('input[placeholder="you@example.com"]').first())
    .toBeVisible({ timeout: 30000 });
  await expect(page.locator('input[placeholder="Enter your password"]').first())
    .toBeVisible({ timeout: 30000 });

  // Fill and submit
  await page.locator('input[placeholder="you@example.com"]').first().fill(email);
  await page.locator('input[placeholder="Enter your password"]').first().fill(password);
  await page.getByRole('button', { name: /sign in|log in|login|submit/i }).click();

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
}
```

---

### C-13: Hardcoded Credentials in Multiple Test Files

| Aspect | Details |
|--------|---------|
| **Root Cause** | Credentials scattered across files, inconsistent with seed |
| **Fix** | Define `TEST_USER` constant at top of each file |

```typescript
const TEST_USER = {
  email: 'admin@example.com',
  password: 'Admin123!',
};
```

---

## Part C — File-Specific Issues & Fixes

### auth-flow.spec.ts

| Issue | Fix Applied |
|-------|-------------|
| C-01, C-08: Mock auth response missing `data` wrapper | Added `data` wrapper with user object |
| C-02: Vite paths intercepted | Added Vite path exclusion in catch-all |
| C-03: `waitForTimeout` anti-pattern | Replaced with `expect().toBeVisible({ timeout })` |
| C-04: Wrong placeholder selectors | Updated to match `LoginPage.tsx` placeholders |
| C-05: Wrong token storage key | Changed to `sessionStorage.getItem('pms_access_token')` |
| C-06: Strict mode violation | Used `.first()` for text locators |
| C-07: Wrong credentials | Updated to `admin@example.com` / `Admin123!` |
| C-09: Poor login wait strategy | Added proper wait for form hydration |
| C-13: Hardcoded credentials | Defined `TEST_USER` constant |
| **I-02 (Session 2):** Two unclosed `test.describe` blocks | Added missing `});` to close Login and Register describes |
| **I-03 (Session 2):** Catch-all shadowing Register describe's mocks | Moved catch-all to top of Register `beforeEach` |
| Added | Validation error test, wrong password test |
| Improved | Login helper function for reuse |

---

### invoice-payment.spec.ts

| Issue | Fix Applied |
|-------|-------------|
| C-01, C-08: Mock auth response missing `data` wrapper | Added `data` wrapper with user object |
| C-02: Vite paths intercepted | Added Vite path exclusion in catch-all |
| C-04: Wrong placeholder selectors | Updated to match `LoginPage.tsx` |
| C-07: Wrong credentials | Updated to seed credentials |
| C-09: Poor login wait strategy | Added proper wait for form hydration |
| C-13: Hardcoded credentials | Centralized `TEST_USER` constant |
| **I-03 (Session 2):** Catch-all shadowing all specific mocks | Moved catch-all to top of `mockInvoiceApis` |
| Added | Vite path exclusion in catch-all route |

---

### meter-offline-sync.spec.ts

| Issue | Fix Applied |
|-------|-------------|
| C-01, C-08: Mock auth response missing `data` wrapper | Added `data` wrapper with user object |
| C-02: Vite paths intercepted | Added Vite path exclusion in catch-all |
| C-04: Wrong placeholder selectors | Updated to match `LoginPage.tsx` |
| C-07: Wrong credentials | Updated to seed credentials |
| C-09: Poor login wait strategy | Added proper wait for form hydration |
| C-13: Hardcoded credentials | Centralized `TEST_USER` constant |
| **I-03 (Session 2):** Catch-all shadowing all specific mocks | Moved catch-all to top of `mockMeterApis` |
| Improved | Login helper function with proper wait strategy |

---

### maintenance-flow.spec.ts

| Issue | Fix Applied |
|-------|-------------|
| C-01, C-08: Mock auth/me response missing `data` wrapper | Added `data` wrapper |
| C-02: Vite paths intercepted | Added Vite path exclusion in catch-all |
| C-07: Wrong credentials | Updated to seed credentials |
| C-09: Poor login wait strategy | Added proper wait for form hydration |
| Fixed | Syntax error from malformed route handler |
| Fixed | Typo `status: 20: 201` → `status: 201` |
| **I-01 (Session 2):** File saved with `600` permissions | `chmod 644` |
| **I-02 (Session 2):** Extra `});` after an `if` block (unbalanced braces) | Changed to `}` to close only the `if` block |
| **I-03 (Session 2):** Catch-all shadowing all specific mocks | Moved catch-all to top of `mockMaintenanceApis` |

---

### contract-flow.spec.ts

| Issue | Fix Applied |
|-------|-------------|
| C-01, C-08 Mock auth/me response missing `data` wrapper | Added `data` wrapper |
| C-02 Vite paths intercepted | Added Vite path exclusion in catch-all |
| C-07 Wrong credentials | Updated to seed credentials |
| C-09 Poor login wait strategy | Added proper wait for form hydration |
| **I-01 (Session 2):** File saved with `600` permissions | `chmod 644` |
| **I-02 (Session 2):** Duplicated/misplaced closing paren in `/auth/me` mock | Rewrote the route handler with balanced parens |
| **I-03 (Session 2):** Catch-all shadowing all specific mocks | Moved catch-all to top of `mockContractApis` |
| **I-04 (Session 2):** Login mock missing `data` wrapper (unmasked by I-03 fix) | Wrapped response in `{ data: { ... } }`, added `user` object |

---

### property-flow.spec.ts

| Issue | Fix Applied |
|-------|-------------|
| C-07 Wrong credentials in mock login response | Updated to `admin@example.com` |
| C-07 Wrong credentials in login helper | Updated to `admin@example.com` / `Admin123!` |
| **I-03 (Session 2):** Catch-all shadowing all specific mocks | Moved catch-all to top of `mockAllApis` |
| **I-07 (Session 2):** File rewritten for full spec coverage | See I-07 below — file only had 5 untagged tests covering a fraction of PROP/PROP-DET/ROOM scenarios and used a broken login helper (C-09); rewritten from scratch with all 20 Test IDs (PROP-01~08, PROP-DET-01~06, ROOM-01~06) plus 3 cross-cutting checks, 23/23 passing |

---

### a11y.spec.ts

| Issue | Fix Applied |
|-------|-------------|
| C-04 Wrong placeholder selectors | Updated to match `LoginPage.tsx` placeholders |
| C-07 Wrong credentials | Updated to seed credentials |
| **I-03 (Session 2):** Catch-all shadowing all specific mocks | Moved catch-all to top of `mockAllApis` |
| **I-04 (Session 2):** Login mock missing `data` wrapper + missing `/auth/me` mock (unmasked by I-03 fix) | Wrapped login response in `{ data: { ... } }`, added `user` object, added `/auth/me` mock |

---

### dashboard.spec.ts (created Session 1, fixed Session 2)

| Issue | Fix Applied |
|-------|-------------|
| **I-01 (Session 2):** File saved with `600` permissions | `chmod 644` |
| **I-03 (Session 2):** `setupDashboardMocks`'s own catch-all registered last, shadowing dashboard-specific mocks | Moved catch-all to top of `setupDashboardMocks` |
| **I-05 (Session 2):** Shared `navigateTo()` matched layout's `<h2>Property Management</h2>` instead of page's `<h1>Dashboard</h1>` | Fixed in shared helper (`test-helpers.ts`), see I-05 |
| **I-06 (Session 2):** Strict mode violations — `text=Overdue` (3 matches), `text=฿0` (2 matches) | Added `.first()` to both locators |

---

### e2e/utils/ (mock-helpers.ts, state-capture.ts, test-helpers.ts)

| Issue | Fix Applied |
|-------|-------------|
| **I-01 (Session 2):** All three files saved with `600` permissions | `chmod 644` |
| **I-03 (Session 2):** `setupAuthFlowMock` and `setupRegisterFlowMocks` registered their catch-all last | Moved catch-all to top of both functions in `mock-helpers.ts` |
| **I-05 (Session 2):** `navigateTo()` used `'h1, h2'` combined selector | Changed to `'h1'` only in `test-helpers.ts` |

---

## Part D — Agent Behavior Errors (Decision/Logic/Process)

> **Purpose:** Document agent's own decision/logic/behavior errors (not test file bugs) to prevent recurrence.
> **Scope:** Wrong decisions, wrong assumptions, skipped steps, violated protocols, not following specs.

### B-01: Did Not Follow features-to-test.md Specification

| Aspect | Details |
|--------|---------|
| **Date** | 2026-07-06 |
| **Error Type** | Process/Decision Error — Failed to follow specification |
| **Specification** | `docs/sprints/features-to-test.md` |
| **What Happened** | Agent executed tests in ad-hoc order instead of following the specified Execution Priority Order (1→8). Created test files as "smoke tests" (24 scenarios) instead of comprehensive tests per route (~230 scenarios). |
| **Specification Violated** | `features-to-test.md` lines 419-428: **Test Execution Order (Priority)** — 8 priority groups must be executed sequentially. |
| **Impact** | - Coverage: 10.4% (24/230 scenarios) vs 100% target<br>- Wrong priority: Property before Billing, skipped Dashboard entirely<br>- Missing test files for 10+ routes<br>- Test count: 24 vs 230 scenarios (91% gap) |
| **Root Cause** | Agent assumed "smoke tests first" approach without confirming with human. Did not read/verify execution order in spec before starting. |
| **Correct Behavior** | 1. Read `features-to-test.md` Execution Order section FIRST<br>2. Create test files per route per Test IDs<br>3. Execute strictly in Priority Order (1→8)<br>4. Stop on P0 blocking bug per spec |
| **Prevention** | - Always read spec FIRST before any implementation<br>- Verify execution order with human if unclear<br>- Create checklist from spec before starting<br>- Track coverage against spec targets |

---

### B-02: Created "Smoke Tests" Instead of Comprehensive Tests

| Aspect | Details |
|--------|---------|
| **Date** | 2026-07-06 |
| **Error Type** | Scope/Decision Error — Wrong test strategy |
| **What Happened** | Created minimal "smoke test" files (1-3 tests/file) instead of comprehensive test coverage per route as specified in `features-to-test.md` Test Breakdown by Route. |
| **Spec Requirement** | Each route has 5-20 detailed Test IDs with specific scenarios (Happy Path, Negative, Edge Case, Security, Integration, etc.) |
| **What Was Delivered** | 7 test files, 24 test cases total (avg 3/file) vs ~230 scenarios required |
| **Gap** | 91% of scenarios not implemented; missing test files for 10+ routes |
| **Root Cause** | Agent chose "smoke test first" strategy without explicit approval. Misunderstood "E2E Campaign" as smoke tests. |
| **Correct Behavior** | Implement full Test ID coverage per route per spec before execution. |
| **Prevention** | - Map Test IDs to test cases 1:1 before coding<br>- Use spec as checklist, not as loose guide<br>- Track scenario coverage per route |

---

### B-03: Did Not Follow Priority Execution Order

| Aspect | Details |
|--------|---------|
| **Date** | 2026-07-06 |
| **Error Type** | Process Error — Violated execution sequence |
| **Spec Order** | 1. P0 Auth (2 routes) → 2. P0 Billing (2 routes) → 3. P0 Property (3 routes) → 4. P0 Dashboard (1 route) → 5. P0 Tenants/Meter/Invoices/Reports (4 routes) → 6. P1 Contract (3 routes) → 7. P1 Maintenance (2 routes) → 8. P1 Settings (1 route) |
| **Actual Order** | Auth → Property → Invoice → Meter → (skipped Dashboard, Tenants, Reports) → Maintenance → Contract |
| **Violations** | - Property (P0) before Billing (P0) ✗<br>- Dashboard (P0) completely skipped ✗<br>- Tenants/Reports (P0) skipped ✗<br>- Maintenance (P1) before Contract (P1) ✗ |
| **Impact** | Critical path (Billing, Dashboard) not validated; P0 bugs could go undetected |
| **Root Cause** | Agent picked "easier" routes first (Property has existing test file) instead of following priority. |
| **Prevention** | - Strict sequential execution per spec<br>- Cannot start Priority N until Priority N-1 complete<br>- Visual checklist of priority gates |

---

### B-04: Did Not Create Test Files for Missing Routes

| Aspect | Details |
|--------|---------|
| **Date** | 2026-07-06 |
| **Error Type** | Incomplete Deliverable |
| **Missing Test Files** | `/dashboard`, `/tenants`, `/reports`, `/property/detail/:id`, `/auth/register`, `/contracts`, `/contracts/new`, `/contracts/:id`, `/maintenance`, `/maintenance/new`, `/settings` |
| **Spec Coverage** | 11 routes (50%) have no test file at all |
| **Impact** | 0% coverage for Group 3 (Phase 4), 0% for Dashboard/Tenants/Reports |
| **Root Cause** | Agent only worked with existing test files; did not create new ones per spec. |
| **Prevention** | - Audit existing test files vs spec routes before starting<br>- Create missing test files as first step<br>- Track file creation against spec route list |

---

### B-05: Incomplete Codebase Audit Before Planning (Failed Comprehensive Audit)

| Aspect | Details |
|--------|---------|
| **Date** | 2026-07-06 |
| **Error Type** | Process/Decision Error — Failed to perform comprehensive codebase audit before planning and implementation |
| **What Happened** | Agent assessed `auth-flow.spec.ts` compliance against `E2E_TEST_STRATEGY.md` by only comparing test structure, imports, and patterns. Did NOT cross-reference with actual frontend component implementations (`LoginPage.tsx`, `RegisterPage.tsx`). Result: False "90% compliant" assessment. |
| **Specification Violated** | `E2E_TEST_STRATEGY.md` Article 1.2: **Specification-First, Execution-Second** — "NO test code written before reading the relevant specification" AND Article 3.2: Test files must match actual component behavior |
| **Impact** | - Planned fixes based on wrong assumptions (remember me checkbox, email field in register)<br>- Would have written failing tests that don't match actual UI<br>- Wasted iteration cycles on trial-and-error debugging |
| **Root Cause** | Agent treated "Strategy compliance" as structural patterns only. Skipped the mandatory step: **read and understand the actual component implementation** before writing/updating tests. Assumed features-to-test.md placeholders matched components without verification. |
| **Correct Behavior** | Before ANY test planning/assessment: 1) Read ALL relevant component source files (LoginPage.tsx, RegisterPage.tsx, etc.) 2) Map actual placeholders, fields, validation behavior, UI elements 3) Cross-reference with features-to-test.md Test IDs 4) Only then assess compliance or write tests |
| **Prevention** | - **MANDATORY PRE-REQUISITE:** Before test planning → Read component source files<br>- Add "Component Audit" step to all test planning workflows<br>- Never assume spec matches implementation — verify<br>- Checklist: [ ] Read LoginPage.tsx [ ] Read RegisterPage.tsx [ ] Map fields/placeholders/validation [ ] Cross-ref features-to-test.md |

---

### B-06: (Session 1) Diagnosis Stalled for 5+ Hours Without Escalating

| Aspect | Details |
|--------|---------|
| **Date** | 2026-07-06 |
| **Error Type** | Process Error — Did not escalate or change approach when stuck |
| **What Happened** | Prior agent session (nemotron-3-ultra) spent ~5 hours attempting to fix the E2E suite without making the suite runnable, and without surfacing that the blocker was infrastructure-level (permissions/syntax/mock ordering) rather than test-logic-level. The user had to interrupt and ask a different agent to diagnose from scratch. |
| **Impact** | 5 hours of session time with no forward progress visible to the user. |
| **Root Cause** | Likely iterated on symptom-level fixes (individual assertion failures) without first verifying the suite could execute at all (`tsc --noEmit`, checking file permissions, checking container logs for `EACCES`/`SyntaxError` before test output). |
| **Correct Behavior** | When a test suite produces no output or fails uniformly across many files, verify the **collection/build step** first (`tsc --noEmit`, file permissions, container logs) before debugging individual test logic. If stuck for a long period without measurable progress, surface that explicitly to the user rather than continuing to iterate silently. |
| **Prevention** | Before debugging individual test failures: 1) Confirm the test runner can collect all files without error 2) Confirm file permissions are correct for the execution environment (e.g. containers with `cap_drop`) 3) If 30+ minutes pass with no passing test and no clear diagnosis, stop and report status rather than continuing to iterate. |

---

## Part E — Best Practices Checklist

### Mock API Setup

- [ ] **Catch-all registered FIRST**, specific mocks registered after (Playwright gives precedence to the most-recently-registered matching route — see I-03)
- [ ] All mock responses wrapped in `data` object
- [ ] Vite dev server paths excluded (`/@vite/`, `/@react-refresh`, `/@fs/`, `/src/`)
- [ ] Catch-all uses `**/api/v1/**` not `**/api/**`
- [ ] Auth mock responses include `data` wrapper with user object

### Login Flow

- [ ] Uses correct placeholders: `you@example.com` / `Enter your password`
- [ ] Uses seed credentials: `admin@example.com` / `Admin123!`
- [ ] Waits for `domcontentloaded` + `networkidle` before form interaction
- [ ] Uses `expect(locator).toBeVisible({ timeout })` not `waitForTimeout`
- [ ] Uses robust login helper function

### Selectors & Assertions

- [ ] Uses `.first()` for text locators that may match multiple
- [ ] Uses `getByRole` for buttons, `getByPlaceholder` for inputs
- [ ] Uses `expect(locator).toBeVisible({ timeout })` not `waitForTimeout`
- [ ] Uses `expect(locator).toContainText()` for text assertions
- [ ] When asserting page headings on a page rendered inside a shared layout, checked what heading tags the layout itself renders first (see I-05) — prefer `h1` only over combined `h1, h2` selectors

### Token Storage

- [ ] Checks `sessionStorage.getItem('pms_access_token')` / `sessionStorage.getItem('pms_refresh_token')`, not `localStorage`
- [ ] Mock auth response includes `data` wrapper with user object

### Credentials & Constants

- [ ] Defines `TEST_USER` constant at top of file
- [ ] Uses seed credentials: `admin@example.com` / `Admin123!`

### File & Environment Hygiene (Session 2 additions)

- [ ] New spec/util files saved with `644` permissions, not `600` (verify with `ls -la` before running in Docker — see I-01)
- [ ] Run `npx tsc --noEmit -p tsconfig.e2e.json` after editing any spec file, before running Playwright (catches unbalanced braces in seconds — see I-02)
- [ ] After any infrastructure-level fix, re-run the full suite rather than assuming previously-green tests are still valid (a fix in one place can unmask a bug elsewhere — see I-04)

### Process Discipline

- [ ] Read full spec FIRST — before any code, read entire `features-to-test.md`
- [ ] Map Test IDs — create 1:1 mapping of Test IDs → test cases
- [ ] Verify Order — confirm execution order with human if unclear
- [ ] Audit Coverage — compare existing test files vs spec routes
- [ ] Track Progress — update coverage table after each route
- [ ] Gate Check — cannot start Priority N until Priority N-1 complete
- [ ] Stop on P0 — stop immediately on P0 blocking bug per spec
- [ ] Component Audit — read `LoginPage.tsx`, `RegisterPage.tsx`, etc. — map actual fields, placeholders, validation, UI elements
- [ ] Cross-ref Spec vs Implementation — verify `features-to-test.md` Test IDs match actual component behavior before writing tests
- [ ] Never Assume — never assume spec placeholders match implementation, or that a passing test is testing the right thing — always verify
- [ ] If stuck for 30+ minutes with no measurable progress, verify the collection/build step is even working before continuing to debug test logic (see B-06)

---

## Part F — Fullstack Conversion (2026-07-06, Session 3)

> **Why this happened:** the entire suite (Parts A–E above) ran against `page.route()` mocks — Playwright never touched the real backend or database. That verifies the frontend renders correctly given a *hypothetical* API response, but proves nothing about whether the real backend actually returns that shape, whether the DB writes persist, or whether the two sides agree on URL paths, enums, or payload schemas. This session removed every mock and ran all 10 spec files (9 converted + `reports-flow.spec.ts` new) against the real FastAPI backend + real Postgres (seeded deterministically — see below), which surfaced 10 real bugs that 100% of the mocked suite had been "passing" straight through (or, for `/reports`, had never been tested at all).

### F-00: Infrastructure — Deterministic Seed Data + DB Reset

| Aspect | Details |
|--------|---------|
| **What was built** | `backend/scripts/seed_e2e.py` — idempotent seed script (`--reset` flag truncates only fixture-owned tables, never `users` wholesale). Uses `uuid.uuid5(fixed_namespace, name)` so the same IDs are deterministically reproducible from both Python (seed script) and TypeScript (`frontend/e2e/fixtures/seeded-ids.ts`) — no ID needs to be looked up at runtime. |
| **What it seeds** | 2 properties, 1 building, 2 rooms (one available, one occupied), 1 tenant, 1 active contract, 1 invoice, 1 maintenance request, 2 meter readings, 1 utility rate, plus the existing admin user and a new `inactive@example.com` user for the AUTH-LOGIN-07 scenario. |
| **Reset workflow** | `./scripts/reset-e2e-db.sh` wraps `docker compose exec backend python -m scripts.seed_e2e --reset` — run before every fullstack suite run so tests don't collide with leftover state from a prior run (e.g. duplicate meter readings triggering BR-07 conflicts). |
| **docker-compose.dev.yml changes** | `frontend-test.depends_on.backend.condition` changed from `service_started` to `service_healthy` (tests were starting before the backend's own DB migrations/health check completed); added `dev` to `profiles: [test, dev]` so `--profile dev run --rm frontend-test <playwright command>` works without also spinning up unrelated services. |

---

### F-01: Missing `session.commit()` in `get_db()` — No Write Ever Persisted (Most Severe Bug Found)

| Aspect | Details |
|--------|---------|
| **Root Cause** | `backend/app/shared/database.py`'s `get_db()` and `get_db_context()` dependency-injection generators both had docstrings claiming the session auto-commits on success, but neither function actually called `await session.commit()`. Every `POST`/`PATCH`/`DELETE` across the **entire backend** returned `201`/`200` as if it succeeded, but the transaction was implicitly rolled back (or left dangling) when the connection was returned to the pool — nothing was ever actually written to the database. |
| **Error Symptom** | Not caught by backend pytest (145 tests) because test fixtures override `get_db` via `app.dependency_overrides` with their own commit logic — the bug only manifests when hitting the real dependency-injected session through the actual HTTP stack. Surfaced in E2E as: create a contract via `POST /contracts` → 201 response → immediately navigate to `/contracts/{id}` → "Contract not found" (silently — the row was never there). |
| **Files Affected** | `backend/app/shared/database.py` — affects every single mutating endpoint in the app |
| **Fix** | ```python\nasync with async_session_maker() as session:\n    try:\n        yield session\n        await session.commit()\n    except Exception:\n        await session.rollback()\n        raise\n    finally:\n        await session.close()\n``` |
| **How it was found** | Contract-termination E2E test timed out waiting for a "Terminate" button that never rendered — traced to the detail page showing "Contract not found" right after a 201-response creation. Verified independently via `curl` (create, then immediately re-fetch — was 404, now works after the fix). |
| **Prevention** | Any dependency-injection session/unit-of-work wrapper needs an integration-level smoke test that exercises the *real* HTTP path end-to-end (exactly what this E2E fullstack conversion now does) — unit/integration tests that override the DB dependency cannot catch bugs in the dependency itself. |

---

### F-02: Missing `ToastProvider` in `App.tsx` — Crashed 8 Real Pages

| Aspect | Details |
|--------|---------|
| **Root Cause** | `ToastProvider` (from `src/shared/ui/Toast.tsx`) existed only inside unit-test render wrappers (`renderPage()` helpers in `*.test.tsx` files) — it was never mounted in the actual app (`App.tsx`). Any component calling `useToast()` threw `Error: useToast must be used within ToastProvider` the instant it rendered. |
| **Error Symptom** | Real, uncaught React error crashing the whole page to a blank screen on: `InvoiceListPage`, `InvoiceDetailPage`, `MaintenanceFormPage`, `SettingsPage`, `TenantListPage`, `ContractDetailPage`, `ContractFormPage`, `MeterReadingPage`. Previously masked because unit tests wrap in their own `ToastProvider`, and the mocked E2E suite's `invoice-payment.spec.ts` never actually inspected page content past the mock response (the earlier "passing" test only checked `page.locator('h1')` which, under mocks, coincidentally showed layout chrome or a stale render). |
| **Files Affected** | `frontend/src/App.tsx` |
| **Fix** | ```tsx\n<QueryClientProvider client={queryClient}>\n  <ToastProvider>\n    <AuthProvider>\n      <AppRoutes />\n    </AuthProvider>\n  </ToastProvider>\n</QueryClientProvider>\n``` |
| **How it was found** | `invoice-payment.spec.ts`'s fullstack conversion hit a blank page instead of the invoice list. Temporarily added `page.on('pageerror', console.log)` to the test, which surfaced the `useToast` error immediately. |
| **Prevention** | Any Context provider a component depends on via a custom hook (`useX()` that throws if `context === null`) needs to be verified present in the real app root, not just in test wrappers — a passing unit test proves the component works *given* the provider, not that the provider is actually mounted in production. |

---

### F-03: Frontend API Path Mismatches (billing, meter, maintenance)

| Aspect | Details |
|--------|---------|
| **Root Cause** | Frontend `api.ts` files called stale/guessed endpoint paths that didn't match the real backend router prefixes: `/meter-readings` → real path is `/billing/meter-readings`; `/invoices/*`, `/payments` → real paths are under `/billing/*`; `/maintenance-requests*` → real path is `/maintenance*`. |
| **Error Symptom** | Every request 404'd against the real backend (silently "worked" under mocks, since mocks match on whatever URL the test author guessed). |
| **Files Affected** | `frontend/src/features/billing/api.ts`, `frontend/src/features/meter/api.ts`, `frontend/src/features/maintenance/api.ts`, `frontend/src/shared/pwa/sync.ts` (background-sync path) |
| **Fix** | Corrected every path to match the real FastAPI router prefixes (verified via `grep` on the backend router files, not by guessing). |
| **Prevention** | When a frontend `api.ts` file is written before or independently of the backend router, its paths must be cross-checked against the actual `APIRouter(prefix=...)` declarations before being trusted — a mocked E2E test provides zero signal here since the mock's URL pattern and the frontend's fetch URL can both be independently wrong in the same way. |

---

### F-04: `useInvoices()` / Backend `list_invoices` Both Hardcoded Stubs

| Aspect | Details |
|--------|---------|
| **Root Cause** | Frontend `useInvoices()` hook was a hardcoded stub returning `[]` unconditionally (never called `apiFetch`). Independently, the backend's `list_invoices` router handler was also a stub — `return []` hardcoded, never querying the repository. Two independent stubs on both sides of the same feature, each looking superficially "complete." |
| **Error Symptom** | Invoice list always empty, no network request ever fired (frontend stub) — so even fixing one side alone would not have surfaced anything. |
| **Files Affected** | `frontend/src/features/billing/api.ts` (`useInvoices`), `backend/app/modules/billing/routers/billing_router.py` (`list_invoices`), `backend/app/modules/billing/repository.py`, `backend/app/modules/billing/services/billing_service.py` |
| **Fix** | Rewrote `useInvoices()` to perform a real fetch with an optional `propertyId` filter param. Added `repository.list_invoices(property_id)` and a `service.list_invoices()` wrapper, and wired the router handler to actually call them instead of returning a hardcoded `[]`. |
| **Prevention** | A stub that returns a valid-shaped empty response (`[]`, `{data: {}}`) is the hardest kind of bug for a mocked E2E test to catch, because the mock *is* effectively re-implementing the same stub on the test side. Only running against the real backend — where a real stub returns real (wrong) empty data instead of test-authored fake data — exposes this class of bug. |

---

### F-05: Backend `billing/schemas.py` Entirely Stale (Pre-UUID-Migration)

| Aspect | Details |
|--------|---------|
| **Root Cause** | The billing module's Pydantic schemas still used `invoice_month`/`invoice_year` field names and implied integer IDs, left over from before the codebase migrated primary keys to UUIDs. The real SQLAlchemy models and the rest of the billing module had already moved to `billing_month`/`billing_year` and UUID PKs — the schemas file was simply never updated to match. |
| **Error Symptom** | Every billing endpoint that touched these schemas (`GenerateInvoiceRequest`, meter reading create/response, invoice detail/list) would either fail validation or serialize the wrong field names. |
| **Files Affected** | `backend/app/modules/billing/schemas.py` (full rewrite), `backend/app/modules/billing/routers/billing_router.py` (fixed `generate_invoice` to pass `property_id` not `room_id`; fixed `record_payment` to wrap `Decimal(str(request.amount))`; added the missing `GET /invoices/{invoice_id}` detail route, which didn't exist at all before) |
| **Fix** | Rewrote all schema classes against the actual current SQLAlchemy models: `MeterReadingRequest`/`Response` (with `from_model()` classmethods), `GenerateInvoiceRequest` (`property_id`-based), `InvoiceResponse`/`InvoiceListResponse`/`InvoiceLineItemResponse`/`InvoiceDetailResponse`, `RecordPaymentRequest`/`PaymentResponse`, plus `{data, meta}` wrapper classes for each. |
| **Prevention** | A module whose DB models have migrated (e.g. int→UUID PKs, renamed columns) needs its Pydantic schemas audited in the same change — a schemas file can silently drift out of sync with its models for a long time if no test ever exercises the real serialization path (unit tests that construct Pydantic objects directly, bypassing the ORM row, won't catch this). |

---

### F-06: Tenant Creation Completely Broken — Pydantic `strict=True` Rejects String UUIDs

| Aspect | Details |
|--------|---------|
| **Root Cause** | `backend/app/modules/tenant/schemas.py`'s `CreateTenantRequest` had `model_config = ConfigDict(strict=True, extra="forbid")` with a bare `property_id: uuid.UUID` field. Pydantic v2 strict mode requires an already-parsed UUID *instance* for that type — but a JSON request body can only ever contain a UUID as a *string*, never as a Python object. Every real POST to `/tenants/` — for every client that has ever existed — returned `422 Input should be an instance of UUID`. |
| **Error Symptom** | `tenant-flow.spec.ts`'s TENANT-02 create-tenant test failed with a 422 the frontend surfaced as a generic error toast. Reproduced independently via `curl -X POST .../tenants/ -d '{"property_id":"<valid-uuid-string>",...}'` — confirmed this had nothing to do with the frontend at all. |
| **Files Affected** | `backend/app/modules/tenant/schemas.py` |
| **Fix** | `property_id: uuid.UUID = Field(strict=False)` — overrides the model-level `strict=True` for just this field, since Pydantic v2 supports per-field strict overrides. Verified backend's 12 tenant-module pytest tests still pass (they construct the Pydantic model directly with already-parsed UUID objects, so they never exercised the JSON-string path that broke in production). |
| **Prevention** | `ConfigDict(strict=True)` combined with any `uuid.UUID` / `datetime` / other type that Pydantic normally coerces from a string is a landmine — strict mode is usually desirable for `extra="forbid"` and preventing implicit type coercion bugs, but any ID field taking input from an HTTP JSON body needs `Field(strict=False)` explicitly, or the endpoint is unusable by definition. Grep every module for `strict=True` combined with a bare `uuid.UUID` field in a *request* schema (not response schema, where the ORM already gives a real UUID object) after any schema change. |

---

### F-07: `MeterReadingPage.tsx` — Duplicate Auto-Generated `id` Silently Loses Water Meter Values

| Aspect | Details |
|--------|---------|
| **Root Cause** | The shared `Input` component (`src/shared/ui/Input.tsx`) auto-generates a DOM `id` from the `label` prop (`input-${label.toLowerCase().replace(/\s+/g, '-')}`) when no explicit `id` is passed. `MeterReadingPage.tsx` renders two "Previous Reading"/"Current Reading" pairs (an Electric Meter card and a Water Meter card) without explicit `id`s, so all four ended up with only two distinct (duplicated) DOM ids. A `<label for="dup-id">` resolves its accessible name to the *first* element in the DOM with that id — so both the Electric and Water "Current Reading" labels bound to the same (Electric) input, and the Water input became an orphaned, unlabelled field. |
| **Error Symptom** | Filling the form (even manually, or by any test using `getByLabel('Current Reading').last()`) silently overwrote the Electric input's value instead of reaching the Water input — the Water reading submitted was always whatever its untouched default was, and the Electric reading ended up as whatever was typed last across both label matches. This is also a real accessibility bug: a sighted mouse user clicking the "Current Reading" label in the Water Meter card would focus/jump to the Electric input instead. |
| **Files Affected** | `frontend/src/features/meter/MeterReadingPage.tsx` |
| **Fix** | Added explicit unique `id`s: `electric-previous-reading`, `electric-current-reading`, `water-previous-reading`, `water-current-reading`. |
| **How it was found** | `meter-offline-sync.spec.ts`'s fullstack conversion showed the sticky summary computing `Electric: 50.0 units, Water: 0.0 units` from form input that should have produced `Electric: 100.0, Water: 50.0` — dumped actual DOM input values via `page.locator('input').evaluateAll(...)` to confirm both "Current Reading" fields held the same (wrong) value. |
| **Prevention** | Any shared form-input component that auto-derives an `id` from a `label` string must document that duplicate labels on the same page **will** collide — either dedupe automatically (e.g. append a counter) or require an explicit `id` whenever the same label text appears more than once in one form. |

---

### F-08: Offline Meter-Reading Submission Hung Forever (Two Stacked Bugs)

| Aspect | Details |
|--------|---------|
| **Root Cause (bug 1)** | `useRecordMeterMutation()` (TanStack Query `useMutation`) had no `networkMode` override, so it inherited the client default of `'online'`. TanStack Query's online-mode mutations are **paused** — `mutationFn` is never even invoked — while `navigator.onLine` reports false. But `mutationFn` here is exactly the code that's supposed to detect the offline case and fall back to the IndexedDB queue — so the offline path could structurally never run; the mutation just sat paused forever, no network request, no error, no state change, nothing. |
| **Root Cause (bug 2)** | Even after fixing bug 1, `registerMeterSync()` (`src/shared/pwa/sync.ts`) awaited `navigator.serviceWorker.ready`, a promise that only resolves once a service worker has *activated* for the page. **No code anywhere in the app ever calls `navigator.serviceWorker.register()`** — so in production, exactly like in the test environment, this promise never resolves, and the whole offline-submit flow hangs indefinitely on every real offline submission, not just in tests. |
| **Error Symptom** | Test timed out waiting for either the "Save Offline" button label or the "pending sync" toast — no JS errors, no console errors, no network requests fired at all (confirmed via `page.on('request', ...)` — zero requests logged after clicking submit). |
| **Files Affected** | `frontend/src/features/meter/api.ts` (`useRecordMeterMutation`), `frontend/src/shared/pwa/sync.ts` (`registerMeterSync`) |
| **Fix** | (1) Added `networkMode: 'always'` to the mutation so `mutationFn` always runs regardless of connectivity state — the offline-detection logic already lives inside `mutationFn` itself and needs the chance to execute. (2) Changed `registerMeterSync()` to use `navigator.serviceWorker.getRegistration()` (resolves immediately, possibly to `undefined`) instead of `.ready`, and bail out early if there's no active registration. |
| **How it was found** | Diagnosed by adding temporary `console.log('DEBUG onSubmit called', ...)` inside `MeterReadingPage.tsx`'s submit handler forwarded to the Node test process via `page.on('console', ...)` — confirmed `onSubmit` *was* called with correct data, but nothing downstream ever executed, isolating the hang to inside `recordMeter.mutateAsync(...)` itself rather than the form or validation layer. |
| **Prevention** | Any TanStack Query mutation whose `mutationFn` contains its own offline-handling logic (rather than relying on the library's built-in offline queue) **must** set `networkMode: 'always'`, or the library's own network-awareness will preempt the custom logic before it ever runs. Separately: `navigator.serviceWorker.ready` should never be awaited unconditionally — always check `getRegistration()` first, since `.ready` blocks forever in any environment (including real users on first load, before the SW has activated) where no SW has registered yet. |

---

### F-09: `frontend-test` Container's `test-results` tmpfs Too Small for a Full-Suite Run (`ENOSPC`)

| Aspect | Details |
|--------|---------|
| **Root Cause** | `docker-compose.dev.yml`'s `frontend-test` service mounts `/app/test-results` as a 100M tmpfs. `playwright.config.ts` sets `trace: 'on'` unconditionally (not `retain-on-failure`), so every one of the 83 tests in a full-suite run writes a full trace zip, not just failures. At full-suite scale this exceeded 100M mid-run. |
| **Error Symptom** | `Error: ENOSPC: no space left on device, write` — failed exactly one test (whichever happened to be running when the tmpfs filled), with no relation to that test's own logic. Host disk itself had hundreds of GB free; this was purely the container's tmpfs cap. |
| **Files Affected** | `docker-compose.dev.yml` |
| **Fix** | Bumped the tmpfs `size` from `100M` to `1G`. |
| **Prevention** | If a suite grows large enough to run 50+ tests with always-on tracing, either size the tmpfs with headroom for that (what was done here) or switch `trace` to `retain-on-failure` to bound artifact volume by failure count instead of total test count. |

---

### F-10: `/reports` — Revenue Report Crashed With 500 (Two Stacked Backend Bugs) + Frontend Contract Drift

| Aspect | Details |
|--------|---------|
| **Root Cause (bug 1)** | `backend/app/modules/dashboard/repository.py::get_revenue_report()` built the `period` column with `func.cast(Invoice.billing_year, func.String)` — `func.String` calls a nonexistent SQL function `STRING()` rather than referencing SQLAlchemy's `String` type. This broke SQLAlchemy's query cache-key generation (`AttributeError: ... no attribute '_static_cache_key'`), crashing every `GET /dashboard/revenue` call (which `/reports`'s Revenue chart depends on) with a 500. |
| **Root Cause (bug 2)** | Once bug 1 was fixed, a second latent bug surfaced: the "outstanding" aggregate filtered `Invoice.status.in_(["sent", "overdue"])`, but `"sent"` is not a valid value of the real `invoice_status_enum` (valid values: `draft/issued/paid/partial/overdue/cancelled`) — Postgres rejected the query with `InvalidTextRepresentationError`. |
| **Root Cause (bug 3, pre-existing, same function)** | The multi-year date-range filter used a Python-level ternary — `Invoice.billing_month >= start_date.month if start_date.year == end_date.year else True` — which fed a raw Python `True` into a SQLAlchemy `.where()` clause for any cross-year range (silently matching everything), and even in the same-year case never bounded the *upper* month, so the query over-selected regardless of `end_date`. |
| **Root Cause (frontend contract drift)** | `frontend/src/features/reports/api.ts`'s `useOverdueReport()` read `summary.overdue_invoices`, a field that has never existed on the real `/dashboard/summary` response (real field: `overdue_count`) — always rendering `undefined` in the Overdue Summary chart. Separately, the entire revenue-report contract (`frontend/src/types/api.d.ts`, `RevenueChart.tsx`, `reports/utils/export.ts`, and the MSW `mocks/handlers.ts` fixture) was built around fields that only ever existed in the mock (`month`/`year`/`revenue`/`expenses`/`net`) — the real backend returns `period`/`collected`/`outstanding`/`total_billed`. Every one of these files had independently drifted from the real API with no test ever exercising the real response shape. |
| **Error Symptom** | Navigating to `/reports` at all crashed with a 500 on page load (every test in `reports-flow.spec.ts` hits this on `beforeEach`); after the first two backend fixes, the page loaded but the Overdue Summary chart showed `NaN`/`undefined` instead of `0`. |
| **Files Affected** | `backend/app/modules/dashboard/repository.py`; `frontend/src/features/reports/api.ts`, `ReportsPage.tsx`, `components/RevenueChart.tsx`, `utils/export.ts`; `frontend/src/types/api.d.ts`; `frontend/src/mocks/handlers.ts` |
| **Fix** | `func.cast(col, String)` (real type, imported from `sqlalchemy`) instead of `func.String`; status filter uses `InvoiceStatus.ISSUED/PARTIAL/OVERDUE` enum members; date range uses a correct `(billing_year*12 + billing_month)` bounded comparison instead of the Python ternary. Frontend: `useOverdueReport()` reads `overdue_count`; `RevenueMetricResponse` type, `RevenueChart.tsx`, `export.ts`, and the MSW mock fixture all aligned to the real `period/collected/outstanding/total_billed` shape. |
| **How it was found** | Writing `frontend/e2e/specs/reports-flow.spec.ts` against the real backend — the very first navigation to `/reports` 500'd, which a mocked test could never have caught since the mock fixture itself encoded the same wrong contract the frontend expected. |
| **Prevention** | Same lesson as F-04/F-05: a mock fixture and the frontend code it's paired with can drift from the real backend identically and in lockstep, so a mocked test passing proves nothing about the real contract — only running against the real backend forces the two sides back into agreement. Also: `func.<TypeName>` vs. importing the actual type (`from sqlalchemy import String`) is an easy typo in SQLAlchemy `cast()`/`func` code — grep for `func\.[A-Z]` patterns being passed as a type argument to `cast()` after any schema change. |

---

### F-11: Meter Reading — One Real Backend Rule Untested (METER-03), One Client-Side-Only (METER-04), Three Spec Scenarios Don't Exist (METER-05/06)

| Aspect | Details |
|--------|---------|
| **Investigation** | `backend/app/modules/billing/services/billing_service.py::record_meter_reading()` (BR-07) enforces two real rules: a decreased-reading rejection (400, code `BILL-001`) and a duplicate-reading-per-room-per-period rejection (409, code `BILL-002`). Only the duplicate check (METER-03) was actually untested backend behavior — the decreased-reading check (METER-04) is **also** independently enforced client-side by `useMeterForm.ts`'s zod `.refine()` (`electric_current >= electric_previous`), which fires before any network request. The frontend's own validation short-circuits the flow, so METER-04 never actually reaches — and never tests — the backend's BILL-001 check; it tests client-side validation instead. Both are real, previously-uncovered behavior, but they exercise two different layers. |
| **METER-05 (auto-generate invoice)** | Confirmed `record_meter_reading()` has no side effect that generates an invoice — invoice generation is a separate, unrelated, property-level endpoint (`generate_monthly_invoice`). This scenario does not exist in the app; the test suite asserts its absence rather than skipping it silently. |
| **METER-06a (bulk import)** | Grepped the entire `frontend/src/features/meter` tree — no bulk-import UI, no CSV/file-upload control anywhere. Does not exist; asserted absent. |
| **METER-06b (reading history)** | The backend has a real `get_meter_reading_history` endpoint, and the frontend even has a `meterKeys.history(roomId)` query-key factory sitting in `api.ts` — but no hook or component anywhere ever calls it. Dead, unwired code, the same pattern as `useUpdateRoomStatus()` in the property module. Asserted absent. |
| **Files Affected** | `frontend/e2e/specs/meter-offline-sync.spec.ts` (added METER-03~06 test coverage) |
| **Prevention** | When a spec lists a Test ID and the backend already enforces the corresponding rule, the gap is in test coverage, not application code — write the real test rather than assuming every uncovered Test ID implies a missing feature. But also check for client-side duplication of the same rule (as here) — if a frontend validator enforces the identical constraint, a test aimed at "backend validation" may actually only ever exercise the frontend layer, silently leaving the backend rule untested. Always verify against the live component/service before assuming a Test ID's scenario exists at all (METER-05/06 here) — the codebase has several dead/unwired backend endpoints with no frontend consumer. |

---

### F-12: `fetchClient.ts` Never Parsed FastAPI's Native `{detail: ...}` Error Format — Every Pydantic Validation Error App-Wide Showed "An unexpected error occurred"

| Aspect | Details |
|--------|---------|
| **Root Cause** | `frontend/src/shared/api/fetchClient.ts::createApiError()` only ever parsed the app's own custom error envelope, `{ error: { code, message, details } }`. But any error raised at the Pydantic *schema validation* layer (before an endpoint's own code runs — e.g. a `field_validator`/model-level `ValueError` on request body fields) is handled by FastAPI itself, not by the app's custom exception handler, and comes back as `{ detail: "message" }` (single error) or `{ detail: [{ msg: "Value error, ...", ... }, ...] }` (validation error list) — a structurally different shape `createApiError()` had no branch for. Every such response silently fell through to the generic fallback message. |
| **Error Symptom** | Any request that failed Pydantic-level validation — discovered via METER-04 (`electric_current <= electric_previous`, a model-level validator) — showed a generic "An unexpected error occurred" toast instead of the real validation message, everywhere in the app, not just meter reading. This is a distinct bug from F-06 (tenant `strict=True`) and F-05 (stale billing schemas): those were backend bugs that produced the *wrong* response; this is a frontend bug that mishandles an entire class of *correct* backend responses. |
| **Files Affected** | `frontend/src/shared/api/fetchClient.ts` |
| **Fix** | Added branches to `createApiError()`: if the custom `{ error: ... }` envelope isn't present, check for a string `detail` (FastAPI's single-message HTTPException shape) or an array `detail` (FastAPI's validation-error-list shape, joining each item's `msg` field) before falling back to the generic message. Verified no regression: all 73 frontend unit tests and the full 97-scenario fullstack E2E suite still pass. |
| **How it was found** | Writing METER-04 (`current <= previous` validation) against the real backend — the toast never showed the expected "Value error, Current electric reading must be greater than previous" message text until this fix. |
| **Prevention** | Any frontend HTTP client wrapping FastAPI must handle both of FastAPI's native error shapes (`detail` as string or array) *in addition to* whatever custom envelope the app's own exception handlers produce — Pydantic schema-level validation failures bypass custom exception handlers entirely and always use FastAPI's native shape, regardless of how consistent the rest of the API is. |

---

### Real-Bug vs. Test-Bug Summary (Session 3)

| # | Bug | Class | Severity |
|---|-----|-------|----------|
| F-01 | `get_db()` never commits — no write ever persisted anywhere in the app | Backend | Critical |
| F-02 | Missing `ToastProvider` in `App.tsx` — crashes 8 real pages | Frontend | Critical |
| F-03 | Frontend API paths didn't match real backend routes (billing/meter/maintenance) | Frontend | High |
| F-04 | `useInvoices()` + backend `list_invoices` both hardcoded stubs | Both | High |
| F-05 | `billing/schemas.py` stale pre-UUID-migration | Backend | High |
| F-06 | Tenant creation always 422s — Pydantic strict mode rejects string UUIDs | Backend | Critical |
| F-07 | Duplicate auto-generated `id`s silently lose Water Meter form values | Frontend | High |
| F-08 | Offline meter-reading submission hangs forever (2 stacked bugs) | Frontend | Critical |
| F-09 | Test infra tmpfs too small for full-suite trace volume | Test infra | Low |
| F-10 | `/reports` Revenue chart 500s (2 backend bugs) + frontend/mock contract drift (4 files) | Both | Critical |
| F-11 | METER-03 real backend rule untested; METER-04 actually client-side only; 3 spec scenarios don't exist | N/A (coverage gap, not a bug) | — |
| F-12 | `fetchClient.ts` never parsed FastAPI's native `{detail: ...}` error shape — every Pydantic validation error app-wide showed a generic message | Frontend | High |

**None of these application/backend bugs (F-01 through F-08, F-10, F-12) were detectable by the mocked E2E suite** — each one requires the real backend, the real database, or the real absence of a service worker registration to manifest. This is the core argument for fullstack E2E over mocked E2E for a pre-production codebase: a mocked suite only proves the frontend renders correctly *given a response the test author imagined*: it cannot prove the backend actually produces that response, that writes persist, or that both sides agree on a contract.

Also found, but deliberately **not fixed** (real gaps, not regressions — see the file-header notes in `dashboard.spec.ts`, `tenant-flow.spec.ts`, and `invoice-payment.spec.ts`): `DashboardPage.tsx`, `TenantListPage.tsx`, and the invoice `Generate Invoice` modal in `InvoiceListPage.tsx` all hardcode a nonexistent placeholder property ID (`SAMPLE_PROPERTY_ID` / `'00000000-0000-0000-0000-000000000001'`) with no property-selector UI, so dashboard stats, tenant search/creation, and bulk invoice generation always operate against a property that doesn't exist. This is a missing feature (property-selector UI), not something an E2E test fix can address — documented and the affected scenarios asserted as *absence* (no property selector in the modal) with the rationale in place, rather than silently passing against fake data.

---

### Real-Bug vs. Test-Bug Summary (Session 4 — Sprint 09, Route 9 /invoices & Route 10 /invoices/:id)

Extended `frontend/e2e/specs/invoice-payment.spec.ts` from 4 → 14 tests covering 10 previously-untested Test IDs (INV-02, INV-03, INV-04, INV-06, INV-07, INV-08, INV-DET-03, INV-DET-04, INV-DET-05, INV-DET-06). Fullstack only (real backend + real Postgres), `./scripts/reset-e2e-db.sh` before every run. Final result: **14 passed, 0 failed, 0 skipped** (repeated clean runs; see flake note below).

| # | Finding | Class | Severity | Disposition |
|---|---------|-------|----------|-------------|
| F-13 | `PaymentModal` method `<select>` options (`cash`,`transfer`,`qr`,`credit`) do NOT match backend's accepted `PaymentMethod` pattern (`cash|bank_transfer|credit_card|qr_code|wallet`) — only `cash` overlaps | Frontend/contract drift | Medium | Not fixed in this task (scope = E2E extension). Tests use the default `cash` method, which is what the form pre-selects. Flagged for a follow-up feature/contract fix. |
| F-14 | INV-03 `Generate Invoice` modal has NO property selector — `handleGenerate()` hardcodes `property_id='00000000-0000-0000-0000-000000000001'` (same `SAMPLE_PROPERTY_ID` class as Dashboard/Tenant, F-02-line) | Frontend gap | High | Not fixed (missing property-selector feature). Covered by assert-absence test (modal opens with month/year only, no property input/combobox), consistent with the established precedent. |
| F-15 | INV-04/INV-08/INV-DET-03/04/05 (send, bulk, refund, void, resend) do not exist — no UI control and no backend endpoint | Missing feature | — | Assert-absence tests (no button/link matching the action). |
| F-16 | INV-06 — no PDF/print control exists; only CSV + TXT client-side export (`utils/export.ts`) are implemented | Partial/real feature | — | Real test for CSV + TXT downloads; assert-absence for any PDF/print control. |
| F-17 | INV-07 — overdue highlighting is PARTIAL: status badge covers `overdue` styling AND remaining-balance cell turns red (`text-red-600`) when `> 0`; there is NO overdue-specific sort/section | Partial | — | Real test for red remaining-balance + badge; assert-absence for overdue sort/section. |
| F-18 | INV-02 — `StatusBadge` (`InvoiceListPage.tsx`) renders color-coded pill from `statusStyles`; seeded status `issued` is absent from the map → renders default gray pill with label `issued` | Real (works as coded) | — | Real test asserting pill text `issued` + `bg-surface-100` class. |
| F-19 | INV-DET-06 — Payment History is a GENUINE GAP: backend `GET /billing/invoices/{id}` returns only `{ invoice, line_items }` (no `payments` field; `InvoiceDetailResponse` has no payments; `repository.get_invoice_by_id` has no payment query); frontend card keys off `line_items.length === 0` so it ALWAYS shows the static placeholder "No payments recorded yet." regardless of real payments | Backend+Frontend gap | High | Not fixed in this task (needs a backend feature addition — return payments on the detail endpoint — plus a frontend render change). Covered by assert-absence test: card shows only the static placeholder and never renders a payment row/table. Documented F-style; a future feature PR should flip it to a real test. |

**Root cause (F-19):** the invoice detail API contract omits payment history; the frontend Payment History card therefore has no data source and falls back to a `line_items`-based placeholder. Symptom: after recording a real payment, the Payment History card is unchanged. Files affected: `backend/app/modules/billing/routers/billing_router.py` (no payments in detail response), `backend/app/modules/billing/repository.py` (`get_invoice_by_id` no payment query), `backend/app/modules/billing/schemas.py` (`InvoiceDetailResponse` no payments field), `frontend/src/features/billing/InvoiceDetailPage.tsx` (card checks `line_items.length`), `frontend/src/types/api.d.ts` (`InvoiceDetailResponse` no payments). Fix: deferred (feature addition, out of E2E-scope) — see assert-absence test + header note in `invoice-payment.spec.ts`.

**Self-inflicted test bug found & fixed during this session (not an app bug):** the original INV-DET-06 recorded a *second* payment after the "record a payment" test had already flipped the seeded invoice to `PARTIAL`; `repo.record_payment` rejects any payment unless `invoice.status in (DRAFT, ISSUED)`, so the 2nd payment 422'd and the test failed. Confirmed as a **shared-state ordering dependency** (isolation run passed; full-suite run failed). Fixed by making INV-DET-06 a pure assert-absence test (static placeholder + no payment rows), order-independent, since the seeded invoice accepts only one payment per run and the other test is the sole payment poster. No assertion was loosened.

**Flake note (environment, not test logic):** on a *cold* `docker run --rm frontend-test` the Vite dev server compiles the whole app on first navigation; the detail-page `h1` `toContainText(invoice number)` occasionally misses the 30s window on the first test of a cold run, producing an intermittent 13/14. This is the documented container-startup-variance class (see Session A, bottleneck #4). Warm runs are consistently 14/14; all 10 new tests also pass in isolation. Assertions were NOT relaxed to mask it.

### F-20 (Contract — CONT-08 Lease History): `useLeaseHistory()` hook + backend `GET /leases/{room_id}/history` exist but are dead code (frontend/backend URL mismatch, never rendered)

| Field | Value |
|-------|-------|
| **Scenario** | CONT-08 (Contract history) |
| **Type** | Dead-code gap (frontend + backend disconnect) — same class as F-14 (`useUpdateRoomStatus`) / F-19-style gaps |
| **Severity** | Low (no user-facing break; feature simply does not exist in the UI) |
| **Status** | Documented, **not fixed** in this E2E task (would require building a new UI feature; per project precedent for E2E gaps, document rather than implement) |

**Root cause (F-20):** `frontend/src/features/contract/api.ts` defines `useLeaseHistory(roomId)` which calls `fetchClient.apiFetch('/leases/' + roomId + '/history')` — i.e. a path under `/api/v1/leases/...`. But the backend endpoint is mounted at `backend/app/modules/contract/routers/contract_router.py` as `@router.get('/leases/{room_id}/history')`, and `contract_router` is included with `prefix='/api/v1/contracts'` (see `backend/app/main.py`). So the real URL is `/api/v1/contracts/leases/{room_id}/history`. The frontend hook would 404 even if it were ever called. More importantly, a **grep of the whole frontend confirms zero components import or call `useLeaseHistory`** — no contract detail page (or any other page) renders a lease/contract history section. So CONT-08 is genuinely unimplemented at the UI layer.

**Symptom:** no lease/contract history UI appears anywhere; an assert-absence test (`page.getByText(/lease history|contract history/i)` → count 0) is the correct, real representation of current behavior.

**Files affected:** `frontend/src/features/contract/api.ts` (`useLeaseHistory` → wrong URL `/leases/...` instead of `/contracts/leases/...`), `backend/app/modules/contract/routers/contract_router.py` (`get_lease_history` endpoint, reachable at `/api/v1/contracts/leases/{id}/history` but unreferenced by any UI), no frontend component wiring.

**How it was found:** re-verifying the prior-session read-only audit while extending `contract-flow.spec.ts` for CONT-08 — the audit's claim ("dead-code gap, not a working feature") was confirmed by grepping the frontend for `useLeaseHistory` (0 callers) and by comparing the hook's URL against the backend router mount prefix.

**Prevention:** (1) When a frontend data hook exists but no component uses it, treat it as a latent UI gap and grep for callers before asserting the feature works. (2) Frontend API path constants must be derived from the backend router's actual `prefix` + path at code-review time, not hand-written — a mismatch like `/leases/` vs `/contracts/leases/` is invisible to type-checking and only surfaces at runtime. (3) Same lesson as F-03/F-16: a hook + an endpoint both existing does NOT mean the feature exists end-to-end; the wiring (component render) is the missing third leg. This is the same class of "two halves exist, the join is missing" bug as F-14.

### F-21 (Contract — CONT-05 Renew): renew creates a NEW contract (new id) but the UI stayed on the terminated original → renewed terms never shown

| Field | Value |
|-------|-------|
| **Scenario** | CONT-05 (Renewal workflow) |
| **Type** | Real frontend bug — silent UX failure (renew "succeeds" but user sees no change) |
| **Severity** | Medium (data is correct server-side; the user just can't see the renewed contract) |
| **Status** | **FIXED at source** (frontend navigate to the new contract after renew) |

**Root cause (F-21):** `POST /api/v1/contracts/{id}/renew` (`backend/app/modules/contract/routers/contract_router.py`) creates a **brand-new** `Contract` row (new UUID) from the terminated/expired original and returns it as `ContractCreateResponse` (HTTP 201). But `handleRenew()` in `frontend/src/features/contract/ContractDetailPage.tsx` only did `showToast('Contract renewed successfully')` + closed the modal — it never navigated to the new contract, and `useRenewContract`'s `onSuccess` only `invalidateQueries({ queryKey: contractKeys.all })` (= `['contracts']`). The page stayed at `/contracts/{originalId}`, whose detail query (`['contracts', originalId]`) still returned the **terminated** original (rent 5,000), so the renewed terms (rent 7,000) were invisible. The test initially failed asserting `7,000` on the detail page — the only honest reason was that the UI was showing the wrong (old) contract.

**Symptom:** after renewing, the detail page still shows the original terminated contract's terms; no navigation, no error. An E2E test that terminates a throwaway contract then renews it and asserts the new rent appears will fail unless the UI navigates.

**Files affected / fix:** `frontend/src/features/contract/ContractDetailPage.tsx` — `handleRenew()` now captures the mutation result, and if `newContract?.id` is present, calls `navigate('/contracts/' + newContract.id)` so the user lands on the renewed contract and sees its (correct) terms. `useRenewContract`'s broad `['contracts']` invalidation is harmless and left as-is (the new detail page does a fresh fetch).

**How it was found:** the CONT-05 E2E test (extend `contract-flow.spec.ts`) failed at `expect(page.getByText('7,000')).toBeVisible()` after a successful renew — `getByText` uses substring match and `formatCurrency` renders `฿7,000.00`, so a real "7,000" would have matched; its absence proved the page was still on the original contract. Confirmed by reading `renew_contract` (creates new row) vs. `handleRenew` (no navigation).

**Prevention:** whenever a write endpoint returns a **new** resource id (create / clone / renew / duplicate), the calling UI must navigate to or otherwise surface that new id — don't assume the current page's entity is the one that changed. A Playwright test asserting post-mutation state on the same URL is a cheap tripwire for exactly this class of bug.

---

### F-30 (Maintenance — MAINT-03/04 "View" dead link + dead status/assign endpoints): `MaintenanceListPage` rendered `<Link to={`/maintenance/${req.id}`}>` for the title AND "View" action, but no `/maintenance/:id` route is registered → silent bounce to `/dashboard`; status/assign PATCH endpoints + hooks exist but are unwired dead code

| Field | Value |
|-------|-------|
| **Scenario** | MAINT-03 (Status workflow), MAINT-04 (Assign staff), and the list-row "View" navigation |
| **Type** | Real frontend bug (dead link → silent navigation bounce) + two dead-code backend endpoints (status/assign) with no UI consumer |
| **Severity** | Medium (no crash, but clicking a list row silently bounced the authenticated user to the dashboard — a confusing no-op; the status/assign backend features are reachable only via API, never the UI) |
| **Status** | **Real bug FIXED at source** (dead links removed). The status/assign dead endpoints are documented, NOT built (out of E2E scope — would require a detail page). Covered by assert-absence tests for MAINT-03/04/05/06/07 + a F-30 regression test in `maintenance-flow.spec.ts`. |

**Root cause (F-30):** `frontend/src/features/maintenance/MaintenanceListPage.tsx` wrapped both the request `title` and the row's "View" action in `<Link to={`/maintenance/${req.id}`}>`. But `src/routes/index.tsx` registers only `/maintenance` and `/maintenance/new` — there is **no `/maintenance/:id` route** and no detail page component. So clicking either link hit the catch-all route `<Route path="*">` → `<Navigate to="/login" replace>` → since the user is already authenticated, `GuestRoute` immediately redirected them to `/dashboard`. Net effect: a silent bounce with no 404, no console error, no feedback — the row looked clickable but did nothing useful. Separately, the backend DOES implement `GET /maintenance/{id}`, `PATCH /maintenance/{id}/status`, and `PATCH /maintenance/{id}/assign` (`backend/app/modules/maintenance/routers/maintenance_router.py`), and `api.ts` exposes the matching `useMaintenanceDetail`, `useUpdateMaintenanceStatus`, and `useAssignMaintenance` hooks — but a **grep confirms zero components import or call those hooks** (no detail page exists to host them). They are dead code, the same class as F-14 (`useUpdateRoomStatus`) and F-20 (`useLeaseHistory`): the backend half and the hook half exist, the UI wiring half is missing.

**Symptom:** (before fix) clicking a maintenance row's title or "View" silently navigated away from `/maintenance` to `/dashboard`. After fix, list rows are plain text (no anchor), so no navigation occurs and the URL stays on `/maintenance`.

**Files affected:** `frontend/src/features/maintenance/MaintenanceListPage.tsx` (removed the two dead `<Link>`s; title is now a `<span>`, the "View" column was dropped — list shows title/room/priority/status/created only). `backend/app/modules/maintenance/routers/maintenance_router.py` + `frontend/src/features/maintenance/api.ts` are confirmed dead-code (documented; not removed, since the endpoints/hooks are valid and a future detail page should wire them up).

**How it was found:** while extending `maintenance-flow.spec.ts` for MAINT-03~07, I investigated what the list-row "View" action actually does (the prompt flagged it as a possible real bug). Component audit of `MaintenanceListPage.tsx` + route audit of `src/routes/index.tsx` showed the dead link; an `assert-absence` test for the missing `/maintenance/:id` route then confirmed the silent bounce empirically (authenticated click landed on `/dashboard`).

**Fix:** removed the dead links at source (no fake route, no workaround). The assert-absence tests for MAINT-03/04 now confirm there is no status-change / assign control *and* no anchor pointing at a per-request detail route (`/maintenance/<uuid>`); a dedicated F-30 regression test asserts `countMaintenanceDetailLinks(page) === 0` and `page.url` stays `/maintenance` after interacting with the list. MAINT-05 (SLA/due_date), MAINT-06 (recurring), MAINT-07 (vendor) are confirmed absent in models/schemas/UI and asserted as absence.

**Prevention:** (1) A `<Link to={...}>` whose target has no registered route is a silent failure (catch-all → login → bounce) — every dynamic row link must have a matching `Route` + page component, and a missing one should be caught in code review. (2) Same lesson as F-14/F-20: a backend endpoint + a frontend hook existing does NOT mean the feature is wired; grep for component callers before claiming a feature works. (3) Navigation-regression guard: any test that clicks a list row should assert the resulting URL, not just that "no error appeared" — a silent bounce to an unrelated page is still a failure.

---

## Reference: Correct Patterns

### Pattern 1: Mock Setup Function — Correct Registration Order

```typescript
async function mockFeatureApis(page: Page): Promise<void> {
  // 1. Catch-all FIRST — Playwright gives precedence to the most recently
  //    registered matching route, so this must not be added after the
  //    specific mocks below or it will shadow all of them (see I-03).
  await page.route('**/api/v1/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/@vite/') || url.includes('/@react-refresh') ||
        url.includes('/@fs/') || url.includes('/src/')) {
      return route.continue();
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: {} }),
    });
  });

  // 2. Specific mocks AFTER — these now correctly override the catch-all.
  await page.route('**/api/v1/auth/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          access_token: 'mock-access-token',
          refresh_token: 'mock-refresh-token',
          token_type: 'bearer',
          user: {
            id: '00000000-0000-0000-0000-000000000001',
            email: 'admin@example.com',
            full_name: 'Test User',
            property_scopes: [],
            is_active: true,
          },
        },
      }),
    });
  });

  await page.route('**/api/v1/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          id: '00000000-0000-0000-0000-000000000001',
          email: 'admin@example.com',
          full_name: 'Test User',
          property_scopes: [],
          is_active: true,
        },
      }),
    });
  });
}
```

### Pattern 2: Login Helper

```typescript
const TEST_USER = {
  email: 'admin@example.com',
  password: 'Admin123!',
};

async function login(page: Page): Promise<void> {
  await page.goto('/login');

  await expect(page.locator('input[placeholder="you@example.com"]').first())
    .toBeVisible({ timeout: 30000 });
  await expect(page.locator('input[placeholder="Enter your password"]').first())
    .toBeVisible({ timeout: 30000 });

  await page.locator('input[placeholder="you@example.com"]').first().fill(TEST_USER.email);
  await page.locator('input[placeholder="Enter your password"]').first().fill(TEST_USER.password);
  await page.getByRole('button', { name: /sign in|log in|login|submit/i }).click();

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
}
```

### Pattern 3: Token Verification

```typescript
const accessToken = await page.evaluate(() =>
  sessionStorage.getItem('pms_access_token')
);
expect(accessToken).not.toBeNull();
expect(accessToken!.length).toBeGreaterThan(0);

const refreshToken = await page.evaluate(() =>
  sessionStorage.getItem('pms_refresh_token')
);
expect(refreshToken).not.toBeNull();
expect(refreshToken!.length).toBeGreaterThan(0);
```

### Pattern 4: Validation Error Assertion

```typescript
const errorLocator = page.locator('text=/required|invalid/i');
await expect(errorLocator.first()).toBeVisible({ timeout: 5000 });
```

### Pattern 5: Page Heading Assertion Under a Shared Layout

```typescript
// MainLayout renders its own <h2>Property Management</h2> brand title
// before page content — match h1 only, never a combined 'h1, h2' selector,
// unless you've confirmed the layout has no heading-level elements (see I-05).
await expect(page.locator('h1').first()).toContainText(/Dashboard/i, { timeout: 30000 });
```

### Pattern 6: Diagnosing "Suite Won't Run" Before Debugging Test Logic

```bash
# Run BEFORE debugging individual test failures — catches I-01/I-02-class bugs in seconds:
cd frontend
npx tsc --noEmit -p tsconfig.e2e.json     # unbalanced braces / syntax errors
ls -la e2e/specs/ e2e/utils/               # file permissions (must be 644, not 600)
```
