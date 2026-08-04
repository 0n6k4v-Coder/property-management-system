// File: src/features/reports/components/RevenueChart.tsx
// Revenue chart using recharts (dynamically imported at component level).
import { useEffect, useState } from 'react';
import type { API } from '@/types/api.d';

interface RevenueChartProps {
  data: API.RevenueMetricResponse[];
}

type RechartsModule = typeof import('recharts');

export function RevenueChart({ data }: RevenueChartProps) {
  const [recharts, setRecharts] = useState<RechartsModule | null>(null);

  useEffect(() => {
    import('recharts').then(setRecharts);
  }, []);

  if (!recharts) {
    return <div className="h-[300px] animate-pulse bg-slate-100 rounded-lg" aria-label="Loading revenue chart" />;
  }

  const { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } = recharts;

  return (
    <div aria-label="Revenue chart showing collected, outstanding, and total billed amounts by period">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="period" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip labelStyle={{ fontWeight: 600 }} />
          <Legend />
          <Bar dataKey="collected" fill="#2563eb" name="Collected" radius={[4, 4, 0, 0]} />
          <Bar dataKey="outstanding" fill="#f59e0b" name="Outstanding" radius={[4, 4, 0, 0]} />
          <Bar dataKey="total_billed" fill="#16a34a" name="Total Billed" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}