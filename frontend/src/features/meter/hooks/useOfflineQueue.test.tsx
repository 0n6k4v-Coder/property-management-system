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
});
