// File: src/features/contract/ContractFormPage.tsx
// Create new contract form with room/tenant selection, rent, deposit, dates.
// SCR-CONTRACT-CREATE: POST /contracts

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCreateContract } from './api';
import { useProperties } from '@/features/property/api';
import { usePropertyWithRooms } from '@/features/property/api';
import { useSearchTenants } from '@/features/tenant/api';
import { Card, CardHeader } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { useToast } from '@/shared/ui/Toast';
import { createContractSchema, type CreateContractForm } from '@/shared/utils/validators';

export default function ContractFormPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const createMutation = useCreateContract();
  const { data: properties } = useProperties();

  // Workflow state for tenant search input
  const [tenantSearch, setTenantSearch] = useState('');

  const {
    register,
    handleSubmit,
    control,
    setValue,
    resetField,
    formState: { errors },
  } = useForm<CreateContractForm>({
    resolver: zodResolver(createContractSchema),
    defaultValues: {
      property_id: '',
      room_id: '',
      tenant_id: '',
      start_date: '',
      end_date: '',
      monthly_rent: undefined,
      deposit_amount: undefined,
      special_conditions: '',
    },
  });

  const propertyId = useWatch({ control, name: 'property_id' }) ?? '';
  const tenantId = useWatch({ control, name: 'tenant_id' }) ?? '';

  const { data: propertyWithRooms } = usePropertyWithRooms(propertyId || null);
  const { data: tenantResults } = useSearchTenants(
    { propertyId, query: tenantSearch },
    propertyId !== '' && tenantSearch.length >= 3,
  );

  const rooms = propertyWithRooms?.rooms ?? [];

  // Reset room and tenant selection when property changes
  const prevPropertyIdRef = useRef(propertyId);
  useEffect(() => {
    if (prevPropertyIdRef.current !== propertyId) {
      prevPropertyIdRef.current = propertyId;
      resetField('room_id', { defaultValue: '' });
      resetField('tenant_id', { defaultValue: '' });
      setTenantSearch('');
    }
  }, [propertyId, resetField]);

  async function onSubmit(data: CreateContractForm) {
    try {
      await createMutation.mutateAsync({
        property_id: data.property_id,
        room_id: data.room_id,
        tenant_id: data.tenant_id,
        start_date: data.start_date,
        end_date: data.end_date,
        monthly_rent: data.monthly_rent,
        deposit_amount: data.deposit_amount,
        special_conditions: data.special_conditions || null,
      });
      showToast('Contract created successfully', 'success');
      navigate('/contracts');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Creation failed', 'error');
    }
  }

  function onInvalid() {
    showToast('Please fill in all required fields', 'error');
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-surface-900">New Contract</h1>
        <p className="mt-1 text-sm text-surface-500">Create a new rental contract</p>
      </div>

      <Card>
        <CardHeader title="Contract Information" />
        <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-4">
          {/* Property selection */}
          <div>
            <label htmlFor="property-select" className="block text-sm font-medium text-surface-700">
              Property <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <select
              id="property-select"
              {...register('property_id')}
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
            {errors.property_id && (
              <p className="mt-1 text-xs text-red-600">{errors.property_id.message}</p>
            )}
          </div>

          {/* Room selection (depends on property) */}
          {propertyId && (
            <div>
              <label htmlFor="room-select" className="block text-sm font-medium text-surface-700">
                Room <span className="text-red-500" aria-hidden="true">*</span>
              </label>
              <select
                id="room-select"
                {...register('room_id')}
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
              {errors.room_id && (
                <p className="mt-1 text-xs text-red-600">{errors.room_id.message}</p>
              )}
            </div>
          )}

          {/* Tenant search */}
          {propertyId && (
            <div>
              <label htmlFor="tenant-search" className="block text-sm font-medium text-surface-700">
                Search Tenant <span className="text-red-500" aria-hidden="true">*</span>
              </label>
              <input
                id="tenant-search"
                type="text"
                list="tenant-options"
                value={tenantSearch}
                onChange={(e) => {
                  const val = e.target.value;
                  setTenantSearch(val);
                  const match = tenantResults?.data.find(
                    (t) => t.full_name.toLowerCase() === val.toLowerCase() || t.id === val,
                  );
                  if (match) {
                    setValue('tenant_id', match.id, { shouldValidate: true });
                  }
                }}
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
                <div className="mt-2 space-y-1 rounded-lg border border-surface-200 bg-surface-50 p-2">
                  <p className="text-xs font-medium text-surface-500">Select matching tenant:</p>
                  {tenantResults.data.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setValue('tenant_id', t.id, { shouldValidate: true });
                        setTenantSearch(t.full_name);
                      }}
                      className="flex w-full items-center justify-between rounded-md bg-white px-3 py-1.5 text-left text-sm text-surface-800 hover:bg-primary-50 hover:text-primary-700 border border-surface-200"
                    >
                      <span className="font-medium">{t.full_name}</span>
                      <span className="text-xs text-surface-500">{t.phone}</span>
                    </button>
                  ))}
                </div>
              )}
              {tenantId && (
                <p className="mt-1 text-xs text-green-600">Selected tenant ID: {tenantId.slice(0, 8)}</p>
              )}
              {errors.tenant_id && (
                <p className="mt-1 text-xs text-red-600">{errors.tenant_id.message}</p>
              )}
            </div>
          )}

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Start Date"
              requiredIndicator={true}
              type="date"
              {...register('start_date')}
              error={errors.start_date?.message}
              required
            />
            <Input
              label="End Date"
              requiredIndicator={true}
              type="date"
              {...register('end_date')}
              error={errors.end_date?.message}
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
              {...register('monthly_rent', { valueAsNumber: true })}
              error={errors.monthly_rent?.message}
              required
            />
            <Input
              label="Deposit Amount (THB)"
              requiredIndicator={true}
              type="number"
              min="0"
              step="0.01"
              {...register('deposit_amount', { valueAsNumber: true })}
              error={errors.deposit_amount?.message}
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
              {...register('special_conditions')}
              rows={3}
              maxLength={2000}
              className="mt-1 block w-full rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-primary-500"
              aria-describedby="special-conditions-hint"
              aria-label="Special conditions for the contract"
            />
            <p id="special-conditions-hint" className="mt-1 text-xs text-surface-500">
              Optional special conditions for this contract
            </p>
            {errors.special_conditions && (
              <p className="mt-1 text-xs text-red-600">{errors.special_conditions.message}</p>
            )}
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