// File: src/features/contract/ContractListPage.tsx
// Active contracts list with property filter, status badges, and quick actions.
// SCR-CONTRACT-LIST: GET /contracts/active

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useActiveContracts } from './api';
import { useProperties } from '@/features/property/api';
import { Card } from '@/shared/ui/Card';
import { Badge } from '@/shared/ui/Badge';
import { TableSkeleton } from '@/shared/ui/TableSkeleton';
import { Button } from '@/shared/ui/Button';

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

function formatCurrency(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return num.toLocaleString('en-US');
}

export default function ContractListPage() {
  const [propertyId, setPropertyId] = useState<string>('');
  const { data: properties } = useProperties();
  const { data: contracts, isLoading } = useActiveContracts(propertyId || undefined);
  const contractList = contracts ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Contracts</h1>
          <p className="mt-1 text-sm text-surface-500">
            View and manage active rental contracts
          </p>
        </div>
        <Link to="/contracts/new">
          <Button>New Contract</Button>
        </Link>
      </div>

      {/* Property filter */}
      <div className="flex items-center gap-3">
        <label htmlFor="property-filter" className="text-sm font-medium text-surface-700">
          Filter by property:
        </label>
        <select
          id="property-filter"
          value={propertyId}
          onChange={(e) => setPropertyId(e.target.value)}
          className="rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm text-surface-900 focus-visible:outline-2 focus-visible:outline-primary-500"
        >
          <option value="">All properties</option>
          {(properties ?? []).map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {isLoading && <TableSkeleton rows={4} />}

      {!isLoading && contractList.length === 0 && (
        <Card className="text-center py-8 text-surface-400">
          <p>No active contracts found.</p>
        </Card>
      )}

      {!isLoading && contractList.length > 0 && (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-50 text-left text-xs font-medium uppercase tracking-wide text-surface-500">
                  <th scope="col" className="px-4 py-3">Contract ID</th>
                  <th scope="col" className="px-4 py-3">Room</th>
                  <th scope="col" className="px-4 py-3">Tenant</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3">Period</th>
                  <th scope="col" className="px-4 py-3 text-right">Monthly Rent</th>
                  <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {contractList.map((contract) => (
                  <tr key={contract.id} className="border-b border-surface-100 transition-colors hover:bg-surface-50">
                    <td className="px-4 py-3 font-medium text-surface-900">
                      {contract.id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3 text-surface-600">{contract.room_id.slice(0, 8)}</td>
                    <td className="px-4 py-3 text-surface-600">{contract.tenant_id.slice(0, 8)}</td>
                    <td className="px-4 py-3"><Badge>{contract.status}</Badge></td>
                    <td className="px-4 py-3 text-surface-600">
                      {formatDate(contract.start_date)} - {formatDate(contract.end_date)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-surface-900">
                      {formatCurrency(contract.monthly_rent)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/contracts/${contract.id}`}
                        className="text-sm font-medium text-primary-600 hover:text-primary-700 focus-visible:outline-2 focus-visible:outline-primary-500"
                        aria-label={`View contract ${contract.id.slice(0, 8)}`}
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
