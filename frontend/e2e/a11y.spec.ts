// File: frontend/e2e/a11y.spec.ts
// E2E Test: Accessibility Audit — Sprint 6 Frozen Contract
// Uses @axe-core/playwright for WCAG 2.1 AA compliance checks
// Scans: /login, /dashboard, /meter-reading → assert 0 violations
// NOTE: axe-playwright import uses the @axe-core/playwright package (installed in devDeps)

import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '@playwright/test';

// -- Shared mock setup for authenticated pages --
async function mockAllApis(page: Page): Promise<void> {
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

  await page.route('**/api/v1/dashboard/**', (route) =>
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
    }),
  );

  await page.route('**/api/v1/invoices/overdue*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    }),
  );

  await page.route('**/api/v1/rooms*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    }),
  );

  await page.route('**/api/v1/meter-readings*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    }),
  );

  // Catch-all
  await page.route('**/api/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: {} }),
    }),
  );
}

async function login(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByPlaceholder('Username').fill('testuser');
  await page.getByPlaceholder('Password').fill('Testpass123!');
  await page.getByRole('button', { name: /sign in|log in|login|submit/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 10_000 });
}

test.describe('Accessibility (A11y) Audit', () => {
  test.beforeEach(async ({ page }) => {
    await mockAllApis(page);
  });

  test('a11y: login page should have 0 violations', async ({ page }) => {
    await page.goto('/login');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('a11y: dashboard page should have 0 violations', async ({ page }) => {
    await login(page);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('a11y: meter reading page should have 0 violations', async ({ page }) => {
    await login(page);
    await page.goto('/meter-reading');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('a11y: invoice list page should have 0 violations', async ({ page }) => {
    await login(page);
    await page.goto('/invoices');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('a11y: login page supports keyboard navigation', async ({ page }) => {
    await page.goto('/login');

    // Tab to first interactive element (should be username input)
    await page.keyboard.press('Tab');
    const focused1 = await page.evaluate(() =>
      document.activeElement?.tagName,
    );
    expect(focused1).toBe('INPUT');

    // Tab to password input
    await page.keyboard.press('Tab');
    const focused2 = await page.evaluate(() =>
      document.activeElement?.tagName,
    );
    expect(focused2).toBe('INPUT');

    // Tab to submit button
    await page.keyboard.press('Tab');
    const focused3 = await page.evaluate(() =>
      document.activeElement?.tagName,
    );
    expect(focused3).toBe('BUTTON');
  });
});

// Verification:
//   cd frontend && npx playwright test e2e/a11y.spec.ts --reporter=list
//   Expected: 5/5 tests pass — 4 axe scans (0 violations) + 1 keyboard nav test
