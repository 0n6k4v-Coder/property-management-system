// File: src/features/billing/utils/export.ts
// Client-side CSV/PDF export from fetched invoice data.
// No backend dependency — generates files in the browser.

import type { API } from '@/types/api.d';

/** Escape a CSV field value (wrap in quotes if contains comma, quote, or newline) */
function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Convert an array of invoice objects to CSV string */
export function invoicesToCsv(invoices: API.InvoiceResponse[]): string {
  const headers = [
    'Invoice Number',
    'Status',
    'Billing Month',
    'Billing Year',
    'Due Date',
    'Total Amount (THB)',
    'Paid Amount (THB)',
    'Remaining',
    'Room ID',
    'Notes',
  ];

  const rows = invoices.map((inv) => {
    const remaining = inv.total_amount - inv.paid_amount;
    return [
      csvEscape(inv.invoice_number),
      csvEscape(inv.status),
      csvEscape(inv.billing_month),
      csvEscape(inv.billing_year),
      csvEscape(inv.due_date),
      csvEscape(inv.total_amount),
      csvEscape(inv.paid_amount),
      csvEscape(remaining),
      csvEscape(inv.room_id),
      csvEscape(inv.notes),
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

/** Trigger a browser download of a file */
export function downloadFile(content: string, filename: string, mimeType: string): void { /* react-doctor-disable-line unused-export */
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Export invoices as CSV and trigger download */
export function exportInvoicesToCsv(invoices: API.InvoiceResponse[]): void {
  const csv = invoicesToCsv(invoices);
  const timestamp = new Date().toISOString().split('T')[0]!;
  downloadFile(csv, `invoices-${timestamp}.csv`, 'text/csv;charset=utf-8;');
}

/** Export invoices as a simple text-based "PDF" (tab-separated layout) */
export function exportInvoicesToTxt(invoices: API.InvoiceResponse[]): void {
  const lines: string[] = [];
  lines.push('=== Invoice Export ===');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Total Invoices: ${invoices.length}`);
  lines.push('');

  for (const inv of invoices) {
    lines.push(`Invoice: ${inv.invoice_number}`);
    lines.push(`  Status:       ${inv.status}`);
    lines.push(`  Period:       ${inv.billing_month}/${inv.billing_year}`);
    lines.push(`  Due:          ${inv.due_date}`);
    lines.push(`  Total:        ฿${Number(inv.total_amount).toFixed(2)}`);
    lines.push(`  Paid:         ฿${Number(inv.paid_amount).toFixed(2)}`);
    lines.push(`  Remaining:    ฿${(inv.total_amount - inv.paid_amount).toFixed(2)}`);
    lines.push('');
  }

  const timestamp = new Date().toISOString().split('T')[0]!;
  downloadFile(lines.join('\n'), `invoices-${timestamp}.txt`, 'text/plain;charset=utf-8;');
}

/** Status summary from a list of invoices */
export function summarizeInvoices(invoices: API.InvoiceResponse[]): string {
  const total = invoices.length;
  const totalAmount = invoices.reduce((s, i) => s + Number(i.total_amount), 0);
  const totalPaid = invoices.reduce((s, i) => s + Number(i.paid_amount), 0);
  const paid = invoices.filter((i) => i.status === 'paid').length;
  const overdue = invoices.filter((i) => i.status === 'overdue').length;

  return [
    `Total: ${total} invoices`,
    `Total Amount: ฿${totalAmount.toFixed(2)}`,
    `Total Paid: ฿${totalPaid.toFixed(2)}`,
    `Paid: ${paid} | Overdue: ${overdue}`,
  ].join('\n');
}