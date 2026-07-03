# File: frontend/docs/02-design/SDD/02-screen-specs/05-invoice-list.md
# SCR-INVOICE-LIST: Invoice Management

| Attribute | Detail |
|-----------|--------|
| **Route** | `/invoices` |
| **Layout** | Table view with filters, bulk actions toolbar, mobile card fallback |
| **UI Elements** | `InvoiceTable`, `StatusFilter`, `DateRangeFilter`, `BulkGenerateButton`, `ExportButton`, `RowActions` |
| **State Mapping** | `loading` → `success` / `error` + `bulk-generating` state |
| **API Dependency** | `GET /invoices`, `POST /invoices/bulk-generate`, `GET /invoices/{id}` |
| **Bulk Action** | Show progress modal → poll `/tasks/{id}` → refresh list on success |
| **Accessibility** | Table headers with `scope="col"`, action buttons with `aria-label`, keyboard nav for row actions |