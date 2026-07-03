// File: frontend/e2e/specs/auth-flow.spec.ts
// E2E Test: Auth Flow — Sprint 6 Frozen Contract
// Flow: visit / → auto-redirect /login → fill form → submit → dashboard → verify tokens
// Uses page.route() to mock all API endpoints (no backend dependency)

import { test, expect, type Page } from '@playwright/test';

// -- Mock API responses for auth flow --
const MOCK_LOGIN_SUCCESS = {
  access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock-token',
  refresh_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock-refresh',
  token_type: 'bearer',
};

const MOCK_DASHBOARD_RESPONSE = {
  data: {
    total_properties: 5,
    total_tenants: 42,
    occupancy_rate: 87.5,
    monthly_revenue: 325000,
    overdue_count: 3,
  },
};

const MOCK_OVERDUE_RESPONSE = { data: [] };

async function mockAuthApis(page: Page): Promise<void> {
  await page.route('**/api/v1/auth/login', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_LOGIN_SUCCESS),
    }),
  );

  await page.route('**/api/v1/dashboard/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_DASHBOARD_RESPONSE),
    }),
  );

  await page.route('**/api/v1/invoices/overdue*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_OVERDUE_RESPONSE),
    }),
  );

  // Catch-all for any other API requests
  await page.route('**/api/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: {} }),
    }),
  );
}

test.describe('Auth Flow', () => {
  test('should redirect to /login when not authenticated', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
  });

  test('should login successfully and redirect to dashboard', async ({ page }) => {
    await mockAuthApis(page);

    await page.goto('/login');
    await expect(page).toHaveURL(/\/login/);

    // Fill login form — use getByLabel or getByPlaceholder with strict selectors
    const usernameInput = page.getByPlaceholder('Username');
    const passwordInput = page.getByPlaceholder('Password');
    const submitButton = page.getByRole('button', { name: /sign in|log in|login|submit/i });

    await expect(usernameInput).toBeVisible();
    await expect(passwordInput).toBeVisible();

    await usernameInput.fill('testuser');
    await passwordInput.fill('Testpass123!');
    await submitButton.click();

    // Wait for redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });

    // Assert dashboard content is visible
    await expect(page.locator('body')).toContainText(/dashboard/i);
  });

  test('should store auth tokens after successful login', async ({ page }) => {
    await mockAuthApis(page);

    await page.goto('/login');

    await page.getByPlaceholder('Username').fill('testuser');
    await page.getByPlaceholder('Password').fill('Testpass123!');
    await page.getByRole('button', { name: /sign in|log in|login|submit/i }).click();

    await page.waitForURL(/\/dashboard/, { timeout: 10_000 });

    // Verify access token stored in localStorage
    const accessToken = await page.evaluate(() =>
      localStorage.getItem('access_token'),
    );
    expect(accessToken).not.toBeNull();
    expect(accessToken!.length).toBeGreaterThan(0);
  });
});

// Verification:
//   cd frontend && npx playwright test e2e/specs/auth-flow.spec.ts --reporter=list
//   Expected: 3/3 tests pass with mocked API responses
