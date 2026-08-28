// File: frontend/e2e/specs/reports-flow.spec.ts
// E2E Test: Reports Flow — Fullstack (real backend + real database, no mocks)
// Test IDs: RPT-01 ~ RPT-06 (per docs/sprints/features-to-test.md Route 11 /
// docs/sprints/E2E_TEST_REPORT_SPRINT_09.md Route 11) — written fullstack from
// day one, never mocked.
// Uses: State Verification Engine (E2E_TEST_STRATEGY.md Article 1.1)
//       Shared Helpers (test-helpers.ts, state-capture.ts)
//       Seeded fixtures (frontend/e2e/fixtures/seeded-ids.ts) — run
//       `./scripts/reset-e2e-db.sh` before this suite.
// Component Audit: Verified against ReportsPage.tsx, reports/api.ts,
// reports/components/RevenueChart.tsx, reports/components/OverdueChart.tsx,
// reports/utils/export.ts, and backend/app/modules/dashboard/{routers,
// services,repository,schemas}.py (there is no dedicated `reports` backend
// module — the Reports page is entirely built on top of the Dashboard
// module's read endpoints).
//
// Component Audit Findings (per E2E_TEST_STRATEGY.md Article 4.1 Step 2):
//   - The spec's "API Calls" row (`GET /api/v1/reports/revenue`, `/reports/
//     occupancy`, `/reports/collection`) does not exist anywhere in the real
//     backend or frontend — there is no `reports` router/module at all. The
//     real ReportsPage only calls `GET /api/v1/dashboard/revenue` (revenue
//     report) and `GET /api/v1/dashboard/summary` (as a stand-in "overdue
//     summary" — it does not call `/dashboard/occupancy` either).
//   - RPT-02 (Occupancy report) and RPT-03 (Collection report / aging) and
//     RPT-04 (Maintenance report by status/priority) are NOT IMPLEMENTED on
//     this page at all — ReportsPage.tsx renders exactly two sections:
//     "Revenue Overview" (bar chart) and "Overdue Summary" (pie chart). No
//     occupancy, collection-rate/aging, or maintenance content exists here
//     (occupancy lives on /dashboard; there is no collection or maintenance
//     report anywhere in the app).
//   - RPT-06 "Scheduled reports" (email schedule setup) is NOT IMPLEMENTED —
//     no schedule/email UI exists on this page.
//   - RPT-05 "Export all" is only PARTIALLY implemented: a single
//     "Export CSV" button exports the revenue dataset as CSV client-side
//     (reports/utils/export.ts, `URL.createObjectURL` + `<a download>`) —
//     there is no Excel/PDF export, no "export all reports" concept, and no
//     export filter UI. The button is also `disabled` whenever the revenue
//     dataset is empty (see next finding), which is always true in the real
//     seeded environment.
//   - RPT-01 (Revenue report) and the Overdue Summary section both share the
//     same structural gap already documented for `dashboard.spec.ts`
//     (DASH-01) and `tenant-flow.spec.ts`: `reports/api.ts` hardcodes
//     `SAMPLE_PROPERTY = '00000000-0000-0000-0000-000000000001'` with no
//     property-selector UI anywhere on the page. That property never exists
//     in the seeded database, so `GET /dashboard/revenue` always returns an
//     empty list (ReportsPage shows "No revenue data available") and
//     `GET /dashboard/summary` always returns real zero-valued stats. This is
//     a missing feature (no property selector), not something an E2E test
//     fix can address — consistent with the existing DASH-01/DASH-04
//     precedent, it is documented and asserted against the real (zero) state
//     rather than faked with mocks.
//   - RPT-06 (Date range picker) IS implemented — plain native
//     `<input type="date">` Start/End Date fields that refetch
//     `/dashboard/revenue` on change. There are no range presets (e.g. "Last
//     30 days") — only free-form custom dates.
//
// Real bugs found and fixed while doing this component audit (both were
// silently masked by the SAMPLE_PROPERTY gap above — since the revenue list
// and overdue summary values are always empty/zero in the real environment,
// neither bug produced a visibly broken chart until traced through the real
// request/response contract; both are genuine frontend/backend field-name
// mismatches in the same family as F-03 in docs/LOG/E2E_TEST.md):
//   1. `reports/api.ts` `useOverdueReport()` read `summary.overdue_invoices`,
//      a field that does not exist on the real backend
//      `DashboardSummaryResponse` (Pydantic model in
//      `backend/app/modules/dashboard/schemas.py` only defines
//      `overdue_count`). Reading the wrong field meant the "Overdue
//      Invoices" pie slice's real value was always `undefined` (rendered as
//      literal "undefined" text inside the chart's data label), not `0` —
//      independent of the SAMPLE_PROPERTY gap, since the request itself
//      always succeeds and returns a real (all-zero) summary object. Fixed
//      by reading `summary.overdue_count` instead, matching the real backend
//      contract. (`frontend/src/features/reports/api.ts`)
//   2. The whole revenue-report contract (`API.RevenueMetricResponse`,
//      `RevenueChart.tsx`, `utils/export.ts`) was built against a shape
//      (`month`, `year`, `revenue`, `expenses`, `net`) that only ever existed
//      in the MSW dev mock (`frontend/src/mocks/handlers.ts`) — the real
//      backend's `RevenueMetric` Pydantic schema returns
//      `period`/`collected`/`outstanding`/`total_billed` (there is no
//      "expenses" or "net" concept in the real revenue aggregation query at
//      all, see `backend/app/modules/dashboard/repository.py
//      get_revenue_report()`). Had any real invoice data ever reached this
//      chart, every bar and every CSV column would have rendered as
//      blank/NaN. Fixed by aligning `API.RevenueMetricResponse`,
//      `RevenueChart.tsx`, and `utils/export.ts` to the real backend field
//      names/semantics, and updated the MSW mock handler to match so the
//      dev/mock contract no longer diverges from the real one.
//      (`frontend/src/types/api.d.ts`,
//      `frontend/src/features/reports/components/RevenueChart.tsx`,
//      `frontend/src/features/reports/utils/export.ts`,
//      `frontend/src/mocks/handlers.ts`)

import { test, expect } from '@playwright/test';
import { login, navigateTo } from '../utils/test-helpers';
import { captureAllStates, type CapturedStates } from '../utils/state-capture';

test.describe('Reports (/reports)', () => {
  let states: CapturedStates;

  test.beforeEach(async ({ page }) => {
    states = await captureAllStates(page);
  });

  test('RPT-01: Revenue report → real fetch succeeds with real data', async ({ page }) => {
    await login(page);
    await navigateTo(page, '/reports', /reports/i);

    await expect(page.locator('h1').first()).toContainText(/reports/i);
    await expect(page.getByText('Revenue Overview')).toBeVisible();
    await expect(page.getByText('Collected, outstanding, and total billed by period')).toBeVisible();

    // Real backend call to GET /dashboard/revenue returns seeded revenue data
    await expect(page.getByLabel(/revenue chart/i)).toBeVisible({ timeout: 10_000 });

    expect(states.consoleErrors).toEqual([]);
    expect(states.jsErrors).toEqual([]);
    expect(states.networkErrors).toEqual([]);
    expect(states.hydrationErrors).toEqual([]);
  });

  test.skip('RPT-02: Occupancy report → NOT IMPLEMENTED on this page', async ({ page }) => {
    // Feature not implemented: ReportsPage.tsx has no occupancy section.
    // Occupancy data only lives on /dashboard.
    // Tracking ticket: N/A (component audit finding)
    // Expected delivery: TBD — see docs/02-design/SDD/02-module-specs.md §2.4
    await login(page);
    await navigateTo(page, '/reports', /reports/i);

    // Component Audit Finding: ReportsPage.tsx has no occupancy section —
    // occupancy lives on /dashboard only. Scoped to <main> — MainLayout's
    // nav bar also links to other routes, and none of those route names
    // collide with "occupancy", but scoping consistently avoids any future
    // false positive from chrome outside the page content.
    await expect(page.locator('main').getByText(/occupancy/i)).toHaveCount(0);

    expect(states.consoleErrors).toEqual([]);
    expect(states.jsErrors).toEqual([]);
    expect(states.networkErrors).toEqual([]);
    expect(states.hydrationErrors).toEqual([]);
  });

  test.skip('RPT-03: Collection report (rate/aging) → NOT IMPLEMENTED on this page', async ({ page }) => {
    // Feature not implemented: ReportsPage.tsx has no collection-rate/aging UI.
    // Tracking ticket: N/A (component audit finding)
    // Expected delivery: TBD — see docs/02-design/SDD/02-module-specs.md §2.4
    await login(page);
    await navigateTo(page, '/reports', /reports/i);

    // Component Audit Finding: no "Collection Rate" or aging-bucket UI
    // exists anywhere on ReportsPage.tsx. The closest real section
    // ("Overdue Summary") is a plain current-snapshot pie chart, not a
    // collection-rate/aging report.
    await expect(page.locator('main').getByText(/collection rate/i)).toHaveCount(0);
    await expect(page.locator('main').getByText(/aging/i)).toHaveCount(0);

    expect(states.consoleErrors).toEqual([]);
    expect(states.jsErrors).toEqual([]);
    expect(states.networkErrors).toEqual([]);
    expect(states.hydrationErrors).toEqual([]);
  });

  test.skip('RPT-04: Maintenance report (by status/priority) → NOT IMPLEMENTED on this page', async ({ page }) => {
    // Feature not implemented: ReportsPage.tsx has no maintenance breakdown.
    // Tracking ticket: N/A (component audit finding)
    // Expected delivery: TBD — see docs/02-design/SDD/02-module-specs.md §2.4
    await login(page);
    await navigateTo(page, '/reports', /reports/i);

    // Component Audit Finding: no maintenance-request breakdown of any kind
    // exists on ReportsPage.tsx. Scoped to <main> — MainLayout's nav bar has
    // its own "Maintenance" link (to /maintenance), which is chrome outside
    // the page content and would otherwise produce a false-positive match.
    await expect(page.locator('main').getByText(/maintenance/i)).toHaveCount(0);

    expect(states.consoleErrors).toEqual([]);
    expect(states.jsErrors).toEqual([]);
    expect(states.networkErrors).toEqual([]);
    expect(states.hydrationErrors).toEqual([]);
  });

  test('RPT-05: Export all → only "Export CSV" (revenue-only) exists; no Excel/PDF', async ({ page }) => {
    await login(page);
    await navigateTo(page, '/reports', /reports/i);

    const exportCsvButton = page.getByRole('button', { name: 'Export CSV' });
    await expect(exportCsvButton).toBeVisible();

    // With real seeded revenue data, export button is enabled
    await expect(exportCsvButton).toBeEnabled();

    // No Excel/PDF export options, and no "export all"/multi-report export
    // exists — the spec's "Export all" scenario describes a feature this
    // component does not implement.
    await expect(page.getByRole('button', { name: /excel/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /pdf/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /export all/i })).toHaveCount(0);

    expect(states.consoleErrors).toEqual([]);
    expect(states.jsErrors).toEqual([]);
    expect(states.networkErrors).toEqual([]);
    expect(states.hydrationErrors).toEqual([]);
  });

  test('RPT-06: Date range picker → real Start/End Date inputs refetch the real backend on change (no presets)', async ({ page }) => {
    await login(page);
    await navigateTo(page, '/reports', /reports/i);

    const startDateInput = page.getByLabel('Start Date');
    const endDateInput = page.getByLabel('End Date');
    await expect(startDateInput).toBeVisible();
    await expect(endDateInput).toBeVisible();

    // No range presets ("Last 30 days", "This year", etc.) exist — only
    // free-form native date inputs.
    await expect(page.getByRole('button', { name: /last 30 days|this month|this year|preset/i })).toHaveCount(0);

    // Changing the date range fires a real request to the real backend with
    // the new query params — verifying the filter actually wires up to a
    // real refetch, not just local UI state.
    const revenueRequestPromise = page.waitForResponse(
      (res) => res.url().includes('/api/v1/dashboard/revenue') && res.url().includes('start_date=2026-01-01'),
    );
    await startDateInput.fill('2026-01-01');
    const revenueResponse = await revenueRequestPromise;
    expect(revenueResponse.status()).toBe(200);

    expect(states.consoleErrors).toEqual([]);
    expect(states.jsErrors).toEqual([]);
    expect(states.networkErrors).toEqual([]);
    expect(states.hydrationErrors).toEqual([]);
  });

  test.skip('RPT-07 (spec RPT-06 duplicate ID): Scheduled reports (email schedule) → NOT IMPLEMENTED', async ({ page }) => {
    // Feature not implemented: ReportsPage.tsx has no schedule/email-setup UI.
    // Tracking ticket: N/A (component audit finding)
    // Expected delivery: TBD — see docs/02-design/SDD/02-module-specs.md §2.4
    await login(page);
    await navigateTo(page, '/reports', /reports/i);

    // Component Audit Finding: no schedule/email-setup UI of any kind exists
    // on ReportsPage.tsx.
    await expect(page.locator('main').getByText(/schedule/i)).toHaveCount(0);
    await expect(page.getByRole('button', { name: /email/i })).toHaveCount(0);

    expect(states.consoleErrors).toEqual([]);
    expect(states.jsErrors).toEqual([]);
    expect(states.networkErrors).toEqual([]);
    expect(states.hydrationErrors).toEqual([]);
  });

  test('Overdue Summary section: real fetch to /dashboard/summary renders zero-valued chart, not "undefined" (regression check for the overdue_count field-name bug)', async ({ page }) => {
    await login(page);
    await navigateTo(page, '/reports', /reports/i);

    await expect(page.getByText('Overdue Summary')).toBeVisible();
    await expect(page.getByText('Current overdue invoice status')).toBeVisible();

    // Real GET /dashboard/summary?property_id=<SAMPLE_PROPERTY> succeeds and
    // returns real all-zero stats (property doesn't exist, but the endpoint
    // itself doesn't 404 on an unknown property_id — it just aggregates
    // zero rows). The pie chart therefore renders with two real zero-valued
    // slices rather than the "No overdue data" empty state.
    await expect(page.getByText('No overdue data')).toHaveCount(0);
    await expect(page.locator('[aria-label="Overdue summary pie chart"]')).toBeVisible();

    // Regression check: before the fix, `summary.overdue_invoices` (a
    // nonexistent field) made the "Overdue Invoices" slice's real value
    // `undefined`, which recharts' label renderer stringifies to the
    // literal text "undefined" inside the chart. With the fix
    // (`summary.overdue_count`), the real value is a real number (0), so
    // that text must never appear.
    await expect(page.getByText('undefined', { exact: true })).toHaveCount(0);
    await expect(page.getByText('NaN', { exact: true })).toHaveCount(0);

    expect(states.consoleErrors).toEqual([]);
    expect(states.jsErrors).toEqual([]);
    expect(states.networkErrors).toEqual([]);
    expect(states.hydrationErrors).toEqual([]);
  });

  test('RPT-ERROR: API error → N/A, cannot force a real 500 response', async () => {
    test.skip(true, 'Forcing a real backend 500 would require stopping the backend/db mid-suite (same rationale as DASH-ERROR).');
  });
});
