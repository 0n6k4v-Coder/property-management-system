// File: src/features/billing/utils/formatters.ts
// Currency, date, and status formatting utilities.

/** Format a decimal string/number as Thai Baht currency */
export function formatCurrency(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return '—';
  const num = typeof value === 'string' ? Number.parseFloat(value) : value;
  if (Number.isNaN(num)) return '—';
  return `฿${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Format an ISO date string to a human-readable Thai locale date */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/** Format a short date (YYYY-MM or YYYY-MM-DD) */
export function formatShortDate(dateStr: string | null | undefined): string { /* react-doctor-disable-line unused-export */
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return dateStr;
  }
}

/** Map invoice status to a human-readable label */
export function formatInvoiceStatus(status: string | null | undefined): string {
  if (!status) return 'Unknown';
  const map: Record<string, string> = {
    draft: 'Draft',
    pending: 'Pending',
    paid: 'Paid',
    overdue: 'Overdue',
    cancelled: 'Cancelled',
    partially_paid: 'Partially Paid',
  };
  return map[status.toLowerCase()] ?? status;
}

/** Map invoice status to a Tailwind badge variant */
export function statusToBadgeVariant(status: string): string { /* react-doctor-disable-line unused-export */
  if (status === 'paid' || status === 'confirmed') return 'success';
  if (status === 'overdue' || status === 'cancelled') return 'danger';
  if (status === 'pending' || status === 'draft') return 'warning';
  if (status === 'partially_paid') return 'info';
  return 'default';
}

/** Get remaining balance: total - paid */
export function getRemainingBalance(invoice: {
  total_amount: number;
  paid_amount: number;
}): number {
  return Math.max(0, invoice.total_amount - invoice.paid_amount);
}

/** Get progress percentage */
export function getPaymentProgress(invoice: {
  total_amount: number;
  paid_amount: number;
}): number {
  if (invoice.total_amount <= 0) return 0;
  return Math.min(100, Math.round((invoice.paid_amount / invoice.total_amount) * 100));
}