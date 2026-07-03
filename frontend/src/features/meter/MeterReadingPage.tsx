// File: src/features/meter/MeterReadingPage.tsx
// PWA Meter Reading form — offline queue, sync status, BR-07 validation.
// SCR-METER-READ: Full-width mobile, large touch targets (>=44px), sticky summary.

import { useState } from 'react';
import { useRecordMeterMutation } from './api';
import { useMeterForm, type MeterReadingFormData } from './hooks/useMeterForm';
import { useOfflineQueue } from './hooks/useOfflineQueue';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { Card, CardHeader } from '@/shared/ui/Card';
import { useToast } from '@/shared/ui/Toast';

type SubmitState = 'idle' | 'submitting' | 'queued' | 'success';

export default function MeterReadingPage() {
  const { showToast } = useToast();
  const recordMeter = useRecordMeterMutation();
  const { pendingCount, isSyncing, triggerSync } = useOfflineQueue();
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useMeterForm();

  const [submitState, setSubmitState] = useState<SubmitState>('idle');

  const watchElectricPrev = watch('electric_previous');
  const watchWaterPrev = watch('water_previous');

  const isOnline = navigator.onLine;

  async function onSubmit(data: Record<string, unknown>) {
    setSubmitState('submitting');
    try {
      const d = data as MeterReadingFormData;
      const result = await recordMeter.mutateAsync({
        room_id: d.room_id,
        billing_month: d.billing_month,
        billing_year: d.billing_year,
        electric_previous: d.electric_previous,
        electric_current: d.electric_current,
        water_previous: d.water_previous,
        water_current: d.water_current,
      });

      if (result.id === '__offline__') {
        setSubmitState('queued');
        showToast('Reading saved offline — will sync when online', 'info');
      } else {
        setSubmitState('success');
        showToast('Meter reading recorded successfully', 'success');
        reset();
      }
    } catch (err) {
      setSubmitState('idle');
      showToast(
        err instanceof Error ? err.message : 'Failed to record reading',
        'error',
      );
    }
  }

  // Calculate usage for display
  const electricUsage = Math.max(0, watch('electric_current') - (watchElectricPrev ?? 0));
  const waterUsage = Math.max(0, watch('water_current') - (watchWaterPrev ?? 0));

  return (
    <div className="mx-auto max-w-lg space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-surface-900">Meter Reading</h1>
        <p className="mt-1 text-sm text-surface-500">
          Record electric and water meter readings
        </p>
      </div>

      {/* Offline Banner */}
      {!isOnline && (
        <div
          className="flex items-center gap-3 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800"
          role="alert"
        >
          <svg className="size-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
          <span>You are offline. Readings will be saved and synced later.</span>
        </div>
      )}

      {/* Sync Status */}
      {pendingCount > 0 && (
        <div className="flex items-center justify-between rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800">
          <span aria-live="polite">
            {pendingCount} reading{pendingCount !== 1 ? 's' : ''} pending sync
            {isSyncing ? ' — syncing...' : ''}
          </span>
          {!isSyncing && (
            <button
              onClick={triggerSync}
              className="font-medium text-blue-700 hover:text-blue-900 focus-visible:outline-2 focus-visible:outline-blue-500"
              type="button"
            >
              Sync now
            </button>
          )}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="space-y-4">
          {/* Room selector — simple input for Sprint 3 */}
          <Input
            label="Room ID"
            placeholder="Room UUID"
            {...register('room_id')}
            error={errors.room_id?.message}
          />

          {/* Billing period */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Billing Month"
              type="number"
              min={1}
              max={12}
              {...register('billing_month', { valueAsNumber: true })}
              error={errors.billing_month?.message}
            />
            <Input
              label="Billing Year"
              type="number"
              min={2020}
              {...register('billing_year', { valueAsNumber: true })}
              error={errors.billing_year?.message}
            />
          </div>

          {/* Electric Meter */}
          <Card padding="lg">
            <CardHeader title="Electric Meter" />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Previous Reading"
                type="number"
                inputMode="decimal"
                step="any"
                {...register('electric_previous', { valueAsNumber: true })}
                error={errors.electric_previous?.message}
              />
              <Input
                label="Current Reading"
                type="number"
                inputMode="decimal"
                step="any"
                {...register('electric_current', { valueAsNumber: true })}
                error={errors.electric_current?.message}
              />
            </div>
          </Card>

          {/* Water Meter */}
          <Card padding="lg">
            <CardHeader title="Water Meter" />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Previous Reading"
                type="number"
                inputMode="decimal"
                step="any"
                {...register('water_previous', { valueAsNumber: true })}
                error={errors.water_previous?.message}
              />
              <Input
                label="Current Reading"
                type="number"
                inputMode="decimal"
                step="any"
                {...register('water_current', { valueAsNumber: true })}
                error={errors.water_current?.message}
              />
            </div>
          </Card>

          {/* Sticky Summary */}
          <div className="sticky bottom-0 z-10 rounded-xl border border-surface-200 bg-white p-4 shadow-lg">
            <div className="flex items-center justify-between text-sm">
              <div className="space-y-1">
                <p>Electric: <strong>{electricUsage.toFixed(1)}</strong> units</p>
                <p>Water: <strong>{waterUsage.toFixed(1)}</strong> units</p>
              </div>
              <div className="flex items-center gap-3">
                {submitState === 'queued' && (
                  <span className="text-sm text-amber-600 font-medium">
                    ✅ Saved (pending sync)
                  </span>
                )}
                {submitState === 'success' && (
                  <span className="text-sm text-green-600 font-medium">
                    ✓ Recorded
                  </span>
                )}
                <Button
                  type="submit"
                  size="lg"
                  className="min-h-[48px] min-w-[140px]"
                  isLoading={submitState === 'submitting'}
                  disabled={submitState === 'submitting'}
                >
                  {isOnline ? 'Save Reading' : 'Save Offline'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}