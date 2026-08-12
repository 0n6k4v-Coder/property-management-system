// File: src/features/meter/api.test.tsx
// Unit tests for meter API hooks — offline queue fallback, success, and error paths.

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { http, HttpResponse } from 'msw';
import { useRecordMeterMutation, meterKeys } from './api';
import type { API } from '@/types/api.d';

// Mock idb-queue and sync modules
const mockAddToQueue = vi.fn();
const mockRegisterMeterSync = vi.fn();

vi.mock('@/shared/pwa/idb-queue', () => ({
  addToQueue: (...args: unknown[]) => mockAddToQueue(...args),
}));
vi.mock('@/shared/pwa/sync', () => ({
  registerMeterSync: (...args: unknown[]) => mockRegisterMeterSync(...args),
}));

function renderHookWithClient(hook: () => unknown) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return renderHook(hook, { wrapper });
}

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
  mockAddToQueue.mockReset();
  mockRegisterMeterSync.mockReset();
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
});
afterAll(() => server.close());

describe('meterKeys', () => {
  it('exports expected query key structure', () => {
    expect(meterKeys.all).toEqual(['meter-readings']);
    expect(meterKeys.history('room-1')).toEqual(['meter-readings', 'history', 'room-1']);
  });
});

describe('useRecordMeterMutation', () => {
  const validPayload: API.MeterReadingRequest = {
    room_id: 'room-1',
    billing_month: 6,
    billing_year: 2026,
    electric_previous: 100,
    electric_current: 150,
    water_previous: 50,
    water_current: 75,
  };

  it('returns success response from API', async () => {
    const { result } = renderHookWithClient(() => useRecordMeterMutation());

    await result.current.mutateAsync(validPayload);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data?.id).toBe('meter-001');
    expect(result.current.data?.electric_used).toBe(50);
  });

  it('falls back to offline queue on network error when offline', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

    mockAddToQueue.mockResolvedValue(undefined);
    mockRegisterMeterSync.mockResolvedValue(false);

    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
      new TypeError('Failed to fetch'),
    );

    const { result } = renderHookWithClient(() => useRecordMeterMutation());

    await result.current.mutateAsync(validPayload);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data?.id).toBe('__offline__');
    expect(mockAddToQueue).toHaveBeenCalledWith(validPayload);
    expect(mockRegisterMeterSync).toHaveBeenCalled();
  });

  it('throws error when online and API returns 503 (no offline fallback)', async () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });

    server.use(
      http.post('*/api/v1/billing/meter-readings', () => {
        return HttpResponse.json(
          { error: { code: 'SYS-503', message: 'Service unavailable' } },
          { status: 503 },
        );
      }),
    );

    const { result } = renderHookWithClient(() => useRecordMeterMutation());

    await expect(result.current.mutateAsync(validPayload)).rejects.toThrow('Service unavailable');

    expect(mockAddToQueue).not.toHaveBeenCalled();
  });

  it('throws error when API returns 400 validation error', async () => {
    server.use(
      http.post('*/api/v1/billing/meter-readings', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'VAL-400',
              message: 'Invalid meter reading',
            },
          },
          { status: 400 },
        );
      }),
    );

    const { result } = renderHookWithClient(() => useRecordMeterMutation());

    await expect(result.current.mutateAsync(validPayload)).rejects.toThrow('Invalid meter reading');

    expect(mockAddToQueue).not.toHaveBeenCalled();
  });

  it('re-throws TypeError when online (no offline fallback)', async () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });

    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
      new TypeError('Failed to fetch'),
    );

    const { result } = renderHookWithClient(() => useRecordMeterMutation());

    await expect(result.current.mutateAsync(validPayload)).rejects.toThrow('Failed to fetch');

    expect(mockAddToQueue).not.toHaveBeenCalled();
  });

  it('re-throws non-network error when offline (no queue fallback)', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

    // Return a 400 validation error — not a network error
    server.use(
      http.post('*/api/v1/billing/meter-readings', () => {
        return HttpResponse.json(
          {
            error: {
              code: 'VAL-400',
              message: 'Some validation error',
            },
          },
          { status: 400 },
        );
      }),
    );

    const { result } = renderHookWithClient(() => useRecordMeterMutation());

    await expect(result.current.mutateAsync(validPayload)).rejects.toThrow('Some validation error');

    // Should NOT fallback to offline queue for non-network errors
    expect(mockAddToQueue).not.toHaveBeenCalled();
  });
});
