// File: src/features/contract/api.test.tsx
// Unit tests for contract API hooks — useActiveContracts, useContractDetail,
// useCreateContract, useTerminateContract, useExtendLease, useRenewContract, useLeaseHistory.

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { http, HttpResponse } from 'msw';
import {
  useActiveContracts,
  useContractDetail,
  useCreateContract,
  useTerminateContract,
  useExtendLease,
  useRenewContract,
  useLeaseHistory,
  contractKeys,
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

describe('contractKeys', () => {
  it('exports expected query key structure', () => {
    expect(contractKeys.all).toEqual(['contracts']);
    expect(contractKeys.active(undefined)).toEqual(['contracts', 'active', undefined]);
    expect(contractKeys.active('p1')).toEqual(['contracts', 'active', 'p1']);
    expect(contractKeys.detail('c1')).toEqual(['contracts', 'c1']);
    expect(contractKeys.detail('')).toEqual(['contracts', '']);
    expect(contractKeys.leaseHistory('r1')).toEqual(['leases', 'r1', 'history']);
    expect(contractKeys.leaseHistory('')).toEqual(['leases', '', 'history']);
  });
});

describe('useActiveContracts', () => {
  it('fetches and returns active contracts list', async () => {
    const { result } = renderHookWithClient(() => useActiveContracts());

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const data = result.current.data as API.ContractResponse[];
    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(2);
    expect(data[0].id).toBe('c1');
    expect(data[0].status).toBe('active');
    expect(data[1].id).toBe('c2');
    expect(data[1].special_conditions).toBe('No pets allowed');
  });

  it('passes property_id as query param when provided', async () => {
    let capturedUrl = '';
    server.use(
      http.get('*/api/v1/contracts/active', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({
          data: [
            {
              id: 'c1',
              room_id: 'r1',
              tenant_id: 't1',
              property_id: 'p1',
              start_date: '2026-01-01',
              end_date: '2026-12-31',
              monthly_rent: '15000',
              deposit_amount: '30000',
              status: 'active',
              special_conditions: null,
              is_renewal: false,
              renewed_from_id: null,
              created_by: 'user-1',
              created_at: '2026-01-01T00:00:00Z',
              updated_at: '2026-01-01T00:00:00Z',
              termination: null,
              extensions: [],
            },
          ],
          meta: null,
        });
      }),
    );

    const { result } = renderHookWithClient(() => useActiveContracts('p1'));

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(capturedUrl).toContain('property_id=p1');
    expect(result.current.data).toHaveLength(1);
  });

  it('filters contracts by property_id in the mock handler', async () => {
    server.use(
      http.get('*/api/v1/contracts/active', ({ request }) => {
        const url = new URL(request.url);
        const propertyId = url.searchParams.get('property_id');
        const contracts = [
          {
            id: 'c1',
            room_id: 'r1',
            tenant_id: 't1',
            property_id: 'p1',
            start_date: '2026-01-01',
            end_date: '2026-12-31',
            monthly_rent: '15000',
            deposit_amount: '30000',
            status: 'active',
            special_conditions: null,
            is_renewal: false,
            renewed_from_id: null,
            created_by: 'user-1',
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
            termination: null,
            extensions: [],
          },
          {
            id: 'c2',
            room_id: 'r2',
            tenant_id: 't2',
            property_id: 'p2',
            start_date: '2026-03-01',
            end_date: '2027-02-28',
            monthly_rent: '18000',
            deposit_amount: '36000',
            status: 'active',
            special_conditions: 'No pets allowed',
            is_renewal: false,
            renewed_from_id: null,
            created_by: 'user-1',
            created_at: '2026-03-01T00:00:00Z',
            updated_at: '2026-03-01T00:00:00Z',
            termination: null,
            extensions: [],
          },
        ];
        const filtered = propertyId
          ? contracts.filter((c) => c.property_id === propertyId)
          : contracts;
        return HttpResponse.json({ data: filtered, meta: null });
      }),
    );

    const { result } = renderHookWithClient(() => useActiveContracts('p2'));

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data[0].property_id).toBe('p2');
  });

  it('throws error when API returns error response', async () => {
    server.use(
      http.get('*/api/v1/contracts/active', () => {
        return HttpResponse.json(
          { error: { code: 'SYS-500', message: 'Internal server error' } },
          { status: 500 },
        );
      }),
    );

    const { result } = renderHookWithClient(() => useActiveContracts());

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('Internal server error');
  });

  it('handles empty contracts list', async () => {
    server.use(
      http.get('*/api/v1/contracts/active', () => {
        return HttpResponse.json({ data: [], meta: null });
      }),
    );

    const { result } = renderHookWithClient(() => useActiveContracts());

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual([]);
  });
});

describe('useContractDetail', () => {
  it('fetches and returns contract detail data', async () => {
    const { result } = renderHookWithClient(() => useContractDetail('c1'));

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const data = result.current.data as API.ContractResponse;
    expect(data.id).toBe('c1');
    expect(data.status).toBe('active');
    expect(data.room_id).toBe('r1');
    expect(data.tenant_id).toBe('t1');
    expect(data.monthly_rent).toBe('15000');
    expect(data.deposit_amount).toBe('30000');
    expect(data.is_renewal).toBe(false);
    expect(data.termination).toBeNull();
    // Extensions are present in the mock response
    expect(data.extensions).toHaveLength(1);
    expect(data.extensions[0].extended_to).toBe('2026-12-31');
  });

  it('does not fetch when id is undefined', async () => {
    const { result } = renderHookWithClient(() => useContractDetail(undefined));

    await waitFor(() => {
      expect(result.current.fetchStatus).toBe('idle');
    });

    expect(result.current.data).toBeUndefined();
  });

  it('throws error when API returns error response', async () => {
    server.use(
      http.get('*/api/v1/contracts/:id', () => {
        return HttpResponse.json(
          { error: { code: 'SYS-500', message: 'Contract fetch failed' } },
          { status: 500 },
        );
      }),
    );

    const { result } = renderHookWithClient(() => useContractDetail('c999'));

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error?.message).toBe('Contract fetch failed');
  });
});

describe('useCreateContract', () => {
  const validPayload: API.ContractRequest = {
    property_id: 'p1',
    room_id: 'r1',
    tenant_id: 't1',
    start_date: '2026-07-01',
    end_date: '2026-12-31',
    monthly_rent: 5500,
    deposit_amount: 11000,
    special_conditions: null,
  };

  function getMutationResult() {
    const { result } = renderHookWithClient(() => useCreateContract());
    return result;
  }

  it('creates contract successfully', async () => {
    const result = getMutationResult();
    await result.current.mutateAsync(validPayload);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.id).toBe('c-new');
    expect(result.current.data?.room_id).toBe('r1');
    expect(result.current.data?.tenant_id).toBe('t1');
    expect(result.current.data?.status).toBe('active');
  });

  it('throws error when API returns error response', async () => {
    server.use(
      http.post('*/api/v1/contracts', () => {
        return HttpResponse.json(
          { error: { code: 'VAL-400', message: 'Room already has an active contract' } },
          { status: 400 },
        );
      }),
    );

    const result = getMutationResult();
    await expect(result.current.mutateAsync(validPayload)).rejects.toThrow(
      'Room already has an active contract',
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });

  it('invalidates contract cache on success', async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useCreateContract(), { wrapper });
    await result.current.mutateAsync(validPayload);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: contractKeys.all });
  });
});

describe('useTerminateContract', () => {
  const validPayload = {
    contractId: 'c1',
    data: { reason: 'tenant_moved_out', notes: 'Moving to another city' },
  };

  function getMutationResult() {
    const { result } = renderHookWithClient(() => useTerminateContract());
    return result;
  }

  it('terminates contract successfully', async () => {
    const result = getMutationResult();
    await result.current.mutateAsync(validPayload);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.id).toBe('c1');
    expect(result.current.data?.status).toBe('terminated');
    expect(result.current.data?.termination?.reason).toBe('tenant_moved_out');
    expect(result.current.data?.termination?.notes).toBe('Moving to another city');
  });

  it('throws error when API returns error response', async () => {
    server.use(
      http.patch('*/api/v1/contracts/:id/terminate', () => {
        return HttpResponse.json(
          { error: { code: 'VAL-400', message: 'Contract is not active' } },
          { status: 400 },
        );
      }),
    );

    const result = getMutationResult();
    await expect(result.current.mutateAsync(validPayload)).rejects.toThrow(
      'Contract is not active',
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });

  it('invalidates contract cache on success', async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useTerminateContract(), { wrapper });
    await result.current.mutateAsync(validPayload);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: contractKeys.all });
  });
});

describe('useExtendLease', () => {
  const validPayload = {
    contractId: 'c1',
    data: { new_end_date: '2027-06-30', reason: 'Tenant requested extension' },
  };

  function getMutationResult() {
    const { result } = renderHookWithClient(() => useExtendLease());
    return result;
  }

  it('extends lease successfully', async () => {
    const result = getMutationResult();
    await result.current.mutateAsync(validPayload);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.id).toBe('c1');
    expect(result.current.data?.end_date).toBe('2027-06-30');
    expect(result.current.data?.status).toBe('active');
    // Extensions should include the new extension
    expect(result.current.data?.extensions).toHaveLength(1);
    expect(result.current.data?.extensions[0].extended_to).toBe('2027-06-30');
    expect(result.current.data?.extensions[0].reason).toBe('Tenant requested extension');
  });

  it('extends lease without reason (optional field)', async () => {
    const result = getMutationResult();
    await result.current.mutateAsync({
      contractId: 'c1',
      data: { new_end_date: '2027-12-31' },
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.end_date).toBe('2027-12-31');
  });

  it('throws error when API returns error response', async () => {
    server.use(
      http.post('*/api/v1/contracts/:id/extend', () => {
        return HttpResponse.json(
          { error: { code: 'VAL-400', message: 'Contract is not active' } },
          { status: 400 },
        );
      }),
    );

    const result = getMutationResult();
    await expect(result.current.mutateAsync(validPayload)).rejects.toThrow(
      'Contract is not active',
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });

  it('invalidates contract detail and all queries on success', async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useExtendLease(), { wrapper });
    await result.current.mutateAsync(validPayload);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Should invalidate both detail (by contractId) and all contracts
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: contractKeys.detail('c1') });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: contractKeys.all });
  });
});

describe('useRenewContract', () => {
  const validPayload = {
    contractId: 'c1',
    data: {
      new_start_date: '2027-01-01',
      new_end_date: '2027-12-31',
      new_monthly_rent: 16000,
      new_deposit_amount: 32000,
    },
  };

  function getMutationResult() {
    const { result } = renderHookWithClient(() => useRenewContract());
    return result;
  }

  it('renews contract successfully and returns new contract', async () => {
    const result = getMutationResult();
    await result.current.mutateAsync(validPayload);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const data = result.current.data as API.ContractResponse;
    expect(data.id).toBe('c-renewed');
    expect(data.is_renewal).toBe(true);
    expect(data.renewed_from_id).toBe('c1');
    expect(data.start_date).toBe('2027-01-01');
    expect(data.end_date).toBe('2027-12-31');
    expect(data.monthly_rent).toBe(16000);
    expect(data.deposit_amount).toBe(32000);
    expect(data.status).toBe('active');
  });

  it('throws error when API returns error response', async () => {
    server.use(
      http.post('*/api/v1/contracts/:id/renew', () => {
        return HttpResponse.json(
          { error: { code: 'VAL-400', message: 'Contract is still active' } },
          { status: 400 },
        );
      }),
    );

    const result = getMutationResult();
    await expect(result.current.mutateAsync(validPayload)).rejects.toThrow(
      'Contract is still active',
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });

  it('invalidates contract cache on success', async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useRenewContract(), { wrapper });
    await result.current.mutateAsync(validPayload);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: contractKeys.all });
  });
});

describe('useLeaseHistory', () => {
  it('fetches lease history for a room', async () => {
    const { result } = renderHookWithClient(() => useLeaseHistory('r1'));

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const data = result.current.data as API.LeaseHistoryItem[];
    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(1);
    expect(data[0].id).toBe('c1');
    expect(data[0].tenant_id).toBe('t1');
    expect(data[0].status).toBe('active');
  });

  it('does not fetch when roomId is undefined', async () => {
    const { result } = renderHookWithClient(() => useLeaseHistory(undefined));

    await waitFor(() => {
      expect(result.current.fetchStatus).toBe('idle');
    });

    expect(result.current.data).toBeUndefined();
  });

  it('does not fetch when roomId is empty string', async () => {
    const { result } = renderHookWithClient(() => useLeaseHistory(''));

    await waitFor(() => {
      expect(result.current.fetchStatus).toBe('idle');
    });

    expect(result.current.data).toBeUndefined();
  });

  it('throws error when API returns error response', async () => {
    server.use(
      http.get('*/api/v1/leases/:roomId/history', () => {
        return HttpResponse.json(
          { error: { code: 'SYS-500', message: 'History fetch failed' } },
          { status: 500 },
        );
      }),
    );

    const { result } = renderHookWithClient(() => useLeaseHistory('r999'));

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error?.message).toBe('History fetch failed');
  });
});
