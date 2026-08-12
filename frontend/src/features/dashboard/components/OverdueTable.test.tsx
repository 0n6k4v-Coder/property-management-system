// File: src/features/dashboard/components/OverdueTable.test.tsx
// Unit tests for OverdueTable — loading state, empty state, and data rendering.

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { OverdueTable } from './OverdueTable';

const mockItems = [
  {
    id: 'demo-1',
    invoice_number: 'INV-2026-0001',
    tenant_name: 'Demo Tenant',
    amount: 15000,
    due_date: '15 Jun 2026',
    days_overdue: 14,
  },
  {
    id: 'demo-2',
    invoice_number: 'INV-2026-0002',
    tenant_name: 'Jane Doe',
    amount: 30000,
    due_date: '10 Jun 2026',
    days_overdue: 45,
  },
];

function renderWithRouter(items: typeof mockItems, isLoading: boolean) {
  return render(
    <MemoryRouter>
      <OverdueTable items={items} isLoading={isLoading} />
    </MemoryRouter>,
  );
}

describe('OverdueTable', () => {
  it('renders loading skeletons when isLoading is true', () => {
    renderWithRouter(mockItems, true);
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBe(3);
  });

  it('shows empty state message when no items', () => {
    renderWithRouter([], false);
    expect(screen.getByText('No overdue invoices')).toBeInTheDocument();
  });

  it('renders invoice table with data', () => {
    renderWithRouter(mockItems, false);

    // Check table headers
    expect(screen.getByText('Invoice')).toBeInTheDocument();
    expect(screen.getByText('Tenant')).toBeInTheDocument();
    expect(screen.getByText('Amount')).toBeInTheDocument();
    expect(screen.getByText('Due')).toBeInTheDocument();
    expect(screen.getByText('Overdue')).toBeInTheDocument();

    // Check first item
    expect(screen.getByText('INV-2026-0001')).toBeInTheDocument();
    expect(screen.getByText('Demo Tenant')).toBeInTheDocument();
    expect(screen.getByText('฿15,000')).toBeInTheDocument();
    expect(screen.getByText('15 Jun 2026')).toBeInTheDocument();
    expect(screen.getByText('14d')).toBeInTheDocument();

    // Check second item
    expect(screen.getByText('INV-2026-0002')).toBeInTheDocument();
    expect(screen.getByText('฿30,000')).toBeInTheDocument();
  });

  it('renders View links for each invoice', () => {
    renderWithRouter(mockItems, false);
    const viewLinks = screen.getAllByText('View');
    expect(viewLinks.length).toBe(2);
  });

  it('applies danger badge class for items overdue > 30 days', () => {
    renderWithRouter(mockItems, false);
    // 45-day item should have danger variant badge (text-red-700)
    const badge = screen.getByText('45d');
    expect(badge).toBeInTheDocument();
    // Check that it has danger variant class (text-red-700)
    expect(badge.className).toContain('text-red-700');
  });

  it('applies warning badge class for items overdue <= 30 days', () => {
    renderWithRouter(mockItems, false);
    // 14-day item should have warning variant badge (text-amber-700)
    const badge = screen.getByText('14d');
    expect(badge).toBeInTheDocument();
    // Check that it has warning variant class (text-amber-700)
    expect(badge.className).toContain('text-amber-700');
    // Should NOT have danger variant
    expect(badge.className).not.toContain('text-red-700');
  });

  it('formats amount with toLocaleString (THB currency)', () => {
    renderWithRouter(mockItems, false);
    // 15000 should be formatted as "฿15,000"
    expect(screen.getByText('฿15,000')).toBeInTheDocument();
    // 30000 should be formatted as "฿30,000"
    expect(screen.getByText('฿30,000')).toBeInTheDocument();
  });
});
