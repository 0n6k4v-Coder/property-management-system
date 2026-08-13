# E2E Files Review Report — Commit 166dee6

**Review Date:** 2026-08-12
**Reviewer:** Hermes Agent
**Scope:** E2E files changed in commit 166dee69 — lint issue fixes
**Commit Message:** `fix(lint): resolve Task 2 lint issues at root cause`

---

## Summary

Commit 166dee6 fixes pre-existing lint errors in 4 E2E files by adding type
assertions for API response shapes, applying Promise.all for independent
evaluations, and removing unused imports/variables. All changes are safe,
correct, and verified against backend schemas.

**Result: APPROVE**

---

## 1. auth-flow.spec.ts

### Changes

1. **Typed API responses** (2 sites, lines ~46 and ~58):
   - `const loginBody = await loginRes.json() as { data: { access_token: string } };`
   - `const inviteBody = await inviteRes.json() as { data: { invite_link: string } };`

2. **Promise.all fix** (line ~521):
   - Before: two sequential `await page.evaluate(...)` calls
   - After: wrapped both in `Promise.all([...])` and destructured into
     `[accessToken, refreshToken]`

### Analysis

- **Correctness: YES**
  - Backend auth router (`auth_router.py:107-113`) returns login as
    `{"data": {"access_token": ..., "refresh_token": ..., "user": {}}}`.
  - The invite endpoint (`auth_router.py:229-235`) returns
    `{"data": InviteResponse(...).model_dump()}` where `InviteResponse` has
    `invite_link: str` (confirmed in `schemas.py:99-111`).
  - The type assertion `{ data: { access_token: string } }` is a valid subset
    of the actual response (extra fields are ignored by TS structural typing).

- **Promise.all fix correctness: YES**
  - `page.evaluate()` for `sessionStorage.getItem()` calls are independent
    (no data dependency between them). Wrapping in `Promise.all` is the
    correct pattern for parallel browser evaluation.
  - The destructuring assignment is correct — `Promise.all` preserves
    array order.

- **Test logic impact: NONE**
  - The assertions (`expect(accessToken).not.toBeNull()`,
    `expect(accessToken!.length).toBeGreaterThan(0)`) are unchanged.
  - The Promise.all fix does not alter the test outcome — it only optimizes
    execution order.

- **Issues found: None**

---

## 2. contract-flow.spec.ts

### Changes

**Typed API responses** (3 sites, lines ~64, ~82, ~223):
- `const body = (await res.json()) as { data: { access_token: string } };`
  (in `loginForApi`)
- `const body = (await res.json()) as { data: { id: string } };`
  (in `createThrowawayContract`, line ~82)
- `const body = (await res.json()) as { data: { id: string } };`
  (inline in test, line ~223)

### Analysis

- **Correctness: YES**
  - `loginForApi` calls `POST /api/v1/auth/login` — confirmed above to return
    `{"data": {"access_token": ...}}`.
  - `createThrowawayContract` calls `POST /api/v1/contracts/` which uses
    `response_model=ContractCreateResponse` (confirmed in
    `contract_router.py:84`). `ContractCreateResponse` has
    `data: ContractResponse` and `ContractResponse` has `id: uuid.UUID`
    (confirmed in `schemas.py:134-155`).
  - The `id: string` assertion is acceptable — UUIDs are serialized as
    strings in JSON, and the test only uses it as a string identifier.

- **Test logic impact: NONE**
  - All downstream usage (`body.data.access_token`, `body.data.id`,
    `JSON.stringify(body)`) is unchanged and type-safe.

- **Issues found: None**

---

## 3. tenant-flow.spec.ts

### Changes

- **Removed unused `Page` import** (line 39):
  - Before: `import { test, expect, type Page } from '@playwright/test';`
  - After: `import { test, expect } from '@playwright/test';`

### Analysis

- **Correctness: YES**
  - Confirmed via `grep -n '\bPage\b'` — no standalone `Page` type usage
    remains in the file (only `page.evaluate`/`page.route` which are
    instance variable names from the test fixture, not the `Page` type).
  - `test` and `expect` are still imported and used throughout.

- **Test logic impact: NONE**
  - Removing a type-only unused import has zero runtime effect.

- **Issues found: None**

---

## 4. mock-helpers.ts

### Changes

- **Removed unused `postData` variable** (line ~22):
  - Before: `const postData = route.request().postData();`
  - After: line removed entirely

### Analysis

- **Correctness: YES**
  - Confirmed via `grep -n "postData"` — no remaining usage in the file.
  - The line was a dead assignment: the variable was never read before
    being removed.

- **Test logic impact: NONE**
  - Dead variable removal — no behavioral change.
  - The mock route continues to fulfill with the same response body.

- **Issues found: None**

---

## Verification Results

| Check              | Result | Details                                        |
|--------------------|--------|------------------------------------------------|
| TypeScript check   | PASS   | 0 errors in all 4 reviewed files               |
| E2E ESLint         | PASS   | 0 errors, 0 warnings on `e2e/` directory       |
| E2E tests runnable | N/A    | Tests require Docker dev environment; not run  |
| Schema validation  | PASS   | Type assertions match backend response models  |

### Notes on Pre-existing TS Errors (NOT in reviewed files)

Running `npx tsc` on the E2E project surfaces 3 errors, but these exist in
files **not modified by commit 166dee6**:

1. `e2e/a11y.spec.ts(139)` — `r`, `g`, `b` possibly undefined (TS18048)
2. `e2e/specs/property-flow.spec.ts(248)` — string literal type mismatch
   (TS2345)

These are out of scope for this review but should be addressed separately.

### Schema Cross-Reference

| API Endpoint              | Backend Schema              | Field Asserted  | Match |
|---------------------------|-----------------------------|-----------------|-------|
| POST /api/v1/auth/login   | `{"data": {"access_token"}}`| `access_token`  | YES   |
| POST /api/v1/auth/invite  | `{"data": {"invite_link"}}` | `invite_link`   | YES   |
| POST /api/v1/contracts/   | `{"data": {"id"}}`          | `id`            | YES   |

---

## Recommendation

- [x] APPROVE — changes are correct and safe
- [ ] REJECT — issues found, need fixes
- [ ] NEEDS DISCUSSION — unclear changes

## Issues Found

None. All 4 files pass TypeScript and ESLint checks. Type assertions are
validated against backend response schemas. Unused imports/variables are
truly unused. The Promise.all optimization is correct for independent
browser evaluations.
