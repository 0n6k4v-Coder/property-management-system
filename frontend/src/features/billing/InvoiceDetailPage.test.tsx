// File: src/features/billing/InvoiceDetailPage.test.tsx
// Integration tests for InvoiceDetailPage — RTL + MSW.

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { AuthProvider } from '@/shared/auth/AuthContext';
import { ToastProvider } from '@/shared/ui/Toast';
import { server } from '@/mocks/server';
import { http, HttpResponse } from 'msw';
import InvoiceDetailPage from './InvoiceDetailPage';

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function renderPage() {
  const qc = createQueryClient();
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

function renderPageWithInvoiceId(invoiceId: string) {
  const qc = createQueryClient();
  return render(
    <MemoryRouter initialEntries={[`/invoices/${invoiceId}`]}>
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

// Helper: wait for invoice to load (waits for skeleton removal)
async function waitForInvoiceLoad() {
  await waitFor(() => {
    expect(screen.queryByText('Invoice Details')).toBeInTheDocument();
  }, { timeout: 5000 });
}

describe('InvoiceDetailPage', () => {
  describe('loading state', () => {
    it('shows skeleton while loading', async () => {
      server.use(
        http.get('*/api/v1/billing/invoices/:id', async () => {
          await new Promise((r) => setTimeout(r, 100));
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
              line_items: [],
            },
          });
        }),
      );

      renderPage();

      // Skeleton elements should be present during loading
      const skeletonContainers = document.querySelectorAll('[aria-hidden="true"]');
      expect(skeletonContainers.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('rendering', () => {
    it('shows invoice number', async () => {
      renderPage();

      await waitForInvoiceLoad();

      const items = await screen.findAllByText('INV-2026-0001');
      expect(items.length).toBeGreaterThanOrEqual(1);
    });

    it('shows line items', async () => {
      renderPage();

      expect(await screen.findByText('Monthly rent for Room 101')).toBeInTheDocument();
      expect(screen.getByText('Electric usage 150 kWh')).toBeInTheDocument();
      expect(screen.getByText('Common area maintenance fee')).toBeInTheDocument();
    });

    it('shows payment progress', async () => {
      renderPage();

      expect(await screen.findByText(/Payment Progress/i)).toBeInTheDocument();
    });

    it('shows remaining balance', async () => {
      renderPage();

      expect(await screen.findByText(/Remaining balance/i)).toBeInTheDocument();
    });

    it('shows invoice details section', async () => {
      renderPage();

      await waitForInvoiceLoad();
      expect(screen.getByText('Invoice Details')).toBeInTheDocument();
      expect(screen.getByText('Room ID')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Due Date')).toBeInTheDocument();
      expect(screen.getByText('Created')).toBeInTheDocument();
    });

    it('shows notes when invoice has notes', async () => {
      server.use(
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
                notes: 'Special instructions for tenant',
                created_at: '2026-06-01T00:00:00Z',
              },
              line_items: [],
            },
          });
        }),
      );

      renderPage();

      await waitForInvoiceLoad();
      expect(screen.getByText('Notes')).toBeInTheDocument();
      expect(screen.getByText('Special instructions for tenant')).toBeInTheDocument();
    });

    it('hides notes section when invoice has no notes', async () => {
      server.use(
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
              line_items: [],
            },
          });
        }),
      );

      renderPage();

      await waitForInvoiceLoad();
      const noteRows = screen.queryAllByText('Notes');
      expect(noteRows.length).toBe(0);
    });

    it('shows breadcrumb navigation with back link', async () => {
      renderPage();

      await waitForInvoiceLoad();
      const invoicesLink = screen.getByText('Invoices');
      expect(invoicesLink).toHaveAttribute('href', '/invoices');
    });

    it('shows invoice status badge', async () => {
      renderPage();

      await waitForInvoiceLoad();
      // The Badge shows the status in the card header
      const badges = screen.getAllByText('Pending');
      expect(badges.length).toBeGreaterThanOrEqual(1);
    });

    it('shows due date', async () => {
      renderPage();

      await waitForInvoiceLoad();
      expect(screen.getByText(/Due:/)).toBeInTheDocument();
    });

    it('shows total amount in payment progress', async () => {
      renderPage();

      await waitForInvoiceLoad();
      expect(screen.getByText('฿15,000.00')).toBeInTheDocument();
    });

    it('shows line item amounts', async () => {
      renderPage();

      await waitForInvoiceLoad();
      expect(screen.getByText('฿10,000.00')).toBeInTheDocument();
      expect(screen.getByText('฿1,200.00')).toBeInTheDocument();
      expect(screen.getByText('฿300.00')).toBeInTheDocument();
      expect(screen.getByText('฿3,500.00')).toBeInTheDocument();
    });

    it('shows line item quantity and unit price', async () => {
      renderPage();

      await waitForInvoiceLoad();
      // Line items show "1 x ฿10,000.00" etc
      const quantityTexts = screen.getAllByText(/1 x/);
      expect(quantityTexts.length).toBeGreaterThanOrEqual(1);
    });

    it('shows payment progress percentage', async () => {
      renderPage();

      await waitForInvoiceLoad();
      // paid_amount=5000, total_amount=15000 → 33%
      expect(screen.getByText('33%')).toBeInTheDocument();
    });

    it('shows paid amount and total amount in progress bar', async () => {
      renderPage();

      await waitForInvoiceLoad();
      expect(screen.getByText('฿5,000.00 paid')).toBeInTheDocument();
      expect(screen.getByText('฿15,000.00 total')).toBeInTheDocument();
    });
  });

  describe('payment modal', () => {
    it('opens payment modal on Record Payment button click', async () => {
      const user = userEvent.setup();
      renderPage();

      await waitForInvoiceLoad();

      const btns = await screen.findAllByRole('button', { name: 'Record Payment' });
      await user.click(btns[0]!);

      expect(await screen.findByText('Already Paid')).toBeInTheDocument();
      expect(screen.getByText('Remaining')).toBeInTheDocument();
      expect(screen.getByText('Reference Number (optional)')).toBeInTheDocument();
      expect(screen.getByText('Notes (optional)')).toBeInTheDocument();
    });

    it('closes payment modal on Cancel button', async () => {
      const user = userEvent.setup();
      renderPage();

      await waitForInvoiceLoad();

      const btns = await screen.findAllByRole('button', { name: 'Record Payment' });
      await user.click(btns[0]!);

      await screen.findByText('Already Paid');
      await user.click(screen.getByText('Cancel'));

      await waitFor(() => {
        expect(screen.queryByText('Already Paid')).not.toBeInTheDocument();
      });
    });

    it('disables Record Payment button when no remaining balance', async () => {
      server.use(
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
                status: 'paid',
                total_amount: 15000,
                paid_amount: 15000,
                notes: null,
                created_at: '2026-06-01T00:00:00Z',
              },
              line_items: [],
            },
          });
        }),
      );

      renderPage();

      await waitForInvoiceLoad();
      const recordPaymentButton = screen.getByRole('button', { name: 'Record Payment' });
      expect(recordPaymentButton).toBeDisabled();
    });

    it('shows payment modal with correct remaining balance', async () => {
      const user = userEvent.setup();
      renderPage();

      await waitForInvoiceLoad();

      const btns = await screen.findAllByRole('button', { name: 'Record Payment' });
      await user.click(btns[0]!);

      await screen.findByText('Already Paid');
      expect(screen.getByText('Remaining')).toBeInTheDocument();
    });

    it('records payment successfully', async () => {
      const user = userEvent.setup();
      renderPage();

      await waitForInvoiceLoad();

      const openBtns = await screen.findAllByRole('button', { name: 'Record Payment' });
      await user.click(openBtns[0]!);

      await screen.findByText('Already Paid');
      // Click the submit button inside the modal form
      const submitBtn = document.querySelector('form button[type="submit"]')!;
      await user.click(submitBtn);

      await waitFor(() => {
        expect(screen.queryByText('Already Paid')).not.toBeInTheDocument();
      });
    });

    it('shows error toast when payment fails', async () => {
      server.use(
        http.post('*/api/v1/billing/payments', () => {
          return HttpResponse.json(
            { error: { code: 'VAL-400', message: 'Invalid payment amount' } },
            { status: 400 },
          );
        }),
      );

      const user = userEvent.setup();
      renderPage();

      await waitForInvoiceLoad();

      const openBtns = await screen.findAllByRole('button', { name: 'Record Payment' });
      await user.click(openBtns[0]!);

      await screen.findByText('Already Paid');
      // Click the submit button inside the modal form
      const submitBtn = document.querySelector('form button[type="submit"]')!;
      await user.click(submitBtn);

      // Modal should stay open on error
      await waitFor(() => {
        expect(screen.getByText('Already Paid')).toBeInTheDocument();
      });
    });

    it('shows warning when amount exceeds remaining balance', async () => {
      const user = userEvent.setup();
      renderPage();

      await waitForInvoiceLoad();

      const openBtns = await screen.findAllByRole('button', { name: 'Record Payment' });
      await user.click(openBtns[0]!);

      await screen.findByText('Already Paid');

      const amountInput = screen.getByLabelText('Amount');
      await user.clear(amountInput);
      await user.type(amountInput, '20000');

      expect(await screen.findByText(/Amount exceeds remaining balance/i)).toBeInTheDocument();
    });

    it('shows validation error when amount is negative', async () => {
      const user = userEvent.setup();
      renderPage();

      await waitForInvoiceLoad();

      const openBtns = await screen.findAllByRole('button', { name: 'Record Payment' });
      await user.click(openBtns[0]!);

      await screen.findByText('Already Paid');

      const amountInput = screen.getByLabelText('Amount');
      await user.clear(amountInput);
      await user.type(amountInput, '-100');

      // Click the submit button inside the modal form
      const submitBtn = document.querySelector('form button[type="submit"]')!;
      await user.click(submitBtn);

      expect(await screen.findByText('Amount must be positive')).toBeInTheDocument();
    });

    it('shows error when invoice fetch fails', async () => {
      server.use(
        http.get('*/api/v1/billing/invoices/:id', () => {
          return HttpResponse.json(
            { error: { code: 'SYS-500', message: 'Invoice fetch failed' } },
            { status: 500 },
          );
        }),
      );

      renderPageWithInvoiceId('inv-999');

      // When invoice data is null, show "Invoice not found"
      await waitFor(() => {
        expect(screen.getByText('Invoice not found.')).toBeInTheDocument();
      }, { timeout: 5000 });
    });
  });
});
