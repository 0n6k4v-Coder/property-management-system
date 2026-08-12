// File: frontend/e2e/specs/settings-flow.spec.ts
// E2E Test: /settings (System Settings) — Fullstack (real backend + real Postgres, no mocks)
// Uses: State Verification Engine (E2E_TEST_STRATEGY.md Article 1.1)
//       Shared Helpers (test-helpers.ts, state-capture.ts)
//       Seeded fixtures (frontend/e2e/fixtures/seeded-ids.ts) — run
//       `./scripts/reset-e2e-db.sh` before this suite.
// Component Audit: Verified against SettingsPage.tsx, api.ts (useAuditLogs /
//       useSystemConfig / useUpdateSystemConfig), and src/routes/index.tsx
//       (2026-07-07).
//
// ══════════════════════════════════════════════════════════════════════════
// ⚠️  MAJOR FINDING — THE PREMISE OF THE SET-xx TEST IDs IS WRONG
// ══════════════════════════════════════════════════════════════════════════
// A prior read-only audit flagged this, and this session RE-CONFIRMED it against
// the live code: `/settings` is NOT a personal/user-profile settings page. It is
// an ADMIN system-configuration page (owner role) with exactly two tabs:
//
//   1. "Audit Logs"   — filterable, paginated log viewer → GET /admin/audit-logs
//   2. "System Config"— key/value config editor           → GET /admin/config,
//                                                            PATCH /admin/config/{key}
//
// None of the 8 SET-xx scenarios (profile, change-password, notification prefs,
// theme, language, 2FA, API keys, danger-zone) have ANY corresponding UI on this
// route. So SET-01..SET-08 are implemented as precise ASSERT-ABSENCE tests —
// each verifies the *specific* concept is missing (not one shallow "nothing
// exists" check), per the established precedent of CONT-03/04/06/08 and
// MAINT-05/06/07 from the sibling spec files.
//
// Because the route does real, working work that maps to NO SET-xx ID, we ALSO
// cover it with real tests (SET-REAL-01..04): the Audit Logs default load +
// property filter, and the System Config load + the (currently broken) edit flow.
//
// Real bugs found & handled in this E2E task (see docs/LOG/E2E_TEST.md Part F):
//   F-60 — GET /admin/audit-logs declared `property_id` as a REQUIRED query param
//     (Query(...), no default). The page's default "All properties" selection
//     sends NO property_id, so the default Audit Logs load returned HTTP 422 and
//     the tab silently showed the empty-state ("No audit logs found."). The
//     service/repository already correctly handle property_id=None, so the fix is
//     a one-line router change (default to None). VERIFIED FIXED at source.
//   F-61 — System Config "Edit" calls PATCH /admin/config/{key}, but NO such
//     route exists in admin_router.py (it only has two GETs). Worse, system config
//     is derived from env via get_settings() and is read-only by design
//     (ADMIN_005_CONFIG_READ_ONLY + _READ_ONLY_CONFIG_KEYS already defined; no DB
//     store). So the Edit control offers an interaction that can never persist.
//     Documented as a gap (same class as F-19), NOT built in this E2E task — the
//     tab is admin/owner-only and rebuilding a DB-backed config store is out of
//     E2E scope. SET-REAL-04 asserts the REAL current behavior (edit enters edit
//     mode but Save does not persist).

import { test, expect } from '@playwright/test';
import { login } from '../utils/test-helpers';
import { captureAllStates, type CapturedStates } from '../utils/state-capture';
import { SEEDED } from '../fixtures/seeded-ids';

test.describe('Settings (System Settings — admin config page)', () => {
  let states: CapturedStates;

  test.beforeEach(async ({ page }) => {
    states = await captureAllStates(page);
  });

  // ── Route sanity: this is an admin System Settings page, not a profile page ──
  test('SET-00 route renders the admin System Settings page with two admin tabs', async ({ page }) => {
    await login(page);
    await page.goto('/settings');
    await expect(page.locator('h1').first()).toContainText(/system settings/i, { timeout: 30000 });
    await expect(page.getByRole('tab', { name: 'Audit Logs' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'System Config' })).toBeVisible();

    expect(states.consoleErrors).toEqual([]);
    expect(states.jsErrors).toEqual([]);
    expect(states.networkErrors).toEqual([]);
    expect(states.hydrationErrors).toEqual([]);
  });

  // ── SET-01: Profile settings — NOT on this route (it's admin config, no profile form) ──
  test('SET-01 should assert no personal-profile settings UI exists', async ({ page }) => {
    await login(page);
    await page.goto('/settings');
    await expect(page.locator('h1').first()).toContainText(/system settings/i, { timeout: 30000 });

    await expect(page.getByText(/profile settings|your profile|account profile/i)).toHaveCount(0);
    await expect(page.getByRole('button', { name: /update profile|save profile|edit profile/i })).toHaveCount(0);
    await expect(page.getByLabel(/full name|display name/i)).toHaveCount(0);

    expect(states.consoleErrors).toEqual([]);
    expect(states.jsErrors).toEqual([]);
    expect(states.networkErrors).toEqual([]);
    expect(states.hydrationErrors).toEqual([]);
  });

  // ── SET-02: Change password — NOT on this route ──
  test('SET-02 should assert no change-password form exists', async ({ page }) => {
    await login(page);
    await page.goto('/settings');
    await expect(page.locator('h1').first()).toContainText(/system settings/i, { timeout: 30000 });

    await expect(page.getByLabel(/current password/i)).toHaveCount(0);
    await expect(page.getByLabel(/new password/i)).toHaveCount(0);
    await expect(page.getByLabel(/confirm password/i)).toHaveCount(0);
    await expect(page.getByRole('button', { name: /change password|update password|reset password/i })).toHaveCount(0);

    expect(states.consoleErrors).toEqual([]);
    expect(states.jsErrors).toEqual([]);
    expect(states.networkErrors).toEqual([]);
    expect(states.hydrationErrors).toEqual([]);
  });

  // ── SET-03: Notification preferences — NOT on this route ──
  test('SET-03 should assert no notification-preferences UI exists', async ({ page }) => {
    await login(page);
    await page.goto('/settings');
    await expect(page.locator('h1').first()).toContainText(/system settings/i, { timeout: 30000 });

    await expect(page.getByText(/notification preferences|email notifications|push notifications|sms notifications/i)).toHaveCount(0);
    await expect(page.getByRole('switch', { name: /notifications/i })).toHaveCount(0);
    await expect(page.getByRole('checkbox', { name: /notify/i })).toHaveCount(0);

    expect(states.consoleErrors).toEqual([]);
    expect(states.jsErrors).toEqual([]);
    expect(states.networkErrors).toEqual([]);
    expect(states.hydrationErrors).toEqual([]);
  });

  // ── SET-04: Theme toggle — NOT on this route ──
  test('SET-04 should assert no theme toggle control exists', async ({ page }) => {
    await login(page);
    await page.goto('/settings');
    await expect(page.locator('h1').first()).toContainText(/system settings/i, { timeout: 30000 });

    await expect(page.getByRole('button', { name: /dark mode|light mode|toggle theme|switch theme/i })).toHaveCount(0);
    await expect(page.getByLabel(/theme/i)).toHaveCount(0);

    expect(states.consoleErrors).toEqual([]);
    expect(states.jsErrors).toEqual([]);
    expect(states.networkErrors).toEqual([]);
    expect(states.hydrationErrors).toEqual([]);
  });

  // ── SET-05: Language selector — NOT on this route ──
  test('SET-05 should assert no language/locale selector exists', async ({ page }) => {
    await login(page);
    await page.goto('/settings');
    await expect(page.locator('h1').first()).toContainText(/system settings/i, { timeout: 30000 });

    await expect(page.getByRole('combobox', { name: /language|locale/i })).toHaveCount(0);
    await expect(page.getByLabel(/language/i)).toHaveCount(0);
    await expect(page.getByText(/^\s*(english|thai|ไทย)\s*$/i)).toHaveCount(0);

    expect(states.consoleErrors).toEqual([]);
    expect(states.jsErrors).toEqual([]);
    expect(states.networkErrors).toEqual([]);
    expect(states.hydrationErrors).toEqual([]);
  });

  // ── SET-06: 2FA setup — NOT on this route ──
  test('SET-06 should assert no two-factor (2FA) setup flow exists', async ({ page }) => {
    await login(page);
    await page.goto('/settings');
    await expect(page.locator('h1').first()).toContainText(/system settings/i, { timeout: 30000 });

    await expect(page.getByText(/two[- ]?factor|2fa|authenticator|otp/i)).toHaveCount(0);
    await expect(page.getByRole('button', { name: /enable 2fa|setup 2fa|activate 2fa/i })).toHaveCount(0);

    expect(states.consoleErrors).toEqual([]);
    expect(states.jsErrors).toEqual([]);
    expect(states.networkErrors).toEqual([]);
    expect(states.hydrationErrors).toEqual([]);
  });

  // ── SET-07: API keys — NOT on this route ──
  test('SET-07 should assert no API-key management UI exists', async ({ page }) => {
    await login(page);
    await page.goto('/settings');
    await expect(page.locator('h1').first()).toContainText(/system settings/i, { timeout: 30000 });

    await expect(page.getByText(/api key|api keys|access token|personal token/i)).toHaveCount(0);
    await expect(page.getByRole('button', { name: /create api key|generate key|new token|revoke/i })).toHaveCount(0);

    expect(states.consoleErrors).toEqual([]);
    expect(states.jsErrors).toEqual([]);
    expect(states.networkErrors).toEqual([]);
    expect(states.hydrationErrors).toEqual([]);
  });

  // ── SET-08: Danger zone / delete account — NOT on this route ──
  test('SET-08 should assert no danger-zone / delete-account section exists', async ({ page }) => {
    await login(page);
    await page.goto('/settings');
    await expect(page.locator('h1').first()).toContainText(/system settings/i, { timeout: 30000 });

    await expect(page.getByText(/danger zone/i)).toHaveCount(0);
    await expect(page.getByRole('button', { name: /delete account|deactivate account|delete my account/i })).toHaveCount(0);

    expect(states.consoleErrors).toEqual([]);
    expect(states.jsErrors).toEqual([]);
    expect(states.networkErrors).toEqual([]);
    expect(states.hydrationErrors).toEqual([]);
  });

  // ── SET-REAL-01: Audit Logs default load (F-60 regression — no property_id, must still load) ──
  // Login writes an audit row (property_id=NULL), so after the F-60 fix the
  // default "All properties" load returns data and renders the table.
  test('SET-REAL-01 should load Audit Logs on the default tab without requiring a property filter', async ({ page }) => {
    await login(page);
    await page.goto('/settings');
    await expect(page.locator('h1').first()).toContainText(/system settings/i, { timeout: 30000 });

    // Wait for the default Audit Logs API response (no property_id, "All properties")
    await page.waitForResponse(
      (response) =>
        response.url().includes('/admin/audit-logs') && response.status() === 200,
      { timeout: 10000 },
    );

    // Default tab is Audit Logs. Either the table header (rows exist) or the
    // explicit empty-state must appear — but NOT a 422-driven silent blank.
    await expect(
      page.locator('th', { hasText: 'Action' }).or(page.getByText(/no audit logs found/i)),
    ).toBeVisible({ timeout: 20000 });

    // If rows loaded, the column headers are present (proves the default
    // "All properties" query succeeded — the F-60 regression signal).
    const hasRows = await page.locator('th', { hasText: 'Action' }).count();
    if (hasRows > 0) {
      await expect(page.locator('th', { hasText: 'Timestamp' })).toBeVisible();
      await expect(page.locator('th', { hasText: 'User' })).toBeVisible();
    }

    expect(states.consoleErrors).toEqual([]);
    expect(states.jsErrors).toEqual([]);
    expect(states.networkErrors).toEqual([]);
    expect(states.hydrationErrors).toEqual([]);
  });

  // ── SET-REAL-02: Audit Logs property filter ──
  test('SET-REAL-02 should filter Audit Logs by property via the dropdown', async ({ page }) => {
    await login(page);
    await page.goto('/settings');
    await expect(page.locator('h1').first()).toContainText(/system settings/i, { timeout: 30000 });

    const select = page.locator('#audit-property');
    await expect(select).toBeVisible();
    await expect(select).toHaveValue(''); // "All properties" default

    await select.selectOption({ value: SEEDED.propertySunsetId }, { timeout: 20000 });
    await expect(select).toHaveValue(SEEDED.propertySunsetId);

    // Wait for the filtered Audit Logs API response before asserting on table
    await page.waitForResponse(
      (response) =>
        response.url().includes('/admin/audit-logs') && response.status() === 200,
      { timeout: 10000 },
    );

    // After filtering, the tab must still render a valid state (table or empty),
    // not a 422 / crash.
    await expect(
      page.locator('th', { hasText: 'Action' }).or(page.getByText(/no audit logs found/i)),
    ).toBeVisible({ timeout: 20000 });

    expect(states.consoleErrors).toEqual([]);
    expect(states.jsErrors).toEqual([]);
    expect(states.networkErrors).toEqual([]);
    expect(states.hydrationErrors).toEqual([]);
  });

  // ── SET-REAL-03: System Config tab loads key/value rows, secrets masked ──
  test('SET-REAL-03 should load System Config with key/value rows and mask secrets', async ({ page }) => {
    await login(page);
    await page.goto('/settings');
    await expect(page.locator('h1').first()).toContainText(/system settings/i, { timeout: 30000 });

    await page.getByRole('tab', { name: 'System Config' }).click();

    // Wait for the System Config API response before asserting on config rows
    await page.waitForResponse(
      (response) =>
        response.url().includes('/admin/system-config') && response.status() === 200,
      { timeout: 10000 },
    );

    await expect(page.locator('th', { hasText: 'Key' })).toBeVisible({ timeout: 20000 });
    await expect(page.locator('th', { hasText: 'Value' })).toBeVisible();
    await expect(page.getByText('APP_NAME')).toBeVisible();
    // Secrets are masked (ADMIN read-only/masked design): SECRET_KEY shows the
    // masked placeholder, not its real value.
    await expect(page.getByText('SECRET_KEY')).toBeVisible();
    // Several sensitive keys are masked (4 of them), so scope to .first().
    await expect(page.getByText('••••••••').first()).toBeVisible();

    expect(states.consoleErrors).toEqual([]);
    expect(states.jsErrors).toEqual([]);
    expect(states.networkErrors).toEqual([]);
    expect(states.hydrationErrors).toEqual([]);
  });

  // ── SET-REAL-04: System Config edit (F-61 regression) — edit UI works, but Save does NOT persist ──
  // The Edit button enters edit mode (real UI), but PATCH /admin/config/{key} does
  // not exist (and config is env-derived/read-only by design), so Save cannot
  // persist. The REAL behavior (read from SettingsPage.handleConfigSave): on a
  // failed Save the catch does NOT reset editingConfigKey, so the row STAYS in
  // edit mode with the typed value still in the input — nothing is persisted.
  test('SET-REAL-04 should enter edit mode but NOT persist a System Config change (F-61)', async ({ page }) => {
    await login(page);
    await page.goto('/settings');
    await expect(page.locator('h1').first()).toContainText(/system settings/i, { timeout: 30000 });

    await page.getByRole('tab', { name: 'System Config' }).click();

    // Wait for the System Config API response before asserting on config rows
    await page.waitForResponse(
      (response) =>
        response.url().includes('/admin/system-config') && response.status() === 200,
      { timeout: 10000 },
    );

    await expect(page.locator('th', { hasText: 'Key' })).toBeVisible({ timeout: 20000 });

    const row = page.locator('tr', { hasText: 'APP_NAME' });
    await row.getByRole('button', { name: 'Edit' }).click();

    // Edit mode: an input appears, pre-filled with the current value.
    const input = row.locator('input[type="text"]');
    await expect(input).toBeVisible();
    await input.fill('ZZZ_TEST_VALUE_123');

    // Save — there is NO PATCH /admin/config/{key} route, so this 404s and the
    // component stays in edit mode (handleConfigSave's catch does NOT reset
    // editingConfigKey). That is the real F-61 behavior: the typed value remains
    // in the input and nothing is persisted server-side.
    await row.getByRole('button', { name: 'Save' }).click();
    await expect(input).toBeVisible(); // still editing (no success reset)
    await expect(input).toHaveValue('ZZZ_TEST_VALUE_123'); // unchanged locally

    // Re-open the tab to force a fresh GET /admin/config — the value must NOT
    // have persisted server-side; APP_NAME shows its original value again.
    await page.getByRole('tab', { name: 'Audit Logs' }).click();
    await page.getByRole('tab', { name: 'System Config' }).click();
    await expect(page.getByText('ZZZ_TEST_VALUE_123')).toHaveCount(0, { timeout: 15000 });
    await expect(page.locator('tr', { hasText: 'APP_NAME' })).toBeVisible();

    // NOTE: the PATCH returns 404 (no such route) — the browser surfaces that
    // as BOTH a network error AND a console error ("Failed to load resource:
    // 404"). That is the EXPECTED empirical proof of F-61, so neither
    // networkErrors nor consoleErrors is asserted empty for this test.
    // jsErrors / hydrationErrors must still be clean.
    expect(states.jsErrors).toEqual([]);
    expect(states.hydrationErrors).toEqual([]);
  });
});

// Verification:
//   ./scripts/reset-e2e-db.sh
//   docker compose --profile dev run --rm frontend-test npx playwright test e2e/specs/settings-flow.spec.ts --reporter=list
//   npx tsc --noEmit -p tsconfig.e2e.json
