# Sprint 09 - Features to Test (Human Input)

## 🎯 Sprint Goal
Execute E2E Campaign for **5 critical features** using `pms-e2e` profile to validate end-to-end user journeys before v1.0.0 Release.

---

## 🗺️ Complete Route Inventory (22 Routes)

### 🔓 Group 1: Auth Routes (Guest - 2 Routes)
| # | Method | Path | Page | Layout | Module |
|---|--------|------|------|--------|--------|
| 1 | GET | `/login` | LoginPage | AuthLayout | auth |
| 2 | GET | `/auth/register` | RegisterPage | AuthLayout | auth |

### 🔒 Group 2: Protected Routes - Core Modules (10 Routes)
| # | Method | Path | Page | Module |
|---|--------|------|------|--------|
| 1 | GET | `/dashboard` | DashboardPage | dashboard |
| 2 | GET | `/property` | PropertyListPage | property |
| 3 | GET | `/property/:id` | PropertyDetailPage | property |
| 4 | GET | `/property/rooms/:id` | RoomDetailPage | property |
| 5 | GET | `/tenants` | TenantListPage | tenant |
| 6 | GET | `/meter-reading` | MeterReadingPage | meter |
| 7 | GET | `/invoices` | InvoiceListPage | billing |
| 8 | GET | `/invoices/:id` | InvoiceDetailPage | billing |
| 9 | GET | `/reports` | ReportsPage | reports |
| 10 | GET | `/property/detail/:id` | PropertyDetailPage | property |

### 🔒 Group 3: Protected Routes - Phase 4 Features (8 Routes)
| # | Method | Path | Page | Module |
 |---|--------|------|------|--------|
 | 1 | GET | `/contracts` | ContractListPage | contract |
 | 2 | GET | `/contracts/new` | ContractFormPage | contract |
 | 13 | GET | `/contracts/:id` | ContractDetailPage | contract |
 | 14 | GET | `/maintenance` | MaintenanceListPage | maintenance |
 | 14 | GET | `/maintenance/new` | MaintenanceFormPage | maintenance |
 | 15 | GET | `/settings` | SettingsPage | settings |

---

## 📋 Standard Test Credentials

> **All E2E tests MUST use these standard credentials matching Seed Data and LoginPage.tsx placeholders**

### 🌱 Seed Credentials (Database)
| Source | Email | Password | Role | Notes |
|--------|-------|----------|------|-------|
| `backend/scripts/seed_admin.py` | `admin@example.com` | `Admin123!` | Admin | Run: `docker compose run --rm backend python scripts/seed_admin.py` |
| Backend tests | `test@example.com` | `SecurePass123` | Test User | Created per test, rolled back |

### 📝 Standard Test Credentials (E2E Tests)
> **Use these for ALL E2E tests — both mocked and real backend**

| Field | Value | Placeholder (LoginPage.tsx) |
|-------|-------|----------------------------|
| **Email** | `admin@example.com` | `you@example.com` |
| **Password** | `Admin123!` | `Enter your password` |

### 📝 Login Page Placeholders (LoginPage.tsx)
> **All test files MUST use these exact placeholders**

| Field | Placeholder Text | Used In |
|-------|------------------|---------|
| Email | `you@example.com` | `LoginPage.tsx` line 106 |
| Password | `Enter your password` | `LoginPage.tsx` line 120 |

### ❌ Deprecated (Do NOT use)
| Old Value | Replacement | Reason |
|-----------|-------------|--------|
| `testuser` | `admin@example.com` | Matches seed |
| `test@example.com` | `admin@example.com` | Single test user |
| `SecurePass123` | `Admin123!` | Matches seed |
| `Testpass123!` | `Admin123!` | Matches seed |
| `Username` placeholder | `you@example.com` | LoginPage uses email |
| `Password` placeholder | `Enter your password` | Exact match required |

---

## 🧪 Test Breakdown by Route (Human Defines WHAT, Hermes designs HOW)

---

## 🔓 Group 1: Auth Routes (Guest - 2 Routes)

---

### Route 1: `/login` (GET/POST) — LoginPage

**Test Scenarios:**

| Test ID | Scenario | Type | Expected Result |
|---------|----------|------|-----------------|
| AUTH-LOGIN-01 | Valid credentials login | Happy Path | Redirect to `/dashboard` with JWT in cookie/localStorage |
| AUTH-LOGIN-02 | Invalid email format | Negative | Error: "Invalid email format" |
| AUTH-LOGIN-03 | Invalid password | Negative | Error: "Invalid credentials" |
| AUTH-LOGIN-04 | Non-existent user | Negative | Error: "Invalid credentials" (no user enumeration) |
| AUTH-LOGIN-05 | Empty email field | Negative | Error: "Email is required" |
| AUTH-LOGIN-06 | Empty password field | Negative | Error: "Password is required" |
| AUTH-LOGIN-07 | Inactive user account | Negative | Error: "Account deactivated" |
| AUTH-LOGIN-08 | Rate limiting (5 failed attempts) | Security | Rate limited for 15 min |
| AUTH-LOGIN-09 | Remember me checkbox | Feature | Token persists 30 days |
| AUTH-LOGIN-10 | Redirect after login | Navigation | Redirect to intended page or `/dashboard` |

**API Calls:** `POST /api/v1/auth/login`, `POST /api/v1/auth/refresh`

---

### Route 2: `/auth/register` (GET/POST) — RegisterPage

**Test Scenarios:**

| Test ID | Scenario | Type | Expected Result |
|---------|----------|------|-----------------|
| AUTH-REG-01 | Valid registration | Happy Path | User created, email sent, redirect to login |
| AUTH-REG-02 | Duplicate email | Negative | Error: "Email already registered" |
| AUTH-REG-03 | Weak password | Negative | Error: "Password must be 8+ chars, upper, lower, number, special" |
| AUTH-REG-04 | Password mismatch | Negative | Error: "Passwords do not match" |
| AUTH-REG-05 | Invalid phone format | Negative | Error: "Invalid phone number format (Thai)" |
| AUTH-REG-06 | Invalid email format | Negative | Error: "Invalid email format" |
| AUTH-REG-07 | Missing required fields | Negative | Field-level validation errors |
| AUTH-REG-07 | Email verification flow | Integration | Email sent → click link → account activated |
| AUTH-REG-08 | Password strength meter | UI | Visual feedback on strength |
| AUTH-REG-09 | Terms acceptance required | Compliance | Submit disabled until checked |

**API Calls:** `POST /api/v1/auth/register`, `POST /api/v1/auth/verify-email`

---

## 🔒 Group 2: Protected Routes - Core Modules (10 Routes)

---

### Route 3: `/dashboard` (GET) — DashboardPage

**Test Scenarios:**

| Test ID | Scenario | Type | Expected Result |
|---------|----------|------|-----------------|
| DASH-01 | Load dashboard with data | Happy Path | KPI cards, charts, recent activity load |
| DASH-02 | Empty state (new user) | Edge Case | Empty state with onboarding CTA |
| DASH-03 | Date range filter | Feature | Charts update on date change |
| DASH-04 | Property switcher | Navigation | Switch property → data refreshes |
| DASH-05 | Real-time updates | Feature | WebSocket updates KPIs |
| DASH-05 | Responsive layout | Responsive | Mobile/Tablet/Desktop breakpoints |
| DASH-06 | Export dashboard | Feature | PDF/Excel export downloads |

**API Calls:** `GET /api/v1/dashboard/kpis`, `GET /api/v1/dashboard/charts`, `WS /ws/dashboard`

---

### Route 4: `/property` (GET) — PropertyListPage

**Test Scenarios:**

| Test ID | Scenario | Type | Expected Result |
|---------|----------|------|-----------------|
| PROP-01 | List all properties | Happy Path | Paginated list with filters |
| PROP-02 | Create property | Happy Path | Modal opens → create → list refreshes |
| PROP-03 | Search by name | Feature | Real-time filter |
| PROP-04 | Filter by status | Feature | Filter active/inactive |
| PROP-05 | Sort by name/created | Feature | Sort toggles |
| PROP-06 | Pagination | Pagination | Next/Prev, page size selector |
| PROP-07 | Delete property | Negative | Confirm modal → soft delete |
| PROP-08 | Empty state | Edge Case | "No properties" with CTA |

**API Calls:** `GET /api/v1/properties`, `POST /api/v1/properties`, `PATCH /api/v1/properties/:id`, `DELETE /api/v1/properties/:id`

---

### Route 5: `/property/:id` (GET) — PropertyDetailPage

**Test Scenarios:**

| Test ID | Scenario | Type | Expected Result |
|---------|----------|------|-----------------|
| PROP-DET-01 | View property details | Happy Path | All tabs load: Overview, Buildings, Floors, Rooms |
| PROP-DET-02 | Edit property | Feature | Inline edit → save → toast |
| PROP-DET-03 | Add building | Feature | Modal → create → appears in list |
| PROP-DET-04 | Delete building | Negative | Confirm → cascade delete floors/rooms |
| PROP-DET-05 | Switch tabs | Navigation | Smooth tab transitions |
| PROP-DET-06 | Invalid ID | Negative | 404 page |

**API Calls:** `GET /api/v1/properties/:id`, `PATCH /api/v1/properties/:id`, `POST /api/v1/buildings`, `DELETE /api/v1/buildings/:id`

---

### Route 6: `/property/rooms/:id` (GET) — RoomDetailPage

**Test Scenarios:**

| Test ID | Scenario | Type | Expected Result |
|---------|----------|------|-----------------|
| ROOM-01 | View room details | Happy Path | Room info, tenant, meter, contract |
| ROOM-02 | Edit room status | Feature | Available/Occupied/Maintenance toggle |
| ROOM-03 | Assign tenant | Feature | Search tenant → assign → contract created |
| ROOM-04 | Unassign tenant | Feature | End lease → room available |
| ROOM-05 | Add meter reading | Feature | Create reading → invoice auto-generated |
| ROOM-06 | View meter history | Feature | Chart + table with pagination |

**API Calls:** `GET /api/v1/rooms/:id`, `PATCH /api/v1/rooms/:id`, `POST /api/v1/meter-readings`, `GET /api/v1/meter-readings/room/:id`

---

### Route 7: `/tenants` (GET) — TenantListPage

**Test Scenarios:**

| Test ID | Scenario | Type | Expected Result |
|---------|----------|------|-----------------|
| TENANT-01 | List tenants | Happy Path | Paginated, searchable, filterable |
| TENANT-02 | Create tenant | Happy Path | Modal → encrypt ID card → save |
| TENANT-03 | Search by name/phone | Feature | Debounced search |
| TENANT-04 | Filter by property | Feature | Multi-select property filter |
| TENANT-04 | View tenant detail | Navigation | Click → detail page |
| TENANT-05 | Edit tenant | Feature | Inline edit |
| TENANT-06 | Export tenants | Feature | CSV/Excel download |

**API Calls:** `GET /api/v1/tenants`, `POST /api/v1/tenants`, `GET /api/v1/tenants/:id`

---

### Route 8: `/meter-reading` (GET/POST) — MeterReadingPage

**Test Scenarios:**

| Test ID | Scenario | Type | Expected Result |
|---------|----------|------|-----------------|
| METER-01 | List readings | Happy Path | Table with filters |
| METER-02 | Create reading | Happy Path | Auto-calculate usage |
| METER-02 | Duplicate reading check | Validation | Error if duplicate month/room |
| METER-04 | Reading < previous | Validation | Warning + allow with confirmation |
| METER-05 | Auto-generate invoice | Integration | Invoice created on reading save |
| METER-05 | Bulk import | Feature | CSV upload → preview → confirm |
| METER-06 | Reading history | Feature | Chart + table per room |

**API Calls:** `GET /api/v1/meter-readings`, `POST /api/v1/meter-readings`, `POST /api/v1/meter-readings/bulk`

---

### Route 9: `/invoices` (GET) — InvoiceListPage

**Test Scenarios:**

| Test ID | Scenario | Type | Expected Result |
|---------|----------|------|-----------------|
| INV-01 | List invoices | Happy Path | Filter by status, date, tenant |
| INV-02 | Invoice status badges | UI | Color-coded: Draft/Sent/Paid/Overdue/Partial |
| INV-03 | Create invoice | Feature | From meter reading or manual |
| INV-04 | Send invoice | Feature | Email/SMS → status: Sent |
| INV-04 | Record payment | Feature | Full/Partial → update status |
| INV-05 | Print/Download PDF | Feature | PDF download with QR |
| INV-05 | Overdue highlighting | UI | Red badge + auto-sort |
| INV-06 | Bulk actions | Feature | Select multiple → bulk send/export |

**API Calls:** `GET /api/v1/invoices`, `POST /api/v1/invoices`, `POST /api/v1/invoices/:id/send`, `POST /api/v1/payments`

---

### Route 10: `/invoices/:id` (GET) — InvoiceDetailPage

**Test Scenarios:**

| Test ID | Scenario | Type | Expected Result |
|---------|----------|------|-----------------|
| INV-DET-01 | View invoice detail | Happy Path | All line items, totals, payments |
| INV-DET-02 | Record payment | Feature | Partial/Full → status updates |
| INV-DET-03 | Refund payment | Feature | Refund → status adjustment |
| INV-DET-03 | Void invoice | Negative | Void → status: Voided |
| INV-DET-04 | Resend invoice | Feature | Re-send email/SMS |
| INV-DET-05 | Payment history | Feature | Timeline of payments |

**API Calls:** `GET /api/v1/invoices/:id`, `POST /api/v1/payments`, `POST /api/v1/invoices/:id/void`

---

### Route 11: `/reports` (GET) — ReportsPage

**Test Scenarios:**

| Test ID | Scenario | Type | Expected Result |
|---------|----------|------|-----------------|
| RPT-01 | Revenue report | Feature | Chart + table by period |
| RPT-02 | Occupancy report | Feature | Occupancy rate by property |
| RPT-03 | Collection report | Feature | Collection rate, aging |
| RPT-04 | Maintenance report | Feature | Requests by status/priority |
| RPT-04 | Export all | Feature | Excel/PDF with filters |
| RPT-05 | Date range picker | UI | Presets + custom range |
| RPT-06 | Scheduled reports | Feature | Email schedule setup |

**API Calls:** `GET /api/v1/reports/revenue`, `GET /api/v1/reports/occupancy`, `GET /api/v1/reports/collection`

---

### Route 12: `/property/detail/:id` (GET) — PropertyDetailPage

**Test Scenarios:**

| Test ID | Scenario | Type | Expected Result |
|---------|----------|------|-----------------|
| PROP-ALT-01 | Alternative detail view | Happy Path | Full hierarchy in single view |
| PROP-ALT-02 | Quick actions | UI | Quick add building/room |
| PROP-ALT-02 | Print summary | Feature | PDF summary |

---

## 🔒 Group 3: Protected Routes - Phase 4 Features (8 Routes)

---

### Route 13: `/contracts` (GET) — ContractListPage

**Test Scenarios:**

| Test ID | Scenario | Type | Expected Result |
|---------|----------|------|-----------------|
| CONT-01 | List contracts | Happy Path | Filter by status: Active/Expiring/Expired |
| CONT-02 | Create contract | Happy Path | Wizard: Room + Tenant + Terms → PDF |
| CONT-03 | Filter by status | Feature | Active/Expiring/Expired/Terminated |
| CONT-04 | Expiring soon badge | UI | 30/60/90 day badges |
| CONT-04 | Renewal workflow | Feature | One-click renewal → new contract |
| CONT-05 | Contract PDF | Feature | View/Download signed PDF |
| CONT-06 | Terminate contract | Negative | Confirm → status: Terminated |
| CONT-07 | Contract history | Feature | Timeline of changes |

**API Calls:** `GET /api/v1/contracts`, `POST /api/v1/contracts`, `POST /api/v1/contracts/:id/renew`, `GET /api/v1/contracts/:id/pdf`

---

### Route 14: `/contracts/new` (GET/POST) — ContractFormPage

**Test Scenarios:**

| Test ID | Scenario | Type | Expected Result |
|---------|----------|------|-----------------|
| CONT-NEW-01 | Step 1: Select room | Wizard | Available rooms only |
| CONT-NEW-02 | Step 2: Select tenant | Wizard | Filter by property |
| CONT-NEW-03 | Step 3: Terms | Form | Rent, deposit, dates, billing day |
| CONT-NEW-04 | Auto-calculate | Feature | Prorated first month |
| CONT-NEW-04 | Preview PDF | Preview | Before submit |
| CONT-NEW-05 | Submit → PDF | Integration | Generate + email |

---

### Route 15: `/contracts/:id` (GET) — ContractDetailPage

**Test Scenarios:**

| Test ID | Scenario | Type | Expected Result |
|---------|----------|------|-----------------|
| CONT-DET-01 | View contract | Happy Path | All terms, payments, history |
| CONT-DET-02 | Record payment | Feature | Update paid amount |
| CONT-DET-02 | Renew contract | Feature | Clone with new dates |
| CONT-DET-03 | Terminate early | Feature | Penalty calculation |
| CONT-DET-04 | Add addendum | Feature | Attach PDF |

---

### Route 16: `/maintenance` (GET) — MaintenanceListPage

**Test Scenarios:**

| Test ID | Scenario | Type | Expected Result |
|---------|----------|------|-----------------|
| MAINT-01 | List requests | Happy Path | Filter: status, priority, property |
| MAINT-02 | Create request | Happy Path | Tenant submits with photos |
| MAINT-02 | Status workflow | Workflow | Pending → Assigned → In Progress → Done |
| MAINT-04 | Assign staff | Feature | Drag-drop or dropdown |
| MAINT-04 | SLA tracking | Feature | SLA timer per priority |
| MAINT-05 | Recurring requests | Feature | Schedule recurring |
| MAINT-05 | Vendor portal | Feature | External access link |

**API Calls:** `GET /api/v1/maintenance`, `POST /api/v1/maintenance`, `PATCH /api/v1/maintenance/:id`

---

### Route 17: `/maintenance/new` (GET/POST) — MaintenanceFormPage

**Test Scenarios:**

| Test ID | Scenario | Type | Expected Result |
|---------|----------|------|-----------------|
| MAINT-NEW-01 | Select room/property | Form | Dropdown with search |
| MAINT-NEW-02 | Select category | Dropdown | Plumbing/Electrical/AC/etc |
| MAINT-NEW-03 | Priority selection | Radio | Low/Medium/High/Emergency |
| MAINT-NEW-04 | Photo upload | Feature | Multiple, preview, max 5MB |
| MAINT-NEW-04 | Submit → notification | Integration | Staff notified |

---

### Route 18: `/settings` (GET) — SettingsPage

**Test Scenarios:**

| Test ID | Scenario | Type | Expected Result |
|---------|----------|------|-----------------|
| SET-01 | Profile settings | Feature | Name, email, phone, avatar |
| SET-02 | Change password | Security | Current + new + confirm |
| SET-03 | Notification prefs | Feature | Email/SMS/Push toggles |
| SET-04 | Theme toggle | UI | Light/Dark/System |
| SET-03 | Language | Feature | TH/EN |
| SET-04 | 2FA setup | Security | TOTP QR code |
| SET-05 | API keys | Developer | Generate/revoke |
| SET-06 | Danger zone | Danger | Delete account |

---

## 📊 Test Coverage Summary

| Group | Routes | Test Scenarios | Priority |
|-------|--------|----------------|----------|
| **Group 1: Auth** | 2 | 19 | P0 |
| **Group 2: Core** | 10 | 105 | P0 |
| **Group 3: Phase 4** | 8 | 56 | P1 |
| **Total** | **22** | **~230 scenarios** | |

---

## 📊 Test Execution Order (Priority)

1. **P0 - Auth** (2 routes, 19 tests) — Foundation
2. **P0 - Billing** (2 routes) — Revenue
3. **P0 - Property** (3 routes) — Inventory
4. **P0 - Dashboard** (1 route) — Core
5. **P0 - Tenants/Meter/Meter/Inv/Report** (4 routes) — Ops
6. **P1 - Contract** (3 routes) — Legal
7. **P1 - Maintenance** (2 routes) — Ops
8. **P1 - Settings** (1 route) — Config

---

## ✅ Approval

**Approved by:** @kawee
**Date:** 2026-07-05
**Sprint:** 09
**Status:** Ready for Execution

---

> **Next Step:** Hermes executes sequentially per route order above. Stop on P0 blocking bug.
EOF