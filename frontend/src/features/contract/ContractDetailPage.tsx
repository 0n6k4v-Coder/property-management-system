// File: src/features/contract/ContractDetailPage.tsx
// Contract detail with termination, extend, and renew actions.
// SCR-CONTRACT-DETAIL: GET /contracts/{id}, PATCH /contracts/{id}/terminate, POST /contracts/{id}/extend, POST /contracts/{id}/renew

import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useContractDetail, useTerminateContract, useExtendLease, useRenewContract } from './api';
import { Card, CardHeader } from '@/shared/ui/Card';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { Modal } from '@/shared/ui/Modal';
import { useToast } from '@/shared/ui/Toast';
import { Skeleton } from '@/shared/ui/Skeleton';

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

  // Form state
  const [termReason, setTermReason] = useState('');
  const [termNotes, setTermNotes] = useState('');
  const [extendDate, setExtendDate] = useState('');
  const [extendReason, setExtendReason] = useState('');
  const [renewStart, setRenewStart] = useState('');
  const [renewEnd, setRenewEnd] = useState('');
  const [renewRent, setRenewRent] = useState('');
  const [renewDeposit, setRenewDeposit] = useState('');

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

  async function handleTerminate() {
    if (!id || !termReason) return;
    try {
      await terminateMutation.mutateAsync({
        contractId: id,
        data: { reason: termReason as never, notes: termNotes || null },
      });
      showToast('Contract terminated successfully', 'success');
      setModalMode(null);
      setTermReason('');
      setTermNotes('');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Termination failed', 'error');
    }
  }

  async function handleExtend() {
    if (!id || !extendDate) return;
    try {
      await extendMutation.mutateAsync({
        contractId: id,
        data: { new_end_date: extendDate, reason: extendReason || null },
      });
      showToast('Lease extended successfully', 'success');
      setModalMode(null);
      setExtendDate('');
      setExtendReason('');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Extension failed', 'error');
    }
  }

  async function handleRenew() {
    if (!id || !renewStart || !renewEnd || !renewRent || !renewDeposit) return;
    try {
      const newContract = await renewMutation.mutateAsync({
        contractId: id,
        data: {
          new_start_date: renewStart,
          new_end_date: renewEnd,
          new_monthly_rent: parseFloat(renewRent),
          new_deposit_amount: parseFloat(renewDeposit),
        },
      });
      showToast('Contract renewed successfully', 'success');
      setModalMode(null);
      setRenewStart('');
      setRenewEnd('');
      setRenewRent('');
      setRenewDeposit('');
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
            &larr; Back to contracts
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
          <Button onClick={() => setModalMode('renew')}>
            Renew Contract
          </Button>
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
                <th className="px-4 py-2">Previous End Date</th>
                <th className="px-4 py-2">Extended To</th>
                <th className="px-4 py-2">Reason</th>
              </tr>
            </thead>
            <tbody>
              {contract.extensions.map((ext) => (
                <tr key={ext.id} className="border-b border-surface-100">
                  <td className="px-4 py-2 text-surface-600">{formatDate(ext.previous_end_date)}</td>
                  <td className="px-4 py-2 text-surface-600">{formatDate(ext.extended_to)}</td>
                  <td className="px-4 py-2 text-surface-600">{ext.reason ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Terminate Modal */}
      <Modal open={modalMode === 'terminate'} onClose={() => setModalMode(null)} title="Terminate Contract">
        <div className="space-y-4">
          <div>
            <label htmlFor="term-reason" className="block text-sm font-medium text-surface-700">
              Reason
            </label>
            <select
              id="term-reason"
              value={termReason}
              onChange={(e) => setTermReason(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-primary-500"
            >
              <option value="">Select a reason…</option>
              <option value="tenant_moved_out">Tenant Moved Out</option>
              <option value="owner_terminated">Owner Terminated</option>
              <option value="breach_of_contract">Breach of Contract</option>
              <option value="mutual_agreement">Mutual Agreement</option>
              <option value="other">Other</option>
            </select>
          </div>
          <Input
            label="Notes (optional)"
            value={termNotes}
            onChange={(e) => setTermNotes(e.target.value)}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setModalMode(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleTerminate} isLoading={terminateMutation.isPending} disabled={!termReason}>
              Terminate
            </Button>
          </div>
        </div>
      </Modal>

      {/* Extend Modal */}
      <Modal open={modalMode === 'extend'} onClose={() => setModalMode(null)} title="Extend Lease">
        <div className="space-y-4">
          <Input
            label="New End Date"
            type="date"
            value={extendDate}
            onChange={(e) => setExtendDate(e.target.value)}
          />
          <Input
            label="Reason (optional)"
            value={extendReason}
            onChange={(e) => setExtendReason(e.target.value)}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setModalMode(null)}>Cancel</Button>
            <Button onClick={handleExtend} isLoading={extendMutation.isPending} disabled={!extendDate}>
              Extend
            </Button>
          </div>
        </div>
      </Modal>

      {/* Renew Modal */}
      <Modal open={modalMode === 'renew'} onClose={() => setModalMode(null)} title="Renew Contract">
        <div className="space-y-4">
          <Input
            label="New Start Date"
            type="date"
            value={renewStart}
            onChange={(e) => setRenewStart(e.target.value)}
          />
          <Input
            label="New End Date"
            type="date"
            value={renewEnd}
            onChange={(e) => setRenewEnd(e.target.value)}
          />
          <Input
            label="New Monthly Rent"
            type="number"
            min="0"
            value={renewRent}
            onChange={(e) => setRenewRent(e.target.value)}
          />
          <Input
            label="New Deposit Amount"
            type="number"
            min="0"
            value={renewDeposit}
            onChange={(e) => setRenewDeposit(e.target.value)}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setModalMode(null)}>Cancel</Button>
            <Button onClick={handleRenew} isLoading={renewMutation.isPending}
              disabled={!renewStart || !renewEnd || !renewRent || !renewDeposit}>
              Renew
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
