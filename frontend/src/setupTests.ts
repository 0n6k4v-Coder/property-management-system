/// <reference types="vitest/globals" />
// File: src/setupTests.ts
// Vitest test setup — React Testing Library, MSW, DOM matchers.

import '@testing-library/jest-dom/vitest';

// Polyfill IndexedDB for JSDOM (used by idb-queue in offline meter readings)
import 'fake-indexeddb/auto';

// Polyfill MutationObserver for JSDOM (needed for React 19 + React Testing Library)
if (typeof globalThis.MutationObserver === 'undefined') {
  class MockMutationObserver {
    constructor(callback: MutationCallback) {
      this.callback = callback;
      this.observing = false;
    }
    observe() {
      this.observing = true;
    }
    disconnect() {
      this.observing = false;
    }
    takeRecords(): MutationRecord[] {
      return [];
    }
    callback: MutationCallback;
    observing: boolean;
  }
  globalThis.MutationObserver = MockMutationObserver as unknown as typeof MutationObserver;
}