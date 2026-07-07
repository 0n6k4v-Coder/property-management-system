// File: src/features/reports/components/RevenueChart.tsx
// Revenue chart using recharts (dynamically imported via ReportsPage lazy loading).

// eslint-disable-next-line react-doctor/prefer-dynamic-import
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import type { API } from '@/types/api.d';

interface RevenueChartProps {
  data: API.RevenueMetricResponse[];
}

export function RevenueChart({ data }: RevenueChartProps) {
  return (
    <div aria-label="Revenue chart showing collected, outstanding, and total billed amounts by period">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="period" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip
            labelStyle={{ fontWeight: 600 }}
          />
          <Legend />
          <Bar dataKey="collected" fill="#2563eb" name="Collected" radius={[4, 4, 0, 0]} />
          <Bar dataKey="outstanding" fill="#f59e0b" name="Outstanding" radius={[4, 4, 0, 0]} />
          <Bar dataKey="total_billed" fill="#16a34a" name="Total Billed" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}