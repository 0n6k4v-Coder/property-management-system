// File: src/shared/ui/CardSkeleton.tsx
// Pre-composed card skeleton for loading states.

import { Skeleton } from './Skeleton';

export function CardSkeleton() {
  return (
    <div className="space-y-4 rounded-xl border border-surface-200 bg-white p-6" aria-hidden="true">
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <div className="flex gap-2 pt-2">
        <Skeleton className="h-8 w-20 rounded-lg" />
        <Skeleton className="h-8 w-20 rounded-lg" />
      </div>
    </div>
  );
}