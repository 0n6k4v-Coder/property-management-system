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
  });
});
