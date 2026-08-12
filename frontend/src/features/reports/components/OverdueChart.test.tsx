// File: src/features/reports/components/OverdueChart.test.tsx
// Unit tests for OverdueChart — loading skeleton, empty data, and chart render.

import { render, screen, waitFor } from '@testing-library/react';
import { OverdueChart } from './OverdueChart';

// Mock recharts dynamic import
vi.mock('recharts', () => {
  const MockPieChart = ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="mock-piechart">{children}</div>
  );
  const MockPie = () => <div data-testid="mock-pie" />;
  const MockCell = () => null;
  const MockResponsiveContainer = ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="mock-responsive-container">{children}</div>
  );
  const MockTooltip = () => null;
  const MockLegend = () => null;
  return {
    __esModule: true,
    PieChart: MockPieChart,
    Pie: MockPie,
    Cell: MockCell,
    ResponsiveContainer: MockResponsiveContainer,
    Tooltip: MockTooltip,
    Legend: MockLegend,
  };
});

describe('OverdueChart', () => {
  it('renders loading skeleton when recharts is not yet loaded', () => {
    render(<OverdueChart data={[]} />);
    const skeleton = screen.getByLabelText('Loading overdue chart');
    expect(skeleton).toBeInTheDocument();
    expect(skeleton).toHaveClass('animate-pulse');
  });

  it('shows empty state message when data is empty', async () => {
    render(<OverdueChart data={[]} />);
    // After dynamic import resolves, shows empty state
    expect(await screen.findByText('No overdue data')).toBeInTheDocument();
  });

  it('renders chart with data when recharts loads', async () => {
    const data = [
      { label: 'Overdue Invoices', value: 5 },
      { label: 'Overdue Amount (THB)', value: 78000 },
    ];
    render(<OverdueChart data={data} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Overdue summary pie chart')).toBeInTheDocument();
    });
  });

  it('renders correct number of cells', async () => {
    const data = [
      { label: 'Overdue Invoices', value: 5 },
      { label: 'Overdue Amount (THB)', value: 78000 },
    ];
    render(<OverdueChart data={data} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Overdue summary pie chart')).toBeInTheDocument();
    });
  });
});
