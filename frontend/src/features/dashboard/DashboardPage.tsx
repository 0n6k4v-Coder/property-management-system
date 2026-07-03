// File: src/features/dashboard/DashboardPage.tsx
// Dashboard overview with stat cards, overdue table, and loading states.
// SCR-DASHBOARD: Grid layout, skeleton loading, caching with staleTime: 5m.

import { useDashboardSummary } from './api';
import { StatCard } from './components/StatCard';
import { OverdueTable } from './components/OverdueTable';
import { Card, CardHeader } from '@/shared/ui/Card';
import { formatCurrency } from '@/features/billing/utils/formatters';

export default function DashboardPage() {
  const { data: summary, isLoading, isError } = useDashboardSummary();

  if (isError) {
    return (
      <Card className="text-center py-8 text-red-600">
        Failed to load dashboard. <button type="button" onClick={() => window.location.reload()} className="underline">Retry</button>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-surface-900">Dashboard</h1>
        <p className="mt-1 text-sm text-surface-500">
          Overview of property performance
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Occupancy"
          value={summary ? `${summary.occupancy_rate}%` : '—'}
          delta={summary ? `${summary.occupied_rooms}/${summary.total_rooms} rooms` : undefined}
          isLoading={isLoading}
        />
        <StatCard
          label="Monthly Revenue"
          value={summary ? formatCurrency(summary.total_revenue) : '—'}
          delta="vs last month"
          isLoading={isLoading}
        />
        <StatCard
          label="Overdue"
          value={summary ? String(summary.overdue_count) : '—'}
          delta={summary ? formatCurrency(summary.overdue_amount) : undefined}
          deltaPositive={false}
          isLoading={isLoading}
        />
        <StatCard
          label="Maintenance"
          value={summary ? String(summary.pending_maintenance) : '—'}
          isLoading={isLoading}
        />
      </div>

      {/* Overdue Table */}
      <Card>
        <CardHeader title="Overdue Invoices" subtitle="Invoices past due date" />
        <OverdueTable
          items={
            summary && summary.overdue_count > 0
              ? [
                  {
                    id: 'demo-1',
                    invoice_number: 'INV-2026-0001',
                    tenant_name: 'Demo Tenant',
                    amount: 15000,
                    due_date: '15 Jun 2026',
                    days_overdue: 14,
                  },
                ]
              : []
          }
          isLoading={isLoading}
        />
      </Card>
    </div>
  );
}