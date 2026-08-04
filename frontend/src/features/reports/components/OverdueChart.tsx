// File: src/features/reports/components/OverdueChart.tsx
// Overdue invoice summary chart using recharts (dynamically imported at component level).
import { useEffect, useState } from 'react';

interface OverdueEntry {
  label: string;
  value: number;
}

interface OverdueChartProps {
  data: OverdueEntry[];
}

type RechartsModule = typeof import('recharts');

const COLORS = ['#ef4444', '#f59e0b', '#3b82f6', '#22c55e'];

export function OverdueChart({ data }: OverdueChartProps) {
  const [recharts, setRecharts] = useState<RechartsModule | null>(null);

  useEffect(() => {
    import('recharts').then(setRecharts);
  }, []);

  if (!recharts) {
    return <div className="h-[280px] animate-pulse bg-slate-100 rounded-lg" aria-label="Loading overdue chart" />;
  }

  if (data.length === 0) {
    return <p className="text-center text-surface-400 text-sm py-12">No overdue data</p>;
  }

  const { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } = recharts;

  return (
    <div aria-label="Overdue summary pie chart">
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            cx="50%"
            cy="50%"
            outerRadius={100}
            label={({ value }: { value: number }) => `${value}`}
          >
            {data.map((entry, idx) => (
              <Cell key={`${entry.label}-${idx}`} fill={COLORS[idx % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}