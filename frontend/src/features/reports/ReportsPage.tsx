// File: src/features/reports/ReportsPage.tsx
// Reports page with filters, charts, and export.
// SCR-REPORTS: Dynamic chart loading, filter sidebar, export controls.

import { Suspense, lazy, useState } from 'react';
import { useRevenueReport, useOverdueReport } from './api';
import { exportRevenueToCsv } from './utils/export';
import { Button } from '@/shared/ui/Button';
import { Card, CardHeader } from '@/shared/ui/Card';
import { Input } from '@/shared/ui/Input';
import { CardSkeleton } from '@/shared/ui/CardSkeleton';

const RevenueChart = lazy(() => import('./components/RevenueChart').then(m => ({ default: m.RevenueChart })));
const OverdueChart = lazy(() => import('./components/OverdueChart').then(m => ({ default: m.OverdueChart })));

export default function ReportsPage() {
  const today = new Date();
  const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 5, 1);

  const [startDate, setStartDate] = useState(sixMonthsAgo.toISOString().split('T')[0]!);
  const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]!);

  const { data: revenue, isLoading: revLoading } = useRevenueReport({ startDate, endDate });
  const { data: overdue } = useOverdueReport();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Reports</h1>
          <p className="mt-1 text-sm text-surface-500">
            Analytics and financial summaries
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => { if (revenue) exportRevenueToCsv(revenue); }}
            disabled={!revenue || revenue.length === 0}
          >
            Export CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card padding="md">
        <div className="flex flex-wrap items-end gap-4">
          <Input
            label="Start Date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <Input
            label="End Date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </Card>

      {/* Revenue Chart */}
      <Card>
        <CardHeader title="Revenue Overview" subtitle="Collected, outstanding, and total billed by period" />
        {revLoading ? (
          <CardSkeleton />
        ) : revenue && revenue.length > 0 ? (
          <Suspense fallback={<CardSkeleton />}>
            <RevenueChart data={revenue} />
          </Suspense>
        ) : (
          <p className="text-center text-surface-400 text-sm py-12">No revenue data available</p>
        )}
      </Card>

      {/* Overdue Summary */}
      <Card>
        <CardHeader title="Overdue Summary" subtitle="Current overdue invoice status" />
        <Suspense fallback={<CardSkeleton />}>
          <OverdueChart data={overdue ?? []} />
        </Suspense>
      </Card>
    </div>
  );
}