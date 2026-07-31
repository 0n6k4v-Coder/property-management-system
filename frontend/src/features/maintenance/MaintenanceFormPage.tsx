// File: src/features/maintenance/MaintenanceFormPage.tsx
// Create new maintenance request form with room/property selection, priority.
// SCR-MAINT-CREATE: POST /maintenance-requests

import { useReducer } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCreateMaintenance } from './api';
import { useProperties } from '@/features/property/api';
import { usePropertyWithRooms } from '@/features/property/api';
import { Card, CardHeader } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { useToast } from '@/shared/ui/Toast';

type State = {
  propertyId: string;
  roomId: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
};

type Action =
  | { type: 'SET_PROPERTY'; payload: string }
  | { type: 'SET_ROOM'; payload: string }
  | { type: 'SET_TITLE'; payload: string }
  | { type: 'SET_DESCRIPTION'; payload: string }
  | { type: 'SET_PRIORITY'; payload: 'low' | 'medium' | 'high' | 'urgent' }
  | { type: 'RESET' };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_PROPERTY':
      return { ...state, propertyId: action.payload, roomId: '' };
    case 'SET_ROOM':
      return { ...state, roomId: action.payload };
    case 'SET_TITLE':
      return { ...state, title: action.payload };
    case 'SET_DESCRIPTION':
      return { ...state, description: action.payload };
    case 'SET_PRIORITY':
      return { ...state, priority: action.payload };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

const initialState: State = {
  propertyId: '',
  roomId: '',
  title: '',
  description: '',
  priority: 'medium',
};

export default function MaintenanceFormPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const createMutation = useCreateMaintenance();
  const { data: properties } = useProperties();
  const [state, dispatch] = useReducer(reducer, initialState);

  const { data: propertyWithRooms } = usePropertyWithRooms(state.propertyId || null);
  const rooms = propertyWithRooms?.rooms ?? [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!state.propertyId || !state.roomId || !state.title.trim() || !state.description.trim()) {
      showToast('Please fill in all required fields', 'error');
      return;
    }
    try {
      await createMutation.mutateAsync({
        property_id: state.propertyId,
        room_id: state.roomId,
        title: state.title,
        description: state.description,
        priority: state.priority,
      });
      showToast('Maintenance request created', 'success');
      navigate('/maintenance');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Creation failed', 'error');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-surface-900">New Maintenance Request</h1>
        <p className="mt-1 text-sm text-surface-500">Submit a maintenance request for a room</p>
      </div>

      <Card>
        <CardHeader title="Request Details" />
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Property */}
          <div>
            <label htmlFor="maint-property" className="block text-sm font-medium text-surface-700">
              Property <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <select
              id="maint-property"
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

          {/* Room (depends on property) */}
          {state.propertyId && (
            <div>
              <label htmlFor="maint-room" className="block text-sm font-medium text-surface-700">
                Room <span className="text-red-500" aria-hidden="true">*</span>
              </label>
              <select
                id="maint-room"
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

          {/* Title */}
          <Input
            label="Title"
            requiredIndicator={true}
            value={state.title}
            onChange={(e) => dispatch({ type: 'SET_TITLE', payload: e.target.value })}
            placeholder="e.g., Leaking faucet in bathroom"
            required
          />

          {/* Description */}
          <div>
            <label htmlFor="maint-description" className="block text-sm font-medium text-surface-700">
              Description <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <textarea
              id="maint-description"
              value={state.description}
              onChange={(e) => dispatch({ type: 'SET_DESCRIPTION', payload: e.target.value })}
              rows={4}
              required
              className="mt-1 block w-full rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-primary-500"
              placeholder="Describe the issue in detail…"
              aria-describedby="maint-description-hint"
              aria-label="Maintenance issue description"
            />
            <p id="maint-description-hint" className="mt-1 text-xs text-surface-500">
              Describe the maintenance issue in detail
            </p>
          </div>

          {/* Priority */}
          <fieldset>
            <legend className="block text-sm font-medium text-surface-700">Priority</legend>
            <div className="mt-2 flex flex-wrap gap-4" role="radiogroup" aria-label="Priority level">
              {(['low', 'medium', 'high', 'urgent'] as const).map((p) => (
                <label key={p} className="flex items-center gap-2 cursor-pointer" htmlFor={`priority-${p}`}>
                  <input
                    type="radio"
                    id={`priority-${p}`}
                    name="priority"
                    value={p}
                    checked={state.priority === p}
                    onChange={() => dispatch({ type: 'SET_PRIORITY', payload: p })}
                    className="size-4 text-primary-600 border-surface-300 focus:ring-primary-500"
                    aria-label={p}
                  />
                  <span className="capitalize">{p}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => navigate('/maintenance')}>
              Cancel
            </Button>
            <Button type="submit" isLoading={createMutation.isPending}>
              Submit Request
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}