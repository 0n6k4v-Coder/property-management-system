// File: src/features/billing/utils/formatters.test.ts
// Unit tests for billing formatting utilities — edge cases, branches, error handling.

import {
  formatCurrency,
  formatDate,
  formatShortDate,
  formatInvoiceStatus,
  statusToBadgeVariant,
  getRemainingBalance,
  getPaymentProgress,
} from './formatters';

describe('formatCurrency', () => {
  it('formats a number as Thai Baht', () => {
    expect(formatCurrency(15000)).toBe('฿15,000.00');
  });

  it('formats a numeric string', () => {
    expect(formatCurrency('8500')).toBe('฿8,500.00');
  });

  it('formats a decimal number with two digits', () => {
    expect(formatCurrency(1234.5)).toBe('฿1,234.50');
  });

  it('returns em-dash for null', () => {
    expect(formatCurrency(null)).toBe('—');
  });

  it('returns em-dash for undefined', () => {
    expect(formatCurrency(undefined)).toBe('—');
  });

  it('returns em-dash for NaN string', () => {
    expect(formatCurrency('not-a-number')).toBe('—');
  });

  it('returns em-dash for NaN', () => {
    expect(formatCurrency(NaN)).toBe('—');
  });

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('฿0.00');
  });

  it('formats negative values', () => {
    expect(formatCurrency(-500)).toBe('฿-500.00');
  });
});

describe('formatDate', () => {
  it('formats an ISO date string', () => {
    const result = formatDate('2026-07-15T00:00:00Z');
    expect(result).toMatch(/\d+/); // day/number
    expect(result).toMatch(/\d{4}/); // year
  });

  it('returns em-dash for null', () => {
    expect(formatDate(null)).toBe('—');
  });

  it('returns em-dash for undefined', () => {
    expect(formatDate(undefined)).toBe('—');
  });

  it('returns em-dash for empty string', () => {
    expect(formatDate('')).toBe('—');
  });
});

describe('formatShortDate', () => {
  it('formats an ISO date string (day + month, no year)', () => {
    const result = formatShortDate('2026-07-15T00:00:00Z');
    expect(result).toMatch(/Jul/); // month name present
  });

  it('returns em-dash for null', () => {
    expect(formatShortDate(null)).toBe('—');
  });

  it('returns em-dash for undefined', () => {
    expect(formatShortDate(undefined)).toBe('—');
  });

  it('returns em-dash for empty string', () => {
    expect(formatShortDate('')).toBe('—');
  });
});

describe('formatInvoiceStatus', () => {
  it('formats "draft" status', () => {
    expect(formatInvoiceStatus('draft')).toBe('Draft');
  });

  it('formats "pending" status', () => {
    expect(formatInvoiceStatus('pending')).toBe('Pending');
  });

  it('formats "paid" status', () => {
    expect(formatInvoiceStatus('paid')).toBe('Paid');
  });

  it('formats "overdue" status', () => {
    expect(formatInvoiceStatus('overdue')).toBe('Overdue');
  });

  it('formats "cancelled" status', () => {
    expect(formatInvoiceStatus('cancelled')).toBe('Cancelled');
  });

  it('formats "partially_paid" status', () => {
    expect(formatInvoiceStatus('partially_paid')).toBe('Partially Paid');
  });

  it('returns "Unknown" for null', () => {
    expect(formatInvoiceStatus(null)).toBe('Unknown');
  });

  it('returns "Unknown" for undefined', () => {
    expect(formatInvoiceStatus(undefined)).toBe('Unknown');
  });

  it('returns "Unknown" for empty string', () => {
    expect(formatInvoiceStatus('')).toBe('Unknown');
  });

  it('returns raw status for unknown status', () => {
    expect(formatInvoiceStatus('custom_status')).toBe('custom_status');
  });

  it('handles uppercase status input', () => {
    expect(formatInvoiceStatus('PAID')).toBe('Paid');
  });
});

describe('statusToBadgeVariant', () => {
  it('returns "success" for "paid"', () => {
    expect(statusToBadgeVariant('paid')).toBe('success');
  });

  it('returns "success" for "confirmed"', () => {
    expect(statusToBadgeVariant('confirmed')).toBe('success');
  });

  it('returns "danger" for "overdue"', () => {
    expect(statusToBadgeVariant('overdue')).toBe('danger');
  });

  it('returns "danger" for "cancelled"', () => {
    expect(statusToBadgeVariant('cancelled')).toBe('danger');
  });

  it('returns "warning" for "pending"', () => {
    expect(statusToBadgeVariant('pending')).toBe('warning');
  });

  it('returns "warning" for "draft"', () => {
    expect(statusToBadgeVariant('draft')).toBe('warning');
  });

  it('returns "info" for "partially_paid"', () => {
    expect(statusToBadgeVariant('partially_paid')).toBe('info');
  });

  it('returns "default" for unknown status', () => {
    expect(statusToBadgeVariant('unknown_status')).toBe('default');
  });

  it('returns "default" for empty string', () => {
    expect(statusToBadgeVariant('')).toBe('default');
  });

  it('returns "default" for uppercase status (not lowercased)', () => {
    expect(statusToBadgeVariant('PAID')).toBe('default');
  });
});

describe('getRemainingBalance', () => {
  it('returns total - paid when paid < total', () => {
    expect(getRemainingBalance({ total_amount: 15000, paid_amount: 5000 })).toBe(10000);
  });

  it('returns zero when fully paid', () => {
    expect(getRemainingBalance({ total_amount: 15000, paid_amount: 15000 })).toBe(0);
  });

  it('returns zero when overpaid (paid > total)', () => {
    expect(getRemainingBalance({ total_amount: 10000, paid_amount: 15000 })).toBe(0);
  });

  it('returns full total when nothing paid', () => {
    expect(getRemainingBalance({ total_amount: 15000, paid_amount: 0 })).toBe(15000);
  });

  it('handles zero total', () => {
    expect(getRemainingBalance({ total_amount: 0, paid_amount: 0 })).toBe(0);
  });
});

describe('getPaymentProgress', () => {
  it('returns 100 when fully paid', () => {
    expect(getPaymentProgress({ total_amount: 10000, paid_amount: 10000 })).toBe(100);
  });

  it('returns 0 when nothing paid', () => {
    expect(getPaymentProgress({ total_amount: 10000, paid_amount: 0 })).toBe(0);
  });

  it('returns rounded percentage for partial payment', () => {
    expect(getPaymentProgress({ total_amount: 30000, paid_amount: 10000 })).toBe(33);
  });

  it('returns 100 when overpaid (not exceeding 100)', () => {
    expect(getPaymentProgress({ total_amount: 1000, paid_amount: 1500 })).toBe(100);
  });

  it('returns 0 when total is zero', () => {
    expect(getPaymentProgress({ total_amount: 0, paid_amount: 100 })).toBe(0);
  });

  it('returns 0 when total is negative', () => {
    expect(getPaymentProgress({ total_amount: -1, paid_amount: 100 })).toBe(0);
  });

  it('returns 0 when total and paid are zero', () => {
    expect(getPaymentProgress({ total_amount: 0, paid_amount: 0 })).toBe(0);
  });
});
