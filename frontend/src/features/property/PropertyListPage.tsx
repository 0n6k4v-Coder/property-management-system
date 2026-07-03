// File: src/features/property/PropertyListPage.tsx
// Dynamic property list from DB + create property form.
// When no properties exist → show empty state with create form.
// When properties exist → show property cards with room counts.

import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useProperties, usePropertyWithRooms, useCreateProperty } from './api';
import { Card, CardHeader } from '@/shared/ui/Card';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { Modal } from '@/shared/ui/Modal';
import { CardSkeleton } from '@/shared/ui/CardSkeleton';
import { statusToVariant } from '@/shared/utils/status';
import type { API } from '@/types/api.d';

// ── Page ────────────────────────────────────────────────────────────

export default function PropertyListPage() {
  const { id: selectedPropertyId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { data: properties, isLoading: listLoading } = useProperties();
  const { data: propertyData, isLoading: detailLoading } = usePropertyWithRooms(selectedPropertyId ?? null);

  // Loading state for property list
  if (listLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-surface-900">Property Management</h1>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <CardSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  // Empty state — no properties yet
  if (!properties || properties.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Property Management</h1>
          <p className="mt-1 text-sm text-surface-500">
            Manage buildings, rooms, and their status
          </p>
        </div>
        <EmptyState />
      </div>
    );
  }

  // Selected property → show detail
  if (selectedPropertyId) {
    if (detailLoading) {
      return (
        <div className="space-y-6">
          <BackButton onClick={() => navigate('/property')} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => <CardSkeleton key={i} />)}
          </div>
        </div>
      );
    }

    if (propertyData) {
      return (
        <div className="space-y-6">
          <BackButton onClick={() => navigate('/property')} />
          <PropertyDetail property={propertyData.property} rooms={propertyData.rooms} />
        </div>
      );
    }
  }

  // Property list
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Property Management</h1>
          <p className="mt-1 text-sm text-surface-500">
            Manage buildings, rooms, and their status
          </p>
        </div>
        <Button variant="primary" onClick={() => setShowCreateModal(true)}>
          + Create Property
        </Button>
      </div>
      <PropertyGrid properties={properties} onSelect={(id) => navigate(`/property/${id}`)} />

      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New Property"
      >
        <CreatePropertyForm
          onCancel={() => setShowCreateModal(false)}
          onSuccess={() => setShowCreateModal(false)}
        />
      </Modal>
    </div>
  );
}

// ── Empty State ─────────────────────────────────────────────────────

function EmptyState() {
  const [showForm, setShowForm] = useState(false);

  if (showForm) {
    return <CreatePropertyForm onCancel={() => setShowForm(false)} onSuccess={() => setShowForm(false)} />;
  }

  return (
    <Card className="text-center py-12">
      <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-surface-100">
        <svg className="size-8 text-surface-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3H21m-3.75 3H21" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-surface-900">No Properties Yet</h3>
      <p className="mt-2 text-sm text-surface-500 max-w-sm mx-auto">
        Create your first property to start managing buildings, rooms, and tenants.
      </p>
      <div className="mt-6">
        <Button variant="primary" onClick={() => setShowForm(true)}>
          + Create Property
        </Button>
      </div>
    </Card>
  );
}

// ── Create Property Form ────────────────────────────────────────────

interface CreatePropertyFormProps {
  onCancel: () => void;
  onSuccess: () => void;
}

function CreatePropertyForm({ onCancel, onSuccess }: CreatePropertyFormProps) {
  const createProperty = useCreateProperty();
  const [form, setForm] = useState({
    name: '',
    address: '',
    billing_due_day: 5,
    min_deposit_months: 2,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Property name is required';
    if (!form.address.trim()) e.address = 'Address is required';
    if (form.billing_due_day < 1 || form.billing_due_day > 28) e.billing_due_day = 'Must be 1–28';
    if (form.min_deposit_months < 1) e.min_deposit_months = 'Must be at least 1';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    try {
      await createProperty.mutateAsync({
        name: form.name.trim(),
        address: form.address.trim(),
        billing_due_day: form.billing_due_day,
        min_deposit_months: form.min_deposit_months,
      });
      onSuccess();
    } catch (err) {
      setErrors({ submit: err instanceof Error ? err.message : 'Failed to create property' });
    }
  }

  return (
    <Card>
      <CardHeader title="Create New Property" subtitle="Fill in the details below" />
      <form onSubmit={handleSubmit} className="space-y-4 mt-4" noValidate>
        <Input
          label="Property Name"
          placeholder="e.g. Sathorn Condominium"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          error={errors.name}
          required
        />
        <Input
          label="Address"
          placeholder="e.g. 123 Sathorn Road, Bangkok"
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
          error={errors.address}
          required
        />
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Billing Due Day"
            type="number"
            min={1}
            max={28}
            value={form.billing_due_day}
            onChange={(e) => setForm({ ...form, billing_due_day: Number(e.target.value) })}
            error={errors.billing_due_day}
            required
          />
          <Input
            label="Min Deposit (months)"
            type="number"
            min={1}
            value={form.min_deposit_months}
            onChange={(e) => setForm({ ...form, min_deposit_months: Number(e.target.value) })}
            error={errors.min_deposit_months}
            required
          />
        </div>

        {errors.submit && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {errors.submit}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <Button type="submit" variant="primary" isLoading={createProperty.isPending}>
            Create Property
          </Button>
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}

// ── Property Grid ───────────────────────────────────────────────────

function PropertyGrid({
  properties,
  onSelect,
}: {
  properties: API.PropertyResponse[];
  onSelect: (id: string) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {properties.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onSelect(p.id)}
          className="text-left rounded-xl border border-surface-200 bg-white p-5 transition-all hover:border-primary-300 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
        >
          <h3 className="font-semibold text-surface-900 truncate">{p.name}</h3>
          <p className="mt-1 text-sm text-surface-500 truncate">{p.address}</p>
          <div className="mt-3 flex items-center gap-4 text-xs text-surface-400">
            <span>Due: Day {p.billing_due_day}</span>
            <span>Deposit: {p.min_deposit_months}mo</span>
          </div>
        </button>
      ))}
    </div>
  );
}

// ── Property Detail ─────────────────────────────────────────────────

function PropertyDetail({ property, rooms }: { property: API.PropertyResponse; rooms: API.RoomResponse[] }) {
  const available = rooms.filter((r) => r.status === 'available').length;
  const occupied = rooms.filter((r) => r.status === 'occupied').length;
  const maintenance = rooms.filter((r) => r.status === 'maintenance').length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title={property.name} subtitle={property.address} />
        <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <Stat label="Due Day" value={`Day ${property.billing_due_day}`} />
          <Stat label="Deposit" value={`${property.min_deposit_months} months`} />
          <Stat label="Total Rooms" value={String(rooms.length)} />
          <Stat label="Available" value={String(available)} />
        </div>
        <div className="mt-3 flex gap-2">
          <Badge variant="success">{`${String(available)} available`}</Badge>
          <Badge variant="info">{`${String(occupied)} occupied`}</Badge>
          {maintenance > 0 && <Badge variant="warning">{`${String(maintenance)} maintenance`}</Badge>}
        </div>
      </Card>

      <div className="space-y-3">
        {rooms.map((room) => (
          <Link
            key={room.id}
            to={`/property/rooms/${room.id}`}
            className="block rounded-lg border border-surface-200 bg-white p-4 transition-colors hover:border-primary-300 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="font-medium text-surface-900">Room {room.room_number}</span>
                <span className="text-sm text-surface-400 capitalize">
                  {room.room_type.replace('_', ' ')}
                </span>
              </div>
              <Badge variant={statusToVariant(room.status)}>{room.status}</Badge>
            </div>
            <div className="mt-1 text-sm text-surface-500">
              Rent: ฿{Number(room.base_rent).toLocaleString()}
            </div>
          </Link>
        ))}
        {rooms.length === 0 && (
          <Card className="text-center py-8 text-surface-400 text-sm">
            No rooms yet. Add buildings and rooms to this property.
          </Card>
        )}
      </div>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 text-sm text-surface-500 hover:text-surface-900 transition-colors"
    >
      <svg className="size-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
      </svg>
      Back to properties
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-surface-400">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-surface-900">{value}</p>
    </div>
  );
}
