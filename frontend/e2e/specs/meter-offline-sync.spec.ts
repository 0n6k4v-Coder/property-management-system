// File: frontend/e2e/specs/meter-offline-sync.spec.ts
// E2E Test: Meter Reading Offline Sync — Fullstack (real backend + real database, no mocks)
// Flow: navigate /meter-reading → fill form → setOffline(true) → submit →
//        assert queued → setOffline(false) → assert no error state
// Uses: State Verification Engine (E2E_TEST_STRATEGY.md Article 1.1)
//       Shared Helpers (test-helpers.ts, state-capture.ts)
//       Seeded fixtures (frontend/e2e/fixtures/seeded-ids.ts) — run
//       `./scripts/reset-e2e-db.sh` before this suite.
// Component Audit: Verified against MeterReadingPage.tsx, useMeterForm.ts, meter/api.ts
//
// Fullstack notes:
//   - Both room 101 and 102 already have a seeded July 2026 meter reading —
//     tests below submit for August 2026 instead to avoid BR-07's
//     duplicate-reading-per-room-per-month conflict (409).
//   - Real bugs found and fixed while converting this file:
//     1. MeterReadingPage.tsx's four Electric/Water "Previous Reading" /
//        "Current Reading" inputs shared auto-generated ids (Input.tsx
//        derives `id` from `label` text), so <label for> collided and both
//        Water inputs silently lost their values. Fixed by passing explicit
//        unique `id`s.
//     2. useRecordMeterMutation() had no `networkMode: 'always'`, so
//        TanStack Query's default 'online' mode paused the mutation
//        indefinitely while offline — mutationFn (which contains the
//        IndexedDB fallback) never ran, so offline submission hung forever.
//        Fixed in features/meter/api.ts.
//     3. registerMeterSync() awaited `navigator.serviceWorker.ready`, which
//        never resolves because the app never calls
//        `navigator.serviceWorker.register()` anywhere — a permanent hang
//        in production too. Fixed to use `getRegistration()` instead.
//   - The offline→online sync relies on the browser's Background Sync API,
//     which is best-effort and not deterministically observable in a
//     headless Playwright run. The offline-queue test below only asserts
//     the deterministic, synchronous part (the form queues the reading and
//     shows the "pending sync" state) rather than waiting for the
//     background sync to actually complete.

import { test, expect } from '@playwright/test';
import { login } from '../utils/test-helpers';
import { captureAllStates, type CapturedStates } from '../utils/state-capture';
import { SEEDED } from '../fixtures/seeded-ids';

async function navigateToMeterReading(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/meter-reading');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('h1').first()).toContainText(/meter reading/i, { timeout: 30000 });
}

async function fillMeterForm(
  page: import('@playwright/test').Page,
  roomId: string,
  billingMonth: number
): Promise<void> {
  await page.getByLabel('Room ID').fill(roomId);
  await page.getByLabel('Billing Month').fill(String(billingMonth));
  await page.getByLabel('Billing Year').fill('2026');
  await page.getByLabel('Previous Reading').first().fill('0');
  await page.getByLabel('Current Reading').first().fill('100');
  await page.getByLabel('Previous Reading').last().fill('0');
  await page.getByLabel('Current Reading').last().fill('50');
}

test.describe('Meter Reading Offline Sync', () => {
  let states: CapturedStates;

  test.beforeEach(async ({ page }) => {
    states = await captureAllStates(page);
  });

  test('should queue meter reading offline when submitted without network', async ({ context, page }) => {
    await login(page);
    await navigateToMeterReading(page);

    await fillMeterForm(page, SEEDED.room101Id, 8);

    await context.setOffline(true);
    await page.getByRole('button', { name: /Save Reading|Save Offline/ }).click();

    await expect(page.getByText(/saved.*pending sync|saved offline/i).first()).toBeVisible({ timeout: 10_000 });

    await context.setOffline(false);

    // No error state should be showing once back online.
    const errorBanner = page.locator('[role="alert"]').filter({ hasText: /error|failed/i });
    await expect(errorBanner).toHaveCount(0);

    expect(states.jsErrors).toEqual([]);
    expect(states.hydrationErrors).toEqual([]);
  });

  test('should record a meter reading successfully when online', async ({ page }) => {
    await login(page);
    await navigateToMeterReading(page);

    await fillMeterForm(page, SEEDED.room102Id, 8);
    await page.getByRole('button', { name: /Save Reading|Save Offline/ }).click();

    await expect(page.getByRole('alert').filter({ hasText: /recorded|success/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('✓ Recorded')).toBeVisible();

    expect(states.consoleErrors).toEqual([]);
    expect(states.jsErrors).toEqual([]);
    expect(states.hydrationErrors).toEqual([]);
  });
});

// Verification:
//   ./scripts/reset-e2e-db.sh && cd frontend && npx playwright test e2e/specs/meter-offline-sync.spec.ts --reporter=list
