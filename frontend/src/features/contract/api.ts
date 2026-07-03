// File: src/features/contract/api.ts
// TanStack Query hooks for Contract API — list active, detail, create, terminate, renew, extend.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/shared/api/fetchClient';
import type { API } from '@/types/api.d';

/** @public - Query key factory for contract cache management */
export const contractKeys = {
  all: ['contracts'] as const,
  active: (propertyId?: string) => ['contracts', 'active', propertyId] as const,
  detail: (id: string) => ['contracts', id] as const,
  leaseHistory: (roomId: string) => ['leases', roomId, 'history'] as const,
};

// ── List Active Contracts ────────────────────────────────────────────

export function useActiveContracts(propertyId?: string) {
  return useQuery({
    queryKey: contractKeys.active(propertyId),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (propertyId) params.set('property_id', propertyId);
      const query = params.toString() ? `?${params}` : '';
      const res = await apiFetch<API.ContractListResponse>(`/contracts/active${query}`);
      if ('error' in res) throw new Error((res as API.ErrorResponse).error.message);
      return (res as API.ContractListResponse).data ?? [];
    },
    staleTime: 30_000,
  });
}

// ── Contract Detail ───────────────────────────────────────────────────

export function useContractDetail(id: string | undefined) {
  return useQuery({
    queryKey: contractKeys.detail(id ?? ''),
    queryFn: async () => {
      const res = await apiFetch<API.SuccessResponse<API.ContractResponse>>(
        `/contracts/${id}`,
      );
      if ('error' in res) throw new Error((res as API.ErrorResponse).error.message);
      return res.data;
    },
    enabled: !!id,
    staleTime: 30_000,
  });
}

// ── Lease History ────────────────────────────────────────────────────

export function useLeaseHistory(roomId: string | undefined) {
  return useQuery({
    queryKey: contractKeys.leaseHistory(roomId ?? ''),
    queryFn: async () => {
      const res = await apiFetch<{ data: API.LeaseHistoryItem[] }>(
        `/leases/${roomId}/history`,
      );
      if ('error' in res) throw new Error((res as API.ErrorResponse).error.message);
      return (res as { data: API.LeaseHistoryItem[] }).data ?? [];
    },
    enabled: !!roomId,
    staleTime: 60_000,
  });
}

// ── Create Contract ──────────────────────────────────────────────────

export function useCreateContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: API.ContractRequest) => {
      const res = await apiFetch<API.SuccessResponse<API.ContractResponse>>('/contracts', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      if ('error' in res) throw new Error((res as API.ErrorResponse).error.message);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: contractKeys.all });
    },
  });
}

// ── Terminate Contract ───────────────────────────────────────────────

export function useTerminateContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ contractId, data }: { contractId: string; data: API.TerminateContractRequest }) => {
      const res = await apiFetch<API.SuccessResponse<API.ContractResponse>>(
        `/contracts/${contractId}/terminate`,
        { method: 'PATCH', body: JSON.stringify(data) },
      );
      if ('error' in res) throw new Error((res as API.ErrorResponse).error.message);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: contractKeys.all });
    },
  });
}

// ── Extend Lease ─────────────────────────────────────────────────────

interface ExtendLeaseRequest {
  new_end_date: string;
  reason?: string | null;
}

export function useExtendLease() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ contractId, data }: { contractId: string; data: ExtendLeaseRequest }) => {
      const res = await apiFetch<API.SuccessResponse<API.ContractResponse>>(
        `/contracts/${contractId}/extend`,
        { method: 'POST', body: JSON.stringify(data) },
      );
      if ('error' in res) throw new Error((res as API.ErrorResponse).error.message);
      return res.data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: contractKeys.detail(variables.contractId) });
      qc.invalidateQueries({ queryKey: contractKeys.all });
    },
  });
}

// ── Renew Contract ───────────────────────────────────────────────────

interface RenewContractRequest {
  new_start_date: string;
  new_end_date: string;
  new_monthly_rent: number;
  new_deposit_amount: number;
}

export function useRenewContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ contractId, data }: { contractId: string; data: RenewContractRequest }) => {
      const res = await apiFetch<API.SuccessResponse<API.ContractResponse>>(
        `/contracts/${contractId}/renew`,
        { method: 'POST', body: JSON.stringify(data) },
      );
      if ('error' in res) throw new Error((res as API.ErrorResponse).error.message);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: contractKeys.all });
    },
  });
}
