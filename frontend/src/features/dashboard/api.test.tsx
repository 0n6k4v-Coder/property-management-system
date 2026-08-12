// File: src/features/dashboard/api.test.tsx
// Unit tests for dashboard API hooks — useDashboardSummary and useDashboardOccupancy.

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { http, HttpResponse } from 'msw';
import { useDashboardSummary, useDashboardOccupancy, dashboardKeys } from './api';
import type { API } from '@/types/api.d';

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
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('dashboardKeys', () => {
  it('exports expected query key structure', () => {
    expect(dashboardKeys.summary('prop-1')).toEqual(['dashboard', 'summary', 'prop-1']);
    expect(dashboardKeys.occupancy('prop-1')).toEqual(['dashboard', 'occupancy', 'prop-1']);
  });
});

describe('useDashboardSummary', () => {
  it('fetches and returns dashboard summary data', async () => {
    const { result } = renderHookWithClient(() => useDashboardSummary());

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const data: API.DashboardSummaryResponse = result.current.data as API.DashboardSummaryResponse;
    expect(data.total_rooms).toBe(50);
    expect(data.occupied_rooms).toBe(42);
    expect(data.occupancy_rate).toBe(84);
    expect(data.overdue_amount).toBe(78000);
  });

  it('throws error when API returns error response', async () => {
    server.use(
      http.get('*/api/v1/dashboard/summary', () => {
        return HttpResponse.json(
          { error: { code: 'SYS-500', message: 'Internal server error' } },
          { status: 500 },
        );
      }),
    );

    const { result } = renderHookWithClient(() => useDashboardSummary());

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});

describe('useDashboardOccupancy', () => {
  it('fetches and returns occupancy data', async () => {
    const { result } = renderHookWithClient(() => useDashboardOccupancy());

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const data: API.OccupancyResponse = result.current.data as API.OccupancyResponse;
    expect(data.total_rooms).toBe(50);
    expect(data.occupied_rooms).toBe(42);
    expect(data.occupancy_rate).toBe(84);
    expect(data.active_contracts).toBe(38);
  });

  it('throws error when API returns error response', async () => {
    server.use(
      http.get('*/api/v1/dashboard/occupancy', () => {
        return HttpResponse.json(
          { error: { code: 'SYS-500', message: 'Occupancy fetch failed' } },
          { status: 500 },
        );
      }),
    );

    const { result } = renderHookWithClient(() => useDashboardOccupancy());

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
