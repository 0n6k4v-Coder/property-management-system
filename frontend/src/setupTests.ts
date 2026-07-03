/// <reference types="vitest/globals" />
// File: src/setupTests.ts
// Vitest test setup — React Testing Library, MSW, DOM matchers.

import '@testing-library/jest-dom/vitest';

// Polyfill IndexedDB for JSDOM (used by idb-queue in offline meter readings)
import 'fake-indexeddb/auto';