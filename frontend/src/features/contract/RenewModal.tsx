// File: src/features/contract/RenewModal.tsx
// Modal for renewing a contract with new dates, rent, and deposit.

import { useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { Modal } from '@/shared/ui/Modal';

interface RenewModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (newStartDate: string, newEndDate: string, newMonthlyRent: string, newDepositAmount: string) => Promise<void>;
  isLoading: boolean;
}

export default function RenewModal({ open, onClose, onSubmit, isLoading }: RenewModalProps) {
  const [newStartDate, setNewStartDate] = useState('');
  const [newEndDate, setNewEndDate] = useState('');
  const [newMonthlyRent, setNewMonthlyRent] = useState('');
  const [newDepositAmount, setNewDepositAmount] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStartDate || !newEndDate || !newMonthlyRent || !newDepositAmount) return;
    await onSubmit(newStartDate, newEndDate, newMonthlyRent, newDepositAmount);
  };

  const handleClose = () => {
    setNewStartDate('');
    setNewEndDate('');
    setNewMonthlyRent('');
    setNewDepositAmount('');
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="Renew Contract">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="New Start Date"
          requiredIndicator={true}
          type="date"
          value={newStartDate}
          onChange={(e) => setNewStartDate(e.target.value)}
          required
        />
        <Input
          label="New End Date"
          requiredIndicator={true}
          type="date"
          value={newEndDate}
          onChange={(e) => setNewEndDate(e.target.value)}
          required
        />
        <Input
          label="New Monthly Rent (THB)"
          requiredIndicator={true}
          type="number"
          min="0"
          step="0.01"
          value={newMonthlyRent}
          onChange={(e) => setNewMonthlyRent(e.target.value)}
          required
        />
        <Input
          label="New Deposit Amount (THB)"
          requiredIndicator={true}
          type="number"
          min="0"
          step="0.01"
          value={newDepositAmount}
          onChange={(e) => setNewDepositAmount(e.target.value)}
          required
        />
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={handleClose}>Cancel</Button>
          <Button
            type="submit"
            isLoading={isLoading}
            disabled={!newStartDate || !newEndDate || !newMonthlyRent || !newDepositAmount}
          >
            Renew
          </Button>
        </div>
      </form>
    </Modal>
  );
}