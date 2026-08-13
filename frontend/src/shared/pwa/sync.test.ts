// File: src/shared/pwa/sync.test.ts
// Unit tests for sync.ts — registerMeterSync, checkNetworkAndSync,
// triggerBackgroundSync. Tests Background Sync API usage and offline queue
// processing.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ── Mock idb-queue module ────────────────────────────────────────────────────
const mockGetAllPending = vi.fn();
const mockDeleteFromQueue = vi.fn();
const mockMarkAsFailed = vi.fn();

vi.mock('@/shared/pwa/idb-queue', () => ({
  getAllPending: (...args: unknown[]) => mockGetAllPending(...args),
  deleteFromQueue: (...args: unknown[]) => mockDeleteFromQueue(...args),
  markAsFailed: (...args: unknown[]) => mockMarkAsFailed(...args),
}));

// ── Mock fetchClient module ─────────────────────────────────────────────────
const mockApiFetch = vi.fn();

vi.mock('@/shared/api/fetchClient', () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

// ── Import after mocks are set up ───────────────────────────────────────────
import {
  registerMeterSync,
  checkNetworkAndSync,
  triggerBackgroundSync,
} from './sync';

// ── Type helpers ────────────────────────────────────────────────────────────

type QueueItem = {
  id: number | undefined;
  payload: Record<string, unknown>;
  createdAt: string;
  status: 'pending' | 'syncing' | 'failed';
};

const makePayload = (overrides: Record<string, unknown> = {}) => ({
  room_id: 'room-1',
  billing_month: 6,
  billing_year: 2026,
  electric_previous: 100,
  electric_current: 150,
  water_previous: 50,
  water_current: 75,
  ...overrides,
});

function makePendingItem(overrides: Partial<QueueItem> = {}): QueueItem {
  return {
    id: 1,
    payload: makePayload(),
    createdAt: '2026-07-15T10:00:00.000Z',
    status: 'pending',
    ...overrides,
  };
}

// ── Navigator mock helpers ──────────────────────────────────────────────────

function setNavigatorOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true });
}

function mockServiceWorker(registration: unknown) {
  Object.defineProperty(navigator, 'serviceWorker', {
    value: {
      getRegistration: vi.fn().mockResolvedValue(registration),
    },
    configurable: true,
  });
}

function mockSyncManager(supported: boolean) {
  if (supported) {
    Object.defineProperty(window, 'SyncManager', {
      value: class SyncManager {},
      configurable: true,
    });
  } else {
    delete (window as { SyncManager?: unknown }).SyncManager;
  }
}

// ── Reset ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  setNavigatorOnline(true);
  mockGetAllPending.mockReset();
  mockDeleteFromQueue.mockReset();
  mockMarkAsFailed.mockReset();
  mockApiFetch.mockReset();

  // Default: navigator.serviceWorker not present
  Object.defineProperty(navigator, 'serviceWorker', {
    value: undefined,
    configurable: true,
  });
  mockSyncManager(false);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('sync', () => {
  describe('registerMeterSync', () => {
    it('returns false when serviceWorker is not in navigator', async () => {
      mockSyncManager(true);

      const result = await registerMeterSync();
      expect(result).toBe(false);
    });

    it('returns false when SyncManager is not in window', async () => {
      mockServiceWorker({ active: {}, sync: { register: vi.fn() } });
      mockSyncManager(false);

      const result = await registerMeterSync();
      expect(result).toBe(false);
    });

    it('returns false when serviceWorker.getRegistration returns null', async () => {
      mockServiceWorker(null);
      mockSyncManager(true);

      const result = await registerMeterSync();
      expect(result).toBe(false);
    });

    it('returns false when registration has no active worker', async () => {
      mockServiceWorker({ active: null, sync: { register: vi.fn() } });
      mockSyncManager(true);

      const result = await registerMeterSync();
      expect(result).toBe(false);
    });

    it('calls sync.register with "meter-sync" tag when supported', async () => {
      const syncRegister = vi.fn().mockResolvedValue(undefined);
      mockServiceWorker({ active: {}, sync: { register: syncRegister } });
      mockSyncManager(true);

      const result = await registerMeterSync();
      expect(result).toBe(true);
      expect(syncRegister).toHaveBeenCalledWith('meter-sync');
    });

    it('returns false when sync.register throws', async () => {
      const syncRegister = vi.fn().mockRejectedValue(new Error('Sync not allowed'));
      mockServiceWorker({ active: {}, sync: { register: syncRegister } });
      mockSyncManager(true);

      const result = await registerMeterSync();
      expect(result).toBe(false);
      expect(syncRegister).toHaveBeenCalled();
    });

    it('returns false when getRegistration throws', async () => {
      Object.defineProperty(navigator, 'serviceWorker', {
        value: {
          getRegistration: vi.fn().mockRejectedValue(new Error('SW not ready')),
        },
        configurable: true,
      });
      mockSyncManager(true);

      const result = await registerMeterSync();
      expect(result).toBe(false);
    });
  });

  describe('checkNetworkAndSync', () => {
    it('returns { synced: 0, failed: 0 } when navigator is offline', async () => {
      setNavigatorOnline(false);

      const result = await checkNetworkAndSync();
      expect(result).toEqual({ synced: 0, failed: 0 });
      expect(mockGetAllPending).not.toHaveBeenCalled();
    });

    it('returns { synced: 0, failed: 0 } when queue is empty', async () => {
      setNavigatorOnline(true);
      mockGetAllPending.mockResolvedValue([]);

      const result = await checkNetworkAndSync();
      expect(result).toEqual({ synced: 0, failed: 0 });
    });

    it('syncs all pending items on success', async () => {
      setNavigatorOnline(true);
      mockGetAllPending.mockResolvedValue([
        makePendingItem({ id: 1, payload: makePayload({ room_id: 'r1' }) }),
        makePendingItem({ id: 2, payload: makePayload({ room_id: 'r2' }) }),
      ]);
      mockApiFetch.mockResolvedValue({ data: { id: 'meter-001' } });
      mockDeleteFromQueue.mockResolvedValue(undefined);

      const result = await checkNetworkAndSync();
      expect(result).toEqual({ synced: 2, failed: 0 });
      expect(mockApiFetch).toHaveBeenCalledTimes(2);
      expect(mockDeleteFromQueue).toHaveBeenCalledWith(1);
      expect(mockDeleteFromQueue).toHaveBeenCalledWith(2);
    });

    it('marks failed items when apiFetch returns error response', async () => {
      setNavigatorOnline(true);
      const item = makePendingItem({ id: 5 });
      mockGetAllPending.mockResolvedValue([item]);
      mockApiFetch.mockResolvedValue({
        error: { code: 'SYS-503', message: 'Service unavailable' },
      });
      mockMarkAsFailed.mockResolvedValue(undefined);

      const result = await checkNetworkAndSync();
      expect(result).toEqual({ synced: 0, failed: 1 });
      expect(mockMarkAsFailed).toHaveBeenCalledWith(5, 'Service unavailable');
      expect(mockDeleteFromQueue).not.toHaveBeenCalled();
    });

    it('counts rejected apiFetch promises as failed', async () => {
      setNavigatorOnline(true);
      const item = makePendingItem({ id: 7 });
      mockGetAllPending.mockResolvedValue([item]);
      mockApiFetch.mockRejectedValue(new TypeError('Failed to fetch'));

      const result = await checkNetworkAndSync();
      expect(result).toEqual({ synced: 0, failed: 1 });
    });

    it('handles mixed success, error response, and network rejection', async () => {
      setNavigatorOnline(true);
      mockGetAllPending.mockResolvedValue([
        makePendingItem({ id: 1 }),
        makePendingItem({ id: 2 }),
        makePendingItem({ id: 3 }),
      ]);
      mockApiFetch
        .mockResolvedValueOnce({ data: { id: 'm1' } })
        .mockResolvedValueOnce({ error: { code: 'SYS-500', message: 'Server error' } })
        .mockRejectedValueOnce(new TypeError('Network error'));

      mockDeleteFromQueue.mockResolvedValue(undefined);
      mockMarkAsFailed.mockResolvedValue(undefined);

      const result = await checkNetworkAndSync();
      expect(result.synced).toBe(1);
      expect(result.failed).toBe(2);
      expect(mockDeleteFromQueue).toHaveBeenCalledWith(1);
      expect(mockMarkAsFailed).toHaveBeenCalledWith(2, 'Server error');
    });

    it('deletes item with undefined id from queue without calling apiFetch', async () => {
      setNavigatorOnline(true);
      const item = makePendingItem({ id: undefined });
      mockGetAllPending.mockResolvedValue([item]);
      mockDeleteFromQueue.mockResolvedValue(undefined);

      const result = await checkNetworkAndSync();
      // item.id === undefined → deleteFromQueue called, returns null →
      // allSettled sees fulfilled with value null → neither synced nor failed
      expect(mockDeleteFromQueue).toHaveBeenCalledWith(undefined);
      expect(mockApiFetch).not.toHaveBeenCalled();
      expect(result.synced).toBe(0);
      expect(result.failed).toBe(0);
    });

    it('calls apiFetch with POST method and stringified body', async () => {
      setNavigatorOnline(true);
      const item = makePendingItem({ id: 42 });
      mockGetAllPending.mockResolvedValue([item]);
      mockApiFetch.mockResolvedValue({ data: { id: 'm1' } });
      mockDeleteFromQueue.mockResolvedValue(undefined);

      await checkNetworkAndSync();

      expect(mockApiFetch).toHaveBeenCalledWith(
        '/billing/meter-readings',
        expect.objectContaining({
          method: 'POST',
          skipAuth: false,
        }),
      );
      // Verify body is a stringified JSON
      const callArgs = mockApiFetch.mock.calls[0][1] as { body: string };
      expect(typeof callArgs.body).toBe('string');
      const parsed = JSON.parse(callArgs.body);
      expect(parsed.room_id).toBe('room-1');
    });
  });

  describe('triggerBackgroundSync', () => {
    it('calls registerMeterSync and awaits it', async () => {
      const syncRegister = vi.fn().mockResolvedValue(undefined);
      mockServiceWorker({ active: {}, sync: { register: syncRegister } });
      mockSyncManager(true);
      setNavigatorOnline(true);

      await triggerBackgroundSync();

      expect(syncRegister).toHaveBeenCalledWith('meter-sync');
    });

    it('falls back to checkNetworkAndSync when registerMeterSync returns false and online', async () => {
      // serviceWorker not available → registerMeterSync returns false
      mockSyncManager(true);
      setNavigatorOnline(true);
      mockGetAllPending.mockResolvedValue([]);

      await triggerBackgroundSync();

      expect(mockGetAllPending).toHaveBeenCalled();
    });

    it('does NOT fall back when offline and registerMeterSync returns false', async () => {
      mockSyncManager(true);
      setNavigatorOnline(false);

      await triggerBackgroundSync();

      expect(mockGetAllPending).not.toHaveBeenCalled();
    });

    it('does not call checkNetworkAndSync when registerMeterSync succeeds', async () => {
      const syncRegister = vi.fn().mockResolvedValue(undefined);
      mockServiceWorker({ active: {}, sync: { register: syncRegister } });
      mockSyncManager(true);
      setNavigatorOnline(true);

      await triggerBackgroundSync();

      // registerMeterSync returned true → no fallback
      expect(mockGetAllPending).not.toHaveBeenCalled();
      expect(mockApiFetch).not.toHaveBeenCalled();
    });

    it('propagates checkNetworkAndSync errors when fallback is triggered', async () => {
      mockServiceWorker(null);
      mockSyncManager(true);
      setNavigatorOnline(true);

      mockGetAllPending.mockRejectedValue(new Error('DB error'));

      // triggerBackgroundSync does NOT catch errors — it propagates them
      await expect(triggerBackgroundSync()).rejects.toThrow('DB error');
      expect(mockGetAllPending).toHaveBeenCalled();
    });
  });
});
