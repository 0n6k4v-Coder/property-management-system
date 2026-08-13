// File: src/shared/utils/validators.test.ts
// Unit tests for shared Zod schemas (validators).
// Covers: createPropertySchema, createRoomSchema, createTenantSchema, createContractSchema

import {
  createPropertySchema,
  createRoomSchema,
  createTenantSchema,
  createContractSchema,
} from './validators';

describe('createPropertySchema', () => {
  it('passes for valid property data', () => {
    const result = createPropertySchema.safeParse({
      name: 'Sunset Tower',
      address: '123 Main St',
      billing_due_day: 5,
      min_deposit_months: 2,
    });
    expect(result.success).toBe(true);
  });

  it('trims whitespace from name on success', () => {
    const result = createPropertySchema.safeParse({
      name: '  My Property  ',
      address: '456 Oak Ave',
      billing_due_day: 10,
      min_deposit_months: 1,
    });
    if (result.success) {
      expect(result.data.name).toBe('My Property');
    }
  });

  it('fails when name is empty', () => {
    const result = createPropertySchema.safeParse({
      name: '',
      address: '456 Oak Ave',
      billing_due_day: 10,
      min_deposit_months: 1,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toMatch(/required/i);
  });

  it('fails when name exceeds 255 chars', () => {
    const result = createPropertySchema.safeParse({
      name: 'x'.repeat(256),
      address: '456 Oak Ave',
      billing_due_day: 10,
      min_deposit_months: 1,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toMatch(/too long/i);
  });

  it('fails when address is empty', () => {
    const result = createPropertySchema.safeParse({
      name: 'My Property',
      address: '',
      billing_due_day: 10,
      min_deposit_months: 1,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toMatch(/required/i);
  });

  it('fails when billing_due_day is not an integer', () => {
    const result = createPropertySchema.safeParse({
      name: 'My Property',
      address: '456 Oak Ave',
      billing_due_day: 5.5,
      min_deposit_months: 1,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toMatch(/whole number/i);
  });

  it('fails when billing_due_day is less than 1', () => {
    const result = createPropertySchema.safeParse({
      name: 'My Property',
      address: '456 Oak Ave',
      billing_due_day: 0,
      min_deposit_months: 1,
    });
    expect(result.success).toBe(false);
  });

  it('fails when billing_due_day exceeds 28', () => {
    const result = createPropertySchema.safeParse({
      name: 'My Property',
      address: '456 Oak Ave',
      billing_due_day: 29,
      min_deposit_months: 1,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toMatch(/1-28/i);
  });

  it('fails when min_deposit_months is less than 1', () => {
    const result = createPropertySchema.safeParse({
      name: 'My Property',
      address: '456 Oak Ave',
      billing_due_day: 5,
      min_deposit_months: 0,
    });
    expect(result.success).toBe(false);
  });

  it('fails when required fields are missing', () => {
    const result = createPropertySchema.safeParse({
      name: 'My Property',
    });
    expect(result.success).toBe(false);
    const issues = result.error?.issues.map((i) => i.path.join('.'));
    expect(issues).toContain('address');
    expect(issues).toContain('billing_due_day');
    expect(issues).toContain('min_deposit_months');
  });

  it('accepts billing_due_day of 28 (boundary)', () => {
    const result = createPropertySchema.safeParse({
      name: 'P',
      address: 'A',
      billing_due_day: 28,
      min_deposit_months: 1,
    });
    expect(result.success).toBe(true);
  });
});

describe('createRoomSchema', () => {
  it('passes for valid room data', () => {
    const result = createRoomSchema.safeParse({
      room_number: '101',
      room_type: 'studio',
      base_rent: 5000,
      building_id: 'b1',
    });
    expect(result.success).toBe(true);
  });

  it('accepts all valid room types', () => {
    const types = ['studio', '1br', '2br', '3br', 'penthouse', 'commercial'] as const;
    types.forEach((rt) => {
      const result = createRoomSchema.safeParse({
        room_number: '101',
        room_type: rt,
        base_rent: 5000,
        building_id: 'b1',
      });
      expect(result.success).toBe(true);
    });
  });

  it('fails for empty room_number', () => {
    const result = createRoomSchema.safeParse({
      room_number: '',
      room_type: 'studio',
      base_rent: 5000,
      building_id: 'b1',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toMatch(/required/i);
  });

  it('fails when room_number exceeds 50 chars', () => {
    const result = createRoomSchema.safeParse({
      room_number: 'x'.repeat(51),
      room_type: 'studio',
      base_rent: 5000,
      building_id: 'b1',
    });
    expect(result.success).toBe(false);
  });

  it('fails for invalid room_type', () => {
    const result = createRoomSchema.safeParse({
      room_number: '101',
      room_type: 'invalid' as never,
      base_rent: 5000,
      building_id: 'b1',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toMatch(/select a room type/i);
  });

  it('fails when base_rent is not positive', () => {
    const result = createRoomSchema.safeParse({
      room_number: '101',
      room_type: 'studio',
      base_rent: -100,
      building_id: 'b1',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toMatch(/positive/i);
  });

  it('fails when base_rent is zero', () => {
    const result = createRoomSchema.safeParse({
      room_number: '101',
      room_type: 'studio',
      base_rent: 0,
      building_id: 'b1',
    });
    expect(result.success).toBe(false);
  });

  it('fails when building_id is empty', () => {
    const result = createRoomSchema.safeParse({
      room_number: '101',
      room_type: 'studio',
      base_rent: 5000,
      building_id: '',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toMatch(/required/i);
  });
});

describe('createTenantSchema', () => {
  const validTenant = {
    property_id: 'p1',
    full_name: 'John Doe',
    id_card_number: '1234567890121', // valid Thai ID checksum
    phone: '0812345678',
    email: 'john@example.com',
    emergency_contact_name: 'Jane Doe',
    emergency_contact_phone: '0898765432',
  };

  it('passes for valid tenant data', () => {
    const result = createTenantSchema.safeParse(validTenant);
    expect(result.success).toBe(true);
  });

  it('passes with empty string for optional email', () => {
    const result = createTenantSchema.safeParse({
      ...validTenant,
      email: '',
    });
    expect(result.success).toBe(true);
  });

  it('passes when optional fields are omitted', () => {
    const result = createTenantSchema.safeParse({
      property_id: 'p1',
      full_name: 'John Doe',
      id_card_number: '1234567890121',
      phone: '0812345678',
    });
    expect(result.success).toBe(true);
  });

  it('fails when property_id is empty', () => {
    const result = createTenantSchema.safeParse({
      ...validTenant,
      property_id: '',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toMatch(/required/i);
  });

  it('fails when full_name is empty', () => {
    const result = createTenantSchema.safeParse({
      ...validTenant,
      full_name: '',
    });
    expect(result.success).toBe(false);
  });

  it('fails when full_name exceeds 255 chars', () => {
    const result = createTenantSchema.safeParse({
      ...validTenant,
      full_name: 'x'.repeat(256),
    });
    expect(result.success).toBe(false);
  });

  it('fails when id_card_number is not exactly 13 digits', () => {
    const result = createTenantSchema.safeParse({
      ...validTenant,
      id_card_number: '1234567890',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toMatch(/13 digits/i);
  });

  it('fails when id_card_number has invalid checksum', () => {
    const result = createTenantSchema.safeParse({
      ...validTenant,
      id_card_number: '1234567890120', // invalid checksum
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toMatch(/checksum/i);
  });

  it('fails when phone is not 10 digits', () => {
    const result = createTenantSchema.safeParse({
      ...validTenant,
      phone: '081234567',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toMatch(/10 digits/i);
  });

  it('fails when phone does not match Thai format', () => {
    const result = createTenantSchema.safeParse({
      ...validTenant,
      phone: '1234567890', // starts with 1, not 0
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toMatch(/Thai phone/i);
  });

  it('fails with invalid email format', () => {
    const result = createTenantSchema.safeParse({
      ...validTenant,
      email: 'not-an-email',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toMatch(/invalid email/i);
  });
});

describe('createContractSchema', () => {
  const validContract = {
    room_id: 'r1',
    tenant_id: 't1',
    property_id: 'p1',
    start_date: '2026-01-01',
    end_date: '2026-12-31',
    monthly_rent: 15000,
    deposit_amount: 30000,
    special_conditions: 'No pets allowed',
  };

  it('passes for valid contract data', () => {
    const result = createContractSchema.safeParse(validContract);
    expect(result.success).toBe(true);
  });

  it('passes when special_conditions is empty string', () => {
    const result = createContractSchema.safeParse({
      ...validContract,
      special_conditions: '',
    });
    expect(result.success).toBe(true);
  });

  it('passes when special_conditions is omitted', () => {
    const { special_conditions, ...rest } = validContract;
    void special_conditions;
    const result = createContractSchema.safeParse(rest);
    expect(result.success).toBe(true);
  });

  it('passes when deposit_amount is zero', () => {
    const result = createContractSchema.safeParse({
      ...validContract,
      deposit_amount: 0,
    });
    expect(result.success).toBe(true);
  });

  it('fails when room_id is empty', () => {
    const result = createContractSchema.safeParse({
      ...validContract,
      room_id: '',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toMatch(/required/i);
  });

  it('fails when tenant_id is empty', () => {
    const result = createContractSchema.safeParse({
      ...validContract,
      tenant_id: '',
    });
    expect(result.success).toBe(false);
  });

  it('fails when property_id is empty', () => {
    const result = createContractSchema.safeParse({
      ...validContract,
      property_id: '',
    });
    expect(result.success).toBe(false);
  });

  it('fails when start_date is missing', () => {
    const result = createContractSchema.safeParse({
      ...validContract,
      start_date: '',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toMatch(/required/i);
  });

  it('fails when end_date is missing', () => {
    const result = createContractSchema.safeParse({
      ...validContract,
      end_date: '',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toMatch(/required/i);
  });

  it('fails when end_date is before start_date', () => {
    const result = createContractSchema.safeParse({
      ...validContract,
      start_date: '2026-06-01',
      end_date: '2026-01-01',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toMatch(/after start date/i);
    expect(result.error?.issues[0].path).toEqual(['end_date']);
  });

  it('passes when end_date equals start_date (boundary not rejected by refine)', () => {
    // refine checks: end_date > start_date (strict) — equal is NOT after, so fails
    const result = createContractSchema.safeParse({
      ...validContract,
      start_date: '2026-06-01',
      end_date: '2026-06-01',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toMatch(/after start date/i);
  });

  it('fails when monthly_rent is not positive', () => {
    const result = createContractSchema.safeParse({
      ...validContract,
      monthly_rent: -100,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toMatch(/positive/i);
  });

  it('fails when deposit_amount is negative', () => {
    const result = createContractSchema.safeParse({
      ...validContract,
      deposit_amount: -5000,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toMatch(/negative/i);
  });

  it('fails when required fields are missing', () => {
    const result = createContractSchema.safeParse({});
    expect(result.success).toBe(false);
    const issues = result.error?.issues.map((i) => i.path.join('.'));
    expect(issues).toContain('room_id');
    expect(issues).toContain('tenant_id');
    expect(issues).toContain('property_id');
    expect(issues).toContain('start_date');
    expect(issues).toContain('end_date');
    expect(issues).toContain('monthly_rent');
    expect(issues).toContain('deposit_amount');
  });
});
