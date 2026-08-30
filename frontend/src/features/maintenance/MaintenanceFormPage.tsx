// File: src/features/maintenance/MaintenanceFormPage.tsx
// Create new maintenance request form with room/property selection, priority.
// SCR-MAINT-CREATE: POST /maintenance-requests

import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCreateMaintenance } from './api';
import { useProperties } from '@/features/property/api';
import { usePropertyWithRooms } from '@/features/property/api';
import { Card, CardHeader } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { useToast } from '@/shared/ui/Toast';

const createMaintenanceSchema = z.object({
  property_id: z.string().min(1, 'Property is required'),
  room_id: z.string().min(1, 'Room is required'),
  title: z
    .string()
    .min(1, 'Title is required')
    .max(255, 'Title too long')
    .refine((v) => v.trim().length > 0, 'Title is required'),
  description: z
    .string()
    .min(1, 'Description is required')
    .refine((v) => v.trim().length > 0, 'Description is required'),
  priority: z.enum(['low', 'medium', 'high', 'urgent'] as const),
});

type CreateMaintenanceForm = z.infer<typeof createMaintenanceSchema>;

export default function MaintenanceFormPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const createMutation = useCreateMaintenance();
  const { data: properties } = useProperties();

  const {
    register,
    handleSubmit,
    control,
    resetField,
    formState: { errors },
  } = useForm<CreateMaintenanceForm>({
    resolver: zodResolver(createMaintenanceSchema),
    defaultValues: {
      property_id: '',
      room_id: '',
      title: '',
      description: '',
      priority: 'medium',
    },
  });

  const propertyId = useWatch({ control, name: 'property_id' }) ?? '';

  const { data: propertyWithRooms } = usePropertyWithRooms(propertyId || null);
  const rooms = propertyWithRooms?.rooms ?? [];

  // Reset room selection when property changes
  const prevPropertyIdRef = useRef(propertyId);
  useEffect(() => {
    if (prevPropertyIdRef.current !== propertyId) {
      prevPropertyIdRef.current = propertyId;
      resetField('room_id', { defaultValue: '' });
    }
  }, [propertyId, resetField]);

  async function onSubmit(data: CreateMaintenanceForm) {
    try {
      await createMutation.mutateAsync({
        property_id: data.property_id,
        room_id: data.room_id,
        title: data.title.trim(),
        description: data.description.trim(),
        priority: data.priority,
      });
      showToast('Maintenance request created', 'success');
      navigate('/maintenance');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Creation failed', 'error');
    }
  }

  function onInvalid() {
    showToast('Please fill in all required fields', 'error');
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-surface-900">New Maintenance Request</h1>
        <p className="mt-1 text-sm text-surface-500">Submit a maintenance request for a room</p>
      </div>

      <Card>
        <CardHeader title="Request Details" />
        <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-4">
          {/* Property */}
          <div>
            <label htmlFor="maint-property" className="block text-sm font-medium text-surface-700">
              Property <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <select
              id="maint-property"
              {...register('property_id')}
              required
              className="mt-1 block w-full rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-primary-500"
            >
              <option value="">Select a property…</option>
              {(properties ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {errors.property_id && (
              <p className="mt-1 text-xs text-red-600">{errors.property_id.message}</p>
            )}
          </div>

          {/* Room (depends on property) */}
          {propertyId && (
            <div>
              <label htmlFor="maint-room" className="block text-sm font-medium text-surface-700">
                Room <span className="text-red-500" aria-hidden="true">*</span>
              </label>
              <select
                id="maint-room"
                {...register('room_id')}
                required
                className="mt-1 block w-full rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-primary-500"
              >
                <option value="">Select a room…</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.room_number} ({r.room_type}) - {r.status}
                  </option>
                ))}
              </select>
              {errors.room_id && (
                <p className="mt-1 text-xs text-red-600">{errors.room_id.message}</p>
              )}
            </div>
          )}

          {/* Title */}
          <Input
            label="Title"
            requiredIndicator={true}
            {...register('title')}
            error={errors.title?.message}
            placeholder="e.g., Leaking faucet in bathroom"
            required
          />

          {/* Description */}
          <div>
            <label htmlFor="maint-description" className="block text-sm font-medium text-surface-700">
              Description <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <textarea
              id="maint-description"
              {...register('description')}
              rows={4}
              required
              className="mt-1 block w-full rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-primary-500"
              placeholder="Describe the issue in detail…"
              aria-describedby="maint-description-hint"
              aria-label="Maintenance issue description"
            />
            <p id="maint-description-hint" className="mt-1 text-xs text-surface-500">
              Describe the maintenance issue in detail
            </p>
            {errors.description && (
              <p className="mt-1 text-xs text-red-600">{errors.description.message}</p>
            )}
          </div>

          {/* Priority */}
          <fieldset>
            <legend className="block text-sm font-medium text-surface-700">Priority</legend>
            <div className="mt-2 flex flex-wrap gap-4" role="radiogroup" aria-label="Priority level">
              {(['low', 'medium', 'high', 'urgent'] as const).map((p) => (
                <label key={p} className="flex items-center gap-2 cursor-pointer" htmlFor={`priority-${p}`}>
                  <input
                    type="radio"
                    id={`priority-${p}`}
                    value={p}
                    {...register('priority')}
                    className="size-4 text-primary-600 border-surface-300 focus:ring-primary-500"
                    aria-label={p}
                  />
                  <span className="capitalize">{p}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => navigate('/maintenance')}>
              Cancel
            </Button>
            <Button type="submit" isLoading={createMutation.isPending}>
              Submit Request
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}