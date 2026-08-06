// File: src/features/billing/InvoiceListPage.test.tsx
// Integration tests for InvoiceListPage — RTL + MSW.

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { AuthProvider } from '@/shared/auth/AuthContext';
import { ToastProvider } from '@/shared/ui/Toast';
import { server } from '@/mocks/server';
import InvoiceListPage from './InvoiceListPage';

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={['/invoices']}>
      <QueryClientProvider client={qc}>
        <AuthProvider>
          <ToastProvider>
            <InvoiceListPage />
          </ToastProvider>
        </AuthProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('InvoiceListPage', () => {
  it('renders page heading', () => {
    renderPage();
    expect(screen.getByText('Invoices')).toBeInTheDocument();
  });

  it('shows empty state when no invoices', async () => {
    renderPage();

    // Wait for skeleton loader (animate-pulse) to disappear
    await waitFor(() => {
      expect(screen.queryByText(/animate-pulse/i)).not.toBeInTheDocument();
    }, { timeout: 5000 });

    expect(await screen.findByText(/No invoices found/i)).toBeInTheDocument();
  });

  it('has generate invoice button', () => {
    renderPage();
    expect(screen.getByText('Generate Invoice')).toBeInTheDocument();
  });

  it('shows export buttons', () => {
    renderPage();
    expect(screen.getByText('Export CSV')).toBeInTheDocument();
    expect(screen.getByText('Export TXT')).toBeInTheDocument();
  });

  it('opens generate modal on button click', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByText('Generate Invoice'));
    expect(await screen.findByText('Billing Month')).toBeInTheDocument(); // inside modal
  });
});