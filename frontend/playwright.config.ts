// File: frontend/playwright.config.ts
// Playwright E2E Configuration — Sprint 6 Frozen Contract
// Target: http://localhost:5173 (Vite dev/preview server)
// Reporter: HTML + list for CI, trace on all runs for debugging

import { defineConfig, devices } from '@playwright/test';

const CI = !!process.env.CI;
const OUTPUT_DIR = process.env.PLAYWRIGHT_OUTPUT_DIR || './test-results/playwright';

// Use system chromium on Alpine (musl libc compatibility)
const chromiumPath = process.env.PLAYWRIGHT_CHROMIUM_PATH || '/usr/bin/chromium-browser';

export default defineConfig({
  testDir: './e2e',
  outputDir: OUTPUT_DIR,
  fullyParallel: CI,
  forbidOnly: CI,
  retries: 2,
  workers: CI ? 1 : undefined,
  reporter: CI
    ? [['html', { outputFolder: OUTPUT_DIR + '/playwright-report', open: 'never' }], ['list']]
    : [['html', { outputFolder: './playwright-report', open: 'on-failure' }], ['list']],

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },

  webServer: {
    command: 'npm run dev',
    port: 5173,
    timeout: 120_000,
    reuseExistingServer: true,
  },

  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        launchOptions: {
          executablePath: chromiumPath,
        },
      },
    },
  ],
});

// Verification:
//   cd frontend && npx playwright test --reporter=list
//   3/3 E2E flows must pass (auth, meter-offline-sync, invoice-payment)
