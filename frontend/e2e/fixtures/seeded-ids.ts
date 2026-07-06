// File: frontend/e2e/fixtures/seeded-ids.ts
// Deterministic IDs for fullstack E2E fixture data.
//
// These MUST match `backend/scripts/seed_e2e.py` exactly — both sides derive
// the same UUIDs from `uuid.uuid5(NAMESPACE, name)` / `uuid5(NAMESPACE, name)`
// using the same fixed namespace and name strings. If you add/rename a
// fixture in the Python script, update this file to match.
//
// Run `./scripts/reset-e2e-db.sh` before running specs that depend on this
// data — the backend and Playwright are separate processes with no shared
// transaction, so nothing rolls back between test runs automatically.

export const SEEDED_USERS = {
  admin: { email: 'admin@example.com', password: 'Admin123!' },
  inactive: { email: 'inactive@example.com', password: 'Inactive123!' },
} as const;

export const SEEDED = {
  propertySunsetId: 'c92df6ed-2bf7-5ac2-8fa3-a50c060ea530',
  propertyRiversideId: '02517f45-90f1-55d8-9d57-df55261be7e3',
  buildingSunsetAId: '66d6c84c-92dd-5f40-8fc5-9a3f6e93d386',
  room101Id: 'feebfe84-5858-5726-be7c-1271172a4e19',
  room102Id: '204370e6-54bc-5487-80db-0f5af944feaf',
  tenantJohnDoeId: '89eada44-adae-57b6-b83d-7c79fae5672a',
  contractRoom102Id: '8e166080-a4dc-5a18-801f-36b8cf803474',
  invoice20260001Id: '16c02148-f68c-5e14-b143-49b7485e5be0',
  maintenanceLeakingFaucetId: 'd2202a7a-ab35-5122-9f21-6ef457a93f60',
  meterReading101Id: 'db5545e6-0897-567f-b241-74d6dc3fc2fc',
} as const;

// Human-readable field values from the seed, for assertions.
export const SEEDED_DATA = {
  property: {
    sunset: { name: 'Sunset Tower', address: '123 Main St', billingDueDay: 5, minDepositMonths: 2 },
    riverside: { name: 'Riverside Apartments', address: '456 River Rd', billingDueDay: 10, minDepositMonths: 3 },
  },
  room101: { number: '101', type: 'studio', baseRent: 5000, status: 'available' },
  room102: { number: '102', type: 'one_bedroom', baseRent: 8000, status: 'occupied' },
  tenant: { fullName: 'John Doe', phone: '0899999999' },
  contract: { monthlyRent: 8000, depositAmount: 16000, status: 'active' },
  invoice: {
    number: 'INV-2026-0001',
    billingMonth: 7,
    billingYear: 2026,
    totalAmount: 8500,
    paidAmount: 0,
    status: 'issued',
  },
  maintenance: { title: 'Leaking faucet', priority: 'medium', status: 'pending' },
} as const;
