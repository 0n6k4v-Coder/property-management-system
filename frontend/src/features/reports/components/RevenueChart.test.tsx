// File: src/features/reports/components/RevenueChart.test.tsx
// Unit tests for RevenueChart — loading skeleton, data rendering.

import { render, screen, waitFor } from '@testing-library/react';
import { RevenueChart } from './RevenueChart';
import type { API } from '@/types/api.d';

// Mock recharts dynamic import
vi.mock('recharts', () => {
  const MockResponsiveContainer = ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="mock-responsive-container">{children}</div>
  );
  const MockBarChart = () => <div data-testid="mock-barchart" />;
  const MockBar = () => null;
  const MockXAxis = () => null;
  const MockYAxis = () => null;
  const MockCartesianGrid = () => null;
  const MockTooltip = () => null;
  const MockLegend = () => null;
  return {
    __esModule: true,
    ResponsiveContainer: MockResponsiveContainer,
    BarChart: MockBarChart,
    Bar: MockBar,
    XAxis: MockXAxis,
    YAxis: MockYAxis,
    CartesianGrid: MockCartesianGrid,
    Tooltip: MockTooltip,
    Legend: MockLegend,
  };
});

describe('RevenueChart', () => {
  it('renders loading skeleton when recharts is not yet loaded', () => {
    const data: API.RevenueMetricResponse[] = [
      { period: '2026-01', collected: 380000, outstanding: 45000, total_billed: 425000 },
    ];
    render(<RevenueChart data={data} />);
    const skeleton = screen.getByLabelText('Loading revenue chart');
    expect(skeleton).toBeInTheDocument();
    expect(skeleton).toHaveClass('animate-pulse');
  });

  it('renders chart with data when recharts loads', async () => {
    const data: API.RevenueMetricResponse[] = [
      { period: '2026-01', collected: 380000, outstanding: 45000, total_billed: 425000 },
      { period: '2026-02', collected: 395000, outstanding: 42000, total_billed: 437000 },
    ];
    render(<RevenueChart data={data} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Revenue chart showing collected, outstanding, and total billed amounts by period')).toBeInTheDocument();
    });
  });

  it('renders chart with empty data array', async () => {
    render(<RevenueChart data={[]} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Revenue chart showing collected, outstanding, and total billed amounts by period')).toBeInTheDocument();
    });
  });
});
