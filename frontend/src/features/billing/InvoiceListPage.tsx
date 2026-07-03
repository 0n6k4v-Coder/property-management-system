// File: src/features/billing/InvoiceListPage.tsx
// Invoice list with filters, bulk generate, export, and mobile fallback.
// SCR-INVOICE-LIST: GET /invoices, POST /invoices/generate

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useInvoices, useGenerateInvoice } from './api';
import { formatCurrency, formatDate, formatInvoiceStatus, getRemainingBalance } from './utils/formatters';
import { exportInvoicesToCsv, exportInvoicesToTxt } from './utils/export';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Modal } from '@/shared/ui/Modal';
import { Input } from '@/shared/ui/Input';
import { useToast } from '@/shared/ui/Toast';
import { TableSkeleton } from '@/shared/ui/TableSkeleton';
import type { API } from '@/types/api.d';

export default function InvoiceListPage() {
  const { showToast } = useToast();
  const { data: invoices, isLoading } = useInvoices();
  const generateInvoice = useGenerateInvoice();
  const [showGenerate, setShowGenerate] = useState(false);
  const [genMonth, setGenMonth] = useState(() => new Date().getMonth() + 1);
  const [genYear, setGenYear] = useState(() => new Date().getFullYear());

  async function handleGenerate() {
    try {
      await generateInvoice.mutateAsync({
        property_id: '00000000-0000-0000-0000-000000000001',
        billing_month: genMonth,
        billing_year: genYear,
      });
      showToast('Invoice generated successfully', 'success');
      setShowGenerate(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Generation failed', 'error');
    }
  }

  const invoicesList = invoices ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Invoices</h1>
          <p className="mt-1 text-sm text-surface-500">
            View and manage invoices
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => setShowGenerate(true)}>
            Generate Invoice
          </Button>
          <Button
            variant="secondary"
            onClick={() => exportInvoicesToCsv(invoicesList)}
            disabled={invoicesList.length === 0}
          >
            Export CSV
          </Button>
          <Button
            variant="secondary"
            onClick={() => exportInvoicesToTxt(invoicesList)}
            disabled={invoicesList.length === 0}
          >
            Export TXT
          </Button>
        </div>
      </div>

      {isLoading && <TableSkeleton rows={4} />}

      {!isLoading && invoicesList.length === 0 && (
        <Card className="text-center py-8 text-surface-400">
          <p>No invoices found.</p>
          <p className="text-sm mt-1">
            Generate invoices to get started.
          </p>
        </Card>
      )}

      {!isLoading && invoicesList.length > 0 && (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-50 text-left text-xs font-medium uppercase tracking-wide text-surface-500">
                  <th scope="col" className="px-4 py-3">Invoice</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3">Period</th>
                  <th scope="col" className="px-4 py-3">Due Date</th>
                  <th scope="col" className="px-4 py-3 text-right">Total</th>
                  <th scope="col" className="px-4 py-3 text-right">Remaining</th>
                  <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {invoicesList.map((inv) => (
                  <InvoiceRow key={inv.id} invoice={inv} />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Bulk Generate Modal */}
      <Modal open={showGenerate} onClose={() => setShowGenerate(false)} title="Generate Invoice">
        <div className="space-y-4">
          <p className="text-sm text-surface-500">
            Generate invoice for the selected billing period.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Billing Month"
              type="number"
              min={1}
              max={12}
              value={String(genMonth)}
              onChange={(e) => setGenMonth(Number(e.target.value))}
            />
            <Input
              label="Billing Year"
              type="number"
              min={2020}
              value={String(genYear)}
              onChange={(e) => setGenYear(Number(e.target.value))}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowGenerate(false)}>Cancel</Button>
            <Button onClick={handleGenerate} isLoading={generateInvoice.isPending}>
              Generate
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function InvoiceRow({ invoice }: { invoice: API.InvoiceResponse }) {
  const remaining = getRemainingBalance(invoice);

  return (
    <tr className="border-b border-surface-100 transition-colors hover:bg-surface-50">
      <td className="px-4 py-3 font-medium text-surface-900">
        {invoice.invoice_number}
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={invoice.status} />
      </td>
      <td className="px-4 py-3 text-surface-600">
        {invoice.billing_month}/{invoice.billing_year}
      </td>
      <td className="px-4 py-3 text-surface-600">
        {formatDate(invoice.due_date)}
      </td>
      <td className="px-4 py-3 text-right font-medium text-surface-900">
        {formatCurrency(invoice.total_amount)}
      </td>
      <td className={`px-4 py-3 text-right font-medium ${
        remaining > 0 ? 'text-red-600' : 'text-green-600'
      }`}>
        {formatCurrency(remaining)}
      </td>
      <td className="px-4 py-3 text-right">
        <Link
          to={`/invoices/${invoice.id}`}
          className="text-sm font-medium text-primary-600 hover:text-primary-700 focus-visible:outline-2 focus-visible:outline-primary-500"
          aria-label={`View invoice ${invoice.invoice_number}`}
        >
          View
        </Link>
      </td>
    </tr>
  );
}

const statusStyles: Record<string, string> = {
  paid: 'bg-green-100 text-green-700',
  pending: 'bg-amber-100 text-amber-700',
  overdue: 'bg-red-100 text-red-700',
  draft: 'bg-surface-100 text-surface-600',
  cancelled: 'bg-surface-100 text-surface-500',
  partially_paid: 'bg-blue-100 text-blue-700',
};

function StatusBadge({ status }: { status: string }) {
  const label = formatInvoiceStatus(status);
  const style = statusStyles[status.toLowerCase()] ?? 'bg-surface-100 text-surface-600';
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}>
      {label}
    </span>
  );
}