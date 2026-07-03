// File: src/features/reports/utils/export.ts
// Client-side export from report data — triggers browser download.

import type { API } from '@/types/api.d';

function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export function exportRevenueToCsv(data: API.RevenueMetricResponse[]): void {
  const headers = ['Month', 'Year', 'Revenue (THB)', 'Expenses (THB)', 'Net (THB)'];
  const rows = data.map((r) => [
    csvEscape(r.month),
    csvEscape(r.year),
    csvEscape(r.revenue),
    csvEscape(r.expenses),
    csvEscape(r.net),
  ].join(','));

  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `revenue-report-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}