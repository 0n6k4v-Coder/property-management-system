// File: src/features/billing/InvoiceDetailPage.tsx
// Invoice detail with line items, payment history, and payment modal.
// SCR-INVOICE-DETAIL: GET /invoices/{id}, POST /payments

import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useInvoiceDetail, useRecordPayment } from './api';
import {
  formatCurrency,
  formatDate,
  formatInvoiceStatus,
  getRemainingBalance,
  getPaymentProgress,
} from './utils/formatters';
import { Card, CardHeader } from '@/shared/ui/Card';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { Modal } from '@/shared/ui/Modal';
import { CardSkeleton } from '@/shared/ui/CardSkeleton';
import { useToast } from '@/shared/ui/Toast';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: invoiceDetail, isLoading } = useInvoiceDetail(id);
  const [showPayment, setShowPayment] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  if (!invoiceDetail) {
    return (
      <Card className="text-center py-8 text-surface-400">
        Invoice not found.
        <div className="mt-4">
          <Link to="/invoices" className="text-primary-600 hover:text-primary-700">Back to invoices</Link>
        </div>
      </Card>
    );
  }

  const { invoice, line_items } = invoiceDetail;
  const remaining = getRemainingBalance(invoice);
  const progress = getPaymentProgress(invoice);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-surface-500">
        <Link to="/invoices" className="hover:text-primary-600">Invoices</Link>
        <span>/</span>
        <span className="text-surface-900">{invoice.invoice_number}</span>
      </nav>

      {/* Invoice Header */}
      <Card>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-surface-900">
              {invoice.invoice_number}
            </h1>
            <p className="mt-1 text-sm text-surface-500">
              Period: {invoice.billing_month}/{invoice.billing_year}
            </p>
          </div>
          <div className="text-right">
            <Badge>{formatInvoiceStatus(invoice.status)}</Badge>
            <p className="mt-1 text-xs text-surface-400">
              Due: {formatDate(invoice.due_date)}
            </p>
          </div>
        </div>
        {/* Progress Bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-surface-600">Payment Progress</span>
            <span className="font-medium">{progress}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-surface-200 overflow-hidden">
            <div
              className="h-full rounded-full bg-green-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-surface-400 mt-1">
            <span>{formatCurrency(invoice.paid_amount)} paid</span>
            <span>{formatCurrency(invoice.total_amount)} total</span>
          </div>
        </div>
      </Card>

      {/* Two-Column Layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Line Items */}
        <Card>
          <CardHeader title="Line Items" />
          <div className="space-y-3">
            {line_items.map((item) => (
              <LineItemRow key={item.id} item={item} />
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-surface-200 pt-4">
            <span className="font-semibold text-surface-900">Total</span>
            <span className="font-semibold text-surface-900">
              {formatCurrency(invoice.total_amount)}
            </span>
          </div>
        </Card>

        {/* Right: Payment History + Actions */}
        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Payment History"
              action={
                <Button
                  size="sm"
                  onClick={() => setShowPayment(true)}
                  disabled={remaining <= 0}
                >
                  Record Payment
                </Button>
              }
            />
            {line_items.length === 0 ? (
              <p className="text-sm text-surface-400 text-center py-4">
                No payments recorded yet.
              </p>
            ) : (
              <p className="text-sm text-surface-400 text-center py-4">
                Payment history appears here after first payment.
              </p>
            )}
            {remaining > 0 && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                Remaining balance: {formatCurrency(remaining)}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Invoice Details" />
            <div className="space-y-2 text-sm">
              <DetailRow label="Room ID" value={invoice.room_id.slice(0, 8)} />
              <DetailRow label="Status" value={formatInvoiceStatus(invoice.status)} />
              <DetailRow label="Due Date" value={formatDate(invoice.due_date)} />
              <DetailRow label="Created" value={formatDate(invoice.created_at)} />
              {invoice.notes && <DetailRow label="Notes" value={invoice.notes} />}
            </div>
          </Card>
        </div>
      </div>

      {/* Payment Modal */}
      <PaymentModal
        open={showPayment}
        onClose={() => setShowPayment(false)}
        invoice={invoice}
      />
    </div>
  );
}

function LineItemRow({ item }: { item: { line_type: string; description: string; quantity: number; unit_price: number; amount: number } }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-surface-100 last:border-0">
      <div>
        <p className="text-sm font-medium text-surface-900 capitalize">
          {item.line_type.replace(/_/g, ' ')}
        </p>
        <p className="text-xs text-surface-500">{item.description}</p>
      </div>
      <div className="text-right">
        <p className="text-sm font-medium text-surface-900">{formatCurrency(item.amount)}</p>
        <p className="text-xs text-surface-400">
          {item.quantity} x {formatCurrency(item.unit_price)}
        </p>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-surface-500">{label}</span>
      <span className="text-surface-900 font-medium">{value}</span>
    </div>
  );
}

// ── Payment Modal ───────────────────────────────────────────────────

const paymentSchema = z.object({
  amount: z.coerce.number().positive('Amount must be positive'),
  method: z.string().min(1, 'Payment method is required'),
  reference_number: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
});

type PaymentFormData = z.infer<typeof paymentSchema>;

function PaymentModal({
  open,
  onClose,
  invoice,
}: {
  open: boolean;
  onClose: () => void;
  invoice: { id: string; total_amount: number; paid_amount: number };
}) {
  const { showToast } = useToast();
  const recordPayment = useRecordPayment();
  const remaining = getRemainingBalance(invoice);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema) as never,
    defaultValues: { amount: remaining, method: 'cash', reference_number: '', notes: '' },
  });

  const watchAmount = watch('amount');

  async function onSubmit(data: Record<string, unknown>) {
    const d = data as PaymentFormData;
    if (d.amount > remaining) {
      showToast(`Amount cannot exceed remaining balance of ${formatCurrency(remaining)}`, 'error');
      return;
    }
    try {
      await recordPayment.mutateAsync({
        invoice_id: invoice.id,
        amount: d.amount,
        method: d.method,
        reference_number: d.reference_number || null,
        notes: d.notes || null,
      });
      showToast('Payment recorded successfully', 'success');
      reset({ amount: remaining, method: 'cash', reference_number: '', notes: '' });
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Payment failed', 'error');
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Record Payment" size="sm">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="space-y-4">
          <div className="rounded-lg bg-surface-50 px-4 py-3 text-sm">
            <div className="flex justify-between">
              <span className="text-surface-500">Total</span>
              <span className="font-medium">{formatCurrency(invoice.total_amount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-surface-500">Already Paid</span>
              <span className="font-medium">{formatCurrency(invoice.paid_amount)}</span>
            </div>
            <div className="flex justify-between font-semibold text-surface-900">
              <span>Remaining</span>
              <span>{formatCurrency(remaining)}</span>
            </div>
          </div>

          <Input
            label="Amount"
            type="number"
            step="0.01"
            min={0.01}
            max={remaining}
            {...register('amount', { valueAsNumber: true })}
            error={errors.amount?.message}
          />

          <div className="space-y-1">
            <label className="block text-sm font-medium text-surface-700" htmlFor="payment-method">Payment Method</label>
            <select
              {...register('method')}
              id="payment-method"
              className="block w-full rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm text-surface-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
              aria-label="Payment method"
            >
              <option value="cash">Cash</option>
              <option value="transfer">Bank Transfer</option>
              <option value="qr">QR PromptPay</option>
              <option value="credit">Credit Card</option>
            </select>
            {errors.method && (
              <p className="text-sm text-red-600" role="alert">{errors.method.message}</p>
            )}
          </div>

          <Input
            label="Reference Number (optional)"
            {...register('reference_number')}
          />

          <Input
            label="Notes (optional)"
            {...register('notes')}
          />

          {watchAmount > remaining && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700" role="alert">
              Amount exceeds remaining balance ({formatCurrency(remaining)})
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
            <Button type="submit" isLoading={recordPayment.isPending}>
              Record Payment
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}