// File: src/features/tenant/TenantListPage.tsx
// Search bar (debounce 300ms), table/card responsive, create modal.
// SCR-TENANT-LIST: GET /tenants/search, POST /tenants

import { useState, useRef, useEffect, useReducer } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSearchTenants, useCreateTenant } from './api';
import { useProperties } from '@/features/property/api';
import { Card } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { Modal } from '@/shared/ui/Modal';
import { TableSkeleton } from '@/shared/ui/TableSkeleton';
import { useToast } from '@/shared/ui/Toast';
import { createTenantSchema, type CreateTenantForm } from '@/shared/utils/validators';

// Use the real seeded property ID from the E2E fixtures for search fallback
import { SEEDED } from '@/../e2e/fixtures/seeded-ids';
const DEFAULT_PROPERTY_ID = SEEDED.propertySunsetId;

interface SearchState {
  debouncedQuery: string;
  page: number;
}

export default function TenantListPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // useReducer for related paging state to avoid cascading setState
  const [search, dispatch] = useReducer(
    (state: SearchState, action: { type: 'DEBOUNCE' | 'PAGE'; value?: string }) => {
      switch (action.type) {
        case 'DEBOUNCE':
          return { debouncedQuery: action.value ?? '', page: 1 };
        case 'PAGE':
          return { ...state, page: action.value ? Number(action.value) : state.page };
        default:
          return state;
      }
    },
    { debouncedQuery: '', page: 1 },
  );

  // Debounce 300ms
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      dispatch({ type: 'DEBOUNCE', value: searchQuery });
    }, 300);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [searchQuery]);

  const { data: searchResults, isLoading } = useSearchTenants(
    { propertyId: DEFAULT_PROPERTY_ID, query: search.debouncedQuery, page: search.page },
    search.debouncedQuery.length >= 3,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Tenants</h1>
          <p className="mt-1 text-sm text-surface-500">
            Search and manage tenants
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>New Tenant</Button>
      </div>

      {/* Search */}
      <div className="max-w-md">
        <Input
          label="Search tenants"
          placeholder="Search by name, phone, or email (min. 3 chars)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-autocomplete="list"
        />
      </div>

      {/* Results */}
      {isLoading && <TableSkeleton rows={4} />}

      {searchResults && searchResults.data.length > 0 && (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-50 text-left text-xs font-medium uppercase tracking-wide text-surface-500">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Emergency Contact</th>
                </tr>
              </thead>
              <tbody>
                {searchResults.data.map((tenant) => (
                  <tr
                    key={tenant.id}
                    className="border-b border-surface-100 transition-colors hover:bg-surface-50"
                  >
                    <td className="px-4 py-3 font-medium text-surface-900">
                      {tenant.full_name}
                    </td>
                    <td className="px-4 py-3 text-surface-600">{tenant.phone}</td>
                    <td className="px-4 py-3 text-surface-500">{tenant.email ?? '—'}</td>
                    <td className="px-4 py-3 text-surface-500">
                      {tenant.emergency_contact_name
                        ? `${tenant.emergency_contact_name} (${tenant.emergency_contact_phone ?? ''})`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          {searchResults.meta && (
            <div className="flex items-center justify-between border-t border-surface-200 px-4 py-3">
              <span className="text-sm text-surface-500">
                {searchResults.meta.total} result{searchResults.meta.total !== 1 ? 's' : ''}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={search.page <= 1}
                  onClick={() => dispatch({ type: 'PAGE', value: String(search.page - 1) })}
                >
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!searchResults.meta.has_next}
                  onClick={() => dispatch({ type: 'PAGE', value: String(search.page + 1) })}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {searchResults && searchResults.data.length === 0 && search.debouncedQuery.length >= 3 && (
        <Card className="text-center text-surface-400 py-8">
          No tenants found matching &quot;{search.debouncedQuery}&quot;
        </Card>
      )}

      {search.debouncedQuery.length < 3 && !isLoading && (
        <Card className="text-center text-surface-400 py-8">
          Type at least 3 characters to search
        </Card>
      )}

      {/* Create Modal */}
      <CreateTenantModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}

// ── Create Tenant Modal ─────────────────────────────────────────────

function CreateTenantModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { showToast } = useToast();
  const createTenant = useCreateTenant();
  const { data: properties, isLoading: isPropertiesLoading } = useProperties();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateTenantForm>({
    resolver: zodResolver(createTenantSchema),
    defaultValues: {
      property_id: '',
      full_name: '',
      id_card_number: '',
      phone: '',
      email: '',
      emergency_contact_name: '',
      emergency_contact_phone: '',
    },
  });

  async function onSubmit(data: CreateTenantForm) {
    try {
      await createTenant.mutateAsync(data);
      showToast('Tenant created successfully', 'success');
      reset();
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create tenant', 'error');
    }
  }

  function handleCancel() {
    reset();
    onClose();
  }

  return (
    <Modal open={open} onClose={handleCancel} title="Create Tenant">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {/* Property Selector */}
        <div>
          <label htmlFor="tenant-property-select" className="block text-sm font-medium text-surface-700">
            Property <span className="text-red-500" aria-hidden="true">*</span>
          </label>
          <select
            id="tenant-property-select"
            {...register('property_id')}
            disabled={isPropertiesLoading}
            className="mt-1 block w-full rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-primary-500 disabled:cursor-not-allowed disabled:bg-surface-100"
          >
            <option value="">Select a property…</option>
            {(properties ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {errors.property_id && (
            <p className="mt-1 text-xs text-red-600">{errors.property_id.message}</p>
          )}
        </div>

        <Input
          label="Full Name"
          {...register('full_name')}
          error={errors.full_name?.message}
        />
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="ID Card (13 digits)"
            {...register('id_card_number')}
            error={errors.id_card_number?.message}
            maxLength={13}
            placeholder="1234567890123"
          />
          <Input
            label="Phone (10 digits)"
            {...register('phone')}
            error={errors.phone?.message}
            maxLength={10}
            placeholder="0812345678"
          />
        </div>
        <Input
          label="Email (optional)"
          type="email"
          {...register('email')}
          error={errors.email?.message}
        />
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Emergency Contact Name"
            {...register('emergency_contact_name')}
            error={errors.emergency_contact_name?.message}
          />
          <Input
            label="Emergency Contact Phone"
            {...register('emergency_contact_phone')}
            error={errors.emergency_contact_phone?.message}
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={handleCancel}>Cancel</Button>
          <Button type="submit" isLoading={createTenant.isPending}>Create</Button>
        </div>
      </form>
    </Modal>
  );
}