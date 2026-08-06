// File: src/features/tenant/TenantListPage.test.tsx
// Integration tests for TenantListPage — RTL + MSW.

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { AuthProvider } from '@/shared/auth/AuthContext';
import { ToastProvider } from '@/shared/ui/Toast';
import { server } from '@/mocks/server';
import { http, HttpResponse } from 'msw';
import TenantListPage from './TenantListPage';

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
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
});