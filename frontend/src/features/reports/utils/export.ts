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
  const headers = ['Period', 'Collected (THB)', 'Outstanding (THB)', 'Total Billed (THB)'];
  const rows = data.map((r) => [
    csvEscape(r.period),
    csvEscape(r.collected),
    csvEscape(r.outstanding),
    csvEscape(r.total_billed),
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