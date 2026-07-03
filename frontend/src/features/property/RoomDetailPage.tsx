// File: src/features/property/RoomDetailPage.tsx
// Tabbed interface: Overview / Contract / Meter History.
// SCR-ROOM-DETAIL: useParams + useQuery, tabs.

import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, CardHeader } from '@/shared/ui/Card';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import type { ReactNode } from 'react';

type Tab = 'overview' | 'contract' | 'meter';

export default function RoomDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-surface-500">
        <Link to="/property" className="hover:text-primary-600">Property</Link>
        <span>/</span>
        <span className="text-surface-900">Room {id?.slice(0, 8)}</span>
      </nav>

      {/* Tabs */}
      <div className="border-b border-surface-200" role="tablist">
        <div className="flex gap-0">
          {(['overview', 'contract', 'meter'] as Tab[]).map((tab) => (
            <button
              key={tab}
              role="tab"
              aria-selected={activeTab === tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-surface-500 hover:text-surface-700'
              }`}
              type="button"
            >
              {tab === 'overview' ? 'Overview' : tab === 'contract' ? 'Contract' : 'Meter History'}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <Card>
        {activeTab === 'overview' && <OverviewTab roomId={id ?? ''} />}
        {activeTab === 'contract' && <ContractTab />}
        {activeTab === 'meter' && <MeterTab />}
      </Card>
    </div>
  );
}

function OverviewTab({ roomId }: { roomId: string }) {
  return (
    <div className="space-y-4">
      <CardHeader title="Room Details" subtitle={`ID: ${roomId}`} />
      <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
        <InfoItem label="Room Number" value={roomId.slice(0, 8)} />
        <InfoItem label="Status" value={<Badge>available</Badge>} />
        <InfoItem label="Type" value="—" />
        <InfoItem label="Base Rent" value="—" />
        <InfoItem label="Floor" value="—" />
        <InfoItem label="Building" value="—" />
      </div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string | ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-surface-400">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-surface-900">{value}</p>
    </div>
  );
}

function ContractTab() {
  return (
    <div className="text-center py-8 text-surface-400">
      <p>No active contract for this room.</p>
      <p className="text-sm mt-1">Contract creation will be available in Sprint 3.</p>
      <Button variant="secondary" className="mt-4" disabled>Create Contract</Button>
    </div>
  );
}

function MeterTab() {
  return (
    <div className="text-center py-8 text-surface-400">
      <p>Meter reading history will appear here.</p>
      <p className="text-sm mt-1">Available in Sprint 4+.</p>
    </div>
  );
}