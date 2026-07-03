// File: src/shared/utils/status.ts
// Status-to-badge-variant mapping utility.

export type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

/** Map common room/contract/entity status strings to badge variant */
export function statusToVariant(status: string): BadgeVariant {
  const s = status.toLowerCase();
  if (['available', 'active', 'paid', 'confirmed'].includes(s)) return 'success';
  if (['occupied', 'pending', 'overdue'].includes(s)) return 'warning';
  if (['maintenance', 'terminated', 'expired', 'cancelled'].includes(s)) return 'danger';
  if (['reserved'].includes(s)) return 'info';
  return 'default';
}