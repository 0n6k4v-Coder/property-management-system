// File: src/features/reports/api.ts
// TanStack Query hooks for Reports — with date range filters.

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/shared/api/fetchClient';
import type { API } from '@/types/api.d';

const SAMPLE_PROPERTY = '00000000-0000-0000-0000-000000000001';

/** @public - Query key factory for reports cache management (exported for test mocks and advanced cache invalidation) */
export const reportKeys = {
  revenue: (propertyId: string, start?: string, end?: string) =>
    ['reports', 'revenue', propertyId, start, end] as const,
  overdue: (propertyId: string) => ['reports', 'overdue', propertyId] as const,
};

interface RevenueFilters {
  startDate?: string;
  endDate?: string;
}

export function useRevenueReport(filters: RevenueFilters = {}) {
  const { startDate, endDate } = filters;
  return useQuery({
    queryKey: reportKeys.revenue(SAMPLE_PROPERTY, startDate, endDate),
    queryFn: async () => {
      const params = new URLSearchParams({ property_id: SAMPLE_PROPERTY });
      if (startDate) params.set('start_date', startDate);
      if (endDate) params.set('end_date', endDate);
      const res = await apiFetch<API.SuccessResponse<API.RevenueMetricResponse[]>>(
        `/dashboard/revenue?${params}`,
      );
      if ('error' in res) throw new Error((res as API.ErrorResponse).error.message);
      return res.data;
    },
    staleTime: 300_000,
    gcTime: 900_000,
  });
}

export function useOverdueReport() {
  return useQuery({
    queryKey: reportKeys.overdue(SAMPLE_PROPERTY),
    queryFn: async () => {
      // Fallback: derive overdue data from dashboard summary
      const res = await apiFetch<API.SuccessResponse<API.DashboardSummaryResponse>>(
        `/dashboard/summary?property_id=${SAMPLE_PROPERTY}`,
      );
      if ('error' in res) throw new Error((res as API.ErrorResponse).error.message);
      const summary = res.data;
      return [
        { label: 'Overdue Invoices', value: summary.overdue_count },
        { label: 'Overdue Amount (THB)', value: summary.overdue_amount },
      ];
    },
    staleTime: 300_000,
    gcTime: 900_000,
  });
}