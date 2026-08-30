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
  workers: process.env.CI ? 1 : 1, // Single worker avoids multi-tenant DB mutation collisions across tests in fullstack E2E
  timeout: 120_000, // 2 minutes per test — extended for full-suite E2E
  reporter: [['list']],

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },

  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,  // 1% tolerance — reduces false positives from font/subpixel differences
      threshold: 0.2,           // color threshold for pixel similarity
    },
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
        headless: true,
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
