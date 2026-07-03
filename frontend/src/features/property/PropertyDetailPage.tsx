// File: src/features/property/PropertyDetailPage.tsx
// Property detail with rooms list — fetches property + rooms via /api/v1/properties/:id/rooms

import { useParams } from 'react-router-dom';
import { usePropertyWithRooms } from './api';
import { Card, CardHeader } from '@/shared/ui/Card';
import { Skeleton } from '@/shared/ui';
import { Link } from 'react-router-dom';

const statusStyles: Record<string, string> = {
  available: 'bg-green-100 text-green-700',
  occupied: 'bg-amber-100 text-amber-700',
  maintenance: 'bg-red-100 text-red-700',
};

function formatCurrency(amount: number): string {
  return amount.toLocaleString('en-US');
}

export default function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: propertyWithRooms, isLoading } = usePropertyWithRooms(id ?? null);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-1/4" />
        <Skeleton className="h-4 w-1/2" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </div>
    );
  }

  if (!propertyWithRooms) {
    return (
      <Card className="text-center py-8 text-surface-400">
        <p>Property not found.</p>
      </Card>
    );
  }

  const { property, rooms } = propertyWithRooms;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            to="/property"
            className="text-sm text-primary-600 hover:text-primary-700 mb-2 inline-block"
          >
            &larr; Back to properties
          </Link>
          <h1 className="text-2xl font-bold text-surface-900">{property.name}</h1>
          <p className="mt-1 text-sm text-surface-500">{property.address}</p>
        </div>
      </div>

      <Card>
        <CardHeader title="Property Info" />
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-surface-500">Billing Due Day</dt>
            <dd className="mt-1 text-sm text-surface-900">Day {property.billing_due_day}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-surface-500">Min Deposit</dt>
            <dd className="mt-1 text-sm text-surface-900">{property.min_deposit_months} months</dd>
          </div>
        </dl>
      </Card>

      <div>
        <h2 className="text-lg font-semibold text-surface-900 mb-3">Rooms</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map((room) => (
            <Link
              key={room.id}
              to={`/property/rooms/${room.id}`}
              className="block rounded-xl border border-surface-200 bg-white p-5 transition-all hover:border-primary-300 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500"
            >
              <h3 className="font-semibold text-surface-900 truncate">
                Room {room.room_number}
              </h3>
              <p className="mt-1 text-sm text-surface-500 capitalize">{room.room_type}</p>
              <div className="mt-3 flex items-center gap-4 text-xs text-surface-400">
                <span className="flex items-center gap-1">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[room.status] ?? 'bg-surface-100 text-surface-700'}`}>
                    {room.status}
                  </span>
                </span>
                <span>Rent: ฿{formatCurrency(Number(room.base_rent))}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}