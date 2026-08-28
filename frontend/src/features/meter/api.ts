// File: src/features/meter/api.ts
// TanStack Query hooks for meter reading — with offline queue fallback.

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/shared/api/fetchClient';
import { addToQueue } from '@/shared/pwa/idb-queue';
import { registerMeterSync } from '@/shared/pwa/sync';
import type { API } from '@/types/api.d';

/** @public - Query key factory for meter reading cache management (exported for test mocks and advanced cache invalidation) */
export const meterKeys = {
  all: ['meter-readings'] as const,
  history: (roomId: string) => ['meter-readings', 'history', roomId] as const,
};

export function useRecordMeterMutation() {
  const qc = useQueryClient();

  return useMutation({
    // Must run even while offline — mutationFn itself detects the offline
    // case and falls back to the IndexedDB queue. TanStack Query's default
    // networkMode ('online') would otherwise pause this mutation forever
    // until connectivity returns, so it never gets the chance to queue it.
    networkMode: 'always',
    mutationFn: async (payload: API.MeterReadingRequest): Promise<API.MeterReadingResponse> => {
      if (!navigator.onLine) {
        await addToQueue(payload);
        await registerMeterSync();
        return {
          id: '__offline__',
          room_id: payload.room_id,
          billing_month: payload.billing_month,
          billing_year: payload.billing_year,
          electric_previous: payload.electric_previous,
          electric_current: payload.electric_current,
          electric_used: payload.electric_current - payload.electric_previous,
          water_previous: payload.water_previous,
          water_current: payload.water_current,
          water_used: payload.water_current - payload.water_previous,
          read_date: new Date().toISOString(),
        };
      }

      const res = await apiFetch<API.SuccessResponse<API.MeterReadingResponse>>(
        '/billing/meter-readings',
        {
          method: 'POST',
          body: JSON.stringify(payload),
          skipAuth: false,
        },
      );

      if ('error' in res) {
        throw new Error((res as API.ErrorResponse).error.message);
      }

      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: meterKeys.all });
    },
  });
}