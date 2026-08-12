// File: src/features/tenant/api.test.tsx
// Unit tests for tenant API hooks — useSearchTenants and useCreateTenant.

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { http, HttpResponse } from 'msw';
import { useSearchTenants, useCreateTenant, tenantKeys } from './api';
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

describe('tenantKeys', () => {
  it('exports expected query key structure', () => {
    expect(tenantKeys.all).toEqual(['tenants']);
    expect(tenantKeys.search('John', 1)).toEqual(['tenants', 'search', 'John', 1]);
  });
});

describe('useSearchTenants', () => {
  it('fetches and returns tenant search results', async () => {
    const { result } = renderHookWithClient(() =>
      useSearchTenants(
        { propertyId: 'p1', query: 'John', searchBy: 'name' },
        true,
      ),
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const data = result.current.data as API.PaginatedResponse<API.TenantResponse>;
    expect(data.data).toHaveLength(1);
    expect(data.data[0].full_name).toBe('John Doe');
    expect(data.meta.total).toBe(1);
  });

  it('returns empty results when no query match', async () => {
    server.use(
      http.get('*/api/v1/tenants/search', () => {
        return HttpResponse.json({
          data: [],
          meta: { page: 1, limit: 20, total: 0, has_next: false },
        });
      }),
    );

    const { result } = renderHookWithClient(() =>
      useSearchTenants(
        { propertyId: 'p1', query: 'nonexistent', searchBy: 'name' },
        true,
      ),
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const data = result.current.data as API.PaginatedResponse<API.TenantResponse>;
    expect(data.data).toHaveLength(0);
    expect(data.meta.total).toBe(0);
  });

  it('does not fetch when enabled is false', async () => {
    const { result } = renderHookWithClient(() =>
      useSearchTenants(
        { propertyId: 'p1', query: 'John', searchBy: 'name' },
        false,
      ),
    );

    await waitFor(() => {
      expect(result.current.fetchStatus).toBe('idle');
    });
  });

  it('does not fetch when query is less than 3 characters', async () => {
    const { result } = renderHookWithClient(() =>
      useSearchTenants(
        { propertyId: 'p1', query: 'Jo', searchBy: 'name' },
        true,
      ),
    );

    await waitFor(() => {
      expect(result.current.fetchStatus).toBe('idle');
    });
  });

  it('throws error when API returns error response', async () => {
    server.use(
      http.get('*/api/v1/tenants/search', () => {
        return HttpResponse.json(
          { error: { code: 'SYS-500', message: 'Search failed' } },
          { status: 500 },
        );
      }),
    );

    const { result } = renderHookWithClient(() =>
      useSearchTenants(
        { propertyId: 'p1', query: 'John', searchBy: 'name' },
        true,
      ),
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});

describe('useCreateTenant', () => {
  const validTenantData: API.TenantRequest = {
    property_id: 'p1',
    full_name: 'New Tenant',
    id_card_number: '1234567890121',
    phone: '0812345678',
    email: 'test@example.com',
    emergency_contact_name: 'Emergency Contact',
    emergency_contact_phone: '0898765432',
  };

  it('creates tenant successfully', async () => {
    const { result } = renderHookWithClient(() => useCreateTenant());

    await result.current.mutateAsync(validTenantData);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data?.id).toBe('new-t1');
    expect(result.current.data?.full_name).toBe('New Tenant');
  });

  it('throws error when API returns error response', async () => {
    server.use(
      http.post('*/api/v1/tenants', () => {
        return HttpResponse.json(
          { error: { code: 'VAL-400', message: 'Name already exists' } },
          { status: 400 },
        );
      }),
    );

    const { result } = renderHookWithClient(() => useCreateTenant());

    await expect(result.current.mutateAsync(validTenantData)).rejects.toThrow('Name already exists');

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
