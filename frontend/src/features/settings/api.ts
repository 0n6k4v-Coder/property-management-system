// File: src/features/settings/api.ts
// TanStack Query hooks for Admin API — audit logs, system config.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/shared/api/fetchClient';
import type { API } from '@/types/api.d';

/** @public - Query key factory for admin cache management */
export const adminKeys = {
  all: ['admin'] as const,
  auditLogs: (propertyId?: string, page?: number) => ['admin', 'audit-logs', propertyId, page] as const,
  systemConfig: ['admin', 'system-config'] as const,
};

// ── Audit Logs ──────────────────────────────────────────────────────

export function useAuditLogs(propertyId?: string, page = 1, limit = 20) {
  return useQuery({
    queryKey: adminKeys.auditLogs(propertyId, page),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (propertyId) params.set('property_id', propertyId);
      params.set('page', String(page));
      params.set('limit', String(limit));
      const res = await apiFetch<API.AuditLogListResponse>(`/admin/audit-logs?${params}`);
      if ('error' in res) throw new Error((res as API.ErrorResponse).error.message);
      return res as API.AuditLogListResponse;
    },
    staleTime: 30_000,
  });
}

// ── System Configuration ────────────────────────────────────────────

export function useSystemConfig() {
  return useQuery({
    queryKey: adminKeys.systemConfig,
    queryFn: async () => {
      const res = await apiFetch<API.SystemConfigListResponse>('/admin/config');
      if ('error' in res) throw new Error((res as API.ErrorResponse).error.message);
      return res as API.SystemConfigListResponse;
    },
    staleTime: 60_000,
  });
}

export function useUpdateSystemConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const res = await apiFetch<API.SuccessResponse<API.SystemConfigResponse>>(
        `/admin/config/${key}`,
        { method: 'PATCH', body: JSON.stringify({ value }) },
      );
      if ('error' in res) throw new Error((res as API.ErrorResponse).error.message);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.systemConfig });
    },
  });
}