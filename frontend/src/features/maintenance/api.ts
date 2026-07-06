// File: src/features/maintenance/api.ts
// TanStack Query hooks for Maintenance API — list pending, detail, create, update status, assign.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/shared/api/fetchClient';
import type { API } from '@/types/api.d';

/** @public - Query key factory for maintenance cache management */
export const maintenanceKeys = {
  all: ['maintenance'] as const,
  pending: (propertyId?: string) => ['maintenance', 'pending', propertyId] as const,
  detail: (id: string) => ['maintenance', id] as const,
};

// ── List Pending Maintenance Requests ────────────────────────────────

export function usePendingMaintenance(propertyId?: string) {
  return useQuery({
    queryKey: maintenanceKeys.pending(propertyId),
    queryFn: async () => {
      const params = new URLSearchParams({ property_id: propertyId! });
      const res = await apiFetch<API.MaintenanceListResponse>(`/maintenance/pending?${params}`);
      if ('error' in res) throw new Error((res as API.ErrorResponse).error.message);
      return (res as API.MaintenanceListResponse).data ?? [];
    },
    // Backend requires property_id — don't fire until one is selected.
    enabled: !!propertyId,
    staleTime: 15_000,
  });
}

// ── Maintenance Detail ───────────────────────────────────────────────

export function useMaintenanceDetail(id: string | undefined) {
  return useQuery({
    queryKey: maintenanceKeys.detail(id ?? ''),
    queryFn: async () => {
      const res = await apiFetch<API.SuccessResponse<API.MaintenanceResponse>>(
        `/maintenance/${id}`,
      );
      if ('error' in res) throw new Error((res as API.ErrorResponse).error.message);
      return res.data;
    },
    enabled: !!id,
    staleTime: 30_000,
  });
}

// ── Create Maintenance Request ──────────────────────────────────────

export function useCreateMaintenance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: API.CreateMaintenanceRequest) => {
      const res = await apiFetch<API.SuccessResponse<API.MaintenanceResponse>>('/maintenance/', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      if ('error' in res) throw new Error((res as API.ErrorResponse).error.message);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: maintenanceKeys.all });
    },
  });
}

// ── Update Maintenance Status ────────────────────────────────────────

export function useUpdateMaintenanceStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ requestId, data }: { requestId: string; data: API.UpdateMaintenanceStatusRequest }) => {
      const res = await apiFetch<API.SuccessResponse<API.MaintenanceResponse>>(
        `/maintenance/${requestId}/status`,
        { method: 'PATCH', body: JSON.stringify(data) },
      );
      if ('error' in res) throw new Error((res as API.ErrorResponse).error.message);
      return res.data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: maintenanceKeys.detail(variables.requestId) });
      qc.invalidateQueries({ queryKey: maintenanceKeys.all });
    },
  });
}

// ── Assign Maintenance Request ──────────────────────────────────────

export function useAssignMaintenance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ requestId, data }: { requestId: string; data: API.AssignMaintenanceRequest }) => {
      const res = await apiFetch<API.SuccessResponse<API.MaintenanceResponse>>(
        `/maintenance/${requestId}/assign`,
        { method: 'PATCH', body: JSON.stringify(data) },
      );
      if ('error' in res) throw new Error((res as API.ErrorResponse).error.message);
      return res.data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: maintenanceKeys.detail(variables.requestId) });
      qc.invalidateQueries({ queryKey: maintenanceKeys.all });
    },
  });
}