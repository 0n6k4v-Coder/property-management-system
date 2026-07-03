// File: frontend/playwright.config.ts
// Playwright E2E Configuration — Sprint 6 Frozen Contract
// Target: http://localhost:5173 (Vite dev/preview server)
// Reporter: HTML + list for CI, trace on all runs for debugging

import { defineConfig, devices } from '@playwright/test';

const CI = !!process.env.CI;

export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e-results',
  fullyParallel: CI,
  forbidOnly: CI,
  retries: 2,
  workers: CI ? 1 : undefined,
  reporter: CI
    ? [['html', { outputFolder: 'playwright-report', open: 'never' }], ['list']]
    : [['html', { outputFolder: 'playwright-report', open: 'on-failure' }], ['list']],

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },

  webServer: {
    command: 'npm run preview',
    port: 5173,
    timeout: 120_000,
    reuseExistingServer: !CI,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});

// Verification:
//   cd frontend && npx playwright test --reporter=list
//   3/3 E2E flows must pass (auth, meter-offline-sync, invoice-payment)
