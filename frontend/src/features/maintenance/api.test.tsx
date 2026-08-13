// File: src/features/maintenance/api.test.tsx
// Unit tests for maintenance API hooks — pending list, detail, create, status update, assign.

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { http, HttpResponse } from 'msw';
import {
  usePendingMaintenance,
  useMaintenanceDetail,
  useCreateMaintenance,
  useUpdateMaintenanceStatus,
  useAssignMaintenance,
  maintenanceKeys,
} from './api';
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

// ── maintenanceKeys ──────────────────────────────────────────────────

describe('maintenanceKeys', () => {
  it('exports expected query key structure', () => {
    expect(maintenanceKeys.all).toEqual(['maintenance']);
    expect(maintenanceKeys.pending('p1')).toEqual(['maintenance', 'pending', 'p1']);
    expect(maintenanceKeys.pending(undefined)).toEqual(['maintenance', 'pending', undefined]);
    expect(maintenanceKeys.detail('maint-1')).toEqual(['maintenance', 'maint-1']);
  });
});

// ── usePendingMaintenance ────────────────────────────────────────────

describe('usePendingMaintenance', () => {
  it('fetches and returns pending maintenance requests', async () => {
    const { result } = renderHookWithClient(() => usePendingMaintenance('p1'));

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const data: API.MaintenanceResponse[] = result.current.data as API.MaintenanceResponse[];
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(2);
    expect(data[0]!.title).toBe('Leaking faucet');
    expect(data[1]!.title).toBe('AC not cooling');
  });

  it('does not fetch when propertyId is undefined', async () => {
    const { result } = renderHookWithClient(() => usePendingMaintenance(undefined));

    await waitFor(() => {
      expect(result.current.fetchStatus).toBe('idle');
    });

    expect(result.current.data).toBeUndefined();
  });

  it('does not fetch when propertyId is empty string', async () => {
    const { result } = renderHookWithClient(() => usePendingMaintenance(''));

    await waitFor(() => {
      expect(result.current.fetchStatus).toBe('idle');
    });

    expect(result.current.data).toBeUndefined();
  });

  it('throws error when API returns error response', async () => {
    server.use(
      http.get('*/api/v1/maintenance/pending', () => {
        return HttpResponse.json(
          { error: { code: 'SYS-500', message: 'Failed to fetch maintenance requests' } },
          { status: 500 },
        );
      }),
    );

    const { result } = renderHookWithClient(() => usePendingMaintenance('p1'));

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('Failed to fetch maintenance requests');
  });

  it('filters requests by property_id query parameter', async () => {
    server.use(
      http.get('*/api/v1/maintenance/pending', ({ request }) => {
        const url = new URL(request.url);
        const propertyId = url.searchParams.get('property_id');

        const allRequests: API.MaintenanceResponse[] = [
          {
            id: 'maint-1',
            property_id: 'p1',
            room_id: 'r1',
            title: 'Leaking faucet',
            description: 'Kitchen faucet dripping',
            priority: 'medium',
            status: 'pending',
            assigned_to: null,
            created_by: 'user-1',
            created_at: '2026-06-15T10:00:00Z',
            updated_at: '2026-06-15T10:00:00Z',
          },
          {
            id: 'maint-3',
            property_id: 'p2',
            room_id: 'r3',
            title: 'Broken light',
            description: 'Hallway light not working',
            priority: 'low',
            status: 'pending',
            assigned_to: null,
            created_by: 'user-3',
            created_at: '2026-06-16T10:00:00Z',
            updated_at: '2026-06-16T10:00:00Z',
          },
        ];

        const filtered = propertyId
          ? allRequests.filter((r) => r.property_id === propertyId)
          : allRequests;

        return HttpResponse.json({ data: filtered, meta: null });
      }),
    );

    const { result } = renderHookWithClient(() => usePendingMaintenance('p1'));

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const data = result.current.data as API.MaintenanceResponse[];
    expect(data.length).toBe(1);
    expect(data[0]!.property_id).toBe('p1');
    expect(data[0]!.title).toBe('Leaking faucet');
  });
});

// ── useMaintenanceDetail ─────────────────────────────────────────────

describe('useMaintenanceDetail', () => {
  it('fetches and returns maintenance request detail', async () => {
    const { result } = renderHookWithClient(() => useMaintenanceDetail('maint-1'));

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const data: API.MaintenanceResponse = result.current.data as API.MaintenanceResponse;
    expect(data.id).toBe('maint-1');
    expect(data.title).toBe('Leaking faucet');
    expect(data.priority).toBe('medium');
    expect(data.status).toBe('pending');
    expect(data.assigned_to).toBeNull();
  });

  it('does not fetch when id is undefined', async () => {
    const { result } = renderHookWithClient(() => useMaintenanceDetail(undefined));

    await waitFor(() => {
      expect(result.current.fetchStatus).toBe('idle');
    });

    expect(result.current.data).toBeUndefined();
  });

  it('throws error when request is not found', async () => {
    server.use(
      http.get('*/api/v1/maintenance/:id', () => {
        return HttpResponse.json(
          { error: { code: 'NOT-404', message: 'Maintenance request not found' } },
          { status: 404 },
        );
      }),
    );

    const { result } = renderHookWithClient(() => useMaintenanceDetail('maint-999'));

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error?.message).toBe('Maintenance request not found');
  });
});

// ── useCreateMaintenance ─────────────────────────────────────────────

describe('useCreateMaintenance', () => {
  const validPayload: API.CreateMaintenanceRequest = {
    room_id: 'r1',
    property_id: 'p1',
    title: 'Broken window',
    description: 'Window in living room will not close properly',
    priority: 'high',
  };

  it('creates maintenance request successfully', async () => {
    const { result } = renderHookWithClient(() => useCreateMaintenance());

    await result.current.mutateAsync(validPayload);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const data: API.MaintenanceResponse = result.current.data as API.MaintenanceResponse;
    expect(data.id).toBe('maint-new');
    expect(data.title).toBe('Broken window');
    expect(data.priority).toBe('high');
    expect(data.status).toBe('pending');
  });

  it('throws error when API returns error response', async () => {
    server.use(
      http.post('*/api/v1/maintenance', () => {
        return HttpResponse.json(
          { error: { code: 'VAL-400', message: 'Room not found' } },
          { status: 400 },
        );
      }),
    );

    const { result } = renderHookWithClient(() => useCreateMaintenance());

    await expect(result.current.mutateAsync(validPayload)).rejects.toThrow('Room not found');

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });

  it('invalidates maintenance cache on success', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useCreateMaintenance(), { wrapper });

    await result.current.mutateAsync(validPayload);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(invalidateSpy).toHaveBeenCalled();
  });
});

// ── useUpdateMaintenanceStatus ───────────────────────────────────────

describe('useUpdateMaintenanceStatus', () => {
  it('updates maintenance status successfully', async () => {
    const { result } = renderHookWithClient(() => useUpdateMaintenanceStatus());

    await result.current.mutateAsync({
      requestId: 'maint-1',
      data: { status: 'in_progress' },
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const data: API.MaintenanceResponse = result.current.data as API.MaintenanceResponse;
    expect(data.id).toBe('maint-1');
    expect(data.status).toBe('in_progress');
  });

  it('throws error when API returns error response', async () => {
    server.use(
      http.patch('*/api/v1/maintenance/:id/status', () => {
        return HttpResponse.json(
          { error: { code: 'VAL-400', message: 'Invalid status transition' } },
          { status: 400 },
        );
      }),
    );

    const { result } = renderHookWithClient(() => useUpdateMaintenanceStatus());

    await expect(
      result.current.mutateAsync({
        requestId: 'maint-1',
        data: { status: 'resolved' },
      }),
    ).rejects.toThrow('Invalid status transition');

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });

  it('invalidates maintenance cache on success', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useUpdateMaintenanceStatus(), { wrapper });

    await result.current.mutateAsync({
      requestId: 'maint-1',
      data: { status: 'resolved' },
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(invalidateSpy).toHaveBeenCalled();
  });
});

// ── useAssignMaintenance ─────────────────────────────────────────────

describe('useAssignMaintenance', () => {
  it('assigns maintenance request successfully', async () => {
    const { result } = renderHookWithClient(() => useAssignMaintenance());

    await result.current.mutateAsync({
      requestId: 'maint-1',
      data: { assigned_to: 'tech-1' },
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const data: API.MaintenanceResponse = result.current.data as API.MaintenanceResponse;
    expect(data.id).toBe('maint-1');
    expect(data.assigned_to).toBe('tech-1');
    expect(data.status).toBe('in_progress');
  });

  it('throws error when API returns error response', async () => {
    server.use(
      http.patch('*/api/v1/maintenance/:id/assign', () => {
        return HttpResponse.json(
          { error: { code: 'VAL-400', message: 'Staff member not found' } },
          { status: 400 },
        );
      }),
    );

    const { result } = renderHookWithClient(() => useAssignMaintenance());

    await expect(
      result.current.mutateAsync({
        requestId: 'maint-1',
        data: { assigned_to: 'invalid-tech' },
      }),
    ).rejects.toThrow('Staff member not found');

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });

  it('invalidates maintenance cache on success', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useAssignMaintenance(), { wrapper });

    await result.current.mutateAsync({
      requestId: 'maint-1',
      data: { assigned_to: 'tech-2' },
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(invalidateSpy).toHaveBeenCalled();
  });
});
