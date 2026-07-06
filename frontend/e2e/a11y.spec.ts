// File: frontend/e2e/a11y.spec.ts
// E2E Test: Accessibility Audit — Fullstack (real backend + real database, no mocks)
// Uses @axe-core/playwright for WCAG 2.1 AA compliance checks
// Scans: /login, /dashboard, /meter-reading, /invoices → assert 0 violations
// NOTE: axe-playwright import uses the @axe-core/playwright package (installed in devDeps)
// Seeded fixtures (frontend/e2e/fixtures/seeded-ids.ts) — run
// `./scripts/reset-e2e-db.sh` before this suite.

import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '@playwright/test';

async function login(page: Page): Promise<void> {
  await page.goto('/login');
  await page.locator('input[placeholder="you@example.com"]').first().fill('admin@example.com');
  await page.locator('input[placeholder="Enter your password"]').first().fill('Admin123!');
  await page.getByRole('button', { name: /sign in|log in|login|submit/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 10_000 });
}

test.describe('Accessibility (A11y) Audit', () => {
  test('a11y: login page should have 0 violations', async ({ page }) => {
    await page.goto('/login');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('a11y: dashboard page should have 0 violations', async ({ page }) => {
    await login(page);
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10_000 });

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('a11y: meter reading page should have 0 violations', async ({ page }) => {
    await login(page);
    await page.goto('/meter-reading');
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('a11y: invoice list page should have 0 violations', async ({ page }) => {
    await login(page);
    await page.goto('/invoices');
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('a11y: login page supports keyboard navigation', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[placeholder="you@example.com"]').first().waitFor({ state: 'visible' });

    // The email input has autoFocus, so it's already focused on load.
    const focused0 = await page.evaluate(() => document.activeElement?.tagName);
    expect(focused0).toBe('INPUT');

    // Tab to password input
    await page.keyboard.press('Tab');
    const focused1 = await page.evaluate(() =>
      document.activeElement?.tagName,
    );
    expect(focused1).toBe('INPUT');

    // Tab to the show/hide password toggle button
    await page.keyboard.press('Tab');
    const focused2 = await page.evaluate(() =>
      document.activeElement?.tagName,
    );
    expect(focused2).toBe('BUTTON');

    // Tab to submit button
    await page.keyboard.press('Tab');
    const focused3 = await page.evaluate(() =>
      document.activeElement?.tagName,
    );
    expect(focused3).toBe('BUTTON');
  });
});

// Verification:
//   ./scripts/reset-e2e-db.sh && cd frontend && npx playwright test e2e/a11y.spec.ts --reporter=list
//   Expected: 5/5 tests pass — 4 axe scans (0 violations) + 1 keyboard nav test
