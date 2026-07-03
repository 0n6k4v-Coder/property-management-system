// File: src/features/maintenance/MaintenanceFormPage.tsx
// Create new maintenance request form with room/property selection, priority.
// SCR-MAINT-CREATE: POST /maintenance-requests

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCreateMaintenance } from './api';
import { useProperties } from '@/features/property/api';
import { usePropertyWithRooms } from '@/features/property/api';
import { Card, CardHeader } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { useToast } from '@/shared/ui/Toast';

export default function MaintenanceFormPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const createMutation = useCreateMaintenance();
  const { data: properties } = useProperties();

  const [propertyId, setPropertyId] = useState('');
  const [roomId, setRoomId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');

  const { data: propertyWithRooms } = usePropertyWithRooms(propertyId || null);
  const rooms = propertyWithRooms?.rooms ?? [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!propertyId || !roomId || !title.trim() || !description.trim()) {
      showToast('Please fill in all required fields', 'error');
      return;
    }
    try {
      await createMutation.mutateAsync({
        property_id: propertyId,
        room_id: roomId,
        title,
        description,
        priority,
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
              Property <span className="text-red-500">*</span>
            </label>
            <select
              id="maint-property"
              value={propertyId}
              onChange={(e) => { setPropertyId(e.target.value); setRoomId(''); }}
              required
              className="mt-1 block w-full rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-primary-500"
            >
              <option value="">Select a property…</option>
              {(properties ?? []).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Room (depends on property) */}
          {propertyId && (
            <div>
              <label htmlFor="maint-room" className="block text-sm font-medium text-surface-700">
                Room <span className="text-red-500">*</span>
              </label>
              <select
                id="maint-room"
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

          {/* Title */}
          <Input
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Leaking faucet in bathroom"
            required
          />

          {/* Description */}
          <div>
            <label htmlFor="maint-description" className="block text-sm font-medium text-surface-700">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              id="maint-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              required
              className="mt-1 block w-full rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-primary-500"
              placeholder="Describe the issue in detail…"
            />
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-surface-700">Priority</label>
            <div className="mt-2 flex flex-wrap gap-4">
              {(['low', 'medium', 'high', 'urgent'] as const).map((p) => (
                <label key={p} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="priority"
                    value={p}
                    checked={priority === p}
                    onChange={() => setPriority(p)}
                    className="h-4 w-4 text-primary-600 border-surface-300 focus:ring-primary-500"
                  />
                  <span className="capitalize">{p}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => navigate('/maintenance')}>Cancel</Button>
            <Button type="submit" isLoading={createMutation.isPending}>
              Submit Request
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}