// File: src/features/billing/InvoiceDetailPage.test.tsx
// Integration tests for InvoiceDetailPage — RTL + MSW.

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { AuthProvider } from '@/shared/auth/AuthContext';
import { ToastProvider } from '@/shared/ui/Toast';
import { server } from '@/mocks/server';
import InvoiceDetailPage from './InvoiceDetailPage';

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={['/invoices/inv-001']}>
      <QueryClientProvider client={qc}>
        <AuthProvider>
          <ToastProvider>
            <Routes>
              <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
              <Route path="/invoices" element={<div>Invoice List</div>} />
            </Routes>
          </ToastProvider>
        </AuthProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('InvoiceDetailPage', () => {
  it('shows invoice number', async () => {
    renderPage();
    const items = await screen.findAllByText('INV-2026-0001');
    expect(items.length).toBeGreaterThanOrEqual(1);
  });

  it('shows line items', async () => {
    renderPage();
    expect(await screen.findByText('Monthly rent for Room 101')).toBeInTheDocument();
    expect(await screen.findByText('Electric usage 150 kWh')).toBeInTheDocument();
    expect(await screen.findByText('Common area maintenance fee')).toBeInTheDocument();
  });

  it('shows payment progress', async () => {
    renderPage();
    expect(await screen.findByText(/Payment Progress/i)).toBeInTheDocument();
  });

  it('opens payment modal', async () => {
    const user = userEvent.setup();
    renderPage();

    const btns = await screen.findAllByText('Record Payment');
    await user.click(btns[0]!);

    expect(await screen.findByText('Cash')).toBeInTheDocument(); // inside modal
  });

  it('shows remaining balance', async () => {
    renderPage();
    expect(await screen.findByText(/Remaining balance/i)).toBeInTheDocument();
  });
});