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
    mutationFn: async (payload: API.MeterReadingRequest): Promise<API.MeterReadingResponse> => {
      // Try online submit first
      try {
        const res = await apiFetch<API.SuccessResponse<API.MeterReadingResponse>>(
          '/meter-readings',
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
      } catch (err) {
        // If it's a network error (TypeError: Failed to fetch) or 503,
        // fallback to offline queue
        const isNetworkError =
          err instanceof TypeError ||
          (err instanceof Error &&
            (err.message.includes('Failed to fetch') ||
             err.message.includes('NetworkError') ||
             err.message.includes('503')));

        if (isNetworkError && !navigator.onLine) {
          await addToQueue(payload);
          await registerMeterSync();
          // Return a placeholder to indicate offline queue success
          return {
            id: '__offline__',
            room_id: payload.room_id,
            billing_month: payload.billing_month,
            billing_year: payload.billing_year,
            electric_previous: payload.electric_previous,
            electric_current: payload.electric_current,
            electric_used: 0,
            water_previous: payload.water_previous,
            water_current: payload.water_current,
            water_used: 0,
            read_date: new Date().toISOString().split('T')[0]!,
          } as API.MeterReadingResponse;
        }

        throw err;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: meterKeys.all });
    },
  });
}