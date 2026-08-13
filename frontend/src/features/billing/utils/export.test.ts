// File: src/features/billing/utils/export.test.ts
// Unit tests for client-side export utilities — CSV escaping, download, summary.

import { invoicesToCsv, summarizeInvoices, downloadFile, exportInvoicesToCsv, exportInvoicesToTxt } from './export';
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

// Helper to mock downloadFile behavior
function setupDownloadMock() {
  const mockClick = vi.fn();
  const mockAnchor = {
    href: '',
    download: '',
    click: mockClick,
  };

  const originalCreateElement = document.createElement.bind(document);
  const createElementSpy = vi
    .spyOn(document, 'createElement')
    .mockImplementation((tag: string) => {
      if (tag === 'a') return mockAnchor as unknown as HTMLAnchorElement;
      return originalCreateElement(tag);
    });

  const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

  return { mockClick, mockAnchor, createElementSpy, revokeSpy };
}

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

describe('invoicesToCsv', () => {
  it('includes all header fields', () => {
    const csv = invoicesToCsv(mockInvoices);
    expect(csv).toContain('Invoice Number');
    expect(csv).toContain('Status');
    expect(csv).toContain('Billing Month');
    expect(csv).toContain('Billing Year');
    expect(csv).toContain('Due Date');
    expect(csv).toContain('Total Amount (THB)');
    expect(csv).toContain('Paid Amount (THB)');
    expect(csv).toContain('Remaining');
    expect(csv).toContain('Room ID');
    expect(csv).toContain('Notes');
  });

  it('includes invoice data rows', () => {
    const csv = invoicesToCsv(mockInvoices);
    expect(csv).toContain('INV-001');
    expect(csv).toContain('INV-002');
  });

  it('handles empty invoice list', () => {
    const csv = invoicesToCsv([]);
    expect(csv).toBe(
      'Invoice Number,Status,Billing Month,Billing Year,Due Date,Total Amount (THB),Paid Amount (THB),Remaining,Room ID,Notes',
    );
  });

  it('calculates remaining correctly in CSV', () => {
    const csv = invoicesToCsv(mockInvoices);
    const lines = csv.split('\n');
    const row1 = lines[1]!;
    const row2 = lines[2]!;
    // First invoice: 15000 - 15000 = 0
    expect(row1).toContain('0');
    // Second invoice: 15000 - 0 = 15000
    expect(row2).toContain('15000');
  });

  it('handles notes with comma by escaping CSV', () => {
    const invoicesWithCommaNotes: API.InvoiceResponse[] = [
      {
        ...mockInvoices[0],
        notes: 'Note, with comma',
      },
    ];
    const csv = invoicesToCsv(invoicesWithCommaNotes);
    expect(csv).toContain('"Note, with comma"');
  });

  it('handles invoice_number with quote by escaping CSV', () => {
    const invoicesWithQuote: API.InvoiceResponse[] = [
      {
        ...mockInvoices[0],
        invoice_number: 'INV"001',
      },
    ];
    const csv = invoicesToCsv(invoicesWithQuote);
    expect(csv).toContain('"INV""001"');
  });

  it('handles notes with newline by escaping CSV', () => {
    const invoicesWithNewline: API.InvoiceResponse[] = [
      {
        ...mockInvoices[0],
        notes: 'Line one\nLine two',
      },
    ];
    const csv = invoicesToCsv(invoicesWithNewline);
    expect(csv).toContain('"Line one\nLine two"');
  });
});

describe('downloadFile', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('creates anchor element and triggers download', () => {
    const { mockClick, mockAnchor, createElementSpy, revokeSpy } = setupDownloadMock();

    downloadFile('test content', 'test.txt', 'text/plain');

    expect(mockAnchor.href).toContain('blob:');
    expect(mockAnchor.download).toBe('test.txt');
    expect(mockClick).toHaveBeenCalledTimes(1);

    createElementSpy.mockRestore();
    revokeSpy.mockRestore();
  });
});

describe('exportInvoicesToCsv', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('generates CSV and triggers download with timestamp', () => {
    const { mockClick, mockAnchor, createElementSpy, revokeSpy } = setupDownloadMock();

    exportInvoicesToCsv(mockInvoices);

    expect(mockAnchor.download).toMatch(/^invoices-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(mockClick).toHaveBeenCalledTimes(1);

    createElementSpy.mockRestore();
    revokeSpy.mockRestore();
  });

  it('handles empty invoice list', () => {
    const { mockClick, mockAnchor, createElementSpy, revokeSpy } = setupDownloadMock();

    exportInvoicesToCsv([]);

    expect(mockAnchor.download).toMatch(/^invoices-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(mockClick).toHaveBeenCalledTimes(1);

    createElementSpy.mockRestore();
    revokeSpy.mockRestore();
  });
});

describe('exportInvoicesToTxt', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('generates TXT and triggers download with timestamp', () => {
    const { mockClick, mockAnchor, createElementSpy, revokeSpy } = setupDownloadMock();

    exportInvoicesToTxt(mockInvoices);

    expect(mockAnchor.download).toMatch(/^invoices-\d{4}-\d{2}-\d{2}\.txt$/);
    expect(mockClick).toHaveBeenCalledTimes(1);

    createElementSpy.mockRestore();
    revokeSpy.mockRestore();
  });

  it('generates text file with correct format', () => {
    const { mockClick, mockAnchor, createElementSpy, revokeSpy } = setupDownloadMock();

    exportInvoicesToTxt(mockInvoices);

    // Verify download was triggered with txt extension
    expect(mockAnchor.download).toMatch(/^invoices-\d{4}-\d{2}-\d{2}\.txt$/);
    expect(mockClick).toHaveBeenCalledTimes(1);
    expect(mockAnchor.href).toContain('blob:');

    createElementSpy.mockRestore();
    revokeSpy.mockRestore();
  });

  it('generates txt file even for empty invoice list', () => {
    const { mockClick, mockAnchor, createElementSpy, revokeSpy } = setupDownloadMock();

    exportInvoicesToTxt([]);

    expect(mockAnchor.download).toMatch(/^invoices-\d{4}-\d{2}-\d{2}\.txt$/);
    expect(mockClick).toHaveBeenCalledTimes(1);

    createElementSpy.mockRestore();
    revokeSpy.mockRestore();
  });
});

describe('summarizeInvoices', () => {
  it('generates summary with total, amount, and status counts', () => {
    const summary = summarizeInvoices(mockInvoices);
    expect(summary).toContain('2 invoices');
    expect(summary).toContain('30000.00'); // total amount
    expect(summary).toContain('15000.00'); // total paid
    expect(summary).toContain('Paid: 1');
    expect(summary).toContain('Overdue: 1');
  });

  it('handles empty invoice list', () => {
    const summary = summarizeInvoices([]);
    expect(summary).toContain('0 invoices');
    expect(summary).toContain('0.00');
    expect(summary).toContain('Paid: 0');
    expect(summary).toContain('Overdue: 0');
  });

  it('counts multiple paid and overdue invoices', () => {
    const invoices: API.InvoiceResponse[] = [
      { ...mockInvoices[0], status: 'paid', total_amount: 10000, paid_amount: 10000 },
      { ...mockInvoices[0], id: '3', status: 'paid', total_amount: 20000, paid_amount: 20000 },
      { ...mockInvoices[1], id: '4', status: 'overdue', total_amount: 30000, paid_amount: 0 },
      { ...mockInvoices[1], id: '5', status: 'pending', total_amount: 5000, paid_amount: 0 },
    ];
    const summary = summarizeInvoices(invoices);
    expect(summary).toContain('4 invoices');
    expect(summary).toContain('Paid: 2');
    expect(summary).toContain('Overdue: 1');
  });

  it('handles invoices with string amounts', () => {
    const invoicesWithStringAmounts: API.InvoiceResponse[] = [
      {
        ...mockInvoices[0],
        total_amount: '15000' as unknown as number,
        paid_amount: '10000' as unknown as number,
      },
    ];
    const summary = summarizeInvoices(invoicesWithStringAmounts);
    expect(summary).toContain('15000.00');
    expect(summary).toContain('10000.00');
  });
});
