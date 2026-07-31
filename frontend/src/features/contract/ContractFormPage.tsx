// File: src/features/contract/ContractFormPage.tsx
// Create new contract form with room/tenant selection, rent, deposit, dates.
// SCR-CONTRACT-CREATE: POST /contracts

import { useReducer } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCreateContract } from './api';
import { useProperties } from '@/features/property/api';
import { usePropertyWithRooms } from '@/features/property/api';
import { useSearchTenants } from '@/features/tenant/api';
import { Card, CardHeader } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { useToast } from '@/shared/ui/Toast';

type State = {
  propertyId: string;
  roomId: string;
  tenantId: string;
  tenantSearch: string;
  startDate: string;
  endDate: string;
  monthlyRent: string;
  depositAmount: string;
  specialConditions: string;
};

type Action =
  | { type: 'SET_PROPERTY'; payload: string }
  | { type: 'SET_ROOM'; payload: string }
  | { type: 'SET_TENANT'; payload: string }
  | { type: 'SET_TENANT_SEARCH'; payload: string }
  | { type: 'SET_START_DATE'; payload: string }
  | { type: 'SET_END_DATE'; payload: string }
  | { type: 'SET_MONTHLY_RENT'; payload: string }
  | { type: 'SET_DEPOSIT_AMOUNT'; payload: string }
  | { type: 'SET_SPECIAL_CONDITIONS'; payload: string }
  | { type: 'RESET' };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_PROPERTY':
      return { ...state, propertyId: action.payload, roomId: '', tenantId: '' };
    case 'SET_ROOM':
      return { ...state, roomId: action.payload };
    case 'SET_TENANT':
      return { ...state, tenantId: action.payload, tenantSearch: '' };
    case 'SET_TENANT_SEARCH':
      return { ...state, tenantSearch: action.payload };
    case 'SET_START_DATE':
      return { ...state, startDate: action.payload };
    case 'SET_END_DATE':
      return { ...state, endDate: action.payload };
    case 'SET_MONTHLY_RENT':
      return { ...state, monthlyRent: action.payload };
    case 'SET_DEPOSIT_AMOUNT':
      return { ...state, depositAmount: action.payload };
    case 'SET_SPECIAL_CONDITIONS':
      return { ...state, specialConditions: action.payload };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

const initialState: State = {
  propertyId: '',
  roomId: '',
  tenantId: '',
  tenantSearch: '',
  startDate: '',
  endDate: '',
  monthlyRent: '',
  depositAmount: '',
  specialConditions: '',
};

export default function ContractFormPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const createMutation = useCreateContract();
  const { data: properties } = useProperties();
  const [state, dispatch] = useReducer(reducer, initialState);

  const { data: propertyWithRooms } = usePropertyWithRooms(state.propertyId || null);
  const { data: tenantResults } = useSearchTenants(
    { propertyId: state.propertyId, query: state.tenantSearch },
    state.propertyId !== '' && state.tenantSearch.length >= 3,
  );

  const rooms = propertyWithRooms?.rooms ?? [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (
      !state.propertyId ||
      !state.roomId ||
      !state.tenantId ||
      !state.startDate ||
      !state.endDate ||
      !state.monthlyRent ||
      !state.depositAmount
    ) {
      showToast('Please fill in all required fields', 'error');
      return;
    }
    try {
      await createMutation.mutateAsync({
        property_id: state.propertyId,
        room_id: state.roomId,
        tenant_id: state.tenantId,
        start_date: state.startDate,
        end_date: state.endDate,
        monthly_rent: parseFloat(state.monthlyRent),
        deposit_amount: parseFloat(state.depositAmount),
        special_conditions: state.specialConditions || null,
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
              Property <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <select
              id="property-select"
              value={state.propertyId}
              onChange={(e) => dispatch({ type: 'SET_PROPERTY', payload: e.target.value })}
              required
              className="mt-1 block w-full rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-primary-500"
            >
              <option value="">Select a property…</option>
              {(properties ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Room selection (depends on property) */}
          {state.propertyId && (
            <div>
              <label htmlFor="room-select" className="block text-sm font-medium text-surface-700">
                Room <span className="text-red-500" aria-hidden="true">*</span>
              </label>
              <select
                id="room-select"
                value={state.roomId}
                onChange={(e) => dispatch({ type: 'SET_ROOM', payload: e.target.value })}
                required
                className="mt-1 block w-full rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-primary-500"
              >
                <option value="">Select a room…</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.room_number} ({r.room_type}) - {r.status}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Tenant search */}
          {state.propertyId && (
            <div>
              <label htmlFor="tenant-search" className="block text-sm font-medium text-surface-700">
                Search Tenant <span className="text-red-500" aria-hidden="true">*</span>
              </label>
              <input
                id="tenant-search"
                type="text"
                list="tenant-options"
                value={state.tenantSearch}
                onChange={(e) => dispatch({ type: 'SET_TENANT_SEARCH', payload: e.target.value })}
                placeholder="Type at least 3 characters…"
                className="mt-1 block w-full rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-primary-500"
                aria-autocomplete="list"
                aria-describedby="tenant-search-hint"
                aria-label="Search tenant by name"
              />
              <p id="tenant-search-hint" className="mt-1 text-xs text-surface-500">
                Type at least 3 characters to search
              </p>
              {tenantResults && tenantResults.data.length > 0 && (
                <datalist id="tenant-options">
                  {tenantResults.data.map((t) => (
                    <option
                      key={t.id}
                      value={t.full_name}
                      data-tenant-id={t.id}
                    >
                      {t.full_name} - {t.phone}
                    </option>
                  ))}
                </datalist>
              )}
              {state.tenantId && (
                <p className="mt-1 text-xs text-green-600">Selected tenant ID: {state.tenantId.slice(0, 8)}</p>
              )}
            </div>
          )}

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Start Date"
              requiredIndicator={true}
              type="date"
              value={state.startDate}
              onChange={(e) => dispatch({ type: 'SET_START_DATE', payload: e.target.value })}
              required
            />
            <Input
              label="End Date"
              requiredIndicator={true}
              type="date"
              value={state.endDate}
              onChange={(e) => dispatch({ type: 'SET_END_DATE', payload: e.target.value })}
              required
            />
          </div>

          {/* Rent and Deposit */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Monthly Rent (THB)"
              requiredIndicator={true}
              type="number"
              min="0"
              step="0.01"
              value={state.monthlyRent}
              onChange={(e) => dispatch({ type: 'SET_MONTHLY_RENT', payload: e.target.value })}
              required
            />
            <Input
              label="Deposit Amount (THB)"
              requiredIndicator={true}
              type="number"
              min="0"
              step="0.01"
              value={state.depositAmount}
              onChange={(e) => dispatch({ type: 'SET_DEPOSIT_AMOUNT', payload: e.target.value })}
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
              value={state.specialConditions}
              onChange={(e) => dispatch({ type: 'SET_SPECIAL_CONDITIONS', payload: e.target.value })}
              rows={3}
              maxLength={2000}
              className="mt-1 block w-full rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-primary-500"
              aria-describedby="special-conditions-hint"
              aria-label="Special conditions for the contract"
            />
            <p id="special-conditions-hint" className="mt-1 text-xs text-surface-500">
              Optional special conditions for this contract
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => navigate('/contracts')}>
              Cancel
            </Button>
            <Button type="submit" isLoading={createMutation.isPending}>
              Create Contract
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}