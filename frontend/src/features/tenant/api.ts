// File: src/features/tenant/api.ts
// TanStack Query hooks for Tenant search and creation.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/shared/api/fetchClient';
import type { API } from '@/types/api.d';

/** @public - Query key factory for tenant cache management (exported for test mocks and advanced cache invalidation) */
export const tenantKeys = {
  all: ['tenants'] as const,
  search: (query: string, page?: number) => ['tenants', 'search', query, page] as const,
};

interface SearchTenantsParams {
  propertyId: string;
  query: string;
  page?: number;
  searchBy?: string;
}

export function useSearchTenants(
  { propertyId, query, page = 1, searchBy = 'name' }: SearchTenantsParams,
  enabled: boolean,
) {
  return useQuery({
    queryKey: tenantKeys.search(query, page),
    queryFn: async () => {
      const params = new URLSearchParams({
        property_id: propertyId,
        query,
        search_by: searchBy,
        page: String(page),
        limit: '20',
      });
      const res = await apiFetch<API.PaginatedResponse<API.TenantResponse>>(
        `/tenants/search?${params}`,
      );
      if ('error' in res) throw new Error((res as API.ErrorResponse).error.message);
      return res as unknown as API.PaginatedResponse<API.TenantResponse>;
    },
    enabled: enabled && query.length >= 3,
    staleTime: 10_000,
  });
}

export function useCreateTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: API.TenantRequest) => {
      const res = await apiFetch<API.SuccessResponse<API.TenantResponse>>('/tenants', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      if ('error' in res) throw new Error((res as API.ErrorResponse).error.message);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tenantKeys.all });
    },
  });
}