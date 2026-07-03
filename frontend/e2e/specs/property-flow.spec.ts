// File: e2e/specs/property-flow.spec.ts
// E2E Test: Property Management Flow
// Flow: Login → View Properties → Select Property → View Rooms → Switch Tabs

import { test, expect, type Page } from '@playwright/test';

// ── Mock Data ─────────────────────────────────────────────────────

const MOCK_LOGIN_SUCCESS = {
  data: {
    access_token: 'mock-access-token',
    refresh_token: 'mock-refresh-token',
    user: {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'test@example.com',
      full_name: 'Test User',
      property_scopes: [],
      is_active: true,
    },
  },
};

const MOCK_PROPERTIES = {
  data: [
    {
      id: 'p1',
      name: 'Sunset Tower',
      address: '123 Main St',
      billing_due_day: 5,
      min_deposit_months: 2,
      created_by: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
    {
      id: 'p2',
      name: 'Riverside Apartments',
      address: '456 River Rd',
      billing_due_day: 10,
      min_deposit_months: 3,
      created_by: null,
      created_at: '2026-02-01T00:00:00Z',
      updated_at: '2026-02-01T00:00:00Z',
    },
  ],
  meta: null,
};

const MOCK_PROPERTY_ROOMS = {
  property: {
    id: 'p1',
    name: 'Sunset Tower',
    address: '123 Main St',
    billing_due_day: 5,
    min_deposit_months: 2,
    created_by: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  rooms: [
    {
      id: 'r1',
      property_id: 'p1',
      building_id: 'b1',
      floor_id: null,
      room_number: '101',
      room_type: 'studio',
      base_rent: 5000,
      status: 'available',
      images: null,
    },
    {
      id: 'r2',
      property_id: 'p1',
      building_id: 'b1',
      floor_id: null,
      room_number: '102',
      room_type: '1br',
      base_rent: 8000,
      status: 'occupied',
      images: null,
    },
  ],
};

const MOCK_DASHBOARD = {
  data: {
    total_rooms: 50,
    occupied_rooms: 42,
    occupancy_rate: 84,
    active_contracts: 38,
    total_revenue: 425000,
    overdue_count: 3,
    overdue_amount: 78000,
    pending_maintenance: 3,
  },
};

// ── Setup Helpers ─────────────────────────────────────────────────

async function mockAllApis(page: Page): Promise<void> {
  // Auth endpoints
  await page.route('**/api/v1/auth/login', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_LOGIN_SUCCESS),
    }),
  );

  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_LOGIN_SUCCESS.data),
    }),
  );

  await page.route('**/api/v1/auth/refresh', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { access_token: 'refreshed-token' } }),
    }),
  );

  // Property endpoints
  await page.route('**/api/v1/properties', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_PROPERTIES),
      });
    }
    // POST — create property
    return route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          id: 'new-p1',
          name: 'New Property',
          address: '789 New St',
          billing_due_day: 10,
          min_deposit_months: 2,
          created_by: null,
          created_at: '2026-06-01T00:00:00Z',
          updated_at: '2026-06-01T00:00:00Z',
        },
      }),
    });
  });

  await page.route('**/api/v1/properties/*/rooms', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_PROPERTY_ROOMS),
    }),
  );

  // Dashboard endpoint
  await page.route('**/api/v1/dashboard/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_DASHBOARD),
    }),
  );

  // Catch-all for other API requests
  await page.route('**/api/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: {} }),
    }),
  );
}

async function loginAsTestUser(page: Page): Promise<void> {
  await page.goto('/login');

  const emailInput = page.getByPlaceholder('you@example.com');
  const passwordInput = page.getByPlaceholder('Enter your password');

  await emailInput.fill('test@example.com');
  await passwordInput.fill('Password1');
  await page.getByRole('button', { name: /sign in/i }).click();

  await page.waitForURL(/\/dashboard/, { timeout: 10_000 });
}

// ── Tests ─────────────────────────────────────────────────────────

test.describe('Property Management', () => {
  test.beforeEach(async ({ page }) => {
    await mockAllApis(page);
  });

  test('full flow: login → property list → select property → view rooms', async ({ page }) => {
    // Step 1: Login
    await loginAsTestUser(page);
    await expect(page).toHaveURL(/\/dashboard/);

    // Step 2: Navigate to properties
    await page.goto('/property');
    await expect(page.getByText('Property Management')).toBeVisible();

    // Step 3: Verify property cards are visible
    const sunsetCard = page.getByRole('button', { name: /Sunset Tower/i });
    await expect(sunsetCard).toBeVisible();

    const riversideCard = page.getByRole('button', { name: /Riverside Apartments/i });
    await expect(riversideCard).toBeVisible();

    // Step 4: Click on Sunset Tower to view rooms
    await sunsetCard.click();

    // Step 5: Verify property detail with rooms
    await expect(page.getByText('Room 101')).toBeVisible();
    await expect(page.getByText('Room 102')).toBeVisible();
    await expect(page.getByText('1 available')).toBeVisible();
    await expect(page.getByText('1 occupied')).toBeVisible();
    await expect(page.getByText('Rent: ฿5,000')).toBeVisible();
  });

  test('property detail: tab switching', async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/property');

    // Select a property
    await page.getByRole('button', { name: /Sunset Tower/i }).click();
    await expect(page.getByText('Room 101')).toBeVisible();

    // Switch to Contract tab
    await page.getByRole('tab', { name: 'Contract' }).click();
    await expect(page.getByText('No active contract for this room.')).toBeVisible();

    // Switch to Meter History tab
    await page.getByRole('tab', { name: 'Meter History' }).click();
    await expect(page.getByText('Meter reading history will appear here.')).toBeVisible();

    // Switch back to Overview
    await page.getByRole('tab', { name: 'Overview' }).click();
    await expect(page.getByText('Room Details')).toBeVisible();
  });

  test('property detail: back navigation', async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto('/property');

    await page.getByRole('button', { name: /Sunset Tower/i }).click();
    await expect(page.getByText('Room 101')).toBeVisible();

    // Click back button
    await page.getByText('Back to properties').click();

    // Should return to property grid
    await expect(page.getByRole('button', { name: /Sunset Tower/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Riverside Apartments/i })).toBeVisible();
  });

  test('empty state: shows create form when no properties', async ({ page }) => {
    // Override properties to return empty list
    await page.route('**/api/v1/properties', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ data: [], meta: null }),
        });
      }
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ data: { id: 'new-p1', name: 'New Property' } }),
      });
    });

    await loginAsTestUser(page);
    await page.goto('/property');

    await expect(page.getByText('No Properties Yet')).toBeVisible();
    await expect(page.getByRole('button', { name: /\+ Create Property/i })).toBeVisible();

    // Click create button to open form
    await page.getByRole('button', { name: /\+ Create Property/i }).click();
    await expect(page.getByText('Create New Property')).toBeVisible();
    await expect(page.getByLabel('Property Name')).toBeVisible();
  });

  test('error scenario: handles API failure gracefully', async ({ page }) => {
    // Override properties to return 500
    await page.route('**/api/v1/properties', (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: { code: 'SYS-500', message: 'Internal server error' } }),
        });
      }
      return route.continue();
    });

    await loginAsTestUser(page);
    await page.goto('/property');

    // Page should still render without crashing
    await expect(page.getByText('Property Management')).toBeVisible();
  });
});
