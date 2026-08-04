// File: frontend/e2e/specs/property-flow.spec.ts
// E2E Test: Property Management Flow — Fullstack (real backend + real database, no mocks)
// Test IDs: PROP-01~08 (/property), PROP-DET-01~06 (/property/:id), ROOM-01~06 (/property/rooms/:id)
// Uses: State Verification Engine (E2E_TEST_STRATEGY.md Article 1.1)
//       Shared Helpers (test-helpers.ts, state-capture.ts)
//       Seeded fixtures (frontend/e2e/fixtures/seeded-ids.ts) — run
//       `./scripts/reset-e2e-db.sh` before this suite.
// Component Audit: Verified against PropertyListPage.tsx, PropertyDetailPage.tsx, RoomDetailPage.tsx, api.ts
//
// Component Audit Findings (per E2E_TEST_STRATEGY.md Article 4.1 Step 2):
//   - PropertyListPage.tsx has NO search/filter/sort/pagination/delete controls — PROP-03~07 are
//     NOT IMPLEMENTED in the component. Tests below assert that absence rather than skipping the ID.
//   - PropertyDetailPage.tsx has NO inline edit, add-building, or delete-building UI, and NO tabs
//     at all — PROP-DET-02~05 are NOT IMPLEMENTED. The tabbed interface the spec describes for
//     "property detail" actually lives on RoomDetailPage.tsx (tested under ROOM-* below).
//   - RoomDetailPage.tsx does not fetch any room data — Overview tab shows placeholder "—" for
//     Type/Base Rent/Floor/Building and a hardcoded "available" badge. There is no status editor,
//     no tenant assignment, and Contract/Meter tabs are static "coming in Sprint 3/4+" placeholders —
//     ROOM-02~06 are NOT IMPLEMENTED.
//
// Fullstack notes:
//   - PROP-08 (empty state) and the "API failure" resilience check both required forcing the
//     properties endpoint into a specific state via mocks. The real GET /properties endpoint
//     always returns every seeded property with no filter — there's no way to produce a real
//     empty/failed response without a separate, isolated environment, so both are skipped here
//     with a clear reason rather than faked.

import { test, expect, type Page } from '@playwright/test';
import { login, navigateTo } from '../utils/test-helpers';
import { captureAllStates, type CapturedStates } from '../utils/state-capture';
import { SEEDED, SEEDED_DATA } from '../fixtures/seeded-ids';

const ROOM_101_SHORT_ID = SEEDED.room101Id.slice(0, 8);

async function navigateToPropertyDetail(page: Page, propertyId = SEEDED.propertySunsetId): Promise<void> {
  await page.goto(`/property/${propertyId}`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle');
}

async function navigateToRoomDetail(page: Page, roomId = SEEDED.room101Id): Promise<void> {
  await page.goto(`/property/rooms/${roomId}`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle');
  // RoomDetailPage.tsx has no <h1> — wait for the tablist instead.
  await expect(page.getByRole('tablist')).toBeVisible({ timeout: 30000 });
}

// ============================================================================
// PROP Test Suite — Route: /property (PropertyListPage) — 8 Test Cases
// ============================================================================

test.describe('Property List (/property)', () => {
  let states: CapturedStates;

  test.beforeEach(async ({ page }) => {
    states = await captureAllStates(page);
  });

  test('PROP-01: List all properties → shows all property cards', async ({ page }) => {
    await login(page);
    await navigateTo(page, '/property', /Property Management/i);

    await expect(page.getByRole('button', { name: /Sunset Tower/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Riverside Apartments/i })).toBeVisible();
    await expect(page.getByText(SEEDED_DATA.property.sunset.address)).toBeVisible();
    await expect(page.getByText(SEEDED_DATA.property.riverside.address)).toBeVisible();

    expect(states.consoleErrors).toEqual([]);
    expect(states.jsErrors).toEqual([]);
    expect(states.networkErrors).toEqual([]);
    expect(states.hydrationErrors).toEqual([]);
  });

  test('PROP-02: Create property → modal opens, submits, and closes', async ({ page }) => {
    await login(page);
    await navigateTo(page, '/property', /Property Management/i);

    await page.getByRole('button', { name: /\+ Create Property/i }).click();
    await expect(page.getByText('Create New Property').first()).toBeVisible();

    const uniqueName = `E2E Test Property ${Date.now()}`;
    await page.getByLabel('Property Name').fill(uniqueName);
    await page.getByLabel('Address').fill('789 New St');
    await page.getByLabel('Billing Due Day').fill('10');
    await page.getByLabel('Min Deposit (months)').fill('2');

    await page.getByRole('button', { name: /^Create Property$/i }).click();

    // Modal unmounts entirely on success (Modal returns null when open=false)
    await expect(page.getByRole('dialog', { name: 'Create New Property' })).not.toBeVisible({ timeout: 10000 });

    expect(states.consoleErrors).toEqual([]);
    expect(states.jsErrors).toEqual([]);
    expect(states.hydrationErrors).toEqual([]);
  });

  test('PROP-03: Search by name → NOT IMPLEMENTED in component', async ({ page }) => {
    await login(page);
    await navigateTo(page, '/property', /Property Management/i);

    // PropertyListPage.tsx has no search input of any kind.
    await expect(page.getByPlaceholder(/search/i)).toHaveCount(0);
    await expect(page.getByRole('searchbox')).toHaveCount(0);
  });

  test('PROP-04: Filter by status → NOT IMPLEMENTED in component', async ({ page }) => {
    await login(page);
    await navigateTo(page, '/property', /Property Management/i);

    // No filter dropdown/select exists on this page.
    await expect(page.getByRole('combobox', { name: /status/i })).toHaveCount(0);
  });

  test('PROP-05: Sort by name/created → NOT IMPLEMENTED in component', async ({ page }) => {
    await login(page);
    await navigateTo(page, '/property', /Property Management/i);

    // No sort control exists on this page.
    await expect(page.getByRole('button', { name: /sort/i })).toHaveCount(0);
  });

  test('PROP-06: Pagination → NOT IMPLEMENTED in component', async ({ page }) => {
    await login(page);
    await navigateTo(page, '/property', /Property Management/i);

    // No pagination controls (Next/Prev, page size) exist on this page.
    await expect(page.getByRole('button', { name: /next|prev/i })).toHaveCount(0);
  });

  test('PROP-07: Delete property → NOT IMPLEMENTED in component', async ({ page }) => {
    await login(page);
    await navigateTo(page, '/property', /Property Management/i);

    // No delete button exists anywhere in the property card or list.
    await expect(page.getByRole('button', { name: /delete/i })).toHaveCount(0);
  });

  test('PROP-08: Empty state → N/A, cannot force a real empty list', async () => {
    // The real GET /properties endpoint always returns every seeded property
    // with no filter param — producing a genuine empty-list response would
    // require a separate, isolated database. Not exercisable against the
    // shared fullstack fixture data.
    test.skip(true, 'Real /properties endpoint has no filter — cannot produce an empty response against shared fixture data');
  });

  test('API failure on property list → N/A, cannot force a real 500 response', async () => {
    test.skip(true, 'Forcing a real backend 500 would require stopping the backend/db mid-suite');
  });
});

// ============================================================================
// PROP-DET Test Suite — Route: /property/:id (PropertyDetailPage) — 6 Test Cases
// ============================================================================

test.describe('Property Detail (/property/:id)', () => {
  let states: CapturedStates;

  test.beforeEach(async ({ page }) => {
    states = await captureAllStates(page);
  });

  test('PROP-DET-01: View property details → property info + rooms render', async ({ page }) => {
    await login(page);
    await navigateToPropertyDetail(page);

    await expect(page.locator('h1').first()).toContainText('Sunset Tower', { timeout: 30000 });
    await expect(page.getByText(SEEDED_DATA.property.sunset.address)).toBeVisible();
    await expect(page.getByText(`Day ${SEEDED_DATA.property.sunset.billingDueDay}`)).toBeVisible();
    await expect(page.getByText(`${SEEDED_DATA.property.sunset.minDepositMonths} months`)).toBeVisible();

    await expect(page.getByRole('link', { name: /Room 101/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Room 102/i })).toBeVisible();
    await expect(page.getByText('฿5,000')).toBeVisible();

    expect(states.consoleErrors).toEqual([]);
    expect(states.jsErrors).toEqual([]);
    expect(states.networkErrors).toEqual([]);
    expect(states.hydrationErrors).toEqual([]);
  });

  test('PROP-DET-02: Edit property → NOT IMPLEMENTED in component', async ({ page }) => {
    await login(page);
    await navigateToPropertyDetail(page);
    await expect(page.locator('h1').first()).toContainText('Sunset Tower', { timeout: 30000 });

    // PropertyDetailPage.tsx has no inline edit control anywhere.
    await expect(page.getByRole('button', { name: /edit/i })).toHaveCount(0);
  });

  test('PROP-DET-03: Add building → NOT IMPLEMENTED in component', async ({ page }) => {
    await login(page);
    await navigateToPropertyDetail(page);
    await expect(page.locator('h1').first()).toContainText('Sunset Tower', { timeout: 30000 });

    // No "Add building" modal/button exists.
    await expect(page.getByRole('button', { name: /add building/i })).toHaveCount(0);
  });

  test('PROP-DET-04: Delete building → NOT IMPLEMENTED in component', async ({ page }) => {
    await login(page);
    await navigateToPropertyDetail(page);
    await expect(page.locator('h1').first()).toContainText('Sunset Tower', { timeout: 30000 });

    // No "Delete building" control exists.
    await expect(page.getByRole('button', { name: /delete building/i })).toHaveCount(0);
  });

  test('PROP-DET-05: Switch tabs → N/A on this page, no tabs implemented', async ({ page }) => {
    await login(page);
    await navigateToPropertyDetail(page);
    await expect(page.locator('h1').first()).toContainText('Sunset Tower', { timeout: 30000 });

    // PropertyDetailPage.tsx renders a single view (Property Info + Rooms grid) with
    // no tablist at all — the tabbed interface the spec describes lives on the Room
    // Detail page instead (see ROOM-* tests below, which cover the real tab behavior).
    await expect(page.getByRole('tablist')).toHaveCount(0);
  });

  test('PROP-DET-06: Invalid ID → shows "Property not found."', async ({ page }) => {
    await login(page);
    // Real backend: a syntactically valid but non-existent UUID genuinely 404s.
    await navigateToPropertyDetail(page, '00000000-0000-0000-0000-000000000000');

    await expect(page.getByText('Property not found.')).toBeVisible({ timeout: 30000 });
    expect(states.jsErrors).toEqual([]);
    expect(states.hydrationErrors).toEqual([]);
  });

  test('Back navigation → returns to property list from detail', async ({ page }) => {
    await login(page);
    await page.goto('/property');
    await expect(page.locator('h1').first()).toContainText('Property Management', { timeout: 30000 });

    await page.getByRole('button', { name: /Sunset Tower/i }).click();
    await expect(page.locator('h1').first()).toContainText('Sunset Tower', { timeout: 30000 });

    await page.getByText('Back to properties').click();

    await expect(page.getByRole('button', { name: /Sunset Tower/i })).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole('button', { name: /Riverside Apartments/i })).toBeVisible();
  });
});

// ============================================================================
// ROOM Test Suite — Route: /property/rooms/:id (RoomDetailPage) — 6 Test Cases
// ============================================================================

test.describe('Room Detail (/property/rooms/:id)', () => {
  let states: CapturedStates;

  test.beforeEach(async ({ page }) => {
    states = await captureAllStates(page);
  });

  test('ROOM-01: View room details → breadcrumb + Overview tab render (placeholder data)', async ({ page }) => {
    await login(page);
    await navigateToRoomDetail(page);

    // RoomDetailPage.tsx does not fetch room data — it only reads the :id param.
    await expect(page.getByText(new RegExp(`^Room ${ROOM_101_SHORT_ID}`))).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('Room Details')).toBeVisible();
    await expect(page.getByText('available').first()).toBeVisible();

    expect(states.consoleErrors).toEqual([]);
    expect(states.jsErrors).toEqual([]);
    expect(states.hydrationErrors).toEqual([]);
  });

  test('ROOM-02: Edit room status → NOT IMPLEMENTED in component', async ({ page }) => {
    await login(page);
    await navigateToRoomDetail(page);

    // Status is rendered as a static Badge ("available") — no editable control.
    // A useUpdateRoomStatus() hook exists in api.ts but is never wired to any UI.
    await expect(page.getByRole('button', { name: /available|occupied|maintenance/i })).toHaveCount(0);
    await expect(page.getByRole('combobox')).toHaveCount(0);
  });

  test('ROOM-03: Assign tenant → NOT IMPLEMENTED in component', async ({ page }) => {
    await login(page);
    await navigateToRoomDetail(page);

    await page.getByRole('tab', { name: 'Contract' }).click();
    await expect(page.getByText('No active contract for this room.')).toBeVisible();
    await expect(page.getByText(/available in Sprint 3/i)).toBeVisible();

    // "Create Contract" (the closest control to tenant assignment) is present but disabled.
    await expect(page.getByRole('button', { name: 'Create Contract' })).toBeDisabled();
  });

  test('ROOM-04: Unassign tenant → NOT IMPLEMENTED in component', async ({ page }) => {
    await login(page);
    await navigateToRoomDetail(page);

    await page.getByRole('tab', { name: 'Contract' }).click();
    // No contract exists and no unassign/end-lease control exists anywhere on this tab.
    await expect(page.getByText('No active contract for this room.')).toBeVisible();
    await expect(page.getByRole('button', { name: /unassign|end lease/i })).toHaveCount(0);
  });

  test('ROOM-05: Add meter reading → NOT IMPLEMENTED in component', async ({ page }) => {
    await login(page);
    await navigateToRoomDetail(page);

    await page.getByRole('tab', { name: 'Meter History' }).click();
    await expect(page.getByText('Meter reading history will appear here.')).toBeVisible();
    await expect(page.getByText(/available in Sprint 4/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /add reading/i })).toHaveCount(0);
  });

  test('ROOM-06: View meter history → NOT IMPLEMENTED in component', async ({ page }) => {
    await login(page);
    await navigateToRoomDetail(page);

    await page.getByRole('tab', { name: 'Meter History' }).click();
    // Placeholder text only — no chart, table, or pagination control exists.
    await expect(page.getByText('Meter reading history will appear here.')).toBeVisible();
    await expect(page.getByRole('table')).toHaveCount(0);
  });

  test('Tab switching → Overview, Contract, Meter History all reachable', async ({ page }) => {
    await login(page);
    await navigateToRoomDetail(page);

    await page.getByRole('tab', { name: 'Contract' }).click();
    await expect(page.getByText('No active contract for this room.')).toBeVisible();

    await page.getByRole('tab', { name: 'Meter History' }).click();
    await expect(page.getByText('Meter reading history will appear here.')).toBeVisible();

    await page.getByRole('tab', { name: 'Overview' }).click();
    await expect(page.getByText('Room Details')).toBeVisible();

    expect(states.consoleErrors).toEqual([]);
    expect(states.jsErrors).toEqual([]);
    expect(states.hydrationErrors).toEqual([]);
  });
});

// Verification:
//   ./scripts/reset-e2e-db.sh && cd frontend && npx playwright test e2e/specs/property-flow.spec.ts --reporter=list
//   Expected: 18 Test-ID cases pass, 2 skipped (PROP-08 + API-failure — real-empty/real-500 not producible), 3 cross-cutting cases pass
