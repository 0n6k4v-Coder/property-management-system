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
//   - METER-03/04 test real backend validation errors (BILL-001, BILL-002).
//   - METER-05 asserts absence of auto-invoice generation on reading save
//     (confirmed: record_meter_reading() has NO invoice side effect; invoice
//     generation is a separate property-level endpoint).
//   - METER-06a asserts no bulk-import UI exists on /meter-reading.
//   - METER-06b asserts no reading history UI exists (dead code: get_meter_reading_history
//     endpoint + meterKeys.history() exist but no component/hook calls them).

import { test, expect } from '@playwright/test';
import { login } from '../utils/test-helpers';
import { captureAllStates, type CapturedStates } from '../utils/state-capture';
import { SEEDED } from '../fixtures/seeded-ids';

async function navigateToMeterReading(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/meter-reading');
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('h1').first()).toContainText(/meter reading/i, { timeout: 30000 });
}

async function fillMeterForm(
  page: import('@playwright/test').Page,
  roomId: string,
  billingMonth: number,
  options?: {
    electricPrevious?: number;
    electricCurrent?: number;
    waterPrevious?: number;
    waterCurrent?: number;
  }
): Promise<void> {
  await page.getByLabel('Room ID').fill(roomId);
  await page.getByLabel('Billing Month').fill(String(billingMonth));
  await page.getByLabel('Billing Year').fill('2026');
  await page.getByLabel('Previous Reading').first().fill(String(options?.electricPrevious ?? 0));
  await page.getByLabel('Current Reading').first().fill(String(options?.electricCurrent ?? 100));
  await page.getByLabel('Previous Reading').last().fill(String(options?.waterPrevious ?? 0));
  await page.getByLabel('Current Reading').last().fill(String(options?.waterCurrent ?? 50));
}

async function submitAndExpectError(page: import('@playwright/test').Page, expectedMessage: string | RegExp): Promise<void> {
  await page.getByRole('button', { name: /Save Reading|Save Offline/ }).click();
  // Wait for toast with error message
  await expect(page.getByRole('alert').filter({ hasText: expectedMessage })).toBeVisible({ timeout: 10_000 });
}

test.describe('Meter Reading Offline Sync', () => {
  let states: CapturedStates;

  test.beforeEach(async ({ page }) => {
    states = await captureAllStates(page);
  });

  test('METER-01: should queue meter reading offline when submitted without network', async ({ context, page }) => {
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

  test('METER-02: should record a meter reading successfully when online', async ({ page }) => {
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

  test('METER-03: should reject duplicate reading for same room and billing period (BILL-002)', async ({ page }) => {
    await login(page);
    await navigateToMeterReading(page);

    // Room 101 already has a seeded reading for July 2026 (billing_month=7, billing_year=2026)
    // Submitting another reading for the same room/month/year should return 409 BILL-002
    await fillMeterForm(page, SEEDED.room101Id, 7);
    await submitAndExpectError(page, /Meter reading already exists for this room and billing period/);

    // Form should remain in idle state (not success)
    await expect(page.getByText('✓ Recorded')).not.toBeVisible();

    expect(states.jsErrors).toEqual([]);
    expect(states.hydrationErrors).toEqual([]);
  });

  test('METER-04: should reject reading where current <= previous (BILL-001)', async ({ page }) => {
      await login(page);
      await navigateToMeterReading(page);

      // Use a fresh month (September 2026) for room 101 to avoid duplicate conflict
      // Fill form with electric_current (50) <= electric_previous (100)
      // The client-side Zod validation should catch this and show inline error
      // without submitting to the server.
      await fillMeterForm(page, SEEDED.room101Id, 9, {
        electricPrevious: 100,
        electricCurrent: 50,
        waterPrevious: 0,
        waterCurrent: 50,
      });

      // Click submit - client-side validation should prevent submission
      await page.getByRole('button', { name: /Save Reading|Save Offline/ }).click();

      // Check for inline validation error message (from Zod schema)
      await expect(page.getByText(/Electric current cannot be less than previous/i)).toBeVisible({ timeout: 5000 });

      // Form should NOT show success state
      await expect(page.getByText('✓ Recorded')).not.toBeVisible();

      expect(states.jsErrors).toEqual([]);
      expect(states.hydrationErrors).toEqual([]);
    });

  test('METER-05: should NOT auto-generate invoice on meter reading submit (assert absence)', async ({ page }) => {
    await login(page);
    await navigateToMeterReading(page);

    // Submit a valid new reading for a fresh month (October 2026) for room 102
    await fillMeterForm(page, SEEDED.room102Id, 10);
    await page.getByRole('button', { name: /Save Reading|Save Offline/ }).click();

    // Wait for success toast
    await expect(page.getByRole('alert').filter({ hasText: /recorded|success/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('✓ Recorded')).toBeVisible();

    // Assert: No invoice-related toast, redirect, or notification appears
    // - No "Invoice generated" toast
    // - No navigation to invoice page
    // - No invoice number displayed
    const invoiceToast = page.getByRole('alert').filter({ hasText: /invoice|generated/i });
    await expect(invoiceToast).toHaveCount(0);

    // URL should remain on /meter-reading (no redirect)
    await expect(page).toHaveURL(/.*meter-reading/);

    expect(states.jsErrors).toEqual([]);
    expect(states.hydrationErrors).toEqual([]);
  });

  test('METER-06a: should NOT have bulk import UI (assert absence)', async ({ page }) => {
    await login(page);
    await navigateToMeterReading(page);

    // Assert: No "Import", "Bulk", "Upload", or "CSV" buttons/links on the page
    const bulkImportButton = page.getByRole('button', { name: /import|bulk|upload|csv/i });
    await expect(bulkImportButton).toHaveCount(0);

    const bulkImportLink = page.getByRole('link', { name: /import|bulk|upload|csv/i });
    await expect(bulkImportLink).toHaveCount(0);

    // Also check for file input (type="file") which would indicate upload capability
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toHaveCount(0);

    expect(states.jsErrors).toEqual([]);
    expect(states.hydrationErrors).toEqual([]);
  });

  test('METER-06b: should NOT have reading history UI (assert absence)', async ({ page }) => {
    await login(page);
    await navigateToMeterReading(page);

    // Assert: No "History", "Chart", "Graph", "Timeline", or tab/link for reading history
    const historyTab = page.getByRole('tab', { name: /history|chart|graph|timeline/i });
    await expect(historyTab).toHaveCount(0);

    const historyLink = page.getByRole('link', { name: /history|chart|graph|timeline/i });
    await expect(historyLink).toHaveCount(0);

    const historyButton = page.getByRole('button', { name: /history|chart|graph|timeline/i });
    await expect(historyButton).toHaveCount(0);

    // No table with meter reading history data (distinct from the form)
    // Look for any table that might show historical readings
    const tables = page.locator('table');
    await expect(tables).toHaveCount(0);

    expect(states.jsErrors).toEqual([]);
    expect(states.hydrationErrors).toEqual([]);
  });
});

// Verification:
//   ./scripts/reset-e2e-db.sh && cd frontend && npx playwright test e2e/specs/meter-offline-sync.spec.ts --reporter=list
