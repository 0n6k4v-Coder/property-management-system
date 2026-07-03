// File: src/features/reports/ReportsPage.test.tsx
// Integration tests for ReportsPage — RTL + MSW.

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { AuthProvider } from '@/shared/auth/AuthContext';
import { server } from '@/mocks/server';
import ReportsPage from './ReportsPage';

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={['/reports']}>
      <QueryClientProvider client={qc}>
        <AuthProvider>
          <ReportsPage />
        </AuthProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('ReportsPage', () => {
  it('renders heading', () => {
    renderPage();
    expect(screen.getByText('Reports')).toBeInTheDocument();
  });

  it('shows date filter inputs', () => {
    renderPage();
    expect(screen.getByText('Start Date')).toBeInTheDocument();
    expect(screen.getByText('End Date')).toBeInTheDocument();
  });

  it('shows export button', () => {
    renderPage();
    expect(screen.getByText('Export CSV')).toBeInTheDocument();
  });

  it('shows revenue chart section', async () => {
    renderPage();
    expect(await screen.findByText('Revenue Overview')).toBeInTheDocument();
  });

  it('shows overdue summary', async () => {
    renderPage();
    expect(await screen.findByText('Overdue Summary')).toBeInTheDocument();
  });
});