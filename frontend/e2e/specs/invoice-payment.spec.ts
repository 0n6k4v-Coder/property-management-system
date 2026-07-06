// File: frontend/e2e/specs/invoice-payment.spec.ts
// E2E Test: Invoice Payment Flow — Fullstack (real backend + real database, no mocks)
// Flow: visit /invoices → view list → click detail → record payment → assert updated balance
// Uses: State Verification Engine (E2E_TEST_STRATEGY.md Article 1.1)
//       Shared Helpers (test-helpers.ts, state-capture.ts)
//       Seeded fixtures (frontend/e2e/fixtures/seeded-ids.ts) — run
//       `./scripts/reset-e2e-db.sh` before this suite.
// Component Audit: Verified against InvoiceListPage.tsx, InvoiceDetailPage.tsx, billing/api.ts
//
// Fullstack notes:
//   - Real route is `/invoices/:id` (the previous mocked version incorrectly
//     navigated to a nonexistent `/invoices/detail/1` as a fallback).
//   - MAJOR FINDING: both InvoiceListPage.tsx and InvoiceDetailPage.tsx call
//     useToast(), but `<ToastProvider>` was never mounted anywhere in the
//     real app tree (App.tsx) — only in isolated component unit tests. This
//     meant every real visit to /invoices crashed immediately with
//     "useToast must be used within ToastProvider" (an uncaught React
//     error), which is what the earlier mocked test's mysterious "renders
//     Dashboard content instead of invoices" symptom actually was. Fixed by
//     adding <ToastProvider> to App.tsx — see docs/LOG/E2E_TEST.md. The same
//     missing-provider bug also affected MaintenanceFormPage, SettingsPage,
//     TenantListPage, ContractDetailPage/ContractFormPage, and
//     MeterReadingPage (all call useToast()).
//   - The PaymentModal's method <select> options ("cash", "transfer", "qr",
//     "credit") do NOT match the real backend's accepted pattern
//     (`cash|bank_transfer|credit_card|qr_code|wallet`) — only "cash"
//     matches on both sides. Selecting any other option would 422. Tests
//     below stick to the default "cash" method, which is what the form
//     pre-selects anyway.
//   - "Generate Invoice" posts a hardcoded placeholder
//     `property_id: '00000000-0000-0000-0000-000000000001'` (same
//     SAMPLE_PROPERTY pattern as the Dashboard) — bulk generation via the
//     UI can never target a real seeded property. Not exercised here.

import { test, expect } from '@playwright/test';
import { login } from '../utils/test-helpers';
import { captureAllStates, type CapturedStates } from '../utils/state-capture';
import { SEEDED, SEEDED_DATA } from '../fixtures/seeded-ids';

test.describe('Invoice Payment Flow', () => {
  let states: CapturedStates;

  test.beforeEach(async ({ page }) => {
    states = await captureAllStates(page);
  });

  test('should display invoice list with correct data', async ({ page }) => {
    await login(page);
    await page.goto('/invoices');
    await expect(page.locator('h1').first()).toContainText(/invoices/i, { timeout: 30000 });

    await expect(page.getByText(SEEDED_DATA.invoice.number)).toBeVisible();
    await expect(page.getByText(/8,500/).first()).toBeVisible();

    expect(states.consoleErrors).toEqual([]);
    expect(states.jsErrors).toEqual([]);
    expect(states.networkErrors).toEqual([]);
    expect(states.hydrationErrors).toEqual([]);
  });

  test('should navigate to invoice detail and show real invoice data', async ({ page }) => {
    await login(page);
    await page.goto('/invoices');
    await expect(page.locator('h1').first()).toContainText(/invoices/i, { timeout: 30000 });

    await page.getByRole('link', { name: new RegExp(`View invoice ${SEEDED_DATA.invoice.number}`, 'i') }).click();
    await expect(page).toHaveURL(new RegExp(`/invoices/${SEEDED.invoice20260001Id}`));

    await expect(page.locator('h1').first()).toContainText(SEEDED_DATA.invoice.number);
    await expect(page.getByText(/8,500/).first()).toBeVisible(); // total
    await expect(page.getByText(/remaining/i)).toBeVisible();

    expect(states.consoleErrors).toEqual([]);
    expect(states.jsErrors).toEqual([]);
    expect(states.networkErrors).toEqual([]);
    expect(states.hydrationErrors).toEqual([]);
  });

  test('should record a payment and update the remaining balance', async ({ page }) => {
    await login(page);
    await page.goto(`/invoices/${SEEDED.invoice20260001Id}`);
    await expect(page.locator('h1').first()).toContainText(SEEDED_DATA.invoice.number, { timeout: 30000 });

    await page.getByRole('button', { name: 'Record Payment' }).click();
    await expect(page.getByRole('dialog', { name: 'Record Payment' })).toBeVisible();

    // Pay a partial amount so the invoice stays payable for repeated test runs.
    await page.getByLabel('Amount').fill('1000');
    // Method left as default "cash" — see file header note on the real
    // backend's accepted method values.
    await page.getByRole('button', { name: 'Record Payment' }).last().click();

    await expect(page.getByRole('alert').filter({ hasText: /payment recorded|success/i })).toBeVisible({ timeout: 10_000 });

    expect(states.consoleErrors).toEqual([]);
    expect(states.jsErrors).toEqual([]);
    expect(states.hydrationErrors).toEqual([]);
  });

  test('should validate that payment amount must be positive', async ({ page }) => {
    await login(page);
    await page.goto(`/invoices/${SEEDED.invoice20260001Id}`);
    await expect(page.locator('h1').first()).toContainText(SEEDED_DATA.invoice.number, { timeout: 30000 });

    await page.getByRole('button', { name: 'Record Payment' }).click();
    await expect(page.getByRole('dialog', { name: 'Record Payment' })).toBeVisible();

    await page.getByLabel('Amount').fill('0');
    await page.getByRole('button', { name: 'Record Payment' }).last().click();

    await expect(page.getByText(/must be positive/i)).toBeVisible();

    expect(states.consoleErrors).toEqual([]);
    expect(states.jsErrors).toEqual([]);
    expect(states.networkErrors).toEqual([]);
    expect(states.hydrationErrors).toEqual([]);
  });
});

// Verification:
//   ./scripts/reset-e2e-db.sh && cd frontend && npx playwright test e2e/specs/invoice-payment.spec.ts --reporter=list
