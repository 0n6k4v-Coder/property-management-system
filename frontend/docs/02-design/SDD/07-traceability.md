# File: frontend/docs/02-design/SDD/07-traceability.md
# Traceability Matrix (Frontend — ครบทุกหน้า)
## Property Management System (Client-Side)

---

## 9. Traceability Matrix (Frontend — ครบทุกหน้า)

| FR/BR ID | Screen/Component | Hook / API | Test File | Backend SDD Ref |
|----------|------------------|------------|-----------|----------------|
| FR-USER-01 | `LoginPage`, `AuthContext` | `useLoginMutation()` | `tests/auth/LoginPage.test.tsx` | §3.3 `POST /auth/login` |
| FR-USER-02 | `RegisterPage` | `useRegisterMutation()` | `tests/auth/RegisterPage.test.tsx` | §3.3 `POST /auth/invite/accept` |
| FR-DASH-01 | `DashboardPage`, `StatsCards` | `useDashboardSummaryQuery()` | `tests/dashboard/DashboardPage.test.tsx` | §3.2 `GET /dashboard` |
| FR-METER-01~04 | `MeterReadingPage`, `OfflineQueue` | `useRecordMeterMutation()`, `usePreviousReadingQuery()` | `tests/billing/MeterReadingPage.test.tsx` | §3.3 `POST /meter-readings` |
| FR-METER-06~10 | `InvoiceListPage`, `InvoiceDetailPage` | `useInvoicesQuery()`, `useInvoiceDetailQuery()` | `tests/billing/InvoiceListPage.test.tsx` | §3.2 `GET /invoices` |
| FR-METER-12/13 | `LinePreviewModal` | `formatLineMessage()` util | `tests/shared/formatLine.test.ts` | §1.3 Billing Workflow |
| FR-TENANT-01~04 | `TenantListPage`, `SearchModal` | `useSearchTenantsQuery()`, `useCreateTenantMutation()` | `tests/tenant/TenantListPage.test.tsx` | §3.2 `GET /tenants/search` |
| FR-PROP-01~07 | `PropertyListPage`, `PropertyGrid`, `PropertyDetail`, `EmptyState`, `CreatePropertyForm`, `RoomDetailPage` | `useProperties()`, `usePropertyWithRooms()`, `useCreateProperty()`, `useUpdateRoomStatus()` | `api.ts`, `PropertyListPage.test.tsx` | §3.3 `GET /properties`, `POST /properties`, `GET /properties/{id}/rooms` |
| FR-CONTRACT-01~05 | `RoomDetailPage`, `CreateContractModal` | `useCreateContractMutation()` | `tests/property/RoomDetailPage.test.tsx` | §3.3 `POST /contracts` |
| FR-DASH-02~04 | `ReportsPage`, `ExportUtils` | `useRevenueReportQuery()` | `tests/reports/ReportsPage.test.tsx` | §3.2 `GET /reports/revenue` |
| BR-07 | `MeterInput` (Zod schema) | `z.number().gte(previous)` | `tests/billing/MeterValidation.test.ts` | §6 State Machines |
| NFR-Usability | All screens | Tailwind responsive, touch targets | `tests/e2e/mobile.spec.ts` | §1.2 Scope |
| NFR-Security | `ProtectedRoute`, Fetch Wrapper | `apiFetch()` 401 retry logic | `tests/shared/api.fetchClient.test.ts` | §3.5.1 Auth Flow |
| NFR-Portability | PWA Service Worker | `service-worker.ts`, `sync.ts` | `tests/pwa/offlineSync.test.ts` | §1.2 Deployment |

> ✅ **กฎ:** ทุก FR/NFR ที่กระทบ UI ต้องมีอย่างน้อย 1 Test File ในคอลัมน์ขวาสุด