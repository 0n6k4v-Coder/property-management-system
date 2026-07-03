// File: src/features/meter/hooks/useOfflineQueue.ts
// Subscribe to IndexedDB queue length, trigger sync on count change.

import { useState, useEffect, useCallback } from 'react';
import { getPendingCount } from '@/shared/pwa/idb-queue';
import { triggerBackgroundSync } from '@/shared/pwa/sync';

interface OfflineQueueState {
  pendingCount: number;
  isSyncing: boolean;
  triggerSync: () => Promise<void>;
}

export function useOfflineQueue(): OfflineQueueState {
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  const refreshCount = useCallback(async () => {
    const count = await getPendingCount();
    setPendingCount(count);
  }, []);

  const triggerSync = useCallback(async () => {
    setIsSyncing(true);
    try {
      await triggerBackgroundSync();
      await refreshCount();
    } finally {
      setIsSyncing(false);
    }
  }, [refreshCount]);

  // Poll queue count on mount + online/offline events
  useEffect(() => {
    refreshCount();

    function handleOnline() {
      refreshCount();
    }

    window.addEventListener('online', handleOnline);

    // Periodic check every 10s when there are pending items
    const interval = setInterval(async () => {
      const count = await getPendingCount();
      setPendingCount(count);
      // Auto-trigger sync if items are pending and we're online
      if (count > 0 && navigator.onLine) {
        triggerBackgroundSync();
      }
    }, 10_000);

    return () => {
      window.removeEventListener('online', handleOnline);
      clearInterval(interval);
    };
  }, [refreshCount]);

  return { pendingCount, isSyncing, triggerSync };
}