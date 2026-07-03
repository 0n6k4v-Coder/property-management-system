// File: src/features/dashboard/components/OverdueTable.tsx
// Compact table showing overdue invoices with status badges.

import { Link } from 'react-router-dom';
import { Badge } from '@/shared/ui/Badge';
import { Skeleton } from '@/shared/ui/Skeleton';

interface OverdueItem {
  id: string;
  invoice_number: string;
  tenant_name: string;
  amount: number;
  due_date: string;
  days_overdue: number;
}

interface OverdueTableProps {
  items: OverdueItem[];
  isLoading?: boolean;
}

export function OverdueTable({ items, isLoading }: OverdueTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    );
  }

  if (items.length === 0) {
    return <p className="text-sm text-surface-400 text-center py-4">No overdue invoices</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-surface-200 text-left text-xs font-medium uppercase tracking-wide text-surface-500">
            <th scope="col" className="px-3 py-2">Invoice</th>
            <th scope="col" className="px-3 py-2">Tenant</th>
            <th scope="col" className="px-3 py-2 text-right">Amount</th>
            <th scope="col" className="px-3 py-2">Due</th>
            <th scope="col" className="px-3 py-2">Overdue</th>
            <th scope="col" className="px-3 py-2"><span className="sr-only">Action</span></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-surface-100 hover:bg-surface-50">
              <td className="px-3 py-2 font-medium text-surface-900">{item.invoice_number}</td>
              <td className="px-3 py-2 text-surface-600">{item.tenant_name}</td>
              <td className="px-3 py-2 text-right font-medium text-red-600">
                {`฿${item.amount.toLocaleString()}`}
              </td>
              <td className="px-3 py-2 text-surface-500">{item.due_date}</td>
              <td className="px-3 py-2">
                <Badge variant={item.days_overdue > 30 ? 'danger' : 'warning'}>
                  {`${item.days_overdue}d`}
                </Badge>
              </td>
              <td className="px-3 py-2 text-right">
                <Link
                  to={`/invoices/${item.id}`}
                  className="text-primary-600 hover:text-primary-700 text-xs font-medium"
                >
                  View
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}