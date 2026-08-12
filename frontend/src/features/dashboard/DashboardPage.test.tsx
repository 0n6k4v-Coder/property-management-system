// File: src/features/dashboard/DashboardPage.test.tsx
// Integration tests for DashboardPage — RTL + MSW.
// Tests: stat cards, overdue table, error state, loading states.

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { AuthProvider } from '@/shared/auth/AuthContext';
import { server } from '@/mocks/server';
import { http, HttpResponse } from 'msw';
import DashboardPage from './DashboardPage';

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <QueryClientProvider client={qc}>
        <AuthProvider>
          <DashboardPage />
        </AuthProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('DashboardPage', () => {
  it('renders heading', () => {
    renderPage();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('shows stat card labels after loading', async () => {
    renderPage();
    expect(await screen.findByText('Occupancy')).toBeInTheDocument();
    expect(await screen.findByText('Monthly Revenue')).toBeInTheDocument();
    expect(screen.getAllByText('Overdue').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Maintenance')).toBeInTheDocument();
  });

  it('shows occupancy rate and room count from API', async () => {
    renderPage();
    expect(await screen.findByText('84%')).toBeInTheDocument();
    // Delta text is split by elements; use a function matcher
    expect(await screen.findByText(/42\/50 rooms/i)).toBeInTheDocument();
  });

  it('shows overdue count and formatted amount', async () => {
    renderPage();
    expect(await screen.findByText('5')).toBeInTheDocument();
    // Delta shows formatted currency
    expect(screen.getAllByText(/฿78,000/).length).toBeGreaterThanOrEqual(1);
  });

  it('shows revenue amount formatted as currency', async () => {
    renderPage();
    expect(await screen.findByText('฿425,000.00')).toBeInTheDocument();
  });

  it('shows maintenance count', async () => {
    // Override handler to ensure pending_maintenance is returned
    server.use(
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
            pending_maintenance: 3,
          },
        });
      }),
    );

    renderPage();

    // The Maintenance stat card value should be String(3)
    const maintenanceCard = await screen.findByText('Maintenance');
    const cardElement = maintenanceCard.closest('[class*="rounded-xl"]');
    expect(cardElement?.textContent).toContain('3');
  });

  it('shows error message and retry button when API fails', async () => {
    server.use(
      http.get('*/api/v1/dashboard/summary', () => {
        return HttpResponse.json(
          { error: { code: 'SYS-500', message: 'Internal server error' } },
          { status: 500 },
        );
      }),
    );

    renderPage();

    expect(await screen.findByText(/Failed to load dashboard/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
  });

  it('renders overdue invoice table with data', async () => {
    renderPage();

    await screen.findByText('Overdue Invoices');

    expect(await screen.findByText('INV-2026-0001')).toBeInTheDocument();
    expect(await screen.findByText('Demo Tenant')).toBeInTheDocument();
    expect(screen.getAllByText(/฿15,000/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('15 Jun 2026')).toBeInTheDocument();
    expect(screen.getByText('14d')).toBeInTheDocument();
    expect(screen.getByText('View')).toBeInTheDocument();
  });

  it('shows delta text on Monthly Revenue stat card', async () => {
    renderPage();
    expect(await screen.findByText('↑ vs last month')).toBeInTheDocument();
  });

  it('shows downward arrow for overdue delta', async () => {
    renderPage();
    // Overdue card delta uses formatCurrency(78000) = ฿78,000
    expect(await screen.findByText(/↓ .*฿78,000/)).toBeInTheDocument();
  });
});
