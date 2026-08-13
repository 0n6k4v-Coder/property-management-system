// File: src/shared/utils/status.test.ts
// Unit tests for status-to-badge-variant mapping utility.

import { statusToVariant } from './status';

describe('statusToVariant', () => {
  describe('success variants', () => {
    it('returns "success" for "available"', () => {
      expect(statusToVariant('available')).toBe('success');
    });

    it('returns "success" for "active"', () => {
      expect(statusToVariant('active')).toBe('success');
    });

    it('returns "success" for "paid"', () => {
      expect(statusToVariant('paid')).toBe('success');
    });

    it('returns "success" for "confirmed"', () => {
      expect(statusToVariant('confirmed')).toBe('success');
    });
  });

  describe('warning variants', () => {
    it('returns "warning" for "occupied"', () => {
      expect(statusToVariant('occupied')).toBe('warning');
    });

    it('returns "warning" for "pending"', () => {
      expect(statusToVariant('pending')).toBe('warning');
    });

    it('returns "warning" for "overdue"', () => {
      expect(statusToVariant('overdue')).toBe('warning');
    });
  });

  describe('danger variants', () => {
    it('returns "danger" for "maintenance"', () => {
      expect(statusToVariant('maintenance')).toBe('danger');
    });

    it('returns "danger" for "terminated"', () => {
      expect(statusToVariant('terminated')).toBe('danger');
    });

    it('returns "danger" for "expired"', () => {
      expect(statusToVariant('expired')).toBe('danger');
    });

    it('returns "danger" for "cancelled"', () => {
      expect(statusToVariant('cancelled')).toBe('danger');
    });
  });

  describe('info variants', () => {
    it('returns "info" for "reserved"', () => {
      expect(statusToVariant('reserved')).toBe('info');
    });
  });

  describe('default variant', () => {
    it('returns "default" for unknown status', () => {
      expect(statusToVariant('unknown')).toBe('default');
    });

    it('returns "default" for empty string', () => {
      expect(statusToVariant('')).toBe('default');
    });

    it('handles case-insensitive status', () => {
      expect(statusToVariant('AVAILABLE')).toBe('success');
      expect(statusToVariant('Active')).toBe('success');
      expect(statusToVariant('OVERDUE')).toBe('warning');
    });

    it('returns "default" for null', () => {
      // null coerced to string "null" — falls through to default
      expect(statusToVariant(null as unknown as string)).toBe('default');
    });

    it('returns "default" for undefined', () => {
      expect(statusToVariant(undefined as unknown as string)).toBe('default');
    });

    it('returns "default" for numeric input', () => {
      // String coercion turns 123 into "123" which is not a known status
      expect(statusToVariant(123 as unknown as string)).toBe('default');
    });

    it('returns "default" for status with leading/trailing whitespace', () => {
      expect(statusToVariant('  available  ')).toBe('default');
    });
  });
});
