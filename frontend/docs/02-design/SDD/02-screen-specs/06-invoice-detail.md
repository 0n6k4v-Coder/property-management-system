# File: frontend/docs/02-design/SDD/02-screen-specs/06-invoice-detail.md
# SCR-INVOICE-DETAIL: Invoice Detail & Payment

| Attribute | Detail |
|-----------|--------|
| **Route** | `/invoices/:id` |
| **Layout** | Two-column: left = invoice details, right = payment history + actions |
| **UI Elements** | `InvoiceHeader`, `LineItemsTable`, `PaymentHistoryList`, `RecordPaymentButton`, `DownloadPDFButton` |
| **State Mapping** | `loading` → `success` / `error` + `payment-recording` state |
| **API Dependency** | `GET /invoices/{id}`, `POST /payments` |
| **Modal Trigger** | `RecordPaymentButton` → opens `PaymentModal` (overlay, not new route) |
| **Accessibility** | Semantic HTML for invoice structure, `aria-modal="true"` for payment modal |