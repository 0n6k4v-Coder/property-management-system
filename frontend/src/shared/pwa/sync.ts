// File: src/shared/pwa/sync.ts
// Sync helper: register background sync, check network, process queue.

import { getAllPending, deleteFromQueue, markAsFailed } from './idb-queue';
import { apiFetch } from '@/shared/api/fetchClient';
import type { API } from '@/types/api.d';

/** Register a background sync event (only works with activated SW) */
export async function registerMeterSync(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('SyncManager' in window)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    await (registration as unknown as { sync: { register: (tag: string) => Promise<void> } }).sync.register('meter-sync');
    return true;
  } catch {
    return false;
  }
}

/** Check network and flush all pending queue items */
/** @public - Public utility for offline queue flush on network reconnect */
export async function checkNetworkAndSync(): Promise<{
  synced: number;
  failed: number;
}> {
  if (!navigator.onLine) {
    return { synced: 0, failed: 0 };
  }

  const pending = await getAllPending();
  let synced = 0;
  let failed = 0;

  // Process items — network error stops further processing to avoid spamming
  const results = await Promise.allSettled(
    pending.map(async (item) => {
      if (item.id === undefined) {
        await deleteFromQueue(item.id as unknown as number);
        return null;
      }

      const res = await apiFetch<API.SuccessResponse<API.MeterReadingResponse>>(
        '/meter-readings',
        {
          method: 'POST',
          body: JSON.stringify(item.payload),
          skipAuth: false,
        },
      );

      if ('error' in res) {
        await markAsFailed(item.id, (res as API.ErrorResponse).error.message);
        return { status: 'failed' as const };
      }

      await deleteFromQueue(item.id);
      return { status: 'synced' as const };
    }),
  );

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value?.status === 'synced') {
      synced++;
    } else if (result.status === 'rejected' || result.value?.status === 'failed') {
      failed++;
    }
  }

  return { synced, failed };
}

/** Trigger an immediate sync attempt (for online events) */
export async function triggerBackgroundSync(): Promise<void> {
  // First try SW sync registration
  const registered = await registerMeterSync();

  // Fallback: directly process the queue if SW sync not available
  if (!registered && navigator.onLine) {
    await checkNetworkAndSync();
  }
}