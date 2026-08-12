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

  // ── Sprint 10 / ADR 002: Respect User Preferences (dark mode) ──
  test('a11y: color-scheme meta + :root declaration present (light/dark support)', async ({ page }) => {
    await page.goto('/login');

    // MANDATORY meta tag from ADR 002 — prevents FOUC, declares dual scheme.
    const metaScheme = page.locator('meta[name="color-scheme"]');
    await expect(metaScheme).toHaveAttribute('content', 'light dark');

    // MANDATORY :root color-scheme declaration from ADR 002.
    const rootScheme = await page.evaluate(() => {
      const cs = getComputedStyle(document.documentElement).colorScheme;
      return cs;
    });
    expect(rootScheme).toMatch(/light/);
    expect(rootScheme).toMatch(/dark/);

    // Tokens resolve via light-dark(); assert a token actually resolves to a
    // color (proves the @theme light-dark() wiring is live, not a bare value).
    const bgResolves = await page.evaluate(() => {
      const v = getComputedStyle(document.body).backgroundColor;
      return v && v !== 'rgba(0, 0, 0, 0)' && v !== 'transparent';
    });
    expect(bgResolves).toBe(true);
  });

  test('a11y: login page has 0 violations under prefers-color-scheme: dark', async ({ page }) => {
    // Emulate OS Dark Mode — ADR 002 must adapt without breaking a11y.
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
      .analyze();

    expect(results.violations).toEqual([]);

    // Surface tokens should actually switch to dark values (not stay light).
    const isDark = await page.evaluate(() => {
      const bg = getComputedStyle(document.body).backgroundColor;
      const m = bg.match(/\d+/g);
      if (!m || m.length < 3) return false;
      // With noUncheckedIndexedAccess, array destructuring yields `number | undefined`.
      // Use guarded indexed access to obtain defined values.
      const r = Number(m[0]);
      const g = Number(m[1]);
      const b = Number(m[2]);
      const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      return luminance < 128;
    });
    expect(isDark).toBe(true);
  });
});

// Verification:
//   ./scripts/reset-e2e-db.sh && cd frontend && npx playwright test e2e/a11y.spec.ts --reporter=list
//   Expected: 7/7 tests pass — 4 axe scans (0 violations) + 1 keyboard nav + 2 dark-mode tests
//   (a11y.spec.ts) plus AUTH-VT-01/02 in auth-flow.spec.ts for View Transition continuity.
