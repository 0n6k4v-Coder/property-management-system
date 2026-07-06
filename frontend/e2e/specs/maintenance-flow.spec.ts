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

import { test, expect } from '@playwright/test';
import { login } from '../utils/test-helpers';
import { captureAllStates, type CapturedStates } from '../utils/state-capture';
import { SEEDED_DATA } from '../fixtures/seeded-ids';

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
});

// Verification:
//   ./scripts/reset-e2e-db.sh && cd frontend && npx playwright test e2e/specs/maintenance-flow.spec.ts --reporter=list
