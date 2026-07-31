// File: frontend/e2e/utils/mock-helpers.ts
// Shared Mock API Helpers — Mandatory Reuse per E2E_TEST_STRATEGY.md Article 3.2
// All mocks use data wrapper, Vite exclusion, and correct response format

import type { Page } from '@playwright/test';
import { MOCK_USER, wrapInData } from './test-helpers';

// -- Vite Path Exclusion Pattern (per C-02, C-12) --
const VITE_PATHS = ['/@vite/', '/@react-refresh', '/@fs/', '/src/'];

function isVitePath(url: string): boolean {
  return VITE_PATHS.some((path) => url.includes(path));
}

// -- Auth Mock APIs --
export async function mockAuthApis(page: Page): Promise<void> {
  // Mock login endpoint (POST /api/v1/auth/login)
  await page.route('**/api/v1/auth/login', async (route) => {
    if (route.request().method() !== 'POST') {
      return route.continue();
    }
    const postData = route.request().postData();
    // Allow test-specific overrides to handle different scenarios
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        wrapInData({
          access_token: 'mock-access-token',
          refresh_token: 'mock-refresh-token',
          token_type: 'bearer',
          user: MOCK_USER,
        })
      ),
    });
  });

  // Mock auth/me endpoint (GET /api/v1/auth/me)
  await page.route('**/api/v1/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(wrapInData(MOCK_USER)),
    });
  });

  // Mock refresh token endpoint
  await page.route('**/api/v1/auth/refresh', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        wrapInData({
          access_token: 'mock-new-access-token',
          refresh_token: 'mock-new-refresh-token',
          token_type: 'bearer',
        })
      ),
    });
  });

  // Mock dashboard endpoints (for login redirect)
  await page.route('**/api/v1/dashboard/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        wrapInData({
          total_properties: 5,
          total_tenants: 42,
          occupancy_rate: 87.5,
          monthly_revenue: 325000,
          overdue_count: 3,
        })
      ),
    });
  });

  // Mock overdue invoices (for dashboard)
  await page.route('**/api/v1/invoices/overdue*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(wrapInData({ data: [] })),
    });
  });
}

// -- Register Mock APIs --
export async function mockRegisterApis(page: Page): Promise<void> {
  // Mock register endpoint (POST /api/v1/auth/register)
  await page.route('**/api/v1/auth/register', async (route) => {
    if (route.request().method() !== 'POST') {
      return route.continue();
    }
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify(
        wrapInData({
          id: '00000000-0000-0000-0000-000000000002',
          email: 'newuser@example.com',
          full_name: 'New User',
          phone: '0812345678',
          is_active: false, // Requires email verification
          message: 'Registration successful. Please verify your email.',
        })
      ),
    });
  });

  // Mock email verification endpoint
  await page.route('**/api/v1/auth/verify-email', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        wrapInData({
          message: 'Email verified successfully. You can now log in.',
        })
      ),
    });
  });

  // Reuse auth mocks for login after registration
  await mockAuthApis(page);
}

// -- Error Mock Factories (for negative test scenarios) --
export function createErrorMock(
  status: number,
  code: string,
  message: string
): (route: { fulfill: (options: { status: number; contentType: string; body: string }) => Promise<void> }) => Promise<void> {
  return async (route) => {
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify({
        error: { code, message },
      }),
    });
  };
}

// -- Specific Error Mocks --
export const mockInvalidCredentials = createErrorMock(
  401,
  'AUTH-001',
  'Invalid email or password'
);

export const mockInactiveUser = createErrorMock(403, 'AUTH-003', 'Account deactivated');

export const mockRateLimited = createErrorMock(
  429,
  'AUTH-004',
  'Too many login attempts. Please try again in 15 minutes.'
);

export const mockEmailExists = createErrorMock(
  400,
  'AUTH-005',
  'Email already registered'
);

export const mockWeakPassword = createErrorMock(
  400,
  'AUTH-006',
  'Password must be at least 8 characters with uppercase, lowercase, number, and special character'
);

export const mockPasswordMismatch = createErrorMock(
  400,
  'AUTH-007',
  'Passwords do not match'
);

export const mockInvalidPhone = createErrorMock(
  400,
  'AUTH-008',
  'Invalid phone number format (Thai)'
);

export const mockInvalidEmailFormat = createErrorMock(
  400,
  'AUTH-009',
  'Invalid email format'
);

// -- Catch-all for API v1 (with Vite exclusion) --
export async function mockCatchAllApi(page: Page): Promise<void> {
  await page.route('**/api/v1/**', async (route) => {
    const url = route.request().url();

    // Skip Vite dev server internal routes (CRITICAL: C-02, C-12)
    if (isVitePath(url)) {
      return route.continue();
    }

    // Default empty success response with data wrapper
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(wrapInData({})),
    });
  });
}

// -- Complete Mock Setup for Auth Flow Tests --
export async function setupAuthFlowMock(page: Page): Promise<void> {
  // Catch-all registered FIRST: Playwright gives precedence to the most
  // recently registered matching route, so the specific mocks below must
  // be added after this one in order to actually take effect.
  await mockCatchAllApi(page);

  // Mock login endpoint (POST /api/v1/auth/login)
  await page.route('**/api/v1/auth/login', async (route) => {
    if (route.request().method() !== 'POST') {
      return route.continue();
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        wrapInData({
          access_token: 'mock-access-token',
          refresh_token: 'mock-refresh-token',
          token_type: 'bearer',
          user: MOCK_USER,
        })
      ),
    });
  });

  // Mock auth/me endpoint (GET /api/v1/auth/me)
  await page.route('**/api/v1/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(wrapInData(MOCK_USER)),
    });
  });

  // Mock refresh token endpoint
  await page.route('**/api/v1/auth/refresh', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        wrapInData({
          access_token: 'mock-new-access-token',
          refresh_token: 'mock-new-refresh-token',
          token_type: 'bearer',
        })
      ),
    });
  });

  // Mock dashboard endpoints (for login redirect)
  await page.route('**/api/v1/dashboard/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        wrapInData({
          total_properties: 5,
          total_tenants: 42,
          occupancy_rate: 87.5,
          monthly_revenue: 325000,
          overdue_count: 3,
        })
      ),
    });
  });

  // Mock overdue invoices (for dashboard)
  await page.route('**/api/v1/invoices/overdue*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(wrapInData({ data: [] })),
    });
  });
}

export async function setupAuthFlowMocks(page: Page): Promise<void> {
  await setupAuthFlowMock(page);
}

export async function setupRegisterFlowMocks(page: Page): Promise<void> {
  await mockCatchAllApi(page);
  await mockRegisterApis(page);
}