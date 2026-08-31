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

  // Wait for DOM content to load
  await page.waitForLoadState('domcontentloaded');

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
  // Wait for heading to be visible (React may need time to render).
  // NOTE: MainLayout renders its own <h2>Property Management</h2> brand
  // title before page content, so matching 'h1, h2' would pick that up
  // instead of the page's actual heading — match 'main h1' only.
  await expect(page.locator('main h1').first()).toContainText(expectedHeading, { timeout: 30000 });
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

/**
 * Generates a deterministic, test-specific, backend-valid Thai phone and ID card number.
 * Uses a stable hash of the scenario/test identifier so the identity is stable across retries,
 * unique per test scenario, and satisfies Thai ID checksum validation (verifyThaiIdChecksum).
 */
export function generateDeterministicTenant(testIdentifier: string): {
  phone: string;
  idCard: string;
  fullName: string;
  email: string;
} {
  let hash = 0;
  for (let i = 0; i < testIdentifier.length; i++) {
    hash = (hash * 31 + testIdentifier.charCodeAt(i)) >>> 0;
  }
  const suffixNum = hash % 10000000;
  const suffix = String(suffixNum).padStart(7, '0');
  const phone = `082${suffix}`;

  // 12-digit base for Thai ID: 1220 + 7-digit suffix + 1 = 12 digits
  const idBase = `1220${suffix}1`;
  const digits = idBase.split('').map(Number);
  const total = digits.reduce((sum, d, i) => sum + (13 - i) * d, 0);
  const check = (11 - (total % 11)) % 10;
  const idCard = `${idBase}${check}`;

  return {
    phone,
    idCard,
    fullName: `Deterministic Tenant ${suffix.slice(-4)}`,
    email: `tenant.${suffix}@example.com`,
  };
}