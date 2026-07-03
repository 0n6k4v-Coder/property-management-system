// File: src/features/contract/ContractFormPage.tsx
// Create new contract form with room/tenant selection, rent, deposit, dates.
// SCR-CONTRACT-CREATE: POST /contracts

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCreateContract } from './api';
import { useProperties } from '@/features/property/api';
import { usePropertyWithRooms } from '@/features/property/api';
import { useSearchTenants } from '@/features/tenant/api';
import { Card, CardHeader } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { useToast } from '@/shared/ui/Toast';

export default function ContractFormPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const createMutation = useCreateContract();
  const { data: properties } = useProperties();

  const [propertyId, setPropertyId] = useState('');
  const [roomId, setRoomId] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [tenantSearch, setTenantSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [monthlyRent, setMonthlyRent] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [specialConditions, setSpecialConditions] = useState('');

  const { data: propertyWithRooms } = usePropertyWithRooms(propertyId || null);
  const { data: tenantResults } = useSearchTenants(
    { propertyId, query: tenantSearch },
    propertyId !== '' && tenantSearch.length >= 3,
  );

  const rooms = propertyWithRooms?.rooms ?? [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!propertyId || !roomId || !tenantId || !startDate || !endDate || !monthlyRent || !depositAmount) {
      showToast('Please fill in all required fields', 'error');
      return;
    }
    try {
      await createMutation.mutateAsync({
        property_id: propertyId,
        room_id: roomId,
        tenant_id: tenantId,
        start_date: startDate,
        end_date: endDate,
        monthly_rent: parseFloat(monthlyRent),
        deposit_amount: parseFloat(depositAmount),
        special_conditions: specialConditions || null,
      });
      showToast('Contract created successfully', 'success');
      navigate('/contracts');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Creation failed', 'error');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-surface-900">New Contract</h1>
        <p className="mt-1 text-sm text-surface-500">Create a new rental contract</p>
      </div>

      <Card>
        <CardHeader title="Contract Information" />
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Property selection */}
          <div>
            <label htmlFor="property-select" className="block text-sm font-medium text-surface-700">
              Property <span className="text-red-500">*</span>
            </label>
            <select
              id="property-select"
              value={propertyId}
              onChange={(e) => { setPropertyId(e.target.value); setRoomId(''); setTenantId(''); }}
              required
              className="mt-1 block w-full rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-primary-500"
            >
              <option value="">Select a property…</option>
              {(properties ?? []).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Room selection (depends on property) */}
          {propertyId && (
            <div>
              <label htmlFor="room-select" className="block text-sm font-medium text-surface-700">
                Room <span className="text-red-500">*</span>
              </label>
              <select
                id="room-select"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                required
                className="mt-1 block w-full rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-primary-500"
              >
                <option value="">Select a room…</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.room_number} ({r.room_type}) — {r.status}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Tenant search */}
          {propertyId && (
            <div>
              <label htmlFor="tenant-search" className="block text-sm font-medium text-surface-700">
                Search Tenant <span className="text-red-500">*</span>
              </label>
              <input
                id="tenant-search"
                type="text"
                value={tenantSearch}
                onChange={(e) => setTenantSearch(e.target.value)}
                placeholder="Type at least 3 characters…"
                className="mt-1 block w-full rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-primary-500"
              />
              {tenantResults && tenantResults.data.length > 0 && (
                <ul className="mt-2 divide-y divide-surface-100 rounded-lg border border-surface-200">
                  {tenantResults.data.map((t) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => { setTenantId(t.id); setTenantSearch(t.full_name); }}
                        className={`w-full px-3 py-2 text-left text-sm hover:bg-surface-50 ${
                          tenantId === t.id ? 'bg-primary-50 text-primary-700' : ''
                        }`}
                      >
                        {t.full_name} — {t.phone}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {tenantId && (
                <p className="mt-1 text-xs text-green-600">Selected tenant ID: {tenantId.slice(0, 8)}</p>
              )}
            </div>
          )}

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Start Date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
            <Input
              label="End Date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
            />
          </div>

          {/* Rent and Deposit */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Monthly Rent (THB)"
              type="number"
              min="0"
              step="0.01"
              value={monthlyRent}
              onChange={(e) => setMonthlyRent(e.target.value)}
              required
            />
            <Input
              label="Deposit Amount (THB)"
              type="number"
              min="0"
              step="0.01"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              required
            />
          </div>

          {/* Special Conditions */}
          <div>
            <label htmlFor="special-conditions" className="block text-sm font-medium text-surface-700">
              Special Conditions (optional)
            </label>
            <textarea
              id="special-conditions"
              value={specialConditions}
              onChange={(e) => setSpecialConditions(e.target.value)}
              rows={3}
              maxLength={2000}
              className="mt-1 block w-full rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-primary-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => navigate('/contracts')}>Cancel</Button>
            <Button type="submit" isLoading={createMutation.isPending}>
              Create Contract
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
