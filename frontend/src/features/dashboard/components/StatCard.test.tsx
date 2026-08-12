// File: src/features/dashboard/components/StatCard.test.tsx
// Unit tests for StatCard — loading state, normal render, delta display.

import { render, screen } from '@testing-library/react';
import { StatCard } from './StatCard';

describe('StatCard', () => {
  it('renders loading skeletons when isLoading is true', () => {
    render(<StatCard label="Test" value="—" isLoading={true} />);
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThanOrEqual(1);
  });

  it('renders label and value when not loading', () => {
    render(<StatCard label="Occupancy" value="84%" isLoading={false} />);
    expect(screen.getByText('Occupancy')).toBeInTheDocument();
    expect(screen.getByText('84%')).toBeInTheDocument();
  });

  it('renders upward arrow with delta when deltaPositive is true', () => {
    render(<StatCard label="Test" value="10" delta="vs last month" isLoading={false} />);
    // The delta text is rendered as: ↑ vs last month
    expect(screen.getByText('↑ vs last month')).toBeInTheDocument();
  });

  it('renders downward arrow with delta when deltaPositive is false', () => {
    render(<StatCard label="Overdue" value="5" delta="฿78,000" deltaPositive={false} isLoading={false} />);
    // The delta text is rendered as: ↓ ฿78,000
    expect(screen.getByText('↓ ฿78,000')).toBeInTheDocument();
  });

  it('does not render delta section when delta is not provided', () => {
    render(<StatCard label="Maintenance" value="3" isLoading={false} />);
    // No delta arrow should be present
    expect(screen.queryByText('↑')).not.toBeInTheDocument();
    expect(screen.queryByText('↓')).not.toBeInTheDocument();
  });
});
