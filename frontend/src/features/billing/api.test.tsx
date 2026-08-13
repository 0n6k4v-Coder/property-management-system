// File: src/features/billing/api.test.tsx
// Unit tests for billing API hooks — invoice detail, list, generate, and payment.

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider, QueryClient, useQueryClient } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { http, HttpResponse } from 'msw';
import { useInvoiceDetail, useInvoices, useGenerateInvoice, useRecordPayment, invoiceKeys } from './api';
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

describe('invoiceKeys', () => {
  it('exports expected query key structure', () => {
    expect(invoiceKeys.all).toEqual(['invoices']);
    expect(invoiceKeys.list(undefined)).toEqual(['invoices', 'list', undefined]);
    expect(invoiceKeys.list({ propertyId: 'p1' })).toEqual(['invoices', 'list', { propertyId: 'p1' }]);
    expect(invoiceKeys.detail('inv-001')).toEqual(['invoices', 'inv-001']);
  });
});

describe('useInvoiceDetail', () => {
  it('fetches and returns invoice detail data', async () => {
    const { result } = renderHookWithClient(() => useInvoiceDetail('inv-001'));

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const data: API.InvoiceDetailResponse = result.current.data as API.InvoiceDetailResponse;
    expect(data.invoice.invoice_number).toBe('INV-2026-0001');
    expect(data.invoice.total_amount).toBe(15000);
    expect(data.line_items).toHaveLength(4);
  });

  it('does not fetch when id is undefined', async () => {
    const { result } = renderHookWithClient(() => useInvoiceDetail(undefined));

    await waitFor(() => {
      expect(result.current.fetchStatus).toBe('idle');
    });
  });

  it('throws error when API returns error response', async () => {
    server.use(
      http.get('*/api/v1/billing/invoices/:id', () => {
        return HttpResponse.json(
          { error: { code: 'SYS-500', message: 'Internal server error' } },
          { status: 500 },
        );
      }),
    );

    const { result } = renderHookWithClient(() => useInvoiceDetail('inv-001'));

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('Internal server error');
  });

  it('throws error when invoice is not found', async () => {
    server.use(
      http.get('*/api/v1/billing/invoices/:id', () => {
        return HttpResponse.json(
          { error: { code: 'NOT-404', message: 'Invoice not found' } },
          { status: 404 },
        );
      }),
    );

    const { result } = renderHookWithClient(() => useInvoiceDetail('inv-999'));

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error?.message).toBe('Invoice not found');
  });
});

describe('useInvoices', () => {
  it('fetches and returns invoice list data', async () => {
    server.use(
      http.get('*/api/v1/billing/invoices', () => {
        return HttpResponse.json({
          data: [
            {
              id: 'inv-001',
              invoice_number: 'INV-2026-0001',
              contract_id: 'c1',
              room_id: 'r1',
              tenant_id: 't1',
              property_id: 'p1',
              billing_month: 6,
              billing_year: 2026,
              due_date: '2026-07-15',
              status: 'pending',
              total_amount: 15000,
              paid_amount: 5000,
              notes: null,
              created_at: '2026-06-01T00:00:00Z',
            },
          ],
          meta: null,
        });
      }),
    );

    const { result } = renderHookWithClient(() => useInvoices());

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const data: API.InvoiceResponse[] = result.current.data as API.InvoiceResponse[];
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(1);
  });

  it('throws error when API returns error response', async () => {
    server.use(
      http.get('*/api/v1/billing/invoices', () => {
        return HttpResponse.json(
          { error: { code: 'SYS-500', message: 'Failed to fetch invoices' } },
          { status: 500 },
        );
      }),
    );

    const { result } = renderHookWithClient(() => useInvoices());

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error?.message).toBe('Failed to fetch invoices');
  });
});

describe('useGenerateInvoice', () => {
  const validPayload: API.GenerateInvoiceRequest = {
    property_id: 'p1',
    billing_month: 6,
    billing_year: 2026,
  };

  function getMutationResult() {
    const { result } = renderHookWithClient(() => useGenerateInvoice());
    return result;
  }

  it('generates invoice successfully', async () => {
    const result = getMutationResult();
    await result.current.mutateAsync(validPayload);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data?.id).toBe('inv-001');
    expect(result.current.data?.invoice_number).toBe('INV-2026-0001');
  });

  it('throws error when API returns error response', async () => {
    server.use(
      http.post('*/api/v1/billing/invoices/generate', () => {
        return HttpResponse.json(
          { error: { code: 'VAL-400', message: 'No contracts found for billing period' } },
          { status: 400 },
        );
      }),
    );

    const result = getMutationResult();
    await expect(result.current.mutateAsync(validPayload)).rejects.toThrow(
      'No contracts found for billing period',
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });

  it('invalidates invoice cache on success', async () => {
    // Use a wrapper that also provides a query for invoices list
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useGenerateInvoice(), { wrapper });
    await result.current.mutateAsync(validPayload);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(invalidateSpy).toHaveBeenCalled();
  });
});

describe('useRecordPayment', () => {
  const validPayload: API.PaymentRequest = {
    invoice_id: 'inv-001',
    amount: 5000,
    method: 'cash',
    reference_number: 'ref-001',
    notes: 'Test payment',
  };

  function getMutationResult() {
    const { result } = renderHookWithClient(() => useRecordPayment());
    return result;
  }

  it('records payment successfully', async () => {
    const result = getMutationResult();
    await result.current.mutateAsync(validPayload);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data?.id).toBe('pay-001');
    expect(result.current.data?.amount).toBe(5000);
  });

  it('throws error when API returns error response', async () => {
    server.use(
      http.post('*/api/v1/billing/payments', () => {
        return HttpResponse.json(
          { error: { code: 'VAL-400', message: 'Payment amount exceeds remaining balance' } },
          { status: 400 },
        );
      }),
    );

    const result = getMutationResult();
    await expect(result.current.mutateAsync(validPayload)).rejects.toThrow(
      'Payment amount exceeds remaining balance',
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });

  it('invalidates invoice cache on success', async () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useRecordPayment(), { wrapper });
    await result.current.mutateAsync(validPayload);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(invalidateSpy).toHaveBeenCalled();
  });
});
