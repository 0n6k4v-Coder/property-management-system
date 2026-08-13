// File: src/shared/pwa/idb-queue.test.ts
// Unit tests for idb-queue — addToQueue, getAllPending, getPendingCount,
// deleteFromQueue, markAsSyncing, markAsFailed, with IndexedDB via fake-indexeddb.

import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { openDB } from 'idb';
import { addToQueue, getAllPending, getPendingCount, deleteFromQueue, markAsSyncing, markAsFailed, _resetDb } from './idb-queue';
import type { API } from '@/types/api.d';

const DB_NAME = 'pms-meter-queue';
const STORE_NAME = 'queue';

// ── DB reset helper ────────────────────────────────────────────────────────
// The module-level dbPromise persists across tests. fake-indexeddb in-memory
// databases are reset when Vitest creates a new environment per file, but
// within a file we need to manage state. We delete the DB and wait for the
// deletion to complete, then the next call to getDb() (via addToQueue)
// will create a fresh database with a reset auto-increment counter.

async function resetDatabase(): Promise<void> {
  return new Promise((resolve) => {
    const deleteReq = indexedDB.deleteDatabase(DB_NAME);
    deleteReq.onsuccess = () => resolve();
    deleteReq.onerror = () => resolve(); // Continue even if deletion fails
    deleteReq.onblocked = () => resolve(); // Continue even if blocked
  });
}

// ── Test payloads ───────────────────────────────────────────────────────────

const makePayload = (
  overrides: Partial<API.MeterReadingRequest> = {},
): API.MeterReadingRequest => ({
  room_id: 'room-1',
  billing_month: 6,
  billing_year: 2026,
  electric_previous: 100,
  electric_current: 150,
  water_previous: 20,
  water_current: 30,
  ...overrides,
});

// ── Tests ───────────────────────────────────────────────────────────────────

describe('idb-queue', () => {
  beforeEach(async () => {
    // Close the cached DB connection + clear promise so each test gets a fresh DB
    await _resetDb();
    // Delete the DB so the next openDB creates a fresh store (resetting auto-increment)
    await resetDatabase();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('addToQueue', () => {
    it('adds a meter reading payload to the queue', async () => {
      const payload = makePayload();
      await addToQueue(payload);

      const all = await getAllPending();
      expect(all).toHaveLength(1);
      expect(all[0]?.payload).toEqual(payload);
      expect(all[0]?.status).toBe('pending');
      expect(all[0]?.createdAt).toBeDefined();
    });

    it('assigns an auto-increment id to each item', async () => {
      await addToQueue(makePayload({ room_id: 'room-1' }));
      await addToQueue(makePayload({ room_id: 'room-2' }));
      await addToQueue(makePayload({ room_id: 'room-3' }));

      const all = await getAllPending();
      expect(all).toHaveLength(3);
      expect(all[0]?.id).toBe(1);
      expect(all[1]?.id).toBe(2);
      expect(all[2]?.id).toBe(3);
    });

    it('stores createdAt as an ISO string', async () => {
      const payload = makePayload();
      await addToQueue(payload);

      const all = await getAllPending();
      expect(all[0]?.createdAt).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
      );
    });

    it('stores status as pending on add', async () => {
      await addToQueue(makePayload());
      const all = await getAllPending();
      expect(all[0]?.status).toBe('pending');
    });

    it('does not set error field on newly added item', async () => {
      await addToQueue(makePayload());
      const all = await getAllPending();
      expect(all[0]?.error).toBeUndefined();
    });
  });

  describe('getAllPending', () => {
    it('returns empty array when queue is empty', async () => {
      const all = await getAllPending();
      expect(all).toEqual([]);
    });

    it('returns only items with status pending', async () => {
      await addToQueue(makePayload({ room_id: 'room-1' }));
      await addToQueue(makePayload({ room_id: 'room-2' }));

      await markAsSyncing(2);

      const all = await getAllPending();
      expect(all).toHaveLength(1);
      expect(all[0]?.payload.room_id).toBe('room-1');
    });

    it('filters out syncing and failed items', async () => {
      await addToQueue(makePayload({ room_id: 'room-1' }));
      await addToQueue(makePayload({ room_id: 'room-2' }));
      await addToQueue(makePayload({ room_id: 'room-3' }));

      await markAsSyncing(2);
      await markAsFailed(3, 'Network error');

      const all = await getAllPending();
      expect(all).toHaveLength(1);
      expect(all[0]?.payload.room_id).toBe('room-1');
    });

    it('filters out items without status property (corrupted data)', async () => {
      // Manually insert a malformed item (no status field) directly into the DB
      const db = await openDB(DB_NAME, 1, {
        upgrade(db) {
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
          }
        },
      });
      await db.add(STORE_NAME, { id: 999, payload: {}, createdAt: '2026-01-01' });
      db.close();

      // The malformed item should be filtered out — getAllPending returns only items with status === 'pending'
      const all = await getAllPending();
      expect(all).toHaveLength(0);
    });
  });

  describe('getPendingCount', () => {
    it('returns 0 when queue is empty', async () => {
      expect(await getPendingCount()).toBe(0);
    });

    it('returns correct count of pending items', async () => {
      await addToQueue(makePayload());
      await addToQueue(makePayload());
      await addToQueue(makePayload());

      expect(await getPendingCount()).toBe(3);
    });

    it('excludes syncing and failed items from count', async () => {
      await addToQueue(makePayload());
      await addToQueue(makePayload());
      await addToQueue(makePayload());
      await addToQueue(makePayload());

      await markAsSyncing(2);
      await markAsFailed(3, 'error');

      expect(await getPendingCount()).toBe(2);
    });
  });

  describe('deleteFromQueue', () => {
    it('deletes an item by id', async () => {
      await addToQueue(makePayload());
      await addToQueue(makePayload());

      expect(await getPendingCount()).toBe(2);

      await deleteFromQueue(1);
      expect(await getPendingCount()).toBe(1);

      const all = await getAllPending();
      expect(all[0]?.id).toBe(2);
    });

    it('does not throw when deleting a non-existent id', async () => {
      await addToQueue(makePayload());

      await expect(deleteFromQueue(999)).resolves.not.toThrow();
      expect(await getPendingCount()).toBe(1);
    });

    it('handles deleting from an empty queue', async () => {
      await expect(deleteFromQueue(1)).resolves.not.toThrow();
    });
  });

  describe('markAsSyncing', () => {
    it('changes item status from pending to syncing', async () => {
      await addToQueue(makePayload());

      await markAsSyncing(1);

      // Syncing items are excluded from getAllPending
      const all = await getAllPending();
      expect(all).toHaveLength(0);

      // Verify via direct DB access
      const db = await openDB(DB_NAME, 1);
      const item = await db.get(STORE_NAME, 1);
      expect(item?.status).toBe('syncing');
      db.close();
    });

    it('does not throw for non-existent id', async () => {
      await expect(markAsSyncing(999)).resolves.not.toThrow();
    });

    it('does not overwrite error field when marking as syncing', async () => {
      await addToQueue(makePayload());
      await markAsFailed(1, 'Initial error');
      await addToQueue(makePayload({ room_id: 'room-2' }));
      await markAsSyncing(2);

      const db = await openDB(DB_NAME, 1);
      const item = await db.get(STORE_NAME, 2);
      expect(item?.status).toBe('syncing');
      expect(item?.error).toBeUndefined();
      db.close();
    });
  });

  describe('markAsFailed', () => {
    it('changes item status from pending to failed and stores error', async () => {
      await addToQueue(makePayload());

      await markAsFailed(1, 'Connection timeout');

      const all = await getAllPending();
      expect(all).toHaveLength(0);

      const db = await openDB(DB_NAME, 1);
      const item = await db.get(STORE_NAME, 1);
      expect(item?.status).toBe('failed');
      expect(item?.error).toBe('Connection timeout');
      db.close();
    });

    it('does not throw for non-existent id', async () => {
      await expect(markAsFailed(999, 'error')).resolves.not.toThrow();
    });

    it('stores error message alongside status', async () => {
      await addToQueue(makePayload());
      await addToQueue(makePayload());

      await markAsFailed(2, 'Meter reading conflict');

      const db = await openDB(DB_NAME, 1);
      const item = await db.get(STORE_NAME, 2);
      expect(item?.error).toBe('Meter reading conflict');
      db.close();
    });
  });

  describe('queue lifecycle', () => {
    it('full cycle: add → mark syncing → delete', async () => {
      await addToQueue(makePayload({ room_id: 'r1' }));
      await addToQueue(makePayload({ room_id: 'r2' }));
      await addToQueue(makePayload({ room_id: 'r3' }));

      expect(await getPendingCount()).toBe(3);

      await markAsSyncing(1);
      expect(await getPendingCount()).toBe(2);

      await markAsFailed(2, 'error');
      expect(await getPendingCount()).toBe(1);

      await deleteFromQueue(3);
      expect(await getPendingCount()).toBe(0);
    });

    it('items are persisted across getDb calls', async () => {
      await addToQueue(makePayload());

      const all = await getAllPending();
      expect(all).toHaveLength(1);
      expect(all[0]?.payload.room_id).toBe('room-1');
    });
  });
});
