// File: src/features/dashboard/DashboardPage.test.tsx
// Integration tests for DashboardPage — RTL + MSW.

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { AuthProvider } from '@/shared/auth/AuthContext';
import { server } from '@/mocks/server';
import DashboardPage from './DashboardPage';

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
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

  it('shows stat cards after loading', async () => {
    renderPage();
    expect(await screen.findByText('Occupancy')).toBeInTheDocument();
    expect(await screen.findByText('Monthly Revenue')).toBeInTheDocument();
    const overdue = await screen.findAllByText('Overdue');
    expect(overdue.length).toBeGreaterThanOrEqual(1);
    expect(await screen.findByText('Maintenance')).toBeInTheDocument();
  });

  it('shows occupancy rate from API', async () => {
    renderPage();
    expect(await screen.findByText('84%')).toBeInTheDocument();
  });

  it('shows overdue amount', async () => {
    renderPage();
    expect(await screen.findByText(/฿78,000/)).toBeInTheDocument();
  });
});