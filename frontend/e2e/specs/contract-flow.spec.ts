// File: frontend/e2e/specs/contract-flow.spec.ts
// E2E Test: Contract Management Flow — Fullstack (real backend + real database, no mocks)
// Flow: visit /contracts → view list → click detail → terminate → assert status updated
// Uses: State Verification Engine (E2E_TEST_STRATEGY.md Article 1.1)
//       Shared Helpers (test-helpers.ts, state-capture.ts)
//       Seeded fixtures (frontend/e2e/fixtures/seeded-ids.ts) — run
//       `./scripts/reset-e2e-db.sh` before this suite.
// Component Audit: Verified against ContractListPage.tsx, ContractDetailPage.tsx, contract/api.ts
//
// Fullstack notes:
//   - The terminate test creates its own throwaway contract (via a direct
//     API call, room 101 which has no existing contract) rather than
//     terminating the shared seeded contract on room 102 — terminating the
//     shared fixture would break every other spec file that depends on
//     room 102 having an active contract.

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
});

// Verification:
//   ./scripts/reset-e2e-db.sh && cd frontend && npx playwright test e2e/specs/contract-flow.spec.ts --reporter=list
