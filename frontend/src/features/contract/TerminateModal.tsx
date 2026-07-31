// File: src/features/contract/TerminateModal.tsx
// Modal for terminating a contract with reason and notes.

import { useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { Modal } from '@/shared/ui/Modal';

type TerminationReason = 'tenant_moved_out' | 'owner_terminated' | 'breach_of_contract' | 'mutual_agreement' | 'other';

interface TerminateModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (reason: TerminationReason, notes: string | null) => Promise<void>;
  isLoading: boolean;
}

const REASONS: { value: TerminationReason; label: string }[] = [
  { value: 'tenant_moved_out', label: 'Tenant Moved Out' },
  { value: 'owner_terminated', label: 'Owner Terminated' },
  { value: 'breach_of_contract', label: 'Breach of Contract' },
  { value: 'mutual_agreement', label: 'Mutual Agreement' },
  { value: 'other', label: 'Other' },
];

export default function TerminateModal({ open, onClose, onSubmit, isLoading }: TerminateModalProps) {
  const [reason, setReason] = useState<TerminationReason>('tenant_moved_out');
  const [notes, setNotes] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) return;
    await onSubmit(reason, notes || null);
  };

  const handleClose = () => {
    setReason('tenant_moved_out');
    setNotes('');
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="Terminate Contract">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="term-reason" className="block text-sm font-medium text-surface-700">
            Reason <span className="text-red-500" aria-hidden="true">*</span>
          </label>
          <select
            id="term-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value as TerminationReason)}
            required
            className="mt-1 block w-full rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-primary-500"
          >
            <option value="">Select a reason…</option>
            {REASONS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>
        <Input
          label="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={handleClose}>Cancel</Button>
          <Button variant="danger" type="submit" isLoading={isLoading} disabled={!reason}>
            Terminate
          </Button>
        </div>
      </form>
    </Modal>
  );
}