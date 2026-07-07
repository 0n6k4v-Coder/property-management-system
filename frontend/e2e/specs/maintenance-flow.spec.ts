// File: frontend/e2e/specs/maintenance-flow.spec.ts
// E2E Test: Maintenance Request Flow — Fullstack (real backend + real database, no mocks)
// Flow: visit /maintenance → filter by property → view list → create new → assert created
// Uses: State Verification Engine (E2E_TEST_STRATEGY.md Article 1.1)
//       Shared Helpers (test-helpers.ts, state-capture.ts)
//       Seeded fixtures (frontend/e2e/fixtures/seeded-ids.ts) — run
//       `./scripts/reset-e2e-db.sh` before this suite.
// Component Audit: Verified against MaintenanceListPage.tsx, MaintenanceFormPage.tsx, maintenance/api.ts
//
// Fullstack notes:
//   - The real backend requires `property_id` on GET /maintenance/pending
//     (see docs/LOG/E2E_TEST.md) and the list page defaults to "All
//     properties" (empty filter) — the query is disabled until a property
//     is explicitly selected in the filter dropdown. Tests below select
//     "Sunset Tower" before expecting any rows to appear.
//
// ── Dead-endpoint / missing-feature findings (re-verified live, Session B) ──
//   1. MAINT-03 (Status workflow) & MAINT-04 (Assign staff):
//      - Backend HAS real endpoints: `GET /maintenance/{id}`,
//        `PATCH /maintenance/{id}/status`, `PATCH /maintenance/{id}/assign`
//        (backend/app/modules/maintenance/routers/maintenance_router.py).
//      - api.ts HAS the matching hooks: useMaintenanceDetail,
//        useUpdateMaintenanceStatus, useAssignMaintenance.
//      - BUT there is NO `/maintenance/:id` route registered in
//        src/routes/index.tsx (Confirmed: only `/maintenance` and
//        `/maintenance/new` exist) and NO detail page component consumes
//        those hooks. They are dead code — same class as the previously
//        documented get_meter_reading_history() / useLeaseHistory() dead-code
//        pattern. Asserted as absence: no status-change / assign control is
//        reachable from the UI because there is no page to host one.
//   2. MAINT-05 (SLA tracking): does not exist anywhere — no due_date/SLA
//      field in backend models.py/schemas.py (MaintenanceRequest has only
//      priority/status/created_at/updated_at). Asserted as absence.
//   3. MAINT-06 (Recurring requests): does not exist — no recurring flag/
//      concept in backend or frontend. Asserted as absence.
//   4. MAINT-07 (Vendor portal): does not exist — no vendor concept in
//      backend or frontend. Asserted as absence.
//   5. "View" link (REAL FIX — docs/LOG/E2E_TEST.md F-30):
//      MaintenanceListPage.tsx previously rendered
//      <Link to={`/maintenance/${req.id}`}> for the title AND the "View"
//      action. Because no `/maintenance/:id` route exists, clicking either
//      hit the catch-all `*` route → <Navigate to="/login"> → GuestRoute
//      bounced the authenticated user back to `/dashboard` (silent no-op
//      bounce, no 404, no error). Fixed at source (F-30): list rows are now
//      plain text, not fake links. The test below asserts the fix — there is
//      no anchor pointing at a non-existent detail route, so navigating the
//      list does not bounce the user to /dashboard.
//
// Disposition: MAINT-03~07 are assert-absence (the features genuinely do not
// exist in the UI); the dead backend endpoints are documented, not faked.
//
// ── MAINT-NEW-01~05 re-verification (Session D / PROMPT D, live audit) ──
// Re-audited MaintenanceFormPage.tsx + MaintenanceListPage.tsx:
//   Fields present: Property, Room (conditional on property), Title,
//   Description, Priority radio group (low/medium/high/urgent). Submit →
//   success toast (showToast) + redirect to /maintenance.
//   NO category field/dropdown. NO <input type="file"> / upload UI. NO
//   separate in-app notification center (bell/inbox) — "notification" is the
//   success toast, already asserted by the create-request test.
// Dispositions:
//   MAINT-NEW-01 (select room/property): cross-ref — covered by the existing
//     "should create a new maintenance request" test (fills Property → Room).
//     No duplicate test.
//   MAINT-NEW-02 (category): assert-absence — no category field exists.
//   MAINT-NEW-03 (priority): real test added — explicitly selects a
//     non-default priority ('urgent'), submits, and verifies the created
//     request's priority badge in the list.
//     NOTE: the existing create-request test ALREADY calls
//     `getByRole('radio', { name: 'high' }).check()` — it does select a
//     priority; it just never asserted the reflected badge. MAINT-NEW-03 adds
//     the explicit selection + badge verification with a distinct value.
//   MAINT-NEW-04 (photo upload): assert-absence — no file input exists.
//   MAINT-NEW-05 (submit → notification): cross-ref — "notification" = the
//     success toast, already covered by the create-request test's alert + URL
//     + list-persistence assertions. No assert-absence test for a concept
//     never claimed to be a distinct feature.

import { test, expect, type Page } from '@playwright/test';
import { login } from '../utils/test-helpers';
import { captureAllStates, type CapturedStates } from '../utils/state-capture';
import { SEEDED_DATA } from '../fixtures/seeded-ids';

// Counts anchors pointing at a per-request detail route (/maintenance/<uuid>).
// The only legitimate maintenance link is "/maintenance/new" (the "New Request"
// button) — which this deliberately EXCLUDES. Used to assert the F-30 fix:
// list rows are plain text, there is no dead link to the non-existent
// /maintenance/:id detail route.
async function countMaintenanceDetailLinks(page: Page): Promise<number> {
  return page.locator('a').evaluateAll(
    (els) =>
      els.filter((el) => {
        const href = el.getAttribute('href') ?? '';
        return /^\/maintenance\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(
          href,
        );
      }).length,
  );
}

test.describe('Maintenance Request Flow', () => {
  let states: CapturedStates;

  test.beforeEach(async ({ page }) => {
    states = await captureAllStates(page);
  });

  test('should display pending maintenance requests for the selected property', async ({ page }) => {
    await login(page);
    await page.goto('/maintenance');
    await expect(page.locator('h1').first()).toContainText(/maintenance/i, { timeout: 30000 });

    await page.getByLabel('Filter by property:').selectOption({ label: 'Sunset Tower' });

    await expect(page.getByText(SEEDED_DATA.maintenance.title)).toBeVisible({ timeout: 10_000 });

    expect(states.consoleErrors).toEqual([]);
    expect(states.jsErrors).toEqual([]);
    expect(states.networkErrors).toEqual([]);
    expect(states.hydrationErrors).toEqual([]);
  });

  test('should create a new maintenance request', async ({ page }) => {
    await login(page);
    await page.goto('/maintenance/new');
    await expect(page.locator('h1').first()).toContainText(/new maintenance request/i, { timeout: 30000 });

    await page.getByLabel('Property').selectOption({ label: 'Sunset Tower' });
    await page.getByLabel('Room').selectOption({ index: 1 });
    await page.getByLabel('Title').fill('Broken window');
    await page.getByLabel('Description').fill('Window in living room will not close properly');
    await page.getByRole('radio', { name: 'high' }).check();

    await page.getByRole('button', { name: 'Submit Request' }).click();

    await expect(page.getByRole('alert').filter({ hasText: /created|success/i })).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/maintenance$/);

    // Confirm it actually persisted — reselect the property filter and
    // check the new request appears in the real list.
    await page.getByLabel('Filter by property:').selectOption({ label: 'Sunset Tower' });
    await expect(page.getByText('Broken window')).toBeVisible({ timeout: 10_000 });

    expect(states.consoleErrors).toEqual([]);
    expect(states.jsErrors).toEqual([]);
    expect(states.hydrationErrors).toEqual([]);
  });

  // ── MAINT-03: Status workflow (assert absence — dead endpoint, no UI) ──
  test('MAINT-03: status-change control is not reachable from the list (no detail route exists)', async ({ page }) => {
    await login(page);
    await page.goto('/maintenance');
    await expect(page.locator('h1').first()).toContainText(/maintenance/i, { timeout: 30000 });
    await page.getByLabel('Filter by property:').selectOption({ label: 'Sunset Tower' });
    await expect(page.getByText(SEEDED_DATA.maintenance.title)).toBeVisible({ timeout: 10_000 });

    // The backend PATCH /maintenance/{id}/status endpoint + useUpdateMaintenanceStatus
    // hook exist but are dead code: there is no /maintenance/:id route or detail
    // page to host a status control. Assert no status-change UI is reachable.
    const statusSelect = page.getByRole('combobox', { name: /status/i });
    const statusButton = page.getByRole('button', { name: /update status|change status|set status/i });
    await expect(statusSelect).toHaveCount(0);
    await expect(statusButton).toHaveCount(0);

    // Also confirm the detail path itself does not resolve to a real page —
    // there is no link on the list row that would navigate to it (cf. F-30 fix).
    expect(await countMaintenanceDetailLinks(page)).toBe(0);

    expect(states.consoleErrors).toEqual([]);
    expect(states.jsErrors).toEqual([]);
    expect(states.hydrationErrors).toEqual([]);
  });

  // ── MAINT-04: Assign staff (assert absence — dead endpoint, no UI) ──
  test('MAINT-04: assign-staff control is not reachable from the list (no detail route exists)', async ({ page }) => {
    await login(page);
    await page.goto('/maintenance');
    await expect(page.locator('h1').first()).toContainText(/maintenance/i, { timeout: 30000 });
    await page.getByLabel('Filter by property:').selectOption({ label: 'Sunset Tower' });
    await expect(page.getByText(SEEDED_DATA.maintenance.title)).toBeVisible({ timeout: 10_000 });

    // The backend PATCH /maintenance/{id}/assign endpoint + useAssignMaintenance hook
    // exist but are dead code: no detail page consumes them. Assert no assign UI.
    const assignSelect = page.getByRole('combobox', { name: /assign|assignee|staff/i });
    const assignButton = page.getByRole('button', { name: /assign/i });
    // The only buttons on the list page are "New Request" (Link→Button) and
    // the property filter is a <select>, not a button. No assign control exists.
    await expect(assignSelect).toHaveCount(0);
    await expect(assignButton).toHaveCount(0);

    // Re-confirm there is no link to a (non-existent) detail route that could
    // host an assign control.
    expect(await countMaintenanceDetailLinks(page)).toBe(0);

    expect(states.consoleErrors).toEqual([]);
    expect(states.jsErrors).toEqual([]);
    expect(states.hydrationErrors).toEqual([]);
  });

  // ── MAINT-05: SLA tracking (assert absence — no due_date/SLA field) ──
  test('MAINT-05: SLA / due-date tracking does not exist on the maintenance list', async ({ page }) => {
    await login(page);
    await page.goto('/maintenance');
    await expect(page.locator('h1').first()).toContainText(/maintenance/i, { timeout: 30000 });
    await page.getByLabel('Filter by property:').selectOption({ label: 'Sunset Tower' });
    await expect(page.getByText(SEEDED_DATA.maintenance.title)).toBeVisible({ timeout: 10_000 });

    // Backend model/schemas have no due_date / SLA / response-target field.
    // Assert no SLA-related column header or control is present in the list.
    const slaHeader = page.getByRole('columnheader', { name: /due|SLA|target|response/i });
    const slaText = page.getByText(/due by|sla|breach/i);
    await expect(slaHeader).toHaveCount(0);
    await expect(slaText).toHaveCount(0);

    expect(states.consoleErrors).toEqual([]);
    expect(states.jsErrors).toEqual([]);
    expect(states.hydrationErrors).toEqual([]);
  });

  // ── MAINT-06: Recurring requests (assert absence — no recurring concept) ──
  test('MAINT-06: recurring-request scheduling does not exist anywhere in the UI', async ({ page }) => {
    await login(page);
    await page.goto('/maintenance');
    await expect(page.locator('h1').first()).toContainText(/maintenance/i, { timeout: 30000 });
    await page.getByLabel('Filter by property:').selectOption({ label: 'Sunset Tower' });
    await expect(page.getByText(SEEDED_DATA.maintenance.title)).toBeVisible({ timeout: 10_000 });

    // No recurring flag/control exists on the list.
    const recurringToggle = page.getByRole('checkbox', { name: /recurring/i });
    const recurringButton = page.getByRole('button', { name: /recurring|schedule/i });
    await expect(recurringToggle).toHaveCount(0);
    await expect(recurringButton).toHaveCount(0);

    // Nor on the create form.
    await page.goto('/maintenance/new');
    await expect(page.locator('h1').first()).toContainText(/new maintenance request/i, { timeout: 30000 });
    await expect(page.getByLabel(/recurring/i)).toHaveCount(0);
    await expect(page.getByText(/recurring/i)).toHaveCount(0);

    expect(states.consoleErrors).toEqual([]);
    expect(states.jsErrors).toEqual([]);
    expect(states.hydrationErrors).toEqual([]);
  });

  // ── MAINT-07: Vendor portal (assert absence — no vendor concept) ──
  test('MAINT-07: vendor portal / vendor assignment does not exist anywhere in the UI', async ({ page }) => {
    await login(page);
    await page.goto('/maintenance');
    await expect(page.locator('h1').first()).toContainText(/maintenance/i, { timeout: 30000 });
    await page.getByLabel('Filter by property:').selectOption({ label: 'Sunset Tower' });
    await expect(page.getByText(SEEDED_DATA.maintenance.title)).toBeVisible({ timeout: 10_000 });

    // No vendor concept on the list (no "vendor" column, link, or button).
    const vendorHeader = page.getByRole('columnheader', { name: /vendor/i });
    const vendorControl = page.getByRole('button', { name: /vendor/i });
    await expect(vendorHeader).toHaveCount(0);
    await expect(vendorControl).toHaveCount(0);

    // Nor on the create form (no "assign to vendor" field).
    await page.goto('/maintenance/new');
    await expect(page.locator('h1').first()).toContainText(/new maintenance request/i, { timeout: 30000 });
    await expect(page.getByLabel(/vendor/i)).toHaveCount(0);

    expect(states.consoleErrors).toEqual([]);
    expect(states.jsErrors).toEqual([]);
    expect(states.hydrationErrors).toEqual([]);
  });

  // ── MAINT-NEW-01: Select room/property (cross-reference, no test) ──
  // Covered by the existing "should create a new maintenance request" test
  // (fills Property → Room). No duplicate.

  // ── MAINT-NEW-02: Category field does not exist (assert absence) ──
  test('MAINT-NEW-02: no category field/dropdown on the create form', async ({ page }) => {
    await login(page);
    await page.goto('/maintenance/new');
    await expect(page.locator('h1').first()).toContainText(/new maintenance request/i, { timeout: 30000 });

    // Re-verified live against MaintenanceFormPage.tsx: the form has Property,
    // Room, Title, Description, and Priority only — no category field.
    await expect(page.getByLabel(/category/i)).toHaveCount(0);
    await expect(page.getByText(/category/i)).toHaveCount(0);

    expect(states.consoleErrors).toEqual([]);
    expect(states.jsErrors).toEqual([]);
    expect(states.hydrationErrors).toEqual([]);
  });

  // ── MAINT-NEW-03: Explicit priority selection + verify reflected badge ──
  test('MAINT-NEW-03: selected priority is persisted and shown as the request priority badge', async ({ page }) => {
    await login(page);
    await page.goto('/maintenance/new');
    await expect(page.locator('h1').first()).toContainText(/new maintenance request/i, { timeout: 30000 });

    await page.getByLabel('Property').selectOption({ label: 'Sunset Tower' });
    await page.getByLabel('Room').selectOption({ index: 1 });
    await page.getByLabel('Title').fill('Urgent pipe burst');
    await page.getByLabel('Description').fill('Main water pipe burst on the ground floor');
    // Explicitly pick a non-default priority (default is "medium").
    await page.getByRole('radio', { name: 'urgent' }).check();

    await page.getByRole('button', { name: 'Submit Request' }).click();

    await expect(page.getByRole('alert').filter({ hasText: /created|success/i })).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/maintenance$/);

    // Confirm persistence + that the chosen priority is reflected on the row's
    // priority badge (3rd column). Target the priority cell, not the title
    // cell, because the title text itself contains the word "urgent".
    await page.getByLabel('Filter by property:').selectOption({ label: 'Sunset Tower' });
    const row = page.locator('tbody tr').filter({ hasText: 'Urgent pipe burst' });
    const priorityCell = row.locator('td').nth(2);
    await expect(priorityCell).toHaveText('urgent', { ignoreCase: true });

    expect(states.consoleErrors).toEqual([]);
    expect(states.jsErrors).toEqual([]);
    expect(states.hydrationErrors).toEqual([]);
  });

  // ── MAINT-NEW-04: Photo upload does not exist (assert absence) ──
  test('MAINT-NEW-04: no photo/file-upload control on the create form', async ({ page }) => {
    await login(page);
    await page.goto('/maintenance/new');
    await expect(page.locator('h1').first()).toContainText(/new maintenance request/i, { timeout: 30000 });

    // Re-verified live against MaintenanceFormPage.tsx: no <input type="file">
    // or any upload UI anywhere in the form.
    await expect(page.locator('input[type="file"]')).toHaveCount(0);
    await expect(page.getByText(/upload|photo|attachment/i)).toHaveCount(0);

    expect(states.consoleErrors).toEqual([]);
    expect(states.jsErrors).toEqual([]);
    expect(states.hydrationErrors).toEqual([]);
  });

  // ── MAINT-NEW-05: Submit → notification (cross-reference, no test) ──
  // Re-verified: the form's only post-submit feedback is the success toast
  // (showToast('Maintenance request created','success')). There is no separate
  // in-app notification center / bell / inbox feature. "Notification" = the
  // toast, already asserted by the existing create-request test (success
  // alert + URL change + list persistence). No assert-absence test for a
  // concept that was never claimed to be a distinct feature.

  // ── "View" link investigation (REAL FIX verification — F-30) ──
  test('view/title links do not bounce the user to /dashboard (no dead /maintenance/:id links)', async ({ page }) => {
    await login(page);
    await page.goto('/maintenance');
    await expect(page.locator('h1').first()).toContainText(/maintenance/i, { timeout: 30000 });
    await page.getByLabel('Filter by property:').selectOption({ label: 'Sunset Tower' });
    await expect(page.getByText(SEEDED_DATA.maintenance.title)).toBeVisible({ timeout: 10_000 });

    // F-30: list rows used to be <Link to={`/maintenance/${req.id}`}> with no
    // matching route, so clicking bounced the user to /dashboard. Fixed at
    // source — rows are plain text now. Assert (a) no anchor points at a
    // non-existent detail route, and (b) the current URL is still /maintenance
    // (we never navigate anywhere by clicking the row).
    expect(await countMaintenanceDetailLinks(page)).toBe(0);
    await expect(page).toHaveURL(/\/maintenance$/);
  });
});

// Verification:
//   chmod 644 frontend/e2e/specs/maintenance-flow.spec.ts
//   cd frontend && npx tsc --noEmit -p tsconfig.e2e.json
//   cd .. && ./scripts/reset-e2e-db.sh
//   docker compose -f docker-compose.dev.yml --profile dev run --rm frontend-test \
//     npx playwright test e2e/specs/maintenance-flow.spec.ts --reporter=list --retries=0
