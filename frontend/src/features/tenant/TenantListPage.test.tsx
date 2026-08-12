// File: src/features/tenant/TenantListPage.test.tsx
// Integration tests for TenantListPage — RTL + MSW.
// Tests: heading, search, create modal, search results, pagination, empty states, validation.

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { AuthProvider } from '@/shared/auth/AuthContext';
import { ToastProvider } from '@/shared/ui/Toast';
import { server } from '@/mocks/server';
import { http, HttpResponse } from 'msw';
import TenantListPage from './TenantListPage';

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return render(
    <MemoryRouter initialEntries={['/tenants']}>
      <QueryClientProvider client={qc}>
        <AuthProvider>
          <ToastProvider>
            <TenantListPage />
          </ToastProvider>
        </AuthProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('TenantListPage', () => {
  it('renders page heading', () => {
    renderPage();
    expect(screen.getByText('Tenants')).toBeInTheDocument();
  });

  it('shows search input', () => {
    renderPage();
    expect(screen.getByLabelText('Search tenants')).toBeInTheDocument();
  });

  it('shows create tenant modal trigger', () => {
    renderPage();
    expect(screen.getByText('New Tenant')).toBeInTheDocument();
  });

  it('searches and displays tenant results', async () => {
    server.use(
      http.get('*/api/v1/tenants/search', ({ request }) => {
        const url = new URL(request.url);
        const q = url.searchParams.get('query');
        return HttpResponse.json({
          data: q
            ? [
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
              ]
            : [],
          meta: { page: 1, limit: 20, total: 1, has_next: false },
        });
      }),
    );

    const user = userEvent.setup();
    renderPage();

    // Wait for skeleton loader (animate-pulse) to disappear
    await waitFor(() => {
      expect(screen.queryByText(/animate-pulse/i)).not.toBeInTheDocument();
    }, { timeout: 5000 });

    const input = screen.getByLabelText('Search tenants');
    await user.type(input, 'John');

    expect(await screen.findByText('John Doe')).toBeInTheDocument();
    expect(await screen.findByText('0812345678')).toBeInTheDocument();
    expect(await screen.findByText('john@example.com')).toBeInTheDocument();
  });

  it('opens create tenant modal', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByText('New Tenant'));
    expect(await screen.findByText('Create Tenant')).toBeInTheDocument();
  });

  // ── No results found test ─────────────────────────────────────────────
  it('shows no results message when search returns empty', async () => {
    server.use(
      http.get('*/api/v1/tenants/search', () => {
        return HttpResponse.json({
          data: [],
          meta: { page: 1, limit: 20, total: 0, has_next: false },
        });
      }),
    );

    const user = userEvent.setup();
    renderPage();

    const input = screen.getByLabelText('Search tenants');
    await user.type(input, 'nonexistent');

    // Wait for search to complete and empty state to show
    expect(await screen.findByText(/No tenants found matching/i)).toBeInTheDocument();
  });

  // ── Short query message test ──────────────────────────────────────────
  it('shows hint when search query is too short', () => {
    renderPage();
    // With debouncedQuery < 3 chars and not loading, shows hint
    expect(screen.getByText('Type at least 3 characters to search')).toBeInTheDocument();
  });

  // ── Tenants with null emergency contact test ──────────────────────────
  it('shows null values as em-dash in tenant table', async () => {
    server.use(
      http.get('*/api/v1/tenants/search', ({ request }) => {
        const url = new URL(request.url);
        const q = url.searchParams.get('query');
        return HttpResponse.json({
          data: q
            ? [
                {
                  id: 't1',
                  property_id: 'p1',
                  full_name: 'Jane Smith',
                  phone: '0898765432',
                  email: null,
                  emergency_contact_name: null,
                  emergency_contact_phone: null,
                  created_at: '2026-02-01T00:00:00Z',
                },
              ]
            : [],
          meta: { page: 1, limit: 20, total: 1, has_next: false },
        });
      }),
    );

    const user = userEvent.setup();
    renderPage();

    const input = screen.getByLabelText('Search tenants');
    await user.type(input, 'Jane');

    expect(await screen.findByText('Jane Smith')).toBeInTheDocument();
    // Null email shows as em-dash
    const emDashCells = screen.getAllByText('—');
    expect(emDashCells.length).toBeGreaterThanOrEqual(1);
  });

  // ── Pagination Next button test ──────────────────────────────────────
  it('shows Next button as disabled when has_next is false', async () => {
    server.use(
      http.get('*/api/v1/tenants/search', ({ request }) => {
        const url = new URL(request.url);
        const q = url.searchParams.get('query');
        return HttpResponse.json({
          data: q
            ? [
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
              ]
            : [],
          meta: { page: 1, limit: 20, total: 1, has_next: false },
        });
      }),
    );

    const user = userEvent.setup();
    renderPage();

    const input = screen.getByLabelText('Search tenants');
    await user.type(input, 'John');

    await screen.findByText('John Doe');

    // Next button should be disabled (has_next is false)
    const nextButton = screen.getByText('Next');
    expect(nextButton).toBeDisabled();
  });

  // ── Pagination Previous button test ──────────────────────────────────
  it('shows Previous button as disabled on first page', async () => {
    server.use(
      http.get('*/api/v1/tenants/search', ({ request }) => {
        const url = new URL(request.url);
        const q = url.searchParams.get('query');
        return HttpResponse.json({
          data: q
            ? [
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
              ]
            : [],
          meta: { page: 1, limit: 20, total: 1, has_next: false },
        });
      }),
    );

    const user = userEvent.setup();
    renderPage();

    const input = screen.getByLabelText('Search tenants');
    await user.type(input, 'John');

    await screen.findByText('John Doe');

    // Previous button should be disabled on page 1
    const prevButton = screen.getByText('Previous');
    expect(prevButton).toBeDisabled();
  });

  // ── CreateTenantModal form submission ─────────────────────────────────
  it('shows validation errors when creating tenant with empty fields', async () => {
    const user = userEvent.setup();
    renderPage();

    // Open modal
    await user.click(screen.getByText('New Tenant'));
    expect(await screen.findByText('Create Tenant')).toBeInTheDocument();

    // Click Create without filling fields
    await user.click(screen.getByRole('button', { name: 'Create' }));

    // Should show validation error for full name
    expect(await screen.findByText('Full name is required')).toBeInTheDocument();
  });

  // ── CreateTenantModal successful creation ─────────────────────────────
  it('creates tenant successfully with valid data', async () => {
    const user = userEvent.setup();
    renderPage();

    // Open modal
    await user.click(screen.getByText('New Tenant'));
    expect(await screen.findByText('Create Tenant')).toBeInTheDocument();

    // Fill in valid form data
    await user.type(screen.getByLabelText('Full Name'), 'Test Tenant');
    await user.type(screen.getByLabelText('ID Card (13 digits)'), '1234567890121');
    await user.type(screen.getByLabelText('Phone (10 digits)'), '0812345678');
    await user.type(screen.getByLabelText('Email (optional)'), 'test@example.com');

    await user.click(screen.getByRole('button', { name: 'Create' }));

    // Should show success toast and close modal
    expect(await screen.findByText('Tenant created successfully')).toBeInTheDocument();
  });

  // ── CreateTenantModal cancel ─────────────────────────────────────────
  it('closes create modal when cancel clicked', async () => {
    const user = userEvent.setup();
    renderPage();

    // Open modal
    await user.click(screen.getByText('New Tenant'));
    expect(await screen.findByText('Create Tenant')).toBeInTheDocument();

    // Click cancel
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    // Modal should be closed
    expect(screen.queryByText('Create Tenant')).not.toBeInTheDocument();
  });

  // ── CreateTenantModal API error ───────────────────────────────────────
  it('shows error toast when create tenant API fails', async () => {
    server.use(
      http.post('*/api/v1/tenants', () => {
        return HttpResponse.json(
          { error: { code: 'VAL-400', message: 'Name already exists' } },
          { status: 400 },
        );
      }),
    );

    const user = userEvent.setup();
    renderPage();

    // Open modal
    await user.click(screen.getByText('New Tenant'));
    expect(await screen.findByText('Create Tenant')).toBeInTheDocument();

    // Fill in valid form data
    await user.type(screen.getByLabelText('Full Name'), 'Duplicate Name');
    await user.type(screen.getByLabelText('ID Card (13 digits)'), '1234567890121');
    await user.type(screen.getByLabelText('Phone (10 digits)'), '0812345678');

    await user.click(screen.getByRole('button', { name: 'Create' }));

    // Should show error toast
    expect(await screen.findByText('Name already exists')).toBeInTheDocument();
  });

  // ── ID card validation error ─────────────────────────────────────────
  it('shows validation error for invalid ID card checksum', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByText('New Tenant'));
    expect(await screen.findByText('Create Tenant')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Full Name'), 'Test Tenant');
    // Invalid checksum ID (13 digits but wrong checksum)
    await user.type(screen.getByLabelText('ID Card (13 digits)'), '1234567890123');
    await user.type(screen.getByLabelText('Phone (10 digits)'), '0812345678');

    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(await screen.findByText(/Invalid ID card checksum/i)).toBeInTheDocument();
  });

  // ── Phone validation error ───────────────────────────────────────────
  it('shows validation error for invalid phone format', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByText('New Tenant'));
    expect(await screen.findByText('Create Tenant')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Full Name'), 'Test Tenant');
    await user.type(screen.getByLabelText('ID Card (13 digits)'), '1234567890121');
    // Invalid phone (not 10 digits starting with 0)
    await user.type(screen.getByLabelText('Phone (10 digits)'), '12345');

    await user.click(screen.getByRole('button', { name: 'Create' }));

    expect(await screen.findByText(/Phone must be 10 digits/i)).toBeInTheDocument();
  });
});
