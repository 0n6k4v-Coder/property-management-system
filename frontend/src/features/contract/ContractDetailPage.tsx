// File: src/features/contract/ContractDetailPage.tsx
// Contract detail with termination, extend, and renew actions.
// SCR-CONTRACT-DETAIL: GET /contracts/{id}, PATCH /contracts/{id}/terminate, POST /contracts/{id}/extend, POST /contracts/{id}/renew
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useContractDetail, useTerminateContract, useExtendLease, useRenewContract } from './api';
import { Card, CardHeader } from '@/shared/ui/Card';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { useToast } from '@/shared/ui/Toast';
import { Skeleton } from '@/shared/ui/Skeleton';
import TerminateModal from './TerminateModal';
import ExtendModal from './ExtendModal';
import RenewModal from './RenewModal';

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

function formatCurrency(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return num.toLocaleString('en-US');
}

type ModalMode = 'terminate' | 'extend' | 'renew' | null;

export default function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { data: contract, isLoading } = useContractDetail(id);
  const terminateMutation = useTerminateContract();
  const extendMutation = useExtendLease();
  const renewMutation = useRenewContract();
  const [modalMode, setModalMode] = useState<ModalMode>(null);

  if (isLoading) {
    return <Skeleton className="h-64" />;
  }

  if (!contract) {
    return (
      <Card className="text-center py-8 text-surface-400">
        <p>Contract not found.</p>
        <Link to="/contracts" className="mt-2 inline-block text-sm text-primary-600 hover:text-primary-700">
          Back to contracts
        </Link>
      </Card>
    );
  }

  const isActive = contract.status === 'active';

  async function handleTerminate(reason: string, notes: string | null) {
    if (!id) return;
    try {
      await terminateMutation.mutateAsync({
        contractId: id,
        data: { reason: reason as never, notes },
      });
      showToast('Contract terminated successfully', 'success');
      setModalMode(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Termination failed', 'error');
    }
  }

  async function handleExtend(newEndDate: string, reason: string | null) {
    if (!id) return;
    try {
      await extendMutation.mutateAsync({
        contractId: id,
        data: { new_end_date: newEndDate, reason },
      });
      showToast('Lease extended successfully', 'success');
      setModalMode(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Extension failed', 'error');
    }
  }

  async function handleRenew(
    newStartDate: string,
    newEndDate: string,
    newMonthlyRent: string,
    newDepositAmount: string
  ) {
    if (!id) return;
    try {
      const newContract = await renewMutation.mutateAsync({
        contractId: id,
        data: {
          new_start_date: newStartDate,
          new_end_date: newEndDate,
          new_monthly_rent: parseFloat(newMonthlyRent),
          new_deposit_amount: parseFloat(newDepositAmount),
        },
      });
      showToast('Contract renewed successfully', 'success');
      setModalMode(null);
      // Renew creates a NEW contract (new id) — navigate to it so the user
      // sees the renewed terms instead of the still-terminated original.
      if (newContract?.id) navigate(`/contracts/${newContract.id}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Renewal failed', 'error');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <Link to="/contracts" className="text-sm text-primary-600 hover:text-primary-700">
            ← Back to contracts
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-surface-900">
            Contract {contract.id.slice(0, 8)}
          </h1>
          <Badge>{contract.status}</Badge>
        </div>
        {isActive && (
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setModalMode('extend')}>
              Extend Lease
            </Button>
            <Button variant="danger" onClick={() => setModalMode('terminate')}>
              Terminate
            </Button>
          </div>
        )}
        {!isActive && (
          <Button onClick={() => setModalMode('renew')}>Renew Contract</Button>
        )}
      </div>

      <Card>
        <CardHeader title="Contract Details" />
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-surface-500">Room ID</dt>
            <dd className="mt-1 text-sm text-surface-900">{contract.room_id}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-surface-500">Tenant ID</dt>
            <dd className="mt-1 text-sm text-surface-900">{contract.tenant_id}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-surface-500">Start Date</dt>
            <dd className="mt-1 text-sm text-surface-900">{formatDate(contract.start_date)}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-surface-500">End Date</dt>
            <dd className="mt-1 text-sm text-surface-900">{formatDate(contract.end_date)}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-surface-500">Monthly Rent</dt>
            <dd className="mt-1 text-sm text-surface-900">{formatCurrency(contract.monthly_rent)}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-surface-500">Deposit Amount</dt>
            <dd className="mt-1 text-sm text-surface-900">{formatCurrency(contract.deposit_amount)}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-surface-500">Is Renewal</dt>
            <dd className="mt-1 text-sm text-surface-900">{contract.is_renewal ? 'Yes' : 'No'}</dd>
          </div>
          {contract.special_conditions && (
            <div className="sm:col-span-2">
              <dt className="text-sm font-medium text-surface-500">Special Conditions</dt>
              <dd className="mt-1 text-sm text-surface-900">{contract.special_conditions}</dd>
            </div>
          )}
        </dl>
      </Card>

      {/* Termination info */}
      {contract.termination && (
        <Card>
          <CardHeader title="Termination Record" />
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-surface-500">Reason</dt>
              <dd className="mt-1 text-sm text-surface-900">{contract.termination.reason}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-surface-500">Termination Date</dt>
              <dd className="mt-1 text-sm text-surface-900">{formatDate(contract.termination.termination_date)}</dd>
            </div>
            {contract.termination.notes && (
              <div className="sm:col-span-2">
                <dt className="text-sm font-medium text-surface-500">Notes</dt>
                <dd className="mt-1 text-sm text-surface-900">{contract.termination.notes}</dd>
              </div>
            )}
          </dl>
        </Card>
      )}

      {/* Extensions */}
      {contract.extensions && contract.extensions.length > 0 && (
        <Card>
          <CardHeader title="Lease Extensions" />
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200 text-left text-xs font-medium uppercase tracking-wide text-surface-500">
                <th scope="col" className="px-4 py-2">Previous End Date</th>
                <th scope="col" className="px-4 py-2">Extended To</th>
                <th scope="col" className="px-4 py-2">Reason</th>
              </tr>
            </thead>
            <tbody>
              {contract.extensions.map((ext) => (
                <tr key={ext.id} className="border-b border-surface-100">
                  <td className="px-4 py-2 text-surface-600">{formatDate(ext.previous_end_date)}</td>
                  <td className="px-4 py-2 text-surface-600">{formatDate(ext.extended_to)}</td>
                  <td className="px-4 py-2 text-surface-600">{ext.reason ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Terminate Modal */}
      <TerminateModal
        open={modalMode === 'terminate'}
        onClose={() => setModalMode(null)}
        onSubmit={handleTerminate}
        isLoading={terminateMutation.isPending}
      />

      {/* Extend Modal */}
      <ExtendModal
        open={modalMode === 'extend'}
        onClose={() => setModalMode(null)}
        onSubmit={handleExtend}
        isLoading={extendMutation.isPending}
      />

      {/* Renew Modal */}
      <RenewModal
        open={modalMode === 'renew'}
        onClose={() => setModalMode(null)}
        onSubmit={handleRenew}
        isLoading={renewMutation.isPending}
      />
    </div>
  );
}