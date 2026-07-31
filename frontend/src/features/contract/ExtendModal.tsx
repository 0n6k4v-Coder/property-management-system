// File: src/features/contract/ExtendModal.tsx
// Modal for extending a lease with new end date and reason.

import { useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { Modal } from '@/shared/ui/Modal';

interface ExtendModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (newEndDate: string, reason: string | null) => Promise<void>;
  isLoading: boolean;
}

export default function ExtendModal({ open, onClose, onSubmit, isLoading }: ExtendModalProps) {
  const [newEndDate, setNewEndDate] = useState('');
  const [reason, setReason] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEndDate) return;
    await onSubmit(newEndDate, reason || null);
  };

  const handleClose = () => {
    setNewEndDate('');
    setReason('');
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="Extend Lease">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="New End Date"
          requiredIndicator={true}
          type="date"
          value={newEndDate}
          onChange={(e) => setNewEndDate(e.target.value)}
          required
        />
        <Input
          label="Reason (optional)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={handleClose}>Cancel</Button>
          <Button type="submit" isLoading={isLoading} disabled={!newEndDate}>
            Extend
          </Button>
        </div>
      </form>
    </Modal>
  );
}