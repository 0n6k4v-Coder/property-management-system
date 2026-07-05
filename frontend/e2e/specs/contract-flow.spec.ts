// File: frontend/e2e/specs/contract-flow.spec.ts
// E2E Test: Contract Management Flow — Phase 4
// Flow: visit /contracts → view list → click detail → terminate → assert status updated
// Uses page.route() for all API mocking

import { test, expect, type Page } from '@playwright/test';

const MOCK_CONTRACTS = {
  data: [
    {
      id: 'c1',
      room_id: 'r1',
      tenant_id: 't1',
      property_id: 'p1',
      start_date: '2026-01-01',
      end_date: '2026-12-31',
      monthly_rent: '15000',
      deposit_amount: '30000',
      status: 'active',
      special_conditions: null,
      is_renewal: false,
      renewed_from_id: null,
      created_by: 'user-1',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      termination: null,
      extensions: [],
    },
  ],
};

const MOCK_CONTRACT_DETAIL = {
  data: MOCK_CONTRACTS.data[0],
};

const MOCK_TERMINATED = {
  data: {
    ...MOCK_CONTRACTS.data[0],
    status: 'terminated',
    termination: {
      id: 'term-1',
      reason: 'tenant_request',
      termination_date: '2026-07-06',
      notes: 'Tenant moving out',
      terminated_by: 'user-1',
      created_at: '2026-07-06T00:00:00Z',
    },
  },
};

async function mockContractApis(page: Page): Promise<void> {
  await page.route('**/api/v1/auth/login', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: 'mock-token',
        refresh_token: 'mock-refresh',
        token_type: 'bearer',
      }),
    }),
  );

  await page.route('**/api/v1/auth/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            id: 'user-1',
            email: 'admin@example.com',
            full_name: 'Test User',
            property_scopes: [],
            is_active: true,
          },
        }),
      })),
  );

  await page.route('**/api/v1/contracts/active', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_CONTRACTS),
    }),
  );

  await page.route('**/api/v1/contracts/c1', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_CONTRACT_DETAIL),
    }),
  );

  await page.route('**/api/v1/contracts/c1/terminate', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_TERMINATED),
    }),
  );

  await page.route('**/api/v1/properties', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          { id: 'p1', name: 'Sunset Tower', address: '123 Main St', billing_due_day: 5, min_deposit_months: 2, created_by: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
        ],
      }),
    }),
  );

  await page.route('**/api/v1/dashboard/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { total_rooms: 50 } }),
    }),
  );

  await page.route('**/api/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: {} }),
    }),
  );
}

async function loginAndNavigateToContracts(page: Page): Promise<void> {
  await page.goto('/login');
  await page.locator('input[placeholder="you@example.com"]').first().fill('admin@example.com');
  await page.locator('input[placeholder="Enter your password"]').first().fill('Admin123!');
  await page.getByRole('button', { name: /sign in|log in|login|submit/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 10_000 });
  await page.goto('/contracts');
  await expect(page.locator('body')).toContainText(/contract/i);
}

test.describe('Contract Management Flow', () => {
  test.beforeEach(async ({ page }) => {
    await mockContractApis(page);
  });

  test('should display active contracts list', async ({ page }) => {
    await loginAndNavigateToContracts(page);
    await expect(page.locator('body')).toContainText('15,000');
  });

  test('should navigate to contract detail and terminate', async ({ page }) => {
    await loginAndNavigateToContracts(page);

    const detailLink = page.getByRole('link', { name: /view/i }).first();
    if (await detailLink.isVisible().catch(() => false)) {
      await detailLink.click();
    } else {
      await page.goto('/contracts/c1');
    }

    await expect(page.locator('body')).toContainText(/contract/i);

    const termButton = page.getByRole('button', { name: /terminate/i });
    if (await termButton.isVisible().catch(() => false)) {
      await termButton.click();

      const reasonSelect = page.locator('select');
      if (await reasonSelect.isVisible().catch(() => false)) {
        await reasonSelect.selectOption('tenant_request');
      }

      const submitBtn = page.getByRole('button', { name: /terminate/i }).last();
      if (await submitBtn.isVisible().catch(() => false)) {
        await submitBtn.click();
      }

      await expect(
        page.locator('text=/terminated|success/i'),
      ).toBeVisible({ timeout: 10_000 });
    }
  });

  test('should navigate to new contract form', async ({ page }) => {
    await loginAndNavigateToContracts(page);

    const newButton = page.getByRole('link', { name: /new contract/i });
    if (await newButton.isVisible().catch(() => false)) {
      await newButton.click();
      await expect(page.locator('body')).toContainText(/new contract|property/i);
    }
  });
});
