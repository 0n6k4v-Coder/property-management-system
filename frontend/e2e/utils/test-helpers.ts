// File: frontend/e2e/utils/test-helpers.ts
// Shared Test Helpers — Mandatory Reuse per E2E_TEST_STRATEGY.md Article 3.2
// Centralizes credentials, login, navigation, and common test data

import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

// -- Standard Test Credentials (from seed_admin.py & LoginPage.tsx) --
export const TEST_USER = {
  email: 'admin@example.com',
  password: 'Admin123!',
} as const;

// -- Mock User Object (returned by /auth/me and login) --
export const MOCK_USER = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'admin@example.com',
  full_name: 'Test User',
  property_scopes: [],
  is_active: true,
} as const;

// -- Register Test Data --
export const VALID_REGISTER_DATA = {
  email: 'newuser@example.com',
  password: 'SecurePass123!',
  confirmPassword: 'SecurePass123!',
  full_name: 'New User',
  phone: '0812345678',
  acceptTerms: true,
} as const;

// -- Login Function (Robust Wait Strategy per C-09) --
export async function login(
  page: Page,
  email: string = TEST_USER.email,
  password: string = TEST_USER.password
): Promise<void> {
  await page.goto('/login');

  // Wait for React app to hydrate - use domcontentloaded + networkidle
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle');

  // Wait for form elements to be visible (auto-waiting per C-03)
  await expect(
    page.locator('input[placeholder="you@example.com"]').first()
  ).toBeVisible({ timeout: 30000 });
  await expect(
    page.locator('input[placeholder="Enter your password"]').first()
  ).toBeVisible({ timeout: 30000 });

  // Fill credentials
  await page.locator('input[placeholder="you@example.com"]').first().fill(email);
  await page.locator('input[placeholder="Enter your password"]').first().fill(password);

  // Submit
  await page.getByRole('button', { name: /sign in|log in|login|submit/i }).click();

  // Wait for redirect to dashboard
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
}

// -- Navigate Helper with Expected Heading --
export async function navigateTo(
  page: Page,
  path: string,
  expectedHeading: string | RegExp
): Promise<void> {
  await page.goto(path);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle');
  // Wait for heading to be visible (React may need time to render).
  // NOTE: MainLayout renders its own <h2>Property Management</h2> brand
  // title before page content, so matching 'h1, h2' would pick that up
  // instead of the page's actual heading — match h1 only.
  await expect(page.locator('h1').first()).toContainText(expectedHeading, { timeout: 30000 });
}

// -- Token Verification Helper --
export async function getAccessToken(page: Page): Promise<string | null> {
  return page.evaluate(() => sessionStorage.getItem('pms_access_token'));
}

export async function verifyTokenStored(page: Page): Promise<void> {
  const accessToken = await getAccessToken(page);
  expect(accessToken).not.toBeNull();
  expect(accessToken!.length).toBeGreaterThan(0);
}

// -- Form Interaction Helpers --
export async function fillField(
  page: Page,
  placeholder: string,
  value: string
): Promise<void> {
  await page.locator(`input[placeholder="${placeholder}"]`).first().fill(value);
}

export async function clickButton(page: Page, name: string | RegExp): Promise<void> {
  await page.getByRole('button', { name }).click();
}

export async function clickLink(page: Page, name: string | RegExp): Promise<void> {
  await page.getByRole('link', { name }).click();
}

// -- Wait for Toast/Notification --
export async function waitForToast(
  page: Page,
  text: string | RegExp,
  timeout = 5000
): Promise<void> {
  await expect(page.locator(`text=${text}`).first()).toBeVisible({ timeout });
}

// -- Check Validation Error --
export async function expectValidationError(
  page: Page,
  errorText: string | RegExp
): Promise<void> {
  const errorLocator = page.locator(`text=${errorText}`).first();
  await expect(errorLocator).toBeVisible({ timeout: 5000 });
}

// -- Standard Mock API Response Wrapper --
export function wrapInData<T>(data: T): { data: T } {
  return { data };
}