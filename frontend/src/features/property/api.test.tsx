// File: src/features/property/api.test.tsx
// Unit tests for property API hooks — useProperties, usePropertyWithRooms, useCreateProperty, useUpdateRoomStatus.

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { http, HttpResponse } from 'msw';
import {
  useProperties,
  usePropertyWithRooms,
  useCreateProperty,
  useUpdateRoomStatus,
  propertyKeys,
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

describe('propertyKeys', () => {
  it('exports expected query key structure', () => {
    expect(propertyKeys.all).toEqual(['properties']);
    expect(propertyKeys.detail('p1')).toEqual(['properties', 'p1']);
    expect(propertyKeys.detail('')).toEqual(['properties', '']);
  });
});

describe('useProperties', () => {
  it('fetches and returns property list data', async () => {
    const { result } = renderHookWithClient(() => useProperties());

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const data: API.PropertyResponse[] = result.current.data as API.PropertyResponse[];
    expect(data).toHaveLength(2);
    expect(data[0].name).toBe('Sunset Tower');
    expect(data[1].name).toBe('Riverside Apartments');
  });

  it('throws error when API returns error response', async () => {
    server.use(
      http.get('*/api/v1/properties', () => {
        return HttpResponse.json(
          { error: { code: 'SYS-500', message: 'Internal server error' } },
          { status: 500 },
        );
      }),
    );

    const { result } = renderHookWithClient(() => useProperties());

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error?.message).toBe('Internal server error');
  });
});

describe('usePropertyWithRooms', () => {
  it('fetches and returns property with rooms data', async () => {
    const { result } = renderHookWithClient(() => usePropertyWithRooms('p1'));

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const data: API.PropertyWithRoomsResponse = result.current.data as API.PropertyWithRoomsResponse;
    expect(data.property.name).toBe('Sunset Tower');
    expect(data.rooms).toHaveLength(2);
    expect(data.rooms[0].room_number).toBe('101');
    expect(data.rooms[1].room_number).toBe('102');
  });

  it('does not fetch when propertyId is null', async () => {
    const { result } = renderHookWithClient(() => usePropertyWithRooms(null));

    await waitFor(() => {
      expect(result.current.fetchStatus).toBe('idle');
    });
  });

  it('does not fetch when propertyId is empty string', async () => {
    const { result } = renderHookWithClient(() => usePropertyWithRooms(''));

    await waitFor(() => {
      expect(result.current.fetchStatus).toBe('idle');
    });
  });

  it('throws error when API returns error response', async () => {
    server.use(
      http.get('*/api/v1/properties/:id/rooms', () => {
        return HttpResponse.json(
          { error: { code: 'SYS-500', message: 'Property not found' } },
          { status: 500 },
        );
      }),
    );

    const { result } = renderHookWithClient(() => usePropertyWithRooms('p999'));

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error?.message).toBe('Property not found');
  });
});

describe('useCreateProperty', () => {
  const validPayload: API.PropertyRequest = {
    name: 'New Property',
    address: '789 New St',
    billing_due_day: 10,
    min_deposit_months: 2,
  };

  function getMutationResult() {
    const { result } = renderHookWithClient(() => useCreateProperty());
    return result;
  }

  it('creates property successfully', async () => {
    const result = getMutationResult();
    await result.current.mutateAsync(validPayload);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data?.id).toBe('new-p1');
    expect(result.current.data?.name).toBe('New Property');
  });

  it('throws error when API returns error response', async () => {
    server.use(
      http.post('*/api/v1/properties', () => {
        return HttpResponse.json(
          { error: { code: 'VAL-400', message: 'Property name already exists' } },
          { status: 400 },
        );
      }),
    );

    const result = getMutationResult();
    await expect(result.current.mutateAsync(validPayload)).rejects.toThrow(
      'Property name already exists',
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });

  it('invalidates property cache on success', async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useCreateProperty(), { wrapper });
    await result.current.mutateAsync(validPayload);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(invalidateSpy).toHaveBeenCalled();
  });
});

describe('useUpdateRoomStatus', () => {
  it('updates room status successfully', async () => {
    const { result } = renderHookWithClient(() => useUpdateRoomStatus());

    await result.current.mutateAsync({ roomId: 'r1', status: 'maintenance' });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data?.id).toBe('r1');
    expect(result.current.data?.status).toBe('maintenance');
  });

  it('throws error when API returns error response', async () => {
    server.use(
      http.patch('*/api/v1/rooms/:id/status', () => {
        return HttpResponse.json(
          { error: { code: 'VAL-400', message: 'Invalid status transition' } },
          { status: 400 },
        );
      }),
    );

    const { result } = renderHookWithClient(() => useUpdateRoomStatus());
    await expect(
      result.current.mutateAsync({ roomId: 'r1', status: 'invalid' }),
    ).rejects.toThrow('Invalid status transition');

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });

  it('invalidates property cache on success', async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useUpdateRoomStatus(), { wrapper });
    await result.current.mutateAsync({ roomId: 'r1', status: 'maintenance' });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(invalidateSpy).toHaveBeenCalled();
  });
});
