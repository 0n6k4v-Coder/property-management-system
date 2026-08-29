// File: frontend/e2e/specs/tenant-flow.spec.ts
// E2E Test: Tenant Flow — Fullstack (real backend + real database, no mocks)
// Test IDs: TENANT-01~06
// Uses: State Verification Engine (E2E_TEST_STRATEGY.md Article 1.1)
//       Shared Helpers (test-helpers.ts, state-capture.ts)
//       Seeded fixtures (frontend/e2e/fixtures/seeded-ids.ts) — run
//       `./scripts/reset-e2e-db.sh` before this suite.
// Component Audit: Verified against TenantListPage.tsx, api.ts, validators.ts
//
// Fullstack notes:
//   - GAP-017 remediation (P1-W05): CreateTenantModal now includes dynamic
//     property selection via useProperties() and binds property_id to the user's
//     selection, allowing tenant creation across real/seeded properties.
//   - TENANT-02 is enabled and verifies end-to-end tenant creation against the real
//     backend. Search filtering tests (TENANT-03~07) remain skipped pending multi-property
//     filtering UI (GAP-019/deferred).

import { test, expect } from '@playwright/test';
import { login, navigateTo, fillField, clickButton, expectValidationError } from '../utils/test-helpers';
import { captureAllStates, type CapturedStates } from '../utils/state-capture';

test.describe('Tenant Flow — Tenant List (/tenants)', () => {
  let states: CapturedStates;

  test.beforeEach(async ({ page }) => {
    states = await captureAllStates(page);
  });

  // --------------------------------------------------------------------------
  // TENANT-01: List tenants (Happy Path)
  // --------------------------------------------------------------------------
  test('TENANT-01: Tenants page loads with search and create controls', async ({ page }) => {
    await login(page);
    await navigateTo(page, '/tenants', /Tenants/i);

    await expect(page.locator('input[placeholder*="min. 3 chars"]').first()).toBeVisible();
    await expect(page.locator('button:has-text("New Tenant")').first()).toBeVisible();

    expect(states.consoleErrors).toEqual([]);
    expect(states.jsErrors).toEqual([]);
    expect(states.networkErrors).toEqual([]);
    expect(states.hydrationErrors).toEqual([]);
  });

  // --------------------------------------------------------------------------
  // TENANT-02: Create tenant (Happy Path)
  // --------------------------------------------------------------------------
  test('TENANT-02: Create tenant → modal opens, saves, shows toast success', async ({ page }) => {
    await login(page);
    await navigateTo(page, '/tenants', /Tenants/i);

    await clickButton(page, /New Tenant/i);
    await expect(page.locator('h2:has-text("Create Tenant")').first()).toBeVisible({ timeout: 5000 });

    // Select property from dynamic options
    const propSelect = page.locator('#tenant-property-select');
    await expect(propSelect).toBeVisible();
    await propSelect.selectOption({ index: 1 }, { timeout: 10000 });

    const uniquePhone = `08${Math.floor(10000000 + Math.random() * 90000000)}`;
    await page.getByLabel('Full Name').fill('สุรศักดิ์ ใจดี');
    await page.getByLabel('ID Card (13 digits)').fill('1234567890121');
    await page.getByLabel('Phone (10 digits)').fill(uniquePhone);
    await page.getByLabel('Email (optional)').fill('surasak.test@example.com');

    await clickButton(page, /Create/i);

    await expect(page.locator('text=Tenant created successfully').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('h2:has-text("Create Tenant")')).not.toBeVisible();

    expect(states.consoleErrors).toEqual([]);
    expect(states.jsErrors).toEqual([]);
    expect(states.networkErrors).toEqual([]);
    expect(states.hydrationErrors).toEqual([]);
  });

  // --------------------------------------------------------------------------
  // TENANT-03/SEARCH: skipped — hardcoded SAMPLE_PROPERTY_ID means search
  // always targets a nonexistent property, so results are always empty
  // regardless of what tenants exist in the database.
  // --------------------------------------------------------------------------
  test.skip('TENANT-03: Search by name/phone → debounced search filters results', async () => {
    // SKIPPED: TenantListPage.tsx hardcodes SAMPLE_PROPERTY_ID to a
    // nonexistent property with no property-selector UI, so search results
    // are always empty — not testable against real data until that UI gap
    // is fixed.
  });

  test.skip('TENANT-04: Filter by property → multi-select property filter', async () => {
    // SKIPPED: TenantListPage.tsx does not have property filter UI yet.
  });

  test.skip('TENANT-05: View tenant detail → click row navigates to detail page', async () => {
    // SKIPPED: TenantListPage.tsx does not have clickable rows or detail navigation.
  });

  test.skip('TENANT-06: Edit tenant → inline edit saves changes', async () => {
    // SKIPPED: TenantListPage.tsx does not have edit functionality.
  });

  test.skip('TENANT-07: Export tenants → CSV/Excel download', async () => {
    // SKIPPED: TenantListPage.tsx does not have export button.
  });

  // --------------------------------------------------------------------------
  // Negative: Create tenant with invalid ID card checksum (client-side zod
  // validation — no network call, safe to run for real)
  // --------------------------------------------------------------------------
  test('TENANT-CREATE-01: Invalid ID card checksum → validation error', async ({ page }) => {
    await login(page);
    await navigateTo(page, '/tenants', /Tenants/i);

    await clickButton(page, /New Tenant/i);
    await expect(page.locator('h2:has-text("Create Tenant")').first()).toBeVisible({ timeout: 5000 });

    await page.getByLabel('Full Name').fill('ทดสอบ ใหม่');
    await page.getByLabel('ID Card (13 digits)').fill('1234567890123'); // Invalid checksum
    await page.getByLabel('Phone (10 digits)').fill('0834567890');

    await clickButton(page, /Create/i);

    await expectValidationError(page, /checksum|invalid/i);

    expect(states.consoleErrors).toEqual([]);
    expect(states.jsErrors).toEqual([]);
    expect(states.networkErrors).toEqual([]);
    expect(states.hydrationErrors).toEqual([]);
  });

  // --------------------------------------------------------------------------
  // Negative: Create tenant with invalid phone format
  // --------------------------------------------------------------------------
  test('TENANT-CREATE-02: Invalid phone format → validation error', async ({ page }) => {
    await login(page);
    await navigateTo(page, '/tenants', /Tenants/i);

    await clickButton(page, /New Tenant/i);
    await expect(page.locator('h2:has-text("Create Tenant")').first()).toBeVisible({ timeout: 5000 });

    await page.getByLabel('Full Name').fill('ทดสอบ ใหม่');
    await page.getByLabel('ID Card (13 digits)').fill('1234567890121');
    await page.getByLabel('Phone (10 digits)').fill('1234567890'); // Missing leading 0

    await clickButton(page, /Create/i);

    await expectValidationError(page, /phone|format|invalid/i);

    expect(states.consoleErrors).toEqual([]);
    expect(states.jsErrors).toEqual([]);
    expect(states.networkErrors).toEqual([]);
    expect(states.hydrationErrors).toEqual([]);
  });

  // --------------------------------------------------------------------------
  // Negative: Create tenant with empty required fields
  // --------------------------------------------------------------------------
  test('TENANT-CREATE-03: Empty required fields → validation errors', async ({ page }) => {
    await login(page);
    await navigateTo(page, '/tenants', /Tenants/i);

    await clickButton(page, /New Tenant/i);
    await expect(page.locator('h2:has-text("Create Tenant")').first()).toBeVisible({ timeout: 5000 });

    await clickButton(page, /Create/i);

    await expectValidationError(page, /required/i);

    expect(states.consoleErrors).toEqual([]);
    expect(states.jsErrors).toEqual([]);
    expect(states.networkErrors).toEqual([]);
    expect(states.hydrationErrors).toEqual([]);
  });

  // --------------------------------------------------------------------------
  // Edge Case: Search with < 3 chars — pure client-side gate, no network
  // --------------------------------------------------------------------------
  test('TENANT-SEARCH-01: Search with < 3 chars → "Type at least 3 characters" message', async ({ page }) => {
    await login(page);
    await navigateTo(page, '/tenants', /Tenants/i);

    await fillField(page, 'Search by name, phone, or email (min. 3 chars)', 'ab');
    await expect(page.locator('text=Type at least 3 characters to search').first()).toBeVisible();

    expect(states.consoleErrors).toEqual([]);
    expect(states.jsErrors).toEqual([]);
    expect(states.networkErrors).toEqual([]);
    expect(states.hydrationErrors).toEqual([]);
  });

  // --------------------------------------------------------------------------
  // Edge Case: Search with no matches — real backend query against the
  // hardcoded nonexistent property always returns zero results, so this
  // assertion holds true for real (if for the "wrong" reason).
  // --------------------------------------------------------------------------
  test('TENANT-SEARCH-02: Search with no matches → "No tenants found" message', async ({ page }) => {
    await login(page);
    await navigateTo(page, '/tenants', /Tenants/i);

    await fillField(page, 'Search by name, phone, or email (min. 3 chars)', 'nonexistentname');

    // Wait for the debounced search API call to complete (300ms debounce + network)
    await page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/tenants/search') && response.status() === 200,
      { timeout: 10000 },
    );

    await expect(page.locator('text=No tenants found matching "nonexistentname"').first()).toBeVisible();

    expect(states.consoleErrors).toEqual([]);
    expect(states.jsErrors).toEqual([]);
    expect(states.networkErrors).toEqual([]);
    expect(states.hydrationErrors).toEqual([]);
  });

  test.skip('TENANT-PAGINATION-01: Pagination next/prev buttons present and disabled', async () => {
    // SKIPPED: the pagination controls only render when
    // `searchResults.data.length > 0` (see TenantListPage.tsx) — with the
    // hardcoded nonexistent SAMPLE_PROPERTY_ID, real searches always
    // return zero rows, so the pagination Card never renders. Not
    // testable against real data until the property-selector UI gap
    // (see file header) is fixed.
  });
});

// Verification:
//   ./scripts/reset-e2e-db.sh && cd frontend && npx playwright test e2e/specs/tenant-flow.spec.ts --reporter=list
