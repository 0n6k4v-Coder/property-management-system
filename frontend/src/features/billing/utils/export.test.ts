// File: src/features/billing/utils/export.test.ts
// Unit tests for client-side export utilities.

import { invoicesToCsv, summarizeInvoices } from './export';
import type { API } from '@/types/api.d';

const mockInvoices: API.InvoiceResponse[] = [
  {
    id: '1',
    invoice_number: 'INV-001',
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
  {
    id: '2',
    invoice_number: 'INV-002',
    contract_id: 'c1',
    room_id: 'r1',
    tenant_id: 't1',
    property_id: 'p1',
    billing_month: 7,
    billing_year: 2026,
    due_date: '2026-08-15',
    status: 'overdue',
    total_amount: 15000,
    paid_amount: 0,
    notes: 'Late payment penalty applied',
    created_at: null,
  },
];

describe('Invoice Export Utilities', () => {
  it('converts invoices to CSV string', () => {
    const csv = invoicesToCsv(mockInvoices);
    expect(csv).toContain('Invoice Number');
    expect(csv).toContain('INV-001');
    expect(csv).toContain('INV-002');
    expect(csv).toContain('paid');
    expect(csv).toContain('overdue');
  });

  it('generates summary text', () => {
    const summary = summarizeInvoices(mockInvoices);
    expect(summary).toContain('2 invoices');
    expect(summary).toContain('Paid: 1');
    expect(summary).toContain('Overdue: 1');
  });
});