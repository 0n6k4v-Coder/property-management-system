// File: src/features/meter/hooks/useMeterForm.ts
// Zod schema + react-hook-form integration for meter reading.
// BR-07: electric_current >= electric_previous, water_current >= water_previous.

import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const meterReadingSchema = z.object({
  room_id: z.string().min(1, 'Room is required'),
  billing_month: z.number().int('Must be a whole number').min(1, 'Month must be 1-12').max(12),
  billing_year: z.number().int('Must be a whole number').min(2020, 'Year must be >= 2020'),
  electric_previous: z.number().min(0, 'Previous must be >= 0').default(0),
  electric_current: z.number().min(0, 'Current must be >= 0'),
  water_previous: z.number().min(0, 'Previous must be >= 0').default(0),
  water_current: z.number().min(0, 'Current must be >= 0'),
}).refine(
  (data) => data.electric_current >= data.electric_previous,
  { message: 'Electric current cannot be less than previous', path: ['electric_current'] },
).refine(
  (data) => data.water_current >= data.water_previous,
  { message: 'Water current cannot be less than previous', path: ['water_current'] },
);

export type MeterReadingFormData = z.infer<typeof meterReadingSchema>;

export function useMeterForm() {
  return useForm<MeterReadingFormData>({
    resolver: zodResolver(meterReadingSchema) as never,
    defaultValues: {
      room_id: '',
      billing_month: new Date().getMonth() + 1,
      billing_year: new Date().getFullYear(),
      electric_previous: 0,
      electric_current: 0,
      water_previous: 0,
      water_current: 0,
    },
  });
}

export { meterReadingSchema };