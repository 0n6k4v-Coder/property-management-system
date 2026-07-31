// File: src/features/tenant/TenantListPage.tsx
// Search bar (debounce 300ms), table/card responsive, create modal.
// SCR-TENANT-LIST: GET /tenants/search, POST /tenants

import { useState, useRef, useEffect, useReducer } from 'react';
import { useSearchTenants, useCreateTenant } from './api';
import { Card } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { Modal } from '@/shared/ui/Modal';
import { TableSkeleton } from '@/shared/ui/TableSkeleton';
import { useToast } from '@/shared/ui/Toast';
import { createTenantSchema, type CreateTenantForm } from '@/shared/utils/validators';

// Use the real seeded property ID from the E2E fixtures
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
  const [form, setForm] = useState<CreateTenantForm>({
    property_id: DEFAULT_PROPERTY_ID,
    full_name: '',
    id_card_number: '',
    phone: '',
    email: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleSubmit() {
    const parsed = createTenantSchema.safeParse(form);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path[0] as string;
        if (!fieldErrors[path]) fieldErrors[path] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    try {
      await createTenant.mutateAsync(parsed.data);
      showToast('Tenant created successfully', 'success');
      onClose();
      setForm({
        property_id: DEFAULT_PROPERTY_ID,
        full_name: '',
        id_card_number: '',
        phone: '',
        email: '',
        emergency_contact_name: '',
        emergency_contact_phone: '',
      });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create tenant', 'error');
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Create Tenant">
      <div className="space-y-4">
        <Input
          label="Full Name"
          value={form.full_name}
          onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
          error={errors.full_name}
        />
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="ID Card (13 digits)"
            value={form.id_card_number}
            onChange={(e) => setForm((f) => ({ ...f, id_card_number: e.target.value }))}
            error={errors.id_card_number}
            maxLength={13}
            placeholder="1234567890123"
          />
          <Input
            label="Phone (10 digits)"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            error={errors.phone}
            maxLength={10}
            placeholder="0812345678"
          />
        </div>
        <Input
          label="Email (optional)"
          type="email"
          value={form.email ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          error={errors.email}
        />
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Emergency Contact Name"
            value={form.emergency_contact_name ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, emergency_contact_name: e.target.value }))}
          />
          <Input
            label="Emergency Contact Phone"
            value={form.emergency_contact_phone ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, emergency_contact_phone: e.target.value }))}
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} isLoading={createTenant.isPending}>Create</Button>
        </div>
      </div>
    </Modal>
  );
}