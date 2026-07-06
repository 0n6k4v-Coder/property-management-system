// File: src/features/dashboard/components/StatCard.tsx
// Reusable stat card with icon, value, label, delta, and loading state.

import { Skeleton } from '@/shared/ui/Skeleton';

interface StatCardProps {
  label: string;
  value: string;
  delta?: string;
  deltaPositive?: boolean;
  icon?: string;
  isLoading?: boolean;
}

export function StatCard({ label, value, delta, deltaPositive = true, isLoading }: StatCardProps) {
  if (isLoading) {
    return (
      <div className="rounded-xl border border-surface-200 bg-white p-5 shadow-sm">
        <Skeleton className="h-4 w-24 mb-2" />
        <Skeleton className="h-8 w-32 mb-1" />
        <Skeleton className="h-3 w-16" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-surface-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-surface-600">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-surface-900">{value}</p>
      {delta !== undefined && (
        <p className={`mt-1 text-xs font-medium ${deltaPositive ? 'text-green-700' : 'text-red-600'}`}>
          {deltaPositive ? '↑' : '↓'} {delta}
        </p>
      )}
    </div>
  );
}