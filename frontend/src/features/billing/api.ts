// File: src/features/billing/api.ts
// TanStack Query hooks for invoices, payments, and bulk generation.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/shared/api/fetchClient';
import type { API } from '@/types/api.d';

/** @public - Query key factory for invoice cache management (exported for test mocks and advanced cache invalidation) */
export const invoiceKeys = {
  all: ['invoices'] as const,
  list: (filters?: Record<string, unknown>) => ['invoices', 'list', filters] as const,
  detail: (id: string) => ['invoices', id] as const,
};

// ── Invoice Detail ──────────────────────────────────────────────────

export function useInvoiceDetail(id: string | undefined) {
  return useQuery({
    queryKey: invoiceKeys.detail(id ?? ''),
    queryFn: async () => {
      const res = await apiFetch<API.SuccessResponse<API.InvoiceDetailResponse>>(
        `/billing/invoices/${id}`,
      );
      if ('error' in res) throw new Error((res as API.ErrorResponse).error.message);
      return res.data;
    },
    enabled: !!id,
    staleTime: 30_000,
  });
}

// ── Invoice List ──────────────────────────────────────────────────

export function useInvoices(propertyId?: string) {
  return useQuery({
    queryKey: invoiceKeys.list({ propertyId }),
    queryFn: async () => {
      const query = propertyId ? `?property_id=${propertyId}` : '';
      const res = await apiFetch<API.SuccessResponse<API.InvoiceResponse[]>>(
        `/billing/invoices${query}`,
      );
      if ('error' in res) throw new Error((res as API.ErrorResponse).error.message);
      return res.data;
    },
    staleTime: 30_000,
  });
}

// ── Generate Invoice (bulk) ─────────────────────────────────────────

export function useGenerateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: API.GenerateInvoiceRequest) => {
      const res = await apiFetch<API.SuccessResponse<API.InvoiceResponse>>(
        '/billing/invoices/generate',
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
      );
      if ('error' in res) throw new Error((res as API.ErrorResponse).error.message);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: invoiceKeys.all });
    },
  });
}

// ── Record Payment ──────────────────────────────────────────────────

export function useRecordPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: API.PaymentRequest) => {
      const res = await apiFetch<API.SuccessResponse<API.PaymentResponse>>(
        '/billing/payments',
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
      );
      if ('error' in res) throw new Error((res as API.ErrorResponse).error.message);
      return res.data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: invoiceKeys.detail(variables.invoice_id) });
      qc.invalidateQueries({ queryKey: invoiceKeys.all });
    },
  });
}