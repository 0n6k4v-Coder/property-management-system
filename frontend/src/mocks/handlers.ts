// File: src/mocks/handlers.ts
// MSW handlers for all API endpoints.

import { http, HttpResponse } from 'msw';

// Layers: Handlers (http.get, http.post) — separated by module
// ── Auth Handlers ──────────────────────────────────────────────────

const handlers = [
  // POST /api/v1/auth/login
  http.post('*/api/v1/auth/login', async ({ request }) => {
    const body = (await request.json()) as { email?: string; password?: string };

    if (!body.email || !body.password) {
      return HttpResponse.json(
        { error: { code: 'VAL-400', message: 'Email and password are required' } },
        { status: 400 },
      );
    }

    if (body.email === 'test@example.com' && body.password === 'Password1') {
      return HttpResponse.json({
        data: {
          access_token: 'test-access-token',
          refresh_token: 'test-refresh-token',
          user: {
            id: '00000000-0000-0000-0000-000000000001',
            email: 'test@example.com',
            full_name: 'Test User',
            property_scopes: [],
            is_active: true,
          },
        },
      });
    }

    return HttpResponse.json(
      { error: { code: 'AUTH-001', message: 'Invalid email or password' } },
      { status: 401 },
    );
  }),

  // POST /api/v1/auth/register
  http.post('*/api/v1/auth/register', async ({ request }) => {
    const body = (await request.json()) as {
      invite_token?: string;
      full_name?: string;
      phone?: string;
    };

    if (!body.invite_token) {
      return HttpResponse.json(
        { error: { code: 'VAL-400', message: 'Invalid invite token' } },
        { status: 400 },
      );
    }

    return HttpResponse.json(
      {
        data: {
          id: '00000000-0000-0000-0000-000000000002',
          email: 'newuser@example.com',
          full_name: body.full_name ?? 'New User',
          property_scopes: [],
          is_active: true,
        },
      },
      { status: 201 },
    );
  }),

  // POST /api/v1/auth/refresh
  http.post('*/api/v1/auth/refresh', () => {
    return HttpResponse.json({
      data: {
        access_token: 'refreshed-access-token',
      },
    });
  }),

  // GET /api/v1/auth/me
  http.get('*/api/v1/auth/me', ({ request }) => {
    const auth = request.headers.get('Authorization');
    if (!auth?.startsWith('Bearer ')) {
      return HttpResponse.json(
        { error: { code: 'AUTH-009', message: 'Invalid or expired access token' } },
        { status: 401 },
      );
    }
    return HttpResponse.json({
      data: {
        id: '00000000-0000-0000-0000-000000000001',
        email: 'test@example.com',
        full_name: 'Test User',
        property_scopes: [],
        is_active: true,
      },
    });
  }),

  // ── Property Handlers ──────────────────────────────────────────────

  http.get('*/api/v1/properties', () => {
    return HttpResponse.json({
      data: [
        {
          id: 'p1',
          name: 'Sunset Tower',
          address: '123 Main St',
          billing_due_day: 5,
          min_deposit_months: 2,
          created_by: null,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
        {
          id: 'p2',
          name: 'Riverside Apartments',
          address: '456 River Rd',
          billing_due_day: 10,
          min_deposit_months: 3,
          created_by: null,
          created_at: '2026-02-01T00:00:00Z',
          updated_at: '2026-02-01T00:00:00Z',
        },
      ],
      meta: null,
    });
  }),

  http.get('*/api/v1/properties/:id/rooms', () => {
    return HttpResponse.json({
      property: {
        id: 'p1',
        name: 'Sunset Tower',
        address: '123 Main St',
        billing_due_day: 5,
        min_deposit_months: 2,
        created_by: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
      rooms: [
        {
          id: 'r1',
          property_id: 'p1',
          building_id: 'b1',
          floor_id: null,
          room_number: '101',
          room_type: 'studio',
          base_rent: 5000,
          status: 'available',
          images: null,
        },
        {
          id: 'r2',
          property_id: 'p1',
          building_id: 'b1',
          floor_id: null,
          room_number: '102',
          room_type: '1br',
          base_rent: 8000,
          status: 'occupied',
          images: null,
        },
      ],
    });
  }),

  http.post('*/api/v1/properties', () => {
    return HttpResponse.json(
      {
        data: {
          id: 'new-p1',
          name: 'New Property',
          address: '456 Oak Ave',
          billing_due_day: 10,
          min_deposit_months: 2,
          created_by: null,
          created_at: '2026-06-01T00:00:00Z',
          updated_at: '2026-06-01T00:00:00Z',
        },
      },
      { status: 201 },
    );
  }),

  http.patch('*/api/v1/rooms/:id/status', () => {
    return HttpResponse.json({
      data: {
        id: 'r1',
        property_id: 'p1',
        building_id: 'b1',
        floor_id: null,
        room_number: '101',
        room_type: 'studio',
        base_rent: 5000,
        status: 'maintenance',
        images: null,
      },
    });
  }),

  // ── Tenant Handlers ────────────────────────────────────────────────

  http.get('*/api/v1/tenants/search', ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get('query') ?? '';
    const page = Number(url.searchParams.get('page') ?? '1');

    const tenants = [
      {
        id: 't1',
        property_id: 'p1',
        full_name: 'John Doe',
        phone: '0812345678',
        email: 'john@example.com',
        emergency_contact_name: 'Jane Doe',
        emergency_contact_phone: '0898765432',
        created_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 't2',
        property_id: 'p1',
        full_name: 'Jane Smith',
        phone: '0898765432',
        email: 'jane@example.com',
        emergency_contact_name: null,
        emergency_contact_phone: null,
        created_at: '2026-02-01T00:00:00Z',
      },
    ];

    const filtered = query
      ? tenants.filter((t) => t.full_name.toLowerCase().includes(query.toLowerCase()) || t.phone.includes(query))
      : [];

    return HttpResponse.json({
      data: filtered,
      meta: { page, limit: 20, total: filtered.length, has_next: false },
    });
  }),

  http.post('*/api/v1/tenants', () => {
    return HttpResponse.json(
      {
        data: {
          id: 'new-t1',
          property_id: 'p1',
          full_name: 'New Tenant',
          phone: '0811111111',
          email: null,
          emergency_contact_name: null,
          emergency_contact_phone: null,
          created_at: '2026-06-01T00:00:00Z',
        },
      },
      { status: 201 },
    );
  }),

  // ── Meter Reading Handlers ─────────────────────────────────────────

  http.post('*/api/v1/billing/meter-readings', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;

    // Mock network failure when room_id is 'fail' or 'offline-room'
    if (body?.room_id === 'offline-room') {
      return HttpResponse.json(
        { error: { code: 'SYS-503', message: 'Service unavailable' } },
        { status: 503 },
      );
    }

    return HttpResponse.json(
      {
        data: {
          id: 'meter-001',
          room_id: body?.room_id ?? 'room-1',
          billing_month: body?.billing_month ?? 6,
          billing_year: body?.billing_year ?? 2026,
          electric_previous: body?.electric_previous ?? 0,
          electric_current: body?.electric_current ?? 100,
          electric_used: (body?.electric_current as number ?? 100) - (body?.electric_previous as number ?? 0),
          water_previous: body?.water_previous ?? 0,
          water_current: body?.water_current ?? 50,
          water_used: (body?.water_current as number ?? 50) - (body?.water_previous as number ?? 0),
          read_date: new Date().toISOString().split('T')[0],
        },
      },
      { status: 201 },
    );
  }),

  // ── Invoice & Payment Handlers ─────────────────────────────────────

  http.post('*/api/v1/billing/invoices/generate', () => {
    return HttpResponse.json(
      {
        data: {
          id: 'inv-001',
          invoice_number: 'INV-2026-0001',
          contract_id: 'c1',
          room_id: 'r1',
          tenant_id: 't1',
          property_id: 'p1',
          billing_month: 6,
          billing_year: 2026,
          due_date: '2026-07-15',
          status: 'pending',
          total_amount: 15000,
          paid_amount: 0,
          notes: null,
          created_at: '2026-06-01T00:00:00Z',
        },
      },
      { status: 201 },
    );
  }),

  http.get('*/api/v1/billing/invoices/:id', () => {
    return HttpResponse.json({
      data: {
        invoice: {
          id: 'inv-001',
          invoice_number: 'INV-2026-0001',
          contract_id: 'c1',
          room_id: 'r1',
          tenant_id: 't1',
          property_id: 'p1',
          billing_month: 6,
          billing_year: 2026,
          due_date: '2026-07-15',
          status: 'pending',
          total_amount: 15000,
          paid_amount: 5000,
          notes: null,
          created_at: '2026-06-01T00:00:00Z',
        },
        line_items: [
          {
            id: 'li-1',
            invoice_id: 'inv-001',
            line_type: 'rent',
            description: 'Monthly rent for Room 101',
            quantity: 1,
            unit_price: 10000,
            amount: 10000,
          },
          {
            id: 'li-2',
            invoice_id: 'inv-001',
            line_type: 'electric',
            description: 'Electric usage 150 kWh',
            quantity: 150,
            unit_price: 8,
            amount: 1200,
          },
          {
            id: 'li-3',
            invoice_id: 'inv-001',
            line_type: 'water',
            description: 'Water usage 10 units',
            quantity: 10,
            unit_price: 30,
            amount: 300,
          },
          {
            id: 'li-4',
            invoice_id: 'inv-001',
            line_type: 'common_fee',
            description: 'Common area maintenance fee',
            quantity: 1,
            unit_price: 3500,
            amount: 3500,
          },
        ],
      },
    });
  }),

  http.post('*/api/v1/billing/payments', () => {
    return HttpResponse.json(
      {
        data: {
          id: 'pay-001',
          invoice_id: 'inv-001',
          amount: 5000,
          payment_date: '2026-06-15',
          method: 'cash',
          reference_number: null,
          slip_image_url: null,
          notes: null,
        },
      },
      { status: 201 },
    );
  }),

  // ── Dashboard Handlers ────────────────────────────────────────────────

  http.get('*/api/v1/dashboard/summary', () => {
    return HttpResponse.json({
      data: {
        total_rooms: 50,
        occupied_rooms: 42,
        occupancy_rate: 84,
        active_contracts: 38,
        total_revenue: 425000,
        overdue_invoices: 5,
        overdue_count: 5,
        overdue_amount: 78000,
        maintenance_count: 3,
      },
    });
  }),

  http.get('*/api/v1/dashboard/revenue', () => {
    return HttpResponse.json({
      data: [
        { period: '2026-01', collected: 380000, outstanding: 45000, total_billed: 425000 },
        { period: '2026-02', collected: 395000, outstanding: 42000, total_billed: 437000 },
        { period: '2026-03', collected: 410000, outstanding: 48000, total_billed: 458000 },
        { period: '2026-04', collected: 398000, outstanding: 44000, total_billed: 442000 },
        { period: '2026-05', collected: 425000, outstanding: 46000, total_billed: 471000 },
        { period: '2026-06', collected: 415000, outstanding: 43000, total_billed: 458000 },
      ],
    });
  }),

  http.get('*/api/v1/dashboard/occupancy', () => {
    return HttpResponse.json({
      data: {
        property_id: 'p1',
        total_rooms: 50,
        occupied_rooms: 42,
        occupancy_rate: 84,
        active_contracts: 38,
      },
    });
  }),

  // ── Maintenance Request Handlers ─────────────────────────────────────

  http.get('*/api/v1/maintenance/pending', ({ request }) => {
    const url = new URL(request.url);
    const propertyId = url.searchParams.get('property_id');
    const requests = [
      {
        id: 'maint-1',
        property_id: 'p1',
        room_id: 'r1',
        title: 'Leaking faucet',
        description: 'Kitchen faucet has been dripping for 3 days',
        priority: 'medium',
        status: 'pending',
        assigned_to: null,
        created_by: 'user-1',
        created_at: '2026-06-15T10:00:00Z',
        updated_at: '2026-06-15T10:00:00Z',
      },
      {
        id: 'maint-2',
        property_id: 'p1',
        room_id: 'r2',
        title: 'AC not cooling',
        description: 'Air conditioner in bedroom not cooling properly',
        priority: 'high',
        status: 'in_progress',
        assigned_to: 'tech-1',
        created_by: 'user-2',
        created_at: '2026-06-14T14:30:00Z',
        updated_at: '2026-06-15T09:00:00Z',
      },
    ];
    const filtered = propertyId
      ? requests.filter((r) => r.property_id === propertyId)
      : requests;
    return HttpResponse.json({ data: filtered, meta: null });
  }),

  http.get('*/api/v1/maintenance/:id', () => {
    return HttpResponse.json({
      data: {
        id: 'maint-1',
        property_id: 'p1',
        room_id: 'r1',
        title: 'Leaking faucet',
        description: 'Kitchen faucet has been dripping for 3 days',
        priority: 'medium',
        status: 'pending',
        assigned_to: null,
        created_by: 'user-1',
        created_at: '2026-06-15T10:00:00Z',
        updated_at: '2026-06-15T10:00:00Z',
      },
    });
  }),

  http.post('*/api/v1/maintenance', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(
      {
        data: {
          id: 'maint-new',
          property_id: body?.property_id ?? 'p1',
          room_id: body?.room_id ?? 'r1',
          title: body?.title ?? 'New Request',
          description: body?.description ?? 'Description',
          priority: body?.priority ?? 'medium',
          status: 'pending',
          assigned_to: null,
          created_by: 'user-1',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      },
      { status: 201 },
    );
  }),

  http.patch('*/api/v1/maintenance/:id/status', async ({ request }) => {
    const body = (await request.json()) as { status: string };
    return HttpResponse.json({
      data: {
        id: 'maint-1',
        property_id: 'p1',
        room_id: 'r1',
        title: 'Leaking faucet',
        description: 'Kitchen faucet has been dripping for 3 days',
        priority: 'medium',
        status: body?.status ?? 'in_progress',
        assigned_to: null,
        created_by: 'user-1',
        created_at: '2026-06-15T10:00:00Z',
        updated_at: new Date().toISOString(),
      },
    });
  }),

  http.patch('*/api/v1/maintenance/:id/assign', async ({ request }) => {
    const body = (await request.json()) as { assigned_to: string };
    return HttpResponse.json({
      data: {
        id: 'maint-1',
        property_id: 'p1',
        room_id: 'r1',
        title: 'Leaking faucet',
        description: 'Kitchen faucet has been dripping for 3 days',
        priority: 'medium',
        status: 'in_progress',
        assigned_to: body?.assigned_to ?? 'tech-1',
        created_by: 'user-1',
        created_at: '2026-06-15T10:00:00Z',
        updated_at: new Date().toISOString(),
      },
    });
  }),

  // ── Contract Handlers ────────────────────────────────────────────────

  http.get('*/api/v1/contracts/active', ({ request }) => {
    const url = new URL(request.url);
    const propertyId = url.searchParams.get('property_id');
    const contracts = [
      {
        id: 'c1',
        room_id: 'r1',
        tenant_id: 't1',
        property_id: 'p1',
        start_date: '2026-01-01',
        end_date: '2026-12-31',
        monthly_rent: '15000',
        deposit_amount: '30000',
        status: 'active',
        special_conditions: null,
        is_renewal: false,
        renewed_from_id: null,
        created_by: 'user-1',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        termination: null,
        extensions: [],
      },
      {
        id: 'c2',
        room_id: 'r2',
        tenant_id: 't2',
        property_id: 'p1',
        start_date: '2026-03-01',
        end_date: '2027-02-28',
        monthly_rent: '18000',
        deposit_amount: '36000',
        status: 'active',
        special_conditions: 'No pets allowed',
        is_renewal: false,
        renewed_from_id: null,
        created_by: 'user-1',
        created_at: '2026-03-01T00:00:00Z',
        updated_at: '2026-03-01T00:00:00Z',
        termination: null,
        extensions: [],
      },
    ];
    const filtered = propertyId
      ? contracts.filter((c) => c.property_id === propertyId)
      : contracts;
    return HttpResponse.json({ data: filtered, meta: null });
  }),

  http.get('*/api/v1/contracts/:id', () => {
    return HttpResponse.json({
      data: {
        id: 'c1',
        room_id: 'r1',
        tenant_id: 't1',
        property_id: 'p1',
        start_date: '2026-01-01',
        end_date: '2026-12-31',
        monthly_rent: '15000',
        deposit_amount: '30000',
        status: 'active',
        special_conditions: null,
        is_renewal: false,
        renewed_from_id: null,
        created_by: 'user-1',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        termination: null,
        extensions: [
          {
            id: 'ext-1',
            previous_end_date: '2025-12-31',
            extended_to: '2026-12-31',
            reason: 'Tenant requested extension',
            extended_by: 'user-1',
            created_at: '2025-12-01T00:00:00Z',
          },
        ],
      },
    });
  }),

  http.post('*/api/v1/contracts', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json(
      {
        data: {
          id: 'c-new',
          room_id: body?.room_id ?? 'r1',
          tenant_id: body?.tenant_id ?? 't1',
          property_id: body?.property_id ?? 'p1',
          start_date: body?.start_date ?? '2026-07-01',
          end_date: body?.end_date ?? '2026-12-31',
          monthly_rent: body?.monthly_rent ?? 15000,
          deposit_amount: body?.deposit_amount ?? 30000,
          status: 'active',
          special_conditions: body?.special_conditions ?? null,
          is_renewal: false,
          renewed_from_id: null,
          created_by: 'user-1',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          termination: null,
          extensions: [],
        },
      },
      { status: 201 },
    );
  }),

  http.patch('*/api/v1/contracts/:id/terminate', async ({ request }) => {
    const body = (await request.json()) as { reason: string; termination_date?: string; notes?: string };
    return HttpResponse.json({
      data: {
        id: 'c1',
        room_id: 'r1',
        tenant_id: 't1',
        property_id: 'p1',
        start_date: '2026-01-01',
        end_date: '2026-12-31',
        monthly_rent: '15000',
        deposit_amount: '30000',
        status: 'terminated',
        special_conditions: null,
        is_renewal: false,
        renewed_from_id: null,
        created_by: 'user-1',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: new Date().toISOString(),
        termination: {
          id: 'term-1',
          reason: body?.reason ?? 'tenant_request',
          termination_date: body?.termination_date ?? new Date().toISOString().split('T')[0],
          notes: body?.notes ?? null,
          terminated_by: 'user-1',
          created_at: new Date().toISOString(),
        },
        extensions: [],
      },
    });
  }),

  http.post('*/api/v1/contracts/:id/extend', async ({ request }) => {
    const body = (await request.json()) as { new_end_date: string; reason?: string };
    return HttpResponse.json({
      data: {
        id: 'c1',
        room_id: 'r1',
        tenant_id: 't1',
        property_id: 'p1',
        start_date: '2026-01-01',
        end_date: body?.new_end_date ?? '2027-06-30',
        monthly_rent: '15000',
        deposit_amount: '30000',
        status: 'active',
        special_conditions: null,
        is_renewal: false,
        renewed_from_id: null,
        created_by: 'user-1',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: new Date().toISOString(),
        termination: null,
        extensions: [
          {
            id: 'ext-new',
            previous_end_date: '2026-12-31',
            extended_to: body?.new_end_date ?? '2027-06-30',
            reason: body?.reason ?? 'Extension',
            extended_by: 'user-1',
            created_at: new Date().toISOString(),
          },
        ],
      },
    });
  }),

  http.post('*/api/v1/contracts/:id/renew', async ({ request }) => {
    const body = (await request.json()) as { new_start_date: string; new_end_date: string; new_monthly_rent: number; new_deposit_amount: number };
    return HttpResponse.json(
      {
        data: {
          id: 'c-renewed',
          room_id: 'r1',
          tenant_id: 't1',
          property_id: 'p1',
          start_date: body?.new_start_date ?? '2027-01-01',
          end_date: body?.new_end_date ?? '2027-12-31',
          monthly_rent: body?.new_monthly_rent ?? 16000,
          deposit_amount: body?.new_deposit_amount ?? 32000,
          status: 'active',
          special_conditions: null,
          is_renewal: true,
          renewed_from_id: 'c1',
          created_by: 'user-1',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          termination: null,
          extensions: [],
        },
      },
      { status: 201 },
    );
  }),

  http.get('*/api/v1/leases/:room_id/history', () => {
    return HttpResponse.json({
      data: [
        {
          id: 'c1',
          tenant_id: 't1',
          start_date: '2026-01-01',
          end_date: '2026-12-31',
          monthly_rent: '15000',
          status: 'active',
          is_renewal: false,
          created_at: '2026-01-01T00:00:00Z',
          termination_reason: null,
          termination_date: null,
        },
      ],
    });
  }),

  // ── Admin Handlers ───────────────────────────────────────────────────

  http.get('*/api/v1/admin/audit-logs', ({ request }) => {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') ?? '1');
    const limit = Number(url.searchParams.get('limit') ?? '20');
    const logs = [
      {
        id: 'audit-1',
        user_id: 'user-1',
        action: 'contract.created',
        resource_type: 'contract',
        resource_id: 'c1',
        property_id: 'p1',
        metadata: { room_id: 'r1', tenant_id: 't1' },
        ip_address: '192.168.1.100',
        timestamp: '2026-06-15T10:00:00Z',
      },
      {
        id: 'audit-2',
        user_id: 'user-1',
        action: 'maintenance.requested',
        resource_type: 'maintenance_request',
        resource_id: 'maint-1',
        property_id: 'p1',
        metadata: { room_id: 'r1', priority: 'medium' },
        ip_address: '192.168.1.100',
        timestamp: '2026-06-15T10:05:00Z',
      },
      {
        id: 'audit-3',
        user_id: 'user-2',
        action: 'payment.recorded',
        resource_type: 'payment',
        resource_id: 'pay-1',
        property_id: 'p1',
        metadata: { invoice_id: 'inv-1', amount: 15000 },
        ip_address: '192.168.1.101',
        timestamp: '2026-06-15T11:30:00Z',
      },
    ];
    const start = (page - 1) * limit;
    const paginated = logs.slice(start, start + limit);
    return HttpResponse.json({
      data: paginated,
      meta: { page, limit, total: logs.length, has_next: start + limit < logs.length },
    });
  }),

  http.get('*/api/v1/admin/config', () => {
    return HttpResponse.json({
      data: [
        { key: 'app.name', value: 'Property Management System', masked: false },
        { key: 'app.version', value: '1.0.0', masked: false },
        { key: 'billing.default_due_day', value: '5', masked: false },
        { key: 'billing.default_min_deposit_months', value: '2', masked: false },
        { key: 'notification.line.channel_access_token', value: '***', masked: true },
        { key: 'notification.email.smtp_password', value: '***', masked: true },
        { key: 'storage.minio.access_key', value: '***', masked: true },
        { key: 'storage.minio.secret_key', value: '***', masked: true },
        { key: 'database.url', value: '***', masked: true },
        { key: 'redis.url', value: '***', masked: true },
      ],
      meta: null,
    });
  }),

  http.patch('*/api/v1/admin/config/:key', async ({ request, params }) => {
    const body = (await request.json()) as { value: string };
    return HttpResponse.json({
      data: {
        key: params.key,
        value: body?.value ?? '',
        masked: ['token', 'password', 'secret', 'key'].some((s) =>
          (params.key as string).toLowerCase().includes(s),
        ),
      },
    });
  }),
];

export { handlers };