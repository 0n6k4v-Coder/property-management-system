// File: src/features/reports/components/OverdueChart.tsx
// Overdue invoice summary chart using recharts (dynamically imported via ReportsPage lazy loading).

// eslint-disable-next-line react-doctor/prefer-dynamic-import
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface OverdueEntry {
  label: string;
  value: number;
}

interface OverdueChartProps {
  data: OverdueEntry[];
}

const COLORS = ['#ef4444', '#f59e0b', '#3b82f6', '#22c55e'];

export function OverdueChart({ data }: OverdueChartProps) {
  if (data.length === 0) {
    return <p className="text-center text-surface-400 text-sm py-12">No overdue data</p>;
  }

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
            label={({ value }) => `${value}`}
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