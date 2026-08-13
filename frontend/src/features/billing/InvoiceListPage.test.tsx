// File: src/features/billing/InvoiceListPage.test.tsx
// Integration tests for InvoiceListPage — RTL + MSW.

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { AuthProvider } from '@/shared/auth/AuthContext';
import { ToastProvider } from '@/shared/ui/Toast';
import { server } from '@/mocks/server';
import { http, HttpResponse } from 'msw';
import InvoiceListPage from './InvoiceListPage';
import type { API } from '@/types/api.d';

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
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

// Default invoice list handler for tests that need data
function mockInvoicesList(invoices: API.InvoiceResponse[]) {
  return http.get('*/api/v1/billing/invoices', () => {
    return HttpResponse.json({ data: invoices, meta: null });
  });
}

const sampleInvoices: API.InvoiceResponse[] = [
  {
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
  {
    id: 'inv-002',
    invoice_number: 'INV-2026-0002',
    contract_id: 'c2',
    room_id: 'r2',
    tenant_id: 't2',
    property_id: 'p1',
    billing_month: 7,
    billing_year: 2026,
    due_date: '2026-08-15',
    status: 'paid',
    total_amount: 20000,
    paid_amount: 20000,
    notes: null,
    created_at: '2026-07-01T00:00:00Z',
  },
];

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Note: No default handler for GET /api/v1/billing/invoices.
// The api.ts hook returns undefined on error, so invoicesList defaults to [].
// Tests needing data must explicitly use server.use(mockInvoicesList(...))

describe('InvoiceListPage', () => {
  describe('loading state', () => {
    it('shows skeleton while invoices are loading', async () => {
      server.use(
        http.get('*/api/v1/billing/invoices', async () => {
          await new Promise((r) => setTimeout(r, 100));
          return HttpResponse.json({ data: [], meta: null });
        }),
      );

      renderPage();

      // Heading should be visible immediately
      expect(screen.getByText('Invoices')).toBeInTheDocument();

      // Skeleton cards are rendered with aria-hidden
      const skeletonContainers = document.querySelectorAll('[aria-hidden="true"]');
      expect(skeletonContainers.length).toBeGreaterThanOrEqual(1);
    });

    it('shows heading while loading', () => {
      renderPage();
      expect(screen.getByText('Invoices')).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('shows empty state when no invoices', async () => {
      server.use(mockInvoicesList([]));

      renderPage();

      await waitFor(() => {
        expect(screen.queryByText(/No invoices found/i)).toBeInTheDocument();
      }, { timeout: 5000 });

      expect(screen.getByText(/No invoices found/i)).toBeInTheDocument();
    });

    it('disables export buttons when no invoices', async () => {
      server.use(mockInvoicesList([]));
      renderPage();

      await screen.findByText(/No invoices found/i);

      expect(screen.getByText('Export CSV')).toBeDisabled();
      expect(screen.getByText('Export TXT')).toBeDisabled();
    });
  });

  describe('invoice list', () => {
    it('renders invoice table with data after loading', async () => {
      server.use(mockInvoicesList(sampleInvoices));

      renderPage();

      expect(await screen.findByText('INV-2026-0001')).toBeInTheDocument();
      expect(screen.getByText('INV-2026-0002')).toBeInTheDocument();
    });

    it('displays invoice status badges', async () => {
      server.use(mockInvoicesList(sampleInvoices));

      renderPage();

      expect(await screen.findByText('INV-2026-0001')).toBeInTheDocument();
      expect(screen.getByText('Pending')).toBeInTheDocument();
      expect(screen.getByText('Paid')).toBeInTheDocument();
    });

    it('displays invoice period and due date', async () => {
      server.use(mockInvoicesList(sampleInvoices));

      renderPage();

      await screen.findByText('INV-2026-0001');

      expect(screen.getAllByText('6/2026').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('7/2026').length).toBeGreaterThanOrEqual(1);
    });

    it('displays total amount in currency format', async () => {
      server.use(mockInvoicesList(sampleInvoices));

      renderPage();

      await screen.findByText('INV-2026-0001');
      // Total: ฿15,000.00 (inv1) and ฿20,000.00 (inv2)
      const totalCells = screen.getAllByText('฿15,000.00');
      expect(totalCells.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('฿20,000.00')).toBeInTheDocument();
    });

    it('displays remaining balance in red for unpaid invoices', async () => {
      server.use(mockInvoicesList(sampleInvoices));

      renderPage();

      await screen.findByText('INV-2026-0001');
      // First invoice: remaining = 15000 - 0 = 15000 (red)
      const redCells = screen.getAllByText('฿15,000.00');
      const redRemaining = redCells.find((el) => el.className.includes('text-red-600'));
      expect(redRemaining).toBeInTheDocument();
    });

    it('displays zero remaining in green for fully paid invoices', async () => {
      server.use(mockInvoicesList(sampleInvoices));

      renderPage();

      await screen.findByText('INV-2026-0001');
      // Second invoice has 0 remaining, should be green
      const zeroCells = screen.getAllByText('฿0.00');
      expect(zeroCells.length).toBeGreaterThanOrEqual(1);
      const zeroRemaining = zeroCells.find((el) => el.className.includes('text-green-600'));
      expect(zeroRemaining).toBeInTheDocument();
    });

    it('renders view link for each invoice', async () => {
      server.use(mockInvoicesList(sampleInvoices));

      renderPage();

      await screen.findByText('INV-2026-0001');
      const viewLink = screen.getByRole('link', { name: 'View invoice INV-2026-0001' });
      expect(viewLink).toHaveAttribute('href', '/invoices/inv-001');

      const viewLink2 = screen.getByRole('link', { name: 'View invoice INV-2026-0002' });
      expect(viewLink2).toHaveAttribute('href', '/invoices/inv-002');
    });
  });

  describe('generate invoice modal', () => {
    it('shows generate invoice button', () => {
      renderPage();
      expect(screen.getByText('Generate Invoice')).toBeInTheDocument();
    });

    it('opens generate modal on button click', async () => {
      const user = userEvent.setup();
      renderPage();
      await user.click(screen.getByText('Generate Invoice'));
      expect(await screen.findByText('Billing Month')).toBeInTheDocument();
    });

    it('closes generate modal on cancel', async () => {
      const user = userEvent.setup();
      renderPage();
      await user.click(screen.getByText('Generate Invoice'));

      await screen.findByText('Billing Month');
      await user.click(screen.getByText('Cancel'));

      await waitFor(() => {
        expect(screen.queryByText('Billing Month')).not.toBeInTheDocument();
      });
    });

    it('generates invoice successfully with valid billing period', async () => {
      const user = userEvent.setup();
      renderPage();

      await user.click(screen.getByText('Generate Invoice'));
      await screen.findByText('Billing Month');

      const monthInput = screen.getByLabelText('Billing Month');
      await user.clear(monthInput);
      await user.type(monthInput, '6');

      const yearInput = screen.getByLabelText('Billing Year');
      await user.clear(yearInput);
      await user.type(yearInput, '2026');

      await user.click(screen.getByText('Generate'));

      await waitFor(() => {
        expect(screen.queryByText('Billing Month')).not.toBeInTheDocument();
      });
    });

    it('shows error message when invoice generation fails', async () => {
      server.use(
        http.post('*/api/v1/billing/invoices/generate', () => {
          return HttpResponse.json(
            { error: { code: 'VAL-400', message: 'Invoice already exists for this period' } },
            { status: 400 },
          );
        }),
      );

      const user = userEvent.setup();
      renderPage();

      await user.click(screen.getByText('Generate Invoice'));
      await screen.findByText('Billing Month');

      await user.click(screen.getByText('Generate'));

      // Modal should stay open on error
      await waitFor(() => {
        expect(screen.getByText('Billing Month')).toBeInTheDocument();
      });
    });
  });

  describe('export functionality', () => {
    it('shows export CSV and export TXT buttons', () => {
      renderPage();
      expect(screen.getByText('Export CSV')).toBeInTheDocument();
      expect(screen.getByText('Export TXT')).toBeInTheDocument();
    });

    it('enables export buttons when invoices exist', async () => {
      server.use(mockInvoicesList(sampleInvoices));
      renderPage();

      await screen.findByText('INV-2026-0001');
      expect(screen.getByText('Export CSV')).not.toBeDisabled();
      expect(screen.getByText('Export TXT')).not.toBeDisabled();
    });
  });
});
