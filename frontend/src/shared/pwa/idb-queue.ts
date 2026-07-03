// File: src/shared/pwa/idb-queue.ts
// IndexedDB queue using `idb` for offline meter reading payloads.
// Key: auto-increment `id`, value: MeterReadingQueueItem.

import { openDB, type IDBPDatabase } from 'idb';
import type { API } from '@/types/api.d';

const DB_NAME = 'pms-meter-queue';
const DB_VERSION = 1;
const STORE_NAME = 'queue';

let dbPromise: Promise<IDBPDatabase> | null = null;

async function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, {
            keyPath: 'id',
            autoIncrement: true,
          });
        }
      },
    });
  }
  return dbPromise;
}

/** Add a meter reading payload to the offline queue */
export async function addToQueue(payload: API.MeterReadingRequest): Promise<void> {
  const db = await getDb();
  const item: API.MeterReadingQueueItem = {
    payload,
    createdAt: new Date().toISOString(),
    status: 'pending',
  };
  await db.add(STORE_NAME, item);
}

/** Get all pending items from the queue */
export async function getAllPending(): Promise<API.MeterReadingQueueItem[]> {
  const db = await getDb();
  const all = await db.getAll(STORE_NAME);
  return all.filter(
    (item): item is API.MeterReadingQueueItem =>
      typeof item === 'object' && item !== null && 'status' in item && item.status === 'pending',
  );
}

/** Delete an item from the queue by id */
export async function deleteFromQueue(id: number): Promise<void> {
  const db = await getDb();
  await db.delete(STORE_NAME, id);
}

/** Get total count of pending items */
export async function getPendingCount(): Promise<number> {
  const items = await getAllPending();
  return items.length;
}

/** Mark an item as syncing */
/** @public - Public utility for IDB queue state transitions (used by sync orchestrator) */
export async function markAsSyncing(id: number): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const item = await tx.store.get(id);
  if (item) {
    item.status = 'syncing';
    await tx.store.put(item);
  }
  await tx.done;
}

/** Mark an item as failed */
export async function markAsFailed(id: number, error: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const item = await tx.store.get(id);
  if (item) {
    item.status = 'failed';
    item.error = error;
    await tx.store.put(item);
  }
  await tx.done;
}