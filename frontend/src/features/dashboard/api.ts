// File: src/features/dashboard/api.ts
// TanStack Query hooks for Dashboard — optimized staleTime/gcTime.

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/shared/api/fetchClient';
import type { API } from '@/types/api.d';

// Use the real seeded property ID from the E2E fixtures
import { SEEDED } from '@/../e2e/fixtures/seeded-ids';
const DEFAULT_PROPERTY_ID = SEEDED.propertySunsetId;

/** @public - Query key factory for dashboard cache management (exported for test mocks and advanced cache invalidation) */
export const dashboardKeys = {
  summary: (propertyId: string) => ['dashboard', 'summary', propertyId] as const,
  occupancy: (propertyId: string) => ['dashboard', 'occupancy', propertyId] as const,
};

export function useDashboardSummary(propertyId: string = DEFAULT_PROPERTY_ID) {
  return useQuery({
    queryKey: dashboardKeys.summary(propertyId),
    queryFn: async () => {
      const res = await apiFetch<API.SuccessResponse<API.DashboardSummaryResponse>>(
        `/dashboard/summary?property_id=${propertyId}`,
      );
      if ('error' in res) throw new Error((res as API.ErrorResponse).error.message);
      return res.data;
    },
    staleTime: 300_000,  // 5 min
    gcTime: 900_000,     // 15 min
  });
}

/** @internal - Hook for occupancy widget — to be wired in Sprint 7 */
export function useDashboardOccupancy(propertyId: string = DEFAULT_PROPERTY_ID) {
  return useQuery({
    queryKey: dashboardKeys.occupancy(propertyId),
    queryFn: async () => {
      const res = await apiFetch<API.SuccessResponse<API.OccupancyResponse>>(
        `/dashboard/occupancy?property_id=${propertyId}`,
      );
      if ('error' in res) throw new Error((res as API.ErrorResponse).error.message);
      return res.data;
    },
    staleTime: 300_000,
    gcTime: 900_000,
  });
}