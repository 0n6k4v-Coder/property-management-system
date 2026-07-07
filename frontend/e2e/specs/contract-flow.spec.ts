// File: frontend/e2e/specs/contract-flow.spec.ts
// E2E Test: Contract Management Flow — Fullstack (real backend + real database, no mocks)
// Flow: visit /contracts → view list → click detail → terminate → assert status updated
// Uses: State Verification Engine (E2E_TEST_STRATEGY.md Article 1.1)
//       Shared Helpers (test-helpers.ts, state-capture.ts)
//       Seeded fixtures (frontend/e2e/fixtures/seeded-ids.ts) — run
//       `./scripts/reset-e2e-db.sh` before this suite.
// Component Audit: Verified against ContractListPage.tsx, ContractDetailPage.tsx,
//                  ContractFormPage.tsx, contract/api.ts (2026-07-07).
//
// Fullstack notes:
//   - The terminate test creates its own throwaway contract (via a direct
//     API call, room 101 which has no existing contract) rather than
//     terminating the shared seeded contract on room 102 — terminating the
//     shared fixture would break every other spec file that depends on
//     room 102 having an active contract.
//   - CONT-02 (create) and CONT-05 (renew) use the deterministic seeded
//     rooms 103 / 104 (added to backend/scripts/seed_e2e.py + seeded-ids.ts)
//     so they never collide with BR-01 "one active contract per room" against
//     the shared room 101/102 fixtures.
//   - Form selectors target the real DOM ids (#property-select, #room-select,
//     #tenant-search) — the form uses plain <select>/<input> (not the shared
//     <Input> component) for property/room/tenant, and <Input> for the rest.
//     Room options render as "103 (studio) — available". Submit navigates back
//     to /contracts (not /contracts/{id}) and shows a success toast.
//
// Known limitations / bugs found & handled in this E2E task (see docs/LOG/E2E_TEST.md Part F):
//   F-20 — CONT-08 lease/contract history: `useLeaseHistory()` hook + backend
//     `GET /leases/{room_id}/history` exist but are dead code (frontend calls
//     wrong URL `/leases/...` vs real `/contracts/leases/...`, and ZERO
//     components render a history section). Asserted as absence. NOT fixed
//     (documented gap — building the UI is out of E2E scope).
//   F-21 — CONT-05 renew: `POST /contracts/{id}/renew` creates a NEW contract
//     (new id) but the UI stayed on the terminated original, so renewed terms
//     were never shown. FIXED at source: `handleRenew()` now navigates to the
//     new contract after a successful renew.

import { test, expect, type APIRequestContext } from '@playwright/test';
import { login } from '../utils/test-helpers';
import { captureAllStates, type CapturedStates } from '../utils/state-capture';
import { SEEDED } from '../fixtures/seeded-ids';

async function loginForApi(request: APIRequestContext): Promise<string> {
  const res = await request.post('/api/v1/auth/login', {
    data: { email: 'admin@example.com', password: 'Admin123!' },
  });
  const body = await res.json();
  return body.data.access_token;
}

async function createThrowawayContract(request: APIRequestContext): Promise<string> {
  const token = await loginForApi(request);
  const res = await request.post('/api/v1/contracts/', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      room_id: SEEDED.room101Id,
      tenant_id: SEEDED.tenantJohnDoeId,
      property_id: SEEDED.propertySunsetId,
      start_date: '2026-01-01',
      end_date: '2026-12-31',
      monthly_rent: 5000,
      deposit_amount: 10000,
    },
  });
  const body = await res.json();
  if (!res.ok()) throw new Error(`Failed to create throwaway contract: ${JSON.stringify(body)}`);
  return body.data.id;
}

test.describe('Contract Management Flow', () => {
  let states: CapturedStates;

  test.beforeEach(async ({ page }) => {
    states = await captureAllStates(page);
  });

  test('should display active contracts list', async ({ page }) => {
    await login(page);
    await page.goto('/contracts');
    await expect(page.locator('h1').first()).toContainText(/contracts/i, { timeout: 30000 });

    await expect(page.getByText('8,000')).toBeVisible();

    expect(states.consoleErrors).toEqual([]);
    expect(states.jsErrors).toEqual([]);
    expect(states.networkErrors).toEqual([]);
    expect(states.hydrationErrors).toEqual([]);
  });

  test('should navigate to contract detail and show real contract data', async ({ page }) => {
    await login(page);
    await page.goto('/contracts');
    await expect(page.locator('h1').first()).toContainText(/contracts/i, { timeout: 30000 });

    await page.getByRole('link', { name: new RegExp(`View contract ${SEEDED.contractRoom102Id.slice(0, 8)}`, 'i') }).click();
    await expect(page).toHaveURL(new RegExp(`/contracts/${SEEDED.contractRoom102Id}`));

    await expect(page.getByText('8,000')).toBeVisible();
    await expect(page.getByText('16,000')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Terminate' })).toBeVisible();

    expect(states.consoleErrors).toEqual([]);
    expect(states.jsErrors).toEqual([]);
    expect(states.networkErrors).toEqual([]);
    expect(states.hydrationErrors).toEqual([]);
  });

  test('should terminate a contract and show the termination record', async ({ page, request }) => {
    const contractId = await createThrowawayContract(request);

    await login(page);
    await page.goto(`/contracts/${contractId}`);
    await expect(page.getByRole('button', { name: 'Terminate' })).toBeVisible({ timeout: 30000 });

    await page.getByRole('button', { name: 'Terminate' }).click();
    await expect(page.getByRole('dialog', { name: 'Terminate Contract' })).toBeVisible();

    await page.getByLabel('Reason').selectOption('tenant_moved_out');
    await page.getByRole('button', { name: 'Terminate' }).last().click();

    await expect(page.getByRole('alert').filter({ hasText: /terminated|success/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Termination Record')).toBeVisible();
    await expect(page.getByText('tenant_moved_out')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Renew Contract' })).toBeVisible();

    expect(states.consoleErrors).toEqual([]);
    expect(states.jsErrors).toEqual([]);
    expect(states.hydrationErrors).toEqual([]);
  });

  test('should navigate to new contract form', async ({ page }) => {
    await login(page);
    await page.goto('/contracts');
    await expect(page.locator('h1').first()).toContainText(/contracts/i, { timeout: 30000 });

    await page.getByRole('link', { name: 'New Contract' }).click();
    await expect(page).toHaveURL(/\/contracts\/new/);

    expect(states.consoleErrors).toEqual([]);
    expect(states.jsErrors).toEqual([]);
    expect(states.hydrationErrors).toEqual([]);
  });

  // ── CONT-02: Create contract (real UI fill, room 103 — available, no BR-01 clash) ──
  test('CONT-02 should create a contract via the form', async ({ page }) => {
    await login(page);
    await page.goto('/contracts/new');
    await expect(page.locator('h1').first()).toContainText(/new contract/i, { timeout: 30000 });

    await page.locator('#property-select').selectOption({ label: 'Sunset Tower' });
    await page.locator('#room-select').selectOption({ value: SEEDED.room103Id }, { timeout: 30000 });

    await page.locator('#tenant-search').fill('John');
    await page.getByRole('button', { name: /john doe/i }).click({ timeout: 30000 });

    await page.getByLabel('Start Date').fill('2026-02-01');
    await page.getByLabel('End Date').fill('2026-12-31');
    await page.getByLabel(/monthly rent/i).fill('5500');
    await page.getByLabel(/deposit amount/i).fill('11000');

    await page.getByRole('button', { name: 'Create Contract' }).click();
    await expect(page.getByText(/contract created successfully/i)).toBeVisible({ timeout: 30000 });
    await expect(page).toHaveURL(/\/contracts$/, { timeout: 30000 });

    expect(states.consoleErrors).toEqual([]);
    expect(states.jsErrors).toEqual([]);
    expect(states.networkErrors).toEqual([]);
    expect(states.hydrationErrors).toEqual([]);
  });

  // ── CONT-03: Filter by status — NOT IMPLEMENTED (list has only a Property filter) ──
  test('CONT-03 should assert status filter is not implemented', async ({ page }) => {
    await login(page);
    await page.goto('/contracts');
    await expect(page.locator('h1').first()).toContainText(/contracts/i, { timeout: 30000 });

    await expect(page.getByRole('combobox', { name: /status/i })).toHaveCount(0);
    await expect(page.getByLabel(/status/i)).toHaveCount(0);

    expect(states.consoleErrors).toEqual([]);
    expect(states.jsErrors).toEqual([]);
    expect(states.hydrationErrors).toEqual([]);
  });

  // ── CONT-04: Expiring-soon badge — NOT IMPLEMENTED ──
  test('CONT-04 should assert no expiring-soon badge exists', async ({ page }) => {
    await login(page);
    await page.goto('/contracts');
    await expect(page.locator('h1').first()).toContainText(/contracts/i, { timeout: 30000 });

    await expect(page.getByText(/expir/i)).toHaveCount(0);

    expect(states.consoleErrors).toEqual([]);
    expect(states.jsErrors).toEqual([]);
    expect(states.hydrationErrors).toEqual([]);
  });

  // ── CONT-05: Renewal workflow (terminate throwaway on room 104, then renew) ──
  async function createThrowawayOnRoom(request: APIRequestContext, roomId: string): Promise<string> {
    const token = await loginForApi(request);
    const res = await request.post('/api/v1/contracts/', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        room_id: roomId,
        tenant_id: SEEDED.tenantJohnDoeId,
        property_id: SEEDED.propertySunsetId,
        start_date: '2026-01-01',
        end_date: '2026-12-31',
        monthly_rent: 5000,
        deposit_amount: 10000,
      },
    });
    const body = await res.json();
    if (!res.ok()) throw new Error(`Failed to create throwaway contract: ${JSON.stringify(body)}`);
    return body.data.id;
  }

  test('CONT-05 should renew a terminated contract with new terms', async ({ page, request }) => {
    const contractId = await createThrowawayOnRoom(request, SEEDED.room104Id);

    await login(page);
    await page.goto(`/contracts/${contractId}`);
    await expect(page.getByRole('button', { name: 'Terminate' })).toBeVisible({ timeout: 30000 });

    await page.getByRole('button', { name: 'Terminate' }).click();
    await expect(page.getByRole('dialog', { name: 'Terminate Contract' })).toBeVisible();
    await page.getByLabel('Reason').selectOption('tenant_moved_out');
    await page.getByRole('button', { name: 'Terminate' }).last().click();
    await expect(page.getByRole('alert').filter({ hasText: /terminated|success/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: 'Renew Contract' })).toBeVisible();

    await page.getByRole('button', { name: 'Renew Contract' }).click();
    await expect(page.getByRole('dialog', { name: 'Renew Contract' })).toBeVisible({ timeout: 10_000 });

    await page.getByLabel('New Start Date').fill('2027-01-01');
    await page.getByLabel('New End Date').fill('2027-12-31');
    await page.getByLabel(/new monthly rent/i).fill('7000');
    await page.getByLabel(/new deposit amount/i).fill('14000');
    await page.getByRole('button', { name: 'Renew' }).last().click();

    await expect(page.getByText('7,000')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('14,000')).toBeVisible();

    expect(states.consoleErrors).toEqual([]);
    expect(states.jsErrors).toEqual([]);
    expect(states.hydrationErrors).toEqual([]);
  });

  // ── CONT-06: Contract PDF — NOT IMPLEMENTED (no PDF/print button anywhere) ──
  test('CONT-06 should assert no contract PDF feature exists', async ({ page }) => {
    await login(page);
    await page.goto('/contracts');
    await expect(page.locator('h1').first()).toContainText(/contracts/i, { timeout: 30000 });

    await expect(page.getByRole('link', { name: /pdf/i }).or(page.getByRole('button', { name: /pdf|print/i }))).toHaveCount(0);

    expect(states.consoleErrors).toEqual([]);
    expect(states.jsErrors).toEqual([]);
    expect(states.hydrationErrors).toEqual([]);
  });

  // ── CONT-08: Contract history UI — NOT IMPLEMENTED (useLeaseHistory hook is dead code) ──
  test('CONT-08 should assert no contract-history UI on the detail page', async ({ page }) => {
    await login(page);
    await page.goto(`/contracts/${SEEDED.contractRoom102Id}`);
    await expect(page.locator('h1').first()).toContainText(/contract/i, { timeout: 30000 });

    await expect(page.getByText(/lease history|contract history/i)).toHaveCount(0);

    expect(states.consoleErrors).toEqual([]);
    expect(states.jsErrors).toEqual([]);
    expect(states.hydrationErrors).toEqual([]);
  });

  // ── CONT-NEW-01 / 02 / 03: wizard steps 1-3 (room, tenant, terms) ──
  // The form is a single page (no wizard step state) — selecting room, tenant,
  // and terms are all covered by the real CONT-02 test above. This test only
  // confirms the three inputs exist on the single page (cross-reference CONT-02).
  test('CONT-NEW-01/02/03 should expose room, tenant and terms inputs on the single-page form', async ({ page }) => {
    await login(page);
    await page.goto('/contracts/new');
    await expect(page.locator('h1').first()).toContainText(/new contract/i, { timeout: 30000 });

    // Room + Tenant are conditionally rendered only after a property is picked.
    await page.locator('#property-select').selectOption({ label: 'Sunset Tower' });

    await expect(page.locator('#room-select')).toBeVisible();
    await expect(page.locator('#tenant-search')).toBeVisible();
    await expect(page.getByLabel('Start Date')).toBeVisible();
    await expect(page.getByLabel('End Date')).toBeVisible();
    await expect(page.getByLabel(/monthly rent/i)).toBeVisible();
    await expect(page.getByLabel(/deposit amount/i)).toBeVisible();

    expect(states.consoleErrors).toEqual([]);
    expect(states.jsErrors).toEqual([]);
    expect(states.hydrationErrors).toEqual([]);
  });

  // ── CONT-NEW-04: Auto-calculate — NOT IMPLEMENTED (rent/deposit are plain manual inputs) ──
  test('CONT-NEW-04 should assert no auto-calculate of deposit from rent', async ({ page }) => {
    await login(page);
    await page.goto('/contracts/new');
    await expect(page.locator('h1').first()).toContainText(/new contract/i, { timeout: 30000 });

    await page.getByLabel(/monthly rent/i).fill('5500');
    // If auto-calc existed, deposit would be derived (e.g. 2x rent). It stays empty.
    await expect(page.getByLabel(/deposit amount/i)).toHaveValue('');

    expect(states.consoleErrors).toEqual([]);
    expect(states.jsErrors).toEqual([]);
    expect(states.hydrationErrors).toEqual([]);
  });

  // ── CONT-NEW-05 / 06: Preview PDF / Submit→PDF — NOT IMPLEMENTED ──
  test('CONT-NEW-05/06 should assert no preview-PDF or submit-to-PDF feature', async ({ page }) => {
    await login(page);
    await page.goto('/contracts/new');
    await expect(page.locator('h1').first()).toContainText(/new contract/i, { timeout: 30000 });

    await expect(page.getByRole('button', { name: /preview|generate pdf|download pdf/i })).toHaveCount(0);

    expect(states.consoleErrors).toEqual([]);
    expect(states.jsErrors).toEqual([]);
    expect(states.hydrationErrors).toEqual([]);
  });
});

// Verification:
//   ./scripts/reset-e2e-db.sh && cd frontend && npx playwright test e2e/specs/contract-flow.spec.ts --reporter=list
