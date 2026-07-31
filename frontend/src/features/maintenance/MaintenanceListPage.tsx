// File: src/features/maintenance/MaintenanceListPage.tsx
// Pending maintenance requests list with status badges, actions to view/detail.
// SCR-MAINT-LIST: GET /maintenance-requests/pending
//
// NOTE (E2E Session B, F-30): the request title and the "View" action were
// previously rendered as <Link to={`/maintenance/${req.id}`}>, but there is NO
// `/maintenance/:id` route registered in src/routes/index.tsx (and no detail
// page component exists). Those links were dead: clicking one hit the catch-all
// `*` route → <Navigate to="/login"> → GuestRoute bounced the authenticated
// user back to `/dashboard` (a silent no-op bounce, no 404, no error). The
// backend detail endpoint (GET /maintenance/{id}) and the status/assign PATCH
// endpoints DO exist but are unwired dead code (no UI consumer). Until a real
// maintenance detail page is built (out of E2E scope), the list rows are plain
// text — not fake links to a route that does not resolve.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { usePendingMaintenance } from './api';
import { useProperties } from '@/features/property/api';
import { Card } from '@/shared/ui/Card';
import { Badge } from '@/shared/ui/Badge';
import { TableSkeleton } from '@/shared/ui/TableSkeleton';
import { Button } from '@/shared/ui/Button';
import { statusToVariant } from '@/shared/utils/status';
import type { BadgeVariant } from '@/shared/utils/status';

const priorityToVariant: Record<string, BadgeVariant> = {
  low: 'default',
  medium: 'info',
  high: 'warning',
  urgent: 'danger',
};

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

export default function MaintenanceListPage() {
  const [propertyId, setPropertyId] = useState('');
  const { data: properties } = useProperties();
  const { data: requests, isLoading } = usePendingMaintenance(propertyId || undefined);
  const requestList = requests ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Maintenance Requests</h1>
          <p className="mt-1 text-sm text-surface-urface-urface-500">View and manage pending maintenance requests</p>
        </div>
        <Link to="/maintenance/new">
          <Button>New Request</Button>
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
          className="block w-full max-w-xs rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-primary-500"
        >
          <option value="">All properties</option>
          {(properties ?? []).map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {isLoading && <TableSkeleton rows={4} />}

      {!isLoading && requestList.length === 0 && (
        <Card className="text-center py-8 text-surface-400">
          <p>No pending maintenance requests found.</p>
        </Card>
      )}

      {!isLoading && requestList.length > 0 && (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-50 text-left text-xs font-medium uppercase tracking-wide text-surface-500">
                  <th scope="col" className="px-4 py-3">Request</th>
                  <th scope="col" className="px-4 py-3">Room</th>
                  <th scope="col" className="px-4 py-3">Priority</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody>
                {requestList.map((req) => (
                  <tr key={req.id} className="border-b border-surface-100 transition-colors hover:bg-surface-50">
                    <td className="px-4 py-3">
                      <span className="font-medium text-surface-900">
                        {req.title}
                      </span>
                      <p className="mt-0.5 text-xs text-surface-500 line-clamp-1">{req.description}</p>
                    </td>
                    <td className="px-4 py-3 text-surface-600">Room {req.room_id.slice(0, 8)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={priorityToVariant[req.priority]}>
                        {req.priority}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={statusToVariant(req.status)}>
                        {req.status.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-surface-600">{formatDate(req.created_at)}</td>
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
