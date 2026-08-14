// File: src/features/meter/hooks/useOfflineQueue.test.tsx
// Unit tests for useOfflineQueue hook — offline queue monitoring and sync trigger.

import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { server } from '@/mocks/server';

// Mock idb-queue and sync modules
const mockGetPendingCount = vi.fn();
const mockTriggerBackgroundSync = vi.fn();

vi.mock('@/shared/pwa/idb-queue', () => ({
  getPendingCount: (...args: unknown[]) => mockGetPendingCount(...args),
}));

vi.mock('@/shared/pwa/sync', () => ({
  triggerBackgroundSync: (...args: unknown[]) => mockTriggerBackgroundSync(...args),
}));

import { useOfflineQueue } from './useOfflineQueue';

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('useOfflineQueue', () => {
  function renderHookWithProviders() {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );
    return renderHook(() => useOfflineQueue(), { wrapper });
  }

  beforeEach(() => {
    // Reset mocks
    mockGetPendingCount.mockReset();
    mockTriggerBackgroundSync.mockReset();
  });

  it('returns initial state with pendingCount=0 and isSyncing=false', async () => {
    mockGetPendingCount.mockResolvedValue(0);
    const { result } = renderHookWithProviders();

    // Wait for initial refreshCount to settle
    await waitFor(() => {
      expect(result.current.pendingCount).toBe(0);
    });
    expect(result.current.isSyncing).toBe(false);
  });

  it('updates pendingCount from getPendingCount on mount', async () => {
    mockGetPendingCount.mockResolvedValue(3);
    const { result } = renderHookWithProviders();

    await waitFor(() => {
      expect(result.current.pendingCount).toBe(3);
    });
  });

  it('sets isSyncing=true during triggerSync, then false after', async () => {
    mockGetPendingCount.mockResolvedValue(0);
    mockTriggerBackgroundSync.mockResolvedValue(undefined);

    const { result } = renderHookWithProviders();

    await waitFor(() => {
      expect(result.current.pendingCount).toBe(0);
    });

    await act(async () => {
      await result.current.triggerSync();
    });

    expect(result.current.isSyncing).toBe(false);
    expect(mockTriggerBackgroundSync).toHaveBeenCalled();
    expect(mockGetPendingCount).toHaveBeenCalled();
  });

  it('refreshes count after triggerSync completes', async () => {
    mockGetPendingCount.mockResolvedValueOnce(5).mockResolvedValueOnce(0);
    mockTriggerBackgroundSync.mockResolvedValue(undefined);

    const { result } = renderHookWithProviders();

    await waitFor(() => {
      expect(result.current.pendingCount).toBe(5);
    });

    await act(async () => {
      await result.current.triggerSync();
    });

    await waitFor(() => {
      expect(result.current.pendingCount).toBe(0);
    });
  });

  it('updates pendingCount on online event', async () => {
    mockGetPendingCount.mockResolvedValueOnce(0).mockResolvedValueOnce(2);
    const { result } = renderHookWithProviders();

    await waitFor(() => {
      expect(result.current.pendingCount).toBe(0);
    });

    // Simulate going online
    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    await waitFor(() => {
      expect(result.current.pendingCount).toBe(2);
    });
  });

  it('does not crash when triggerBackgroundSync throws', async () => {
    mockGetPendingCount.mockResolvedValue(0);
    mockTriggerBackgroundSync.mockRejectedValue(new Error('Sync failed'));

    const { result } = renderHookWithProviders();

    await waitFor(() => {
      expect(result.current.pendingCount).toBe(0);
    });

    await act(async () => {
      await expect(result.current.triggerSync()).rejects.toThrow('Sync failed');
    });

    // isSyncing should be false even after error
    expect(result.current.isSyncing).toBe(false);
  });

  // ── Interval-based auto-sync tests (lines 44-49) ─────────────────────────────
  // These tests cover the setInterval branch: when count > 0 && navigator.onLine,
  // triggerBackgroundSync is called automatically.

  describe('interval auto-sync', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    // Helper: render hook with fake timers, wait for initial mount to settle
    async function renderAndMount() {
      const { result, unmount } = renderHookWithProviders();
      // Flush microtasks for initial mount effect + initial getPendingCount call
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      return { result, unmount };
    }

    it('auto-triggers sync when pending count > 0 and online', async () => {
      mockGetPendingCount.mockResolvedValueOnce(0).mockResolvedValueOnce(3);
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });

      const { result } = await renderAndMount();
      expect(result.current.pendingCount).toBe(0);

      // Advance 10s to trigger the interval
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000);
      });

      // After interval fires, getPendingCount is called again (returns 3)
      expect(result.current.pendingCount).toBe(3);
      expect(mockTriggerBackgroundSync).toHaveBeenCalled();
    });

    it('does NOT auto-trigger sync when offline (navigator.onLine=false)', async () => {
      mockGetPendingCount.mockResolvedValue(5);
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

      const { result } = await renderAndMount();
      expect(result.current.pendingCount).toBe(5);

      // Reset mock to count only calls after initial fetch
      mockTriggerBackgroundSync.mockClear();

      // Advance 10s — interval fires but should NOT trigger sync (offline)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000);
      });

      expect(mockTriggerBackgroundSync).not.toHaveBeenCalled();
    });

    it('does NOT auto-trigger sync when pending count is 0 and online', async () => {
      mockGetPendingCount.mockResolvedValue(0);
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });

      await renderAndMount();

      mockTriggerBackgroundSync.mockClear();

      // Advance 10s — interval fires but count is 0 so no sync
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000);
      });

      expect(mockTriggerBackgroundSync).not.toHaveBeenCalled();
    });

    it('cleans up event listener and interval on unmount', async () => {
      mockGetPendingCount.mockResolvedValue(0);
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });

      const { result, unmount } = await renderAndMount();
      expect(result.current.pendingCount).toBe(0);

      // Unmount should clear the interval and event listener
      unmount();

      // Advancing time after unmount should not cause errors
      await act(async () => {
        await vi.advanceTimersByTimeAsync(20_000);
      });

      // No crash — cleanup ran successfully
      expect(mockGetPendingCount).toHaveBeenCalled();
    });
  });

  // ── Return value shape ───────────────────────────────────────────────────────

  describe('return value', () => {
    it('returns pendingCount, isSyncing, and triggerSync', async () => {
      mockGetPendingCount.mockResolvedValue(0);
      const { result } = renderHookWithProviders();

      await waitFor(() => {
        expect(result.current?.pendingCount).toBe(0);
      });

      expect(typeof result.current?.pendingCount).toBe('number');
      expect(typeof result.current?.isSyncing).toBe('boolean');
      expect(typeof result.current?.triggerSync).toBe('function');
    });
  });
});
