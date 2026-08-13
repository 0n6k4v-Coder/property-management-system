# File: frontend/docs/02-design/SDD/07-traceability.md
# Traceability Matrix (Frontend — ครบทุกหน้า)
## Property Management System (Client-Side)

---

## 9. Traceability Matrix (Frontend — ครบทุกหน้า)

| FR/BR ID | Screen/Component | Hook / API | Test File | Backend SDD Ref |
|----------|------------------|------------|-----------|----------------|
| FR-USER-01 | `LoginPage`, `AuthContext` | `useLoginMutation()` | `src/features/auth/LoginPage.test.tsx` | §3.3 `POST /auth/login` |
| FR-USER-02 | `RegisterPage` | `useRegisterMutation()` | `src/features/auth/RegisterPage.test.tsx` | §3.3 `POST /auth/invite/accept` |
| FR-DASH-01 | `DashboardPage`, `StatsCards` | `useDashboardSummaryQuery()` | `src/features/dashboard/DashboardPage.test.tsx` | §3.2 `GET /dashboard` |
| FR-DASH-02~04 | `DashboardPage`, `OverdueTable` | `useDashboardSummaryQuery()` | `src/features/dashboard/components/OverdueTable.test.tsx` | §3.2 `GET /dashboard` |
| FR-DASH-02~04 | `DashboardPage`, `StatCard` | `useDashboardSummaryQuery()` | `src/features/dashboard/components/StatCard.test.tsx` | §3.2 `GET /dashboard` |
| FR-METER-01~04 | `MeterReadingPage`, `OfflineQueue` | `useRecordMeterMutation()`, `usePreviousReadingQuery()` | `src/features/meter/MeterReadingPage.test.tsx` | §3.3 `POST /meter-readings` |
| FR-METER-06~10 | `InvoiceListPage`, `InvoiceDetailPage` | `useInvoicesQuery()`, `useInvoiceDetailQuery()` | `src/features/billing/InvoiceListPage.test.tsx` | §3.2 `GET /invoices` |
| FR-METER-06~10 | `InvoiceDetailPage` | `useInvoiceDetailQuery()` | `src/features/billing/InvoiceDetailPage.test.tsx` | §3.2 `GET /invoices/{id}` |
| FR-METER-06~10 | `billing/api.ts` | `apiFetch`, `fetchInvoices`, `fetchInvoice` | `src/features/billing/api.test.tsx` | §3.2 `GET /invoices` |
| FR-METER-06~10 | `billing/utils/formatters.ts` | `formatCurrency`, `formatDate`, `formatStatus` | `src/features/billing/utils/formatters.test.ts` | — |
| FR-METER-06~10 | `billing/utils/export.ts` | `exportInvoices`, `exportToCSV`, `exportToPDF` | `src/features/billing/utils/export.test.ts` | — |
| FR-METER-12/13 | `LinePreviewModal`, `ExportUtils` | `formatLineMessage()`, `exportInvoices` | `src/features/billing/utils/export.test.ts` | §1.3 Billing Workflow |
| BR-07 | `MeterInput` (Zod schema) | `z.number().gte(previous)` | `src/features/billing/utils/formatters.test.ts` | §6 State Machines |
| FR-TENANT-01~04 | `TenantListPage`, `SearchModal` | `useSearchTenantsQuery()`, `useCreateTenantMutation()` | `src/features/tenant/TenantListPage.test.tsx` | §3.2 `GET /tenants/search` |
| FR-TENANT-01~04 | `tenant/api.ts` | `apiFetch`, `fetchTenants`, `createTenant` | `src/features/tenant/api.test.tsx` | §3.2 `GET /tenants/search` |
| FR-PROP-01~07 | `PropertyListPage`, `PropertyGrid`, `PropertyDetail`, `EmptyState`, `CreatePropertyForm`, `RoomDetailPage` | `useProperties()`, `usePropertyWithRooms()`, `useCreateProperty()`, `useUpdateRoomStatus()` | `src/features/property/PropertyListPage.test.tsx` | §3.3 `GET /properties`, `POST /properties`, `GET /properties/{id}/rooms` |
| FR-PROP-01~07 | `PropertyDetailPage` | `usePropertyWithRooms()` | `src/features/property/PropertyDetailPage.test.tsx` | §3.3 `GET /properties/{id}` |
| FR-PROP-01~07 | `RoomDetailPage` | `useUpdateRoomStatus()` | `src/features/property/RoomDetailPage.test.tsx` | §3.3 `GET /properties/{id}/rooms` |
| FR-PROP-01~07 | `property/api.ts` | `apiFetch`, `fetchProperties`, `fetchProperty`, `fetchPropertyRooms` | `src/features/property/api.test.tsx` | §3.3 `GET /properties` |
| FR-CONTRACT-01~05 | `RoomDetailPage`, `CreateContractModal` | `useCreateContractMutation()` | `src/features/property/RoomDetailPage.test.tsx` | §3.3 `POST /contracts` |
| FR-CONTRACT-01~05 | `ContractListPage` | `useContractsQuery()` | `src/features/contract/ContractListPage.test.tsx` | §3.4 `GET /contracts` |
| FR-CONTRACT-01~05 | `ContractDetailPage` | `useContractDetailQuery()` | `src/features/contract/ContractDetailPage.test.tsx` | §3.4 `GET /contracts/{id}` |
| FR-CONTRACT-01~05 | `ContractFormPage` | `useCreateContractMutation()`, `useUpdateContractMutation()` | `src/features/contract/ContractFormPage.test.tsx` | §3.4 `POST /contracts`, `PUT /contracts/{id}` |
| FR-CONTRACT-01~05 | `TerminateModal` | `useTerminateContractMutation()` | `src/features/contract/TerminateModal.test.tsx` | §3.4 `POST /contracts/{id}/terminate` |
| FR-CONTRACT-01~05 | `ExtendModal` | `useExtendContractMutation()` | `src/features/contract/ExtendModal.test.tsx` | §3.4 `POST /contracts/{id}/extend` |
| FR-CONTRACT-01~05 | `RenewModal` | `useRenewContractMutation()` | `src/features/contract/RenewModal.test.tsx` | §3.4 `POST /contracts/{id}/renew` |
| FR-CONTRACT-01~05 | `contract/api.ts` | `apiFetch`, `fetchContracts`, `fetchContract`, `createContract` | `src/features/contract/api.test.tsx` | §3.4 `GET /contracts` |
| FR-MAINT-01~05 | `MaintenanceListPage`, `MaintenanceFormPage` | `useMaintenanceQuery()`, `useCreateMaintenanceMutation()` | `src/features/maintenance/MaintenanceListPage.test.tsx` | §3.5 `GET /maintenance` |
| FR-MAINT-01~05 | `MaintenanceFormPage` | `useCreateMaintenanceMutation()`, `useUpdateMaintenanceMutation()` | `src/features/maintenance/MaintenanceFormPage.test.tsx` | §3.5 `POST /maintenance` |
| FR-MAINT-01~05 | `maintenance/api.ts` | `apiFetch`, `fetchMaintenance`, `createMaintenance` | `src/features/maintenance/api.test.tsx` | §3.5 `GET /maintenance` |
| FR-DASH-02~04 | `ReportsPage`, `ExportUtils`, `RevenueChart` | `useRevenueReportQuery()` | `src/features/reports/ReportsPage.test.tsx` | §3.2 `GET /reports/revenue` |
| FR-DASH-02~04 | `RevenueChart` component | `useRevenueReportQuery()` | `src/features/reports/components/RevenueChart.test.tsx` | §3.2 `GET /reports/revenue` |
| FR-DASH-02~04 | `OverdueChart` component | `useOverdueReportQuery()` | `src/features/reports/components/OverdueChart.test.tsx` | §3.2 `GET /reports/overdue` |
| FR-DASH-02~04 | `reports/utils/export.ts` | `exportReport`, `exportToCSV` | `src/features/reports/utils/export.test.ts` | — |
| FR-ADMIN-01~05 | `SettingsPage` | `useSettingsQuery()`, `useUpdateSettingsMutation()` | `src/features/settings/SettingsPage.test.tsx` | §3.6 `GET /admin/settings` |
| FR-ADMIN-01~05 | `settings/api.ts` | `apiFetch`, `fetchSettings`, `updateSettings` | `src/features/settings/api.test.tsx` | §3.6 `GET /admin/settings` |
| NFR-Usability | All screens | Tailwind responsive, touch targets | `src/features/meter/MeterReadingPage.test.tsx` | §1.2 Scope |
| NFR-Security | `ProtectedRoute`, Fetch Wrapper | `apiFetch()` 401 retry logic | `src/shared/api/fetchClient.test.ts` | §3.5.1 Auth Flow |
| NFR-Portability | PWA Service Worker | `service-worker.ts`, `sync.ts` | `src/shared/pwa/service-worker.test.ts` | §1.2 Deployment |
| NFR-Portability | PWA Background Sync | `sync.ts`, `idb-queue.ts` | `src/shared/pwa/sync.test.ts` | §1.2 Deployment |
| NFR-Portability | PWA IDB Queue | `idb-queue.ts` | `src/shared/pwa/idb-queue.test.ts` | §1.2 Deployment |
| NFR-Security | `AuthContext` | `useAuth()`, `login()`, `logout()` | `src/shared/auth/AuthContext.test.tsx` | §3.5.1 Auth Flow |
| NFR-Architecture | `fetchClient.ts` | `apiFetch`, error mapping | `src/shared/api/fetchClient.test.ts` | §3.5.1 Auth Flow |
| NFR-Architecture | `routes/index.tsx` | Lazy loading, route guards | `src/routes/index.test.tsx` | §1.3 Routing |
| NFR-Architecture | `App.tsx` root | Provider composition | `src/App.test.tsx` | §1.3 App Structure |
| NFR-Architecture | `layouts/AuthLayout` | Layout composition | `src/layouts/AuthLayout.test.tsx` | §1.3 Layouts |
| NFR-Architecture | `layouts/MainLayout` | Layout composition, sidebar | `src/layouts/MainLayout.test.tsx` | §1.3 Layouts |
| NFR-Architecture | `layouts/TopHeader` | Header component | `src/layouts/TopHeader.test.tsx` | §1.3 Layouts |
| NFR-Architecture | `shared/utils/validators.ts` | Zod schemas, validation utils | `src/shared/utils/validators.test.ts` | — |
| NFR-Architecture | `shared/utils/status.ts` | Status formatting, enum utils | `src/shared/utils/status.test.ts` | — |
| NFR-Architecture | `shared/hooks/useSidebar.ts` | Sidebar state management | `src/shared/hooks/useSidebar.test.ts` | — |
| NFR-Architecture | `shared/hooks/useFocusTrap.ts` | Focus trap accessibility hook | `src/shared/hooks/useFocusTrap.test.ts` | — |
| NFR-Architecture | `shared/components/Dialog` | Modal dialog component | `src/shared/components/Dialog.test.tsx` | — |
| FR-METER-01~04 | `MeterInput` (offline) | `useOfflineQueue()` | `src/features/meter/hooks/useOfflineQueue.test.tsx` | §3.3 `POST /meter-readings` (offline) |
| FR-DASH-01 | `DashboardPage` API | `useDashboardSummaryQuery()` | `src/features/dashboard/api.test.tsx` | §3.2 `GET /dashboard` |
| FR-CONTRACT-01 | `ContractListPage` | `useContractsQuery()` | `src/features/contract/ContractListPage.test.tsx` | §3.4 `GET /contracts` |

> ✅ **กฎ:** ทุก FR/NFR ที่กระทบ UI ต้องมีอย่างน้อย 1 Test File ในคอลัมน์ขวาสุด
> 📊 **Coverage:** ทุก test file อยู่ใน `src/features/<feature>/` หรือ `src/shared/<category>/` (ไม่ใช่ `tests/`)