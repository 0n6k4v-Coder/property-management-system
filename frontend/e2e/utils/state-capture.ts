// File: frontend/e2e/utils/state-capture.ts
// State Capture Utility — Mandatory in Every Test per E2E_TEST_STRATEGY.md Article 3.4
// Captures ALL states simultaneously: console, JS errors, network, hydration

import type { Page, Response } from '@playwright/test';

export interface CapturedStates {
  consoleErrors: string[];
  jsErrors: string[];
  networkErrors: Array<{ status: number; url: string; method: string }>;
  hydrationErrors: string[];
}

export async function captureAllStates(page: Page): Promise<CapturedStates> {
  const states: CapturedStates = {
    consoleErrors: [],
    jsErrors: [],
    networkErrors: [],
    hydrationErrors: [],
  };

  // Console errors
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      states.consoleErrors.push(msg.text());
    }
  });

  // JavaScript uncaught exceptions
  page.on('pageerror', (error) => {
    states.jsErrors.push(error.message);
  });

  // Network errors (4xx, 5xx)
  page.on('response', (response: Response) => {
    if (response.status() >= 400) {
      states.networkErrors.push({
        status: response.status(),
        url: response.url(),
        method: response.request().method(),
      });
    }
  });

  // Hydration mismatches (React hydration errors)
  page.on('console', (msg) => {
    const text = msg.text();
    if (
      text.includes('hydration') ||
      text.includes('Hydration') ||
      text.includes('hydrate')
    ) {
      states.hydrationErrors.push(text);
    }
  });

  return states;
}