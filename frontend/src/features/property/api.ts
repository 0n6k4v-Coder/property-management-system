// File: src/features/property/api.ts
// TanStack Query hooks for Property and Room API.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/shared/api/fetchClient';
import type { API } from '@/types/api.d';

// ── Keys ────────────────────────────────────────────────────────────

/** @public - Query key factory for property cache management */
export const propertyKeys = {
  all: ['properties'] as const,
  detail: (id: string) => ['properties', id] as const,
};

// ── List all properties ─────────────────────────────────────────────

export function useProperties() {
  return useQuery({
    queryKey: propertyKeys.all,
    queryFn: async () => {
      const res = await apiFetch<API.SuccessResponse<API.PropertyResponse[]>>(
        '/properties',
      );
      if ('error' in res) throw new Error((res as API.ErrorResponse).error.message);
      return res.data;
    },
    staleTime: 30_000,
  });
}

// ── Get property with rooms ─────────────────────────────────────────

export function usePropertyWithRooms(propertyId: string | null) {
  return useQuery({
    queryKey: propertyKeys.detail(propertyId ?? ''),
    queryFn: async () => {
      // Backend returns {property: ..., rooms: [...]} directly (no data wrapper)
      const res = await apiFetch<API.PropertyWithRoomsResponse>(
        `/properties/${propertyId}/rooms`,
      );
      if ('error' in res) throw new Error((res as API.ErrorResponse).error.message);
      return res as API.PropertyWithRoomsResponse;
    },
    enabled: !!propertyId,
    staleTime: 15_000,
  });
}

// ── Create Property ─────────────────────────────────────────────────

export function useCreateProperty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: API.PropertyRequest) => {
      const res = await apiFetch<API.SuccessResponse<API.PropertyResponse>>('/properties/', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      if ('error' in res) throw new Error((res as API.ErrorResponse).error.message);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: propertyKeys.all });
    },
  });
}

// ── Update Room Status ──────────────────────────────────────────────

export function useUpdateRoomStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ roomId, status }: { roomId: string; status: string }) => {
      const res = await apiFetch<API.SuccessResponse<API.RoomResponse>>(
        `/rooms/${roomId}/status`,
        {
          method: 'PATCH',
          body: JSON.stringify({ status }),
        },
      );
      if ('error' in res) throw new Error((res as API.ErrorResponse).error.message);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: propertyKeys.all });
    },
  });
}
