// File: src/shared/ui/Badge.tsx
// Status badge component with color variants based on status value.

import type { BadgeVariant } from '@/shared/utils/status';
import { statusToVariant as _stv } from '@/shared/utils/status';

interface BadgeProps {
  children: string;
  variant?: BadgeVariant;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-surface-100 text-surface-700',
  success: 'bg-green-100 text-green-700',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-red-100 text-red-700',
  info: 'bg-blue-100 text-blue-700',
};

export function Badge({ children, variant, className = '' }: BadgeProps) {
  const resolvedVariant = variant ?? _stv(children);
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variantStyles[resolvedVariant]} ${className}`}
    >
      {children}
    </span>
  );
}