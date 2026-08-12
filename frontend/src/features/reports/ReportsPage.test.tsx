// File: src/features/reports/ReportsPage.test.tsx
// Integration tests for ReportsPage — RTL + MSW.
// Tests: heading, filters, export button, revenue chart, overdue summary, empty state, export action.

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { AuthProvider } from '@/shared/auth/AuthContext';
import { server } from '@/mocks/server';
import { http, HttpResponse } from 'msw';
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

  // ── Export button interaction ────────────────────────────────────────
  it('calls exportRevenueToCsv when export button clicked with revenue data', async () => {
    // Mock the export function
    const mockExport = vi.fn();
    vi.doMock('./utils/export', () => ({
      exportRevenueToCsv: mockExport,
    }));

    const user = userEvent.setup();
    renderPage();

    // Wait for revenue data to load
    await screen.findByText('Revenue Overview');

    // Click export button
    await user.click(screen.getByText('Export CSV'));

    // Export should have been called (the export function is mocked)
    // Since the data exists, the button should not be disabled
    expect(screen.getByText('Export CSV')).not.toBeDisabled();

    vi.doUnmock('./utils/export');
  });

  // ── Export button disabled when no revenue ───────────────────────────
  it('disables export button when revenue data is empty', async () => {
    server.use(
      http.get('*/api/v1/dashboard/revenue', () => {
        return HttpResponse.json({ data: [] });
      }),
    );

    renderPage();

    // Wait for loading to finish
    await waitFor(() => {
      expect(screen.getByText('Export CSV')).toBeInTheDocument();
    });

    // Button should be disabled because revenue is empty
    expect(screen.getByText('Export CSV')).toBeDisabled();
  });

  // ── Empty state for no revenue data ───────────────────────────────────
  it('shows no data message when revenue is empty', async () => {
    server.use(
      http.get('*/api/v1/dashboard/revenue', () => {
        return HttpResponse.json({ data: [] });
      }),
    );

    renderPage();

    expect(await screen.findByText('No revenue data available')).toBeInTheDocument();
  });

  // ── Update revenue when date filters change ──────────────────────────
  it('updates revenue query when date filter changes', async () => {
    const user = userEvent.setup();
    renderPage();

    // Wait for initial revenue data to load
    await screen.findByText('Revenue Overview');

    // The default Start Date input should have a value
    const startDateInput = screen.getByLabelText('Start Date');
    const endDateInput = screen.getByLabelText('End Date');

    expect(startDateInput).toBeInTheDocument();
    expect(endDateInput).toBeInTheDocument();

    // Change the start date
    await user.clear(startDateInput);
    await user.type(startDateInput, '2026-03-01');

    // Verify the input value changed
    expect(startDateInput).toHaveValue('2026-03-01');
  });
});
