// File: frontend/e2e/specs/dialog-a11y.spec.ts
// E2E Test: Native Dialog Accessibility & Responsive Navigation Verification
// Test suite for G3-FOLLOWUP-01:
// - Feature Modal (Create Tenant, Terminate Contract): Open, Escape, Focus Entry, Background Isolation, Accessible Name, Close
// - Responsive Navigation: Desktop persistent <aside>, Tablet Dialog overlay, Mobile Dialog drawer

import { test, expect } from '@playwright/test';
import { login, navigateTo } from '../utils/test-helpers';

test.describe('Native Dialog Accessibility Verification', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('DIA-01: Feature Modal open, accessible role & name, focus entry, close button', async ({ page }) => {
    await navigateTo(page, '/tenants', /Tenants/i);

    const triggerBtn = page.getByRole('button', { name: /New Tenant/i });
    await expect(triggerBtn).toBeVisible();
    await triggerBtn.click();

    // Verify modal is open and has dialog role with accessible name
    const dialog = page.getByRole('dialog', { name: 'Create Tenant' });
    await expect(dialog).toBeVisible();

    // Verify focus has moved into the dialog
    const isFocusInside = await dialog.evaluate((el) => el.contains(document.activeElement));
    expect(isFocusInside).toBe(true);

    // Close via close button
    const closeBtn = dialog.getByRole('button', { name: /Close dialog/i });
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();

    // Verify dialog is closed
    await expect(dialog).not.toBeVisible();
  });

  test('DIA-02: Feature Modal closes via Escape key and background interaction is blocked', async ({ page }) => {
    await navigateTo(page, '/tenants', /Tenants/i);

    const triggerBtn = page.getByRole('button', { name: /New Tenant/i });
    await triggerBtn.click();

    const dialog = page.getByRole('dialog', { name: 'Create Tenant' });
    await expect(dialog).toBeVisible();

    // Background interaction isolation check:
    // When a native dialog is opened via showModal(), the underlying page is inert / blocked from pointer events.
    // In native modal mode, clicking a background element must fail actionability / pointer interception.
    const searchInput = page.locator('input[placeholder*="min. 3 chars"]');
    
    // Assert that interacting with the background element is blocked / rejected by the modal barrier
    let clickSucceeded: boolean;
    try {
      await searchInput.click({ timeout: 1500 });
      clickSucceeded = true;
    } catch {
      clickSucceeded = false;
    }
    expect(clickSucceeded).toBe(false);

    // Verify background searchInput did NOT receive focus (dialog remains isolated)
    const isSearchFocused = await searchInput.evaluate((el) => el === document.activeElement);
    expect(isSearchFocused).toBe(false);

    // Press Escape to close modal
    await page.keyboard.press('Escape');

    // Verify dialog closed
    await expect(dialog).not.toBeVisible();
  });

  test('DIA-03: Responsive Navigation - Desktop persistent <aside>, Mobile <dialog>, Tablet <dialog>', async ({ page }) => {
    // Desktop Viewport (1280x800)
    await page.setViewportSize({ width: 1280, height: 800 });
    await navigateTo(page, '/dashboard', /Dashboard/i);

    // Desktop should have persistent aside navigation
    const desktopAside = page.locator('aside[aria-label="Sidebar navigation"]');
    await expect(desktopAside).toBeVisible();

    // Mobile Viewport (375x667)
    await page.setViewportSize({ width: 375, height: 667 });

    // Open mobile navigation drawer via header menu button (wait for mobile menu button to become visible)
    const mobileMenuBtn = page.getByRole('button', { name: /Toggle navigation menu/i });
    await expect(mobileMenuBtn).toBeVisible();
    await mobileMenuBtn.click();

    // Mobile drawer should be native dialog
    const mobileDialog = page.getByRole('dialog');
    await expect(mobileDialog).toBeVisible();

    // Escape closes mobile drawer
    await page.keyboard.press('Escape');
    await expect(mobileDialog).not.toBeVisible();

    // Tablet Viewport (820x1180)
    await page.setViewportSize({ width: 820, height: 1180 });
    await navigateTo(page, '/dashboard', /Dashboard/i);

    // In tablet mode, sidebar is collapsed by default.
    // Find and click the toggle button to expand tablet overlay
    const tabletToggle = page.getByRole('button', { name: /Expand sidebar/i });
    await expect(tabletToggle).toBeVisible();
    await tabletToggle.click();

    // Tablet overlay should now be an open native dialog
    const tabletDialog = page.getByRole('dialog', { name: 'Sidebar navigation (overlay)' });
    await expect(tabletDialog).toBeVisible();

    // Escape closes tablet overlay
    await page.keyboard.press('Escape');
    await expect(tabletDialog).not.toBeVisible();
  });
});
