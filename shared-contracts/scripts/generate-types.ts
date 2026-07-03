#!/usr/bin/env ts-node
/**
 * Generate TypeScript types from OpenAPI specification
 * Usage: npm run generate
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const OPENAPI_PATH = join(__dirname, '../../openapi.json');
const OUTPUT_DIR = join(__dirname, '../types/frontend');
const OUTPUT_FILE = join(OUTPUT_DIR, 'api.ts');

async function generateTypes() {
  console.log('🔄 Generating TypeScript types from OpenAPI spec...');
  
  // Check if openapi.json exists
  if (!existsSync(OPENAPI_PATH)) {
    console.error('❌ openapi.json not found at:', OPENAPI_PATH);
    console.error('   Run backend openapi generation first: python3 ../../backend/generate_openapi.py');
    process.exit(1);
  }

  // Ensure output directory exists
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  try {
    // Use openapi-typescript to generate types
    const command = `npx openapi-typescript ${OPENAPI_PATH} -o ${OUTPUT_FILE} --use-options --use-unions`;
    console.log('Running:', command);
    
    execSync(command, { 
      stdio: 'inherit',
      cwd: join(__dirname, '..')
    });

    console.log('✅ Types generated at:', OUTPUT_FILE);
    
    // Also generate Zod schemas for runtime validation
    await generateZodSchemas();
    
  } catch (error) {
    console.error('❌ Generation failed:', error);
    process.exit(1);
  }
}

async function generateZodSchemas() {
  console.log('🔄 Generating Zod schemas for runtime validation...');
  
  const ZOD_OUTPUT = join(OUTPUT_DIR, 'schemas.ts');
  
  try {
    const zodContent = `/**
 * Auto-generated Zod schemas from OpenAPI spec
 * DO NOT EDIT MANUALLY - Run 'npm run generate' to regenerate
 */

import { z } from 'zod';

// Base types
export const UUIDSchema = z.string().uuid();

// Auth schemas
export const AuthRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const RegisterRequestSchema = z.object({
  invite_token: z.string().min(1),
  full_name: z.string().min(1).max(255),
  password: z.string().min(8),
  phone: z.string().min(10).max(20),
});

export const TokenDataSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  user: z.object({
    id: UUIDSchema,
    email: z.string().email(),
    full_name: z.string(),
    property_scopes: z.array(UUIDSchema),
    is_active: z.boolean(),
  }),
});

// Pagination schemas
export const PaginationParamsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sort: z.string().optional(),
});

export const PaginatedMetaSchema = z.object({
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  has_next: z.boolean(),
});

// Property schemas
export const PropertyCreateSchema = z.object({
  name: z.string().min(1).max(255),
  address: z.string().min(1),
  billing_due_day: z.number().int().min(1).max(28),
  min_deposit_months: z.number().int().min(1).default(2),
});

export const PropertyResponseSchema = z.object({
  id: UUIDSchema,
  name: z.string(),
  address: z.string(),
  billing_due_day: z.number().int(),
  min_deposit_months: z.number().int(),
  created_by: UUIDSchema.nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

// Building schemas
export const BuildingCreateSchema = z.object({
  property_id: UUIDSchema,
  name: z.string().min(1).max(255),
  display_order: z.number().int().default(0),
  description: z.string().optional(),
});

// Room schemas
export const RoomCreateSchema = z.object({
  property_id: UUIDSchema,
  building_id: UUIDSchema,
  floor_id: UUIDSchema.optional(),
  room_number: z.string().min(1).max(20),
  room_type: z.string().default('studio'),
  base_rent: z.number().nonnegative().default(0),
  images: z.record(z.unknown()).optional(),
});

export const RoomResponseSchema = z.object({
  id: UUIDSchema,
  property_id: UUIDSchema,
  building_id: UUIDSchema,
  floor_id: UUIDSchema.nullable(),
  room_number: z.string(),
  room_type: z.string(),
  base_rent: z.string(), // Decimal as string
  status: z.enum(['available', 'occupied', 'maintenance']),
  images: z.record(z.unknown()).nullable(),
});

// Billing schemas
export const MeterReadingCreateSchema = z.object({
  room_id: UUIDSchema,
  electric_current: z.number().nonnegative(),
  water_current: z.number().nonnegative(),
});

export const InvoiceBulkGenerateSchema = z.object({
  property_id: UUIDSchema,
  billing_month: z.number().int().min(1).max(12),
  billing_year: z.number().int().min(2020).max(2030),
});

export const PaymentCreateSchema = z.object({
  invoice_id: UUIDSchema,
  amount: z.number().positive(),
  payment_method: z.enum(['cash', 'transfer', 'card', 'other']),
  paid_at: z.string().datetime().optional(),
  notes: z.string().optional(),
});

// Contract schemas
export const ContractCreateSchema = z.object({
  property_id: UUIDSchema,
  room_id: UUIDSchema,
  tenant_id: UUIDSchema,
  start_date: z.string().date(),
  end_date: z.string().date(),
  rent_amount: z.number().nonnegative(),
  deposit_amount: z.number().nonnegative(),
  billing_day: z.number().int().min(1).max(28),
});

// Maintenance schemas
export const MaintenanceCreateSchema = z.object({
  room_id: UUIDSchema,
  title: z.string().min(1).max(255),
  description: z.string(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
});

// Dashboard/Reports schemas
export const DashboardResponseSchema = z.object({
  total_properties: z.number().int(),
  total_rooms: z.number().int(),
  occupied_rooms: z.number().int(),
  available_rooms: z.number().int(),
  maintenance_rooms: z.number().int(),
  monthly_revenue: z.string(),
  overdue_invoices: z.number().int(),
  overdue_amount: z.string(),
});

// Error response schema
export const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.unknown()).optional(),
  }),
});

// Type exports
export type AuthRequest = z.infer<typeof AuthRequestSchema>;
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;
export type TokenData = z.infer<typeof TokenDataSchema>;
export type PropertyCreate = z.infer<typeof PropertyCreateSchema>;
export type PropertyResponse = z.infer<typeof PropertyResponseSchema>;
export type BuildingCreate = z.infer<typeof BuildingCreateSchema>;
export type RoomCreate = z.infer<typeof RoomCreateSchema>;
export type RoomResponse = z.infer<typeof RoomResponseSchema>;
export type MeterReadingCreate = z.infer<typeof MeterReadingCreateSchema>;
export type InvoiceBulkGenerate = z.infer<typeof InvoiceBulkGenerateSchema>;
export type PaymentCreate = z.infer<typeof PaymentCreateSchema>;
export type ContractCreate = z.infer<typeof ContractCreateSchema>;
export type MaintenanceCreate = z.infer<typeof MaintenanceCreateSchema>;
export type DashboardResponse = z.infer<typeof DashboardResponseSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
`;

    writeFileSync(ZOD_OUTPUT, zodContent);
    console.log('✅ Zod schemas generated at:', ZOD_OUTPUT);
    
  } catch (error) {
    console.error('❌ Zod generation failed:', error);
  }
}

// Run if executed directly
if (require.main === module) {
  generateTypes();
}

export { generateTypes };