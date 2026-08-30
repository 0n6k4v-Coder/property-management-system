// File: src/shared/utils/validators.ts
// Zod schemas for Property, Tenant, and Contract forms — matching api.d.ts types.

import { z } from 'zod';

// ── Property Schemas ────────────────────────────────────────────────

export const createPropertySchema = z.object({ /* react-doctor-disable-line unused-export */
  name: z
    .string()
    .min(1, 'Property name is required')
    .max(255, 'Name too long')
    .transform((v) => v.trim()),
  address: z.string().min(1, 'Address is required'),
  billing_due_day: z
    .number()
    .int('Must be a whole number')
    .min(1, 'Must be 1–28')
    .max(28, 'Must be 1–28'),
  min_deposit_months: z
    .number()
    .int('Must be a whole number')
    .min(1, 'Must be at least 1'),
});

export type CreatePropertyForm = z.infer<typeof createPropertySchema>;

// ── Room Schemas ───────────────────────────────────────────────────

export const createRoomSchema = z.object({ /* react-doctor-disable-line unused-export */
  room_number: z.string().min(1, 'Room number is required').max(50),
  room_type: z.enum(['studio', '1br', '2br', '3br', 'penthouse', 'commercial'] as const, 'Please select a room type'),
  base_rent: z.number().positive('Rent must be positive'),
  building_id: z.string().min(1, 'Building is required'),
});

export type CreateRoomForm = z.infer<typeof createRoomSchema>;

// ── Tenant Schemas ─────────────────────────────────────────────────

const thaiPhoneRegex = /^0\d{9}$/;
const thaiIdCardRegex = /^\d{13}$/;

function verifyThaiIdChecksum(id: string): boolean {
  if (id.length !== 13 || !/^\d{13}$/.test(id)) return false;
  const digits = id.split('').map(Number);
  const total = digits.slice(0, 12).reduce((sum, d, i) => sum + (13 - i) * d, 0);
  const check = (11 - (total % 11)) % 10;
  return check === digits[12];
}

export const createTenantSchema = z.object({
  property_id: z.string().min(1, 'Property is required'),
  full_name: z.string().min(1, 'Full name is required').max(255),
  id_card_number: z
    .string()
    .length(13, 'Thai ID card must be exactly 13 digits')
    .regex(thaiIdCardRegex, 'ID card must be 13 digits')
    .refine(verifyThaiIdChecksum, 'Invalid ID card checksum'),
  phone: z
    .string()
    .length(10, 'Phone must be 10 digits')
    .regex(thaiPhoneRegex, 'Invalid Thai phone format (0XXXXXXXXX)'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  emergency_contact_name: z.string().max(255).optional().or(z.literal('')),
  emergency_contact_phone: z.string().max(20).optional().or(z.literal('')),
});

export type CreateTenantForm = z.infer<typeof createTenantSchema>;

// ── Contract Schemas ────────────────────────────────────────────────

export const createContractSchema = z.object({ /* react-doctor-disable-line unused-export */
    room_id: z.string().min(1, 'Room is required'),
    tenant_id: z.string().min(1, 'Tenant is required'),
    property_id: z.string().min(1, 'Property is required'),
    start_date: z.string().min(1, 'Start date is required'),
    end_date: z.string().min(1, 'End date is required'),
    monthly_rent: z.number().positive('Monthly rent must be positive'),
    deposit_amount: z.number().min(0, 'Deposit cannot be negative'),
    special_conditions: z.string().optional().or(z.literal('')),
  })
  .refine(
    (data) => !data.start_date || !data.end_date || new Date(data.end_date) > new Date(data.start_date),
    { message: 'End date must be after start date', path: ['end_date'] },
  );

export type CreateContractForm = z.infer<typeof createContractSchema>;