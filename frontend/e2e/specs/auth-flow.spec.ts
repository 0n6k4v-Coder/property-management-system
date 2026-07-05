// File: frontend/e2e/specs/auth-flow.spec.ts
// E2E Test: Auth Flow — Sprint 6 Frozen Contract
// Flow: visit / → auto-redirect /login → fill form → submit → dashboard → verify tokens
// Uses page.route() to mock all API endpoints (no backend dependency)

import { test, expect, type Page } from '@playwright/test';

// -- Mock API responses for auth flow --
const MOCK_LOGIN_SUCCESS = {
  access_token: 'eyJhbG...oken',
  refresh_token: 'eyJhbG...resh',
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
  await page.route('**/api/v1/auth/login', async (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          access_token: 'mock-access-token',
          refresh_token: 'mock-refresh-token',
          token_type: 'bearer',
          user: {
            id: '00000000-0000-0000-0000-000000000001',
            email: 'admin@example.com',
            full_name: 'Test User',
            property_scopes: [],
            is_active: true,
          },
        },
      }),
    });
  });

  await page.route('**/api/v1/dashboard/**', async (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          total_properties: 5,
          total_tenants: 42,
          occupancy_rate: 87.5,
          monthly_revenue: 325000,
          overdue_count: 3,
        },
      }),
    });
  });

  await page.route('**/api/v1/invoices/overdue*', async (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    });
  });

  // Catch-all for actual API v1 routes only - exclude Vite dev server paths
  await page.route('**/api/v1/**', async (route) => {
    const url = route.request().url();
    // Skip Vite dev server internal routes
    if (url.includes('/@vite/') || url.includes('/@react-refresh') || url.includes('/@fs/') || url.includes('/src/')) {
      return route.continue();
    }
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: {} }),
    });
  });
}

test.describe('Auth Flow', () => {
  test('should redirect to /login when not authenticated', async ({ page }) => {
    // Capture console messages
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
  });

  test('should login successfully and redirect to dashboard', async ({ page }) => {
    // Capture console messages
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

    await mockAuthApis(page);

    await page.goto('/login');
    await expect(page).toHaveURL(/\/login/);

    // Wait for React app to hydrate
    await page.waitForLoadState('domcontentloaded');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);

    // Debug: log page content
    const html = await page.content();
    console.log('Page HTML length:', html.length);
    console.log('Has you@example.com:', html.includes('you@example.com'));
    console.log('Has Enter your password:', html.includes('Enter your password'));
    console.log('Has Loading:', html.includes('Loading'));
    console.log('Has Suspense:', html.includes('Suspense'));
    console.log('HTML sample:', html.substring(0, 3000));

    // Try multiple selectors
    const usernameInput = page.locator('input[placeholder="you@example.com"]').first();
    const passwordInput = page.locator('input[placeholder="Enter your password"]').first();
    const submitButton = page.getByRole('button', { name: /sign in|log in|login|submit/i });

    await expect(usernameInput).toBeVisible({ timeout: 30000 });
    await expect(passwordInput).toBeVisible({ timeout: 30000 });

    await usernameInput.fill('admin@example.com');
    await passwordInput.fill('Admin123!');
    await submitButton.click();

    // Debug: check if login API was called
    await page.waitForTimeout(2000);
    console.log('Current URL after submit:', page.url());

    // Wait for redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });

    // Assert dashboard content is visible
    await expect(page.locator('body')).toContainText(/dashboard/i);
  });

  test('should store auth tokens after successful login', async ({ page }) => {
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

    await mockAuthApis(page);

    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);

    await page.locator('input[placeholder="you@example.com"]').first().fill('admin@example.com');
    await page.locator('input[placeholder="Enter your password"]').first().fill('Admin123!');
    await page.getByRole('button', { name: /sign in|log in|login|submit/i }).click();

    await page.waitForURL(/\/dashboard/, { timeout: 10_000 });

    // Verify access token stored in sessionStorage
    const accessToken = await page.evaluate(() =>
      sessionStorage.getItem('pms_access_token'),
    );
    expect(accessToken).not.toBeNull();
    expect(accessToken!.length).toBeGreaterThan(0);
  });
});

// Verification:
//   cd frontend && npx playwright test e2e/specs/auth-flow.spec.ts --reporter=list
//   Expected: 3/3 tests pass with mocked API responses