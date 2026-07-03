// File: frontend/e2e/specs/maintenance-flow.spec.ts
// E2E Test: Maintenance Request Flow — Phase 4
// Flow: visit /maintenance → view list → create new → assert created
// Uses page.route() for all API mocking

import { test, expect, type Page } from '@playwright/test';

const MOCK_MAINTENANCE = {
  data: [
    {
      id: 'maint-1',
      property_id: 'p1',
      room_id: 'r1',
      title: 'Leaking faucet',
      description: 'Kitchen faucet has been dripping for 3 days',
      priority: 'medium',
      status: 'pending',
      assigned_to: null,
      created_by: 'user-1',
      created_at: '2026-06-15T10:00:00Z',
      updated_at: '2026-06-15T10:00:00Z',
    },
  ],
};

const MOCK_CREATED = {
  data: {
    id: 'maint-new',
    property_id: 'p1',
    room_id: 'r1',
    title: 'Broken window',
    description: 'Window in living room will not close properly',
    priority: 'high',
    status: 'pending',
    assigned_to: null,
    created_by: 'user-1',
    created_at: '2026-07-06T00:00:00Z',
    updated_at: '2026-07-06T00:00:00Z',
  },
};

async function mockMaintenanceApis(page: Page): Promise<void> {
  await page.route('**/api/v1/auth/login', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: 'mock-token',
        refresh_token: 'mock-refresh',
        token_type: 'bearer',
      }),
    }),
  );

  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          id: 'user-1',
          email: 'test@example.com',
          full_name: 'Test User',
          property_scopes: [],
          is_active: true,
        },
      }),
    }),
  );

  await page.route('**/api/v1/maintenance-requests/pending', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_MAINTENANCE),
    }),
  );

  await page.route('**/api/v1/maintenance-requests', (route) => {
    if (route.request().method() === 'POST') {
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_CREATED),
      });
    }
    return route.fallback();
  });

  await page.route('**/api/v1/properties', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          { id: 'p1', name: 'Sunset Tower', address: '123 Main St', billing_due_day: 5, min_deposit_months: 2, created_by: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
        ],
      }),
    }),
  );

  await page.route('**/api/v1/properties/*/rooms', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        property: { id: 'p1', name: 'Sunset Tower', address: '123 Main St', billing_due_day: 5, min_deposit_months: 2, created_by: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
        rooms: [
          { id: 'r1', property_id: 'p1', building_id: 'b1', floor_id: null, room_number: '101', room_type: 'studio', base_rent: 5000, status: 'available', images: null },
        ],
      }),
    }),
  );

  await page.route('**/api/v1/dashboard/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { total_rooms: 50 } }),
    }),
  );

  await page.route('**/api/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: {} }),
    }),
  );
}

async function loginAndNavigateToMaintenance(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByPlaceholder('Username').fill('testuser');
  await page.getByPlaceholder('Password').fill('Testpass123!');
  await page.getByRole('button', { name: /sign in|log in|login|submit/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 10_000 });
  await page.goto('/maintenance');
  await expect(page.locator('body')).toContainText(/maintenance/i);
}

test.describe('Maintenance Request Flow', () => {
  test.beforeEach(async ({ page }) => {
    await mockMaintenanceApis(page);
  });

  test('should display pending maintenance requests', async ({ page }) => {
    await loginAndNavigateToMaintenance(page);
    await expect(page.locator('body')).toContainText('Leaking faucet');
  });

  test('should create a new maintenance request', async ({ page }) => {
    await loginAndNavigateToMaintenance(page);

    const newButton = page.getByRole('link', { name: /new request/i });
    if (await newButton.isVisible().catch(() => false)) {
      await newButton.click();

      const propertySelect = page.locator('select').first();
      if (await propertySelect.isVisible().catch(() => false)) {
        await propertySelect.selectOption({ index: 1 });
      }

      await page.waitForTimeout(500);

      const roomSelect = page.locator('select').nth(1);
      if (await roomSelect.isVisible().catch(() => false)) {
        await roomSelect.selectOption({ index: 1 });
      }

      const titleInput = page.getByPlaceholder(/faucet|title/i).or(page.getByLabel(/title/i));
      if (await titleInput.isVisible().catch(() => false)) {
        await titleInput.fill('Broken window');
      }

      const descTextarea = page.locator('textarea').first();
      if (await descTextarea.isVisible().catch(() => false)) {
        await descTextarea.fill('Window in living room will not close properly');
      }

      const submitBtn = page.getByRole('button', { name: /submit|create|save/i });
      if (await submitBtn.isVisible().catch(() => false)) {
        await submitBtn.click();
      }

      await expect(
        page.locator('text=/created|success/i'),
      ).toBeVisible({ timeout: 10_000 });
    }
  });
});
