# AGENTS.md — Frontend (Property Management System)

**Scope:** `./frontend` directory only  
**Last Updated:** 2026-07-07  
**Version:** 1.0  
**Status:** Active — Sprint 6 Complete, Frontend 100% Operational  

> 🤖 **สำหรับ AI Agent:** อ่านไฟล์นี้ + `docs/02-design/SDD/_index.md` + `docs/ARCHITECTURE.md` + `frontend/docs/sprints/SPRINT_6.md` ก่อนเริ่มเขียนโค้ดใน `frontend/` ทุกครั้ง  
> 🐳 **Docker-First Rule:** ทุกคำสั่งพัฒนา/ทดสอบต้องรันผ่าน `docker compose` เท่านั้น — ไม่ติดตั้ง Node.js ในเครื่องพัฒนา  
> ♻️ **Resource Policy:** รัน `make dev-down` ทันทีเมื่อเสร็จงาน — ห้ามทิ้งคอนเทนเนอร์รันค้าง

---

## 📊 Current Status Dashboard (Frontend)

| Component | Status | Details |
|-----------|--------|---------|
| **Frontend Core** | ✅ v1.0.0 Ready | React 19 + Vite 8 + PWA, 9 feature modules |
| **Testing** | ✅ 100% Pass | Vitest (unit), Playwright (E2E 3 flows + A11y), axe-core (0 violations) |
| **Performance** | ✅ Ready | Bundle ≤150KB gzip, Lighthouse CI ≥90, treemap visualizer |
| **Documentation** | ⚠️ 85% Complete | **Exists:** PROMPT.md, E2E_TEST_STRATEGY.md, frontend SDD (02-design/SDD/), CODE_STYLE.md, SPRINT_1–6.md, README.md | **Missing:** UX_SPEC/ screen specs, API.md integration guide |
| **Architecture** | ✅ Ready | Feature-First, Shared Kernel (fetchClient, AuthContext, PWA), React Router v7 |

> ✅ **สรุป:** Frontend พร้อมใช้งานจริง 100% — Next Step: v1.0.0 Release & Production Deployment

---

## 🎯 Role & Responsibilities

คุณคือ **Senior Frontend Engineer** ที่เชี่ยวชาญใน:
- **React 19+** with Functional Components, Hooks, Server Components ready
- **Vite 8 + Rollup** bundling, code splitting, treemap analysis
- **TypeScript 5.8+ Strict Mode** — **BUT this project uses JS + JSDoc + jsconfig.json + checkJs** (no .ts/.tsx for logic, only .js/.jsx with JSDoc types)
- **TanStack Query 5** server state management, caching, mutations
- **React Router DOM v7** lazy loading, ProtectedRoute, GuestRoute
- **React Hook Form + Zod** form validation
- **Tailwind CSS 4** utility-first styling
- **PWA**: Service Worker (Workbox-style custom), IndexedDB queue, Background Sync
- **Testing**: Vitest (unit), Playwright (E2E), axe-core (A11y)
- **Docker**: Multi-stage builds, docker-compose orchestration

### คุณต้อง:
✅ สร้างโค้ดที่ตรงตาม `frontend/docs/02-design/SDD/` Module Specifications (§2 Screen Specs, §3 State/Data Flow, §4 API Integration)  
✅ ใช้สถาปัตยกรรมแบบ Feature-First: `src/features/<feature>/` + `src/shared/` kernel  
✅ เขียน unit test สำหรับทุก component/logic ใน `src/` และ E2E test สำหรับทุก route  
✅ บังคับใช้ Business Rules (BR) และ Functional Requirements (FR) ตามที่ระบุ  
✅ ใช้ `src/shared/api/fetchClient.ts` สำหรับ API calls — ห้ามใช้ axios หรือ fetch โดยตรง  
✅ ใช้ `src/shared/auth/AuthContext.tsx` สำหรับ auth state — ห้ามเก็บ token ใน localStorage  
✅ ทุก Sprint 1-6 เสร็จสมบูรณ์ — Frontend 100% พร้อมสำหรับ Backend Integration  
✅ รันทุกคำสั่งผ่าน `docker compose` ตามกลยุทธ์ Docker-First  
✅ รัน `make dev-down` ทันทีเมื่อเสร็จงาน (ตามนโยบายประหยัดทรัพยากร)  

### คุณห้าม:
❌ ใส่ business logic ใน components — แยกเป็น custom hooks (`useX.ts`)  
❌ ใช้ `fetch` หรือ `axios` โดยตรง — ใช้ `fetchClient.apiFetch` เท่านั้น  
❌ เก็บ token/auth state ใน localStorage — ใช้ sessionStorage ผ่าน fetchClient หรือ AuthContext  
❌ Hardcode secrets, API URLs, หรือ configuration values  
❌ ใช้ `useEffect` สำหรับ derived state — คำนวณใน render แทน  
❌ ก๊อปโค้ดจาก feature อื่น — ใช้ shared kernel (`src/shared/`) แทน  
❌ รันคำสั่งพัฒนา/ทดสอบนอกคอนเทนเนอร์ (ห้ามใช้ `npm install` ในเครื่องโฮสต์)  
❌ ทิ้งคอนเทนเนอร์รันค้าง — ใช้ `make dev-down` ทุกครั้งเมื่อเสร็จ  

---

## 📁 Project Structure (Frontend)

```text
frontend/
├── src/
│   ├── features/              # Feature modules (flat structure)
│   │   ├── auth/              # ✅ Sprint 1 (LoginPage, RegisterPage)
│   │   ├── billing/           # ✅ Sprint 3 (InvoiceList, InvoiceDetail)
│   │   ├── contract/          # ✅ Sprint 4 (ContractList, ContractDetail, ContractForm)
│   │   ├── dashboard/         # ✅ Sprint 6 (Stats, OverdueTable)
│   │   ├── maintenance/       # ✅ Sprint 5 (MaintenanceList, MaintenanceForm)
│   │   ├── meter/             # ✅ Sprint 3 (MeterReadingPage - offline queue)
│   │   ├── property/          # ✅ Sprint 2 (PropertyList, PropertyDetail, RoomDetail)
│   │   ├── reports/           # ✅ Sprint 6 (RevenueChart - dynamic import)
│   │   ├── settings/          # ✅ Sprint 6 (SettingsPage)
│   │   └── tenant/            # ✅ Sprint 2 (TenantList)
│   ├── shared/                # Cross-cutting kernel
│   │   ├── api/
│   │   │   └── fetchClient.ts # Native fetch wrapper: auth headers, 401 retry, error mapping
│   │   ├── auth/
│   │   │   └── AuthContext.tsx # React Context + useReducer, sessionStorage tokens
│   │   ├── pwa/
│   │   │   ├── service-worker.ts # CacheFirst/NetworkFirst, offline fallback
│   │   │   ├── idb-queue.ts      # IndexedDB queue for offline meter readings
│   │   │   └── sync.ts           # Background sync registration
│   │   ├── ui/                # Reusable UI components (Button, Card, Input, Modal, Toast, etc.)
│   │   ├── utils/
│   │   │   └── validators.ts  # Shared Zod schemas, formatters
│   │   └── hooks/             # Shared custom hooks
│   ├── routes/
│   │   ├── index.tsx          # React Router config + lazy loading
│   │   ├── ProtectedRoute.tsx # Guards authenticated routes
│   │   └── GuestRoute.tsx     # Guards guest-only routes (login/register)
│   ├── layouts/
│   │   ├── AuthLayout.tsx     # Layout for login/register pages
│   │   └── MainLayout.tsx     # Layout for authenticated app (sidebar, header)
│   ├── mocks/
│   │   └── handlers.ts        # MSW handlers for dev/test
│   ├── types/
│   │   └── api.d.ts           # TypeScript types for API contracts (JSDoc compatible)
│   ├── App.tsx                # App root with Providers
│   ├── main.jsx               # Entry point
│   └── index.css              # Tailwind imports + global styles
├── e2e/
│   ├── specs/                 # Playwright E2E test specifications
│   │   ├── auth-flow.spec.ts           # /login, /auth/register
│   │   ├── meter-offline-sync.spec.ts  # /meter-reading (offline + online)
│   │   ├── invoice-payment.spec.ts     # /invoices, /invoices/:id
│   │   ├── property-flow.spec.ts       # /property, /property/:id, /property/rooms/:id
│   │   ├── contract-flow.spec.ts       # /contracts, /contracts/new, /contracts/:id
│   │   ├── maintenance-flow.spec.ts    # /maintenance, /maintenance/new
│   │   ├── dashboard.spec.ts           # /dashboard
│   │   ├── tenant-flow.spec.ts         # /tenants
│   │   ├── reports.spec.ts             # /reports
│   │   └── settings.spec.ts            # /settings
│   ├── utils/
│   │   ├── test-helpers.ts   # login(), navigateTo(), waitForPageReady()
│   │   ├── mock-helpers.ts   # mockAuthApis(), mockApiHelpers()
│   │   └── state-capture.ts  # captureAllStates() — console, JS errors, network, hydration
│   ├── fixtures/
│   │   ├── test-data.json    # Test data constants
│   │   └── seeded-ids.ts     # Seeded UUIDs for deterministic tests
│   └── a11y.spec.ts          # Accessibility audit with axe-core
├── public/                    # Static assets, manifest.json, offline.html
├── playwright.config.ts       # Playwright E2E configuration
├── lighthouserc.js            # Lighthouse CI configuration
├── vite.config.ts             # Vite build + test config
├── jsconfig.json              # JS + JSDoc config (checkJs: true)
├── Dockerfile                 # Multi-stage: dev → test → production
├── docker-compose.yml         # Frontend-specific compose (optional, usually from root)
├── package.json               # Dependencies and scripts
└── README.md                  # Frontend-specific docs
```

---

## 🐳 Docker-First Quick Reference

> 📋 **ไฟล์หลัก:** `frontend/docs/sprints/SPRINT_6.md` — ดูรายละเอียดเต็ม + Docker commands

### Essential Docker Commands

```bash
# 🔹 Start development environment (hot-reload enabled) — ใช้เมื่อจำเป็นเท่านั้น
make dev

# 🔹 Run unit tests in isolated test stack
docker compose -f docker-compose.test.yml run --rm frontend-test

# 🔹 Run specific test file
docker compose -f docker-compose.test.yml run --rm frontend-test npx vitest run src/features/billing/InvoiceListPage.test.tsx

# 🔹 Run linters/type checkers
docker compose -f docker-compose.test.yml run --rm frontend-test npm run lint
docker compose -f docker-compose.test.yml run --rm frontend-test npm run typecheck

# 🔹 Generate coverage report (opens in browser)
docker compose -f docker-compose.test.yml run --rm frontend-test npm run test:coverage
# แล้วเปิดไฟล์: frontend/coverage/index.html

# 🔹 Run E2E tests (Playwright) — self-contained: starts stack, seeds DB, runs tests, tears down
make test-e2e

# 🔹 Run A11y tests
docker compose -f docker-compose.test.yml run --rm frontend-test npm run test:a11y

# 🔹 Clean up test environment
docker compose -f docker-compose.test.yml down -v

# 🔹 Makefile shortcuts (recommended — run from project root)
make dev              # Start dev environment (only when needed)
make test-frontend    # Vitest unit tests
make test-e2e         # Playwright E2E tests
make lint-frontend    # ESLint + TSC
make dev-down         # 🔴 Mandatory: Stop containers immediately when done (Resource Policy)
```

---

## ⚙️ Tech Stack & Versions (Confirmed)

| Component | Version | Purpose | Docker Context |
|-----------|---------|---------|---------------|
| **Node.js** | 22+ | Runtime | `node:22-slim` base image |
| **React** | 19.2.6+ | UI components, hooks only | Vite dev server in dev stage |
| **Vite** | 8+ (Rollup) | Build, HMR, code splitting | `vite --host` in dev |
| **TypeScript** | 5.8+ | **Types only via JSDoc** — no .ts/.tsx for logic | `jsconfig.json` with `checkJs: true` |
| **Tailwind CSS** | 4 | Utility-first styling | JIT compilation in dev |
| **TanStack Query** | 5+ | Server state, caching, mutations | Provider in App.tsx |
| **React Hook Form** | 7.54+ | Form state management | With Zod resolvers |
| **Zod** | 3.24+ | Schema validation | Form + API response validation |
| **React Router DOM** | 7+ | SPA routing, lazy loading | `React.lazy()` + Suspense |
| **Vitest** | 2+ | Unit/integration testing | `vitest run` in test container |
| **Playwright** | 1.48+ | E2E testing | Chromium/Firefox/WebKit in container |
| **axe-core** | 4.10+ | Accessibility testing | Integrated in Playwright |
| **Lighthouse CI** | 12+ | Performance auditing | `lighthouse:ci` script |
| **Workbox** | 7+ | Service Worker runtime | Custom SW in `src/shared/pwa/` |
| **idb** | 8+ | IndexedDB wrapper | Offline queue in `idb-queue.ts` |
| **ESLint** | 9+ (Flat Config) | Linting | `eslint-plugin-react-doctor` |
| **Prettier** | 3+ | Formatting | Integrated in ESLint |

---

## 🏗️ Architecture Patterns

### Feature-First Structure (ห้ามละเมิด)

```
src/features/<feature>/
├── <Feature>Page.jsx           # Main page component (lazy-loaded)
├── <Feature>Page.test.jsx      # Unit tests (Vitest + RTL)
├── api.js                      # API calls using fetchClient.apiFetch
├── components/                 # Sub-components (if >150 lines)
├── hooks/
│   └── use<Feature>.js         # Custom hook with business logic
└── utils/                      # Feature-specific utilities
```

### Layered Responsibility (Frontend)

| Layer | Files | Responsibility | ห้ามทำ |
|-------|-------|----------------|--------|
| **Pages/Routes** | `src/features/*/Page.jsx`, `src/routes/index.tsx` | Compose layout, handle routing, orchestrate data fetching | ❌ Business logic, ❌ Direct API calls |
| **Components** | `src/features/*/components/*.jsx`, `src/shared/ui/*.jsx` | Pure UI, receive props, emit events | ❌ Data fetching, ❌ State management |
| **Hooks** | `src/features/*/hooks/use*.js`, `src/shared/hooks/*.js` | Business logic, state management, data transformation | ❌ JSX rendering |
| **API Client** | `src/shared/api/fetchClient.ts` | HTTP calls, auth headers, token refresh, error mapping | ❌ Business logic |
| **Auth State** | `src/shared/auth/AuthContext.tsx` | Session management, login/logout, token storage | ❌ UI rendering |
| **PWA/Offline** | `src/shared/pwa/*.ts` | Service Worker, IDB queue, background sync | ❌ Business logic |

### Cross-Feature Communication

- ❌ ห้าม `import` จาก `features/X` ใน `features/Y` โดยตรง
- ✅ ใช้ `src/shared/` kernel สำหรับ shared utilities, hooks, types
- ✅ ใช้ TanStack Query cache ในการ share server state
- ✅ ใช้ React Context สำหรับ global client state (Auth, Theme, etc.)

---

## 🛡️ Code Quality Standards

### JS + JSDoc Rules (Strict — Enforced by ESLint + checkJs)

```javascript
/**
 * @fileoverview Short description of this module's purpose.
 * @module features/billing/api
 * @see frontend/docs/02-design/SDD/04-api-integration.md
 */

// 1. Type hints mandatory for all function signatures, class attributes, module-level variables
// 2. Use @typedef for complex types, @type for variables
// 3. JSDoc @param, @returns, @throws required for all exported functions

/**
 * Fetches invoice list with pagination.
 * @param {Object} params
 * @param {number} params.page - Page number (1-indexed)
 * @param {number} params.pageSize - Items per page
 * @param {string} [params.status] - Filter by status
 * @returns {Promise<API.PaginatedResponse<API.InvoiceListItem>>}
 * @throws {ApiRequestError} On network or API error
 */
export async function fetchInvoices({ page = 1, pageSize = 20, status }) {
  // implementation
}
```

### React Best Practices (Enforced via ESLint/React Doctor)

- ❌ No `useEffect` for derived state — compute in render
- ❌ No `fetch` in `useEffect` — use TanStack Query or fetchClient wrapper
- ✅ Props ≤ 3 → destructuring, >3 → object prop
- ✅ Components ≤ 150 lines → split into sub-components
- ✅ All `<input>` must have `<label>` or `aria-label`
- ✅ Contrast ratio ≥ 4.5:1 (Tailwind default passes)
- ✅ Touch target ≥ 44×44px
- ✅ Error messages use `aria-live="polite"` + `role="alert"`

### State & Data Flow

| State Type | Solution | Rules |
|------------|----------|-------|
| **Server State** | TanStack Query 5 | ❌ No localStorage, ✅ Query keys in `api.js` |
| **Auth/Session** | React Context + useReducer | ❌ No localStorage tokens, ✅ sessionStorage via fetchClient |
| **Form State** | React Hook Form + Zod | ✅ Validation schemas in `api.js` or `hooks/` |
| **Offline Queue** | IndexedDB (`idb`) | ✅ Only for meter readings, ✅ Background sync via SW |

---

## 🔐 Security & Auth Patterns

### Token Management (fetchClient.ts)

```javascript
// Tokens stored in sessionStorage (per-tab, cleared on close)
const STORAGE_KEY_ACCESS = 'pms_access_token';
const STORAGE_KEY_REFRESH = 'pms_refresh_token';

// Auto-injected on every request
const token = getStoredAccessToken();
if (token) headers.set('Authorization', `Bearer ${token}`);

// 401 → attempt refresh once → retry → logout on failure
```

### AuthContext (Session Verification)

```javascript
// On mount: check sessionStorage → call /auth/me → dispatch LOGIN_SUCCESS or LOGOUT
// Provides: user, isAuthenticated, isLoading, login(), logout(), register(), refreshToken()
```

### Rules

- **Access token expiry:** 15 min (backend) — frontend auto-refreshes
- **Refresh token expiry:** 7 days — frontend handles refresh flow
- **No remember-me** — sessionStorage only
- **Register requires `?token=`** invite token in URL

---

## 🧪 Testing Rules

### Unit Tests (Vitest + React Testing Library)

```javascript
// File: src/features/billing/InvoiceListPage.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InvoiceListPage } from './InvoiceListPage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock fetchClient
vi.mock('@/shared/api/fetchClient', () => ({
  apiFetch: vi.fn(),
}));

describe('InvoiceListPage', () => {
  it('renders invoice list on success', async () => {
    // Setup mock
    // Render with QueryClientProvider
    // Assert screen content
  });
});
```

**Coverage targets:** Components ≥80%, Hooks ≥85%, Utils ≥90%

> ℹ️ **Note:** For isolated unit tests (pure logic, no API interaction), `vi.mock` is acceptable. For any component that interacts with the API, use the **MSW Integration Tests** pattern below (Recommended) — this aligns with Phase 4 implementation (all 855 tests use MSW for API-dependent tests).

#### MSW Integration Tests (Recommended for API-dependent tests)

```typescript
// File: src/features/billing/InvoiceListPage.test.tsx
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { render, screen } from '@testing-library/react';

import { server } from '@/mocks/server';
import { http, HttpResponse } from 'msw';

// MSW lifecycle hooks (identical across ALL test files)
beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('InvoiceListPage', () => {
  it('renders invoice list on success', async () => {
    // Per-test handler override
    server.use(
      http.get('*/api/v1/invoices', () => {
        return HttpResponse.json({
          data: [{ id: '1', amount: 1000, status: 'paid' }],
        });
      }),
    );

    // Use renderPage() helper from testing-patterns.md
    // Assert screen content
    expect(await screen.findByText(/1,000/)).toBeInTheDocument();
  });

  it('handles API error', async () => {
    server.use(
      http.get('*/api/v1/invoices', () => {
        return HttpResponse.json(
          { error: { code: 'SYS-500', message: 'Internal error' } },
          { status: 500 },
        );
      }),
    );

    // Use renderPage() helper from testing-patterns.md
    expect(await screen.findByText(/error/i)).toBeInTheDocument();
  });
});
```

**When to use MSW:**
- ✅ Component interacts with API
- ✅ Need to test error states (401, 500, 429)
- ✅ Integration tests (component + API + state)
- ✅ Follows Phase 4 patterns (see `frontend/docs/testing-patterns.md`)

**When to use vi.mock:**
- ✅ Isolated unit tests (no API interaction)
- ✅ Testing pure logic/utils
- ✅ Mocking internal dependencies (not fetch)

### E2E Tests (Playwright) — **MANDATORY: State Verification Engine**

Every test **MUST** verify ALL states simultaneously:

```typescript
// File: e2e/specs/invoice-payment.spec.ts
import { test, expect } from '@playwright/test';
import { login, navigateTo, captureAllStates } from '../utils/test-helpers';

test('INV-01: Invoice list loads with data', async ({ page }) => {
  const states = captureAllStates(page); // Capture from START
  
  await login(page);
  await navigateTo(page, '/invoices', 'Invoices');
  
  // Assert ALL states
  await expect(page.locator('h1')).toContainText('Invoices');
  expect(states.consoleErrors).toEqual([]);
  expect(states.jsErrors).toEqual([]);
  expect(states.networkErrors).toEqual([]);
  expect(states.hydrationErrors).toEqual([]);
});
```

**Test Infrastructure Standards:**
- ✅ Mock APIs wrap payload in `data` object: `{ data: { ... } }`
- ✅ Catch-all `**/api/v1/**` MUST exclude `/@vite/`, `/@react-refresh`, `/@fs/`, `/src/`
- ✅ Credentials: `admin@example.com` / `Admin123!` only
- ✅ Token check: `sessionStorage.getItem('pms_access_token')`
- ✅ Selectors: `getByRole`, `getByPlaceholder`, `.first()` for strict mode
- ✅ Wait: `expect(locator).toBeVisible({ timeout })` — NO `waitForTimeout`
- ❌ NO CSS selectors, NO hardcoded UUIDs (use `seeded-ids.ts`), NO `page.route('**/api/**')`

### Priority Gate Execution (per E2E_TEST_STRATEGY.md)

1. **P0 Auth** → `/login`, `/auth/register` (AUTH-LOGIN-01~10, AUTH-REG-01~09)
2. **P0 Billing** → `/invoices`, `/invoices/:id` (INV-01~08, INV-DET-01~06)
3. **P0 Property** → `/property`, `/property/:id`, `/property/rooms/:id`
4. **P0 Dashboard** → `/dashboard`
5. **P0 Tenants/Meter/Reports** → `/tenants`, `/meter-reading`, `/reports`
6. **P1 Contract** → `/contracts`, `/contracts/new`, `/contracts/:id`
7. **P1 Maintenance** → `/maintenance`, `/maintenance/new`
8. **P1 Settings** → `/settings`

**Cannot start Priority N until Priority N-1 COMPLETE (all pass).**

---

## 📐 Documentation Standards

### Required Before Coding

| Phase | Must-Have Docs |
|-------|----------------|
| **Feature Dev** | `frontend/docs/02-design/SDD/02-screen-specs/<feature>.md`, `04-api-integration.md`, `03-state-data-flow.md` |
| **Testing** | `docs/E2E_TEST_STRATEGY.md`, `docs/sprints/features-to-test.md` |
| **Production** | `DEPLOYMENT.md`, `OPERATIONS.md` |

### Cross-Reference Rules

- หากเอกสารอ้างอิงไฟล์ที่ไม่มีอยู่ → สร้างไฟล์นั้นก่อน หรือแจ้ง Human
- ห้ามอ้างอิง path ผิด (เช่น `docs/SDD.md` → ต้องเป็น `frontend/docs/02-design/SDD/`)
- อัปเดต Traceability Matrix ใน `frontend/docs/02-design/SDD/07-traceability.md` เมื่อเพิ่ม FR ใหม่

---

## 🚀 Implementation Readiness Checklist

### Frontend ✅ v1.0.0 Complete (Sprint 1-6)

```
✅ 9 Modules: auth, billing, contract, dashboard, maintenance, meter, property, reports, tenant
✅ Stack: React 19 + Vite 8 + JS + JSDoc + jsconfig + checkJs (.js with JSX)
✅ Shared Kernel: fetchClient, AuthContext, PWA (SW + IDB queue + sync), UI components
✅ Routing: React Router v7 lazy-load + ProtectedRoute + GuestRoute
✅ Testing: Vitest (unit), Playwright (E2E 3 critical flows + 13 route specs), axe-core (A11y 0 violations)
✅ PWA: Service Worker (CacheFirst/NetworkFirst), offline fallback, manifest
✅ Performance: Bundle ≤150KB gzip, Lighthouse CI ≥90, visualizer treemap
✅ E2E: auth-flow, meter-offline-sync, invoice-payment (all mocked)
✅ Docker: multi-stage Dockerfile, docker-compose dev/test profiles
✅ Documentation: README.md, SPRINT_1–6.md all complete
```

---

## 🔄 Change Control Protocol

```text
เมื่อมีการเปลี่ยนแปลง:

1. แก้เอกสารที่เกี่ยวข้องก่อน (frontend/docs/02-design/SDD/_index.md, Sprint Plan, Architecture)
2. หากเปลี่ยน tech stack/pattern/boundary → แก้ docs/ARCHITECTURE.md
3. หากเปลี่ยน module spec/function signature → แก้ frontend/docs/02-design/SDD/02-module-specs.md
4. หากแก้ API Contract → แก้ frontend/docs/02-design/SDD/04-api-integration.md + backend/docs/02-design/SDD/03-api-contract.md
5. หากแก้ UX Spec → แก้ frontend/docs/02-design/SDD/02-screen-specs/
6. แจ้งทีม/บันทึกใน commit message ว่า "docs: update SDD for FR-XXX"

❌ ห้าม:
- แก้โค้ดโดยไม่แก้เอกสารที่เกี่ยวข้อง
- แก้เอกสารหลายไฟล์ใน commit เดียวโดยไม่อธิบายความสัมพันธ์
- ข้ามขั้นตอน propose → approve → implement
- เปลี่ยน public interface โดยไม่แจ้งทีม
```

---

## 🤖 AI Agent Quick Reference

### ก่อนเริ่มงานทุกครั้ง

```
1. อ่านไฟล์นี้ (frontend/AGENTS.md) → เข้าใจกฎและสถานะปัจจุบัน
2. อ่าน INDEX.md → เข้าใจโครงสร้างโปรเจกต์และคำสั่งเร็ว
3. อ่าน frontend/docs/02-design/SDD/_index.md → เลือกไฟล์ที่เกี่ยวข้องกับงาน
4. อ่าน docs/ARCHITECTURE.md → เข้าใจภาพรวมระบบ
5. อ่าน docs/E2E_TEST_STRATEGY.md → เข้าใจกฎการทดสอบ (ถ้าทำ E2E)
6. 🔴 อ่าน .agents/log/nemotron-3-ultra-550b-a55b.md → ดู Mistakes Made + Improvements ป้องกันทำผิดซ้ำ
7. เริ่มงานตาม Sprint Plan → Propose → Implement → Test → PR
8. รัน `make dev-down` เมื่อเสร็จ
```

### เมื่อเจอปัญหา

```
❓ SDD ไม่ชัดเจน → เสนอแก้ไข → รอ Human approve → ทำต่อ
❓ API spec เปลี่ยน → อัปเดต frontend/docs/02-design/SDD/04-api-integration.md → รัน openapi-typescript → แจ้ง backend
❓ Architecture เปลี่ยน → อัปเดต docs/ARCHITECTURE.md → อัปเดต frontend/docs/02-design/SDD/
❓ Test infrastructure broken (ProtectedRoute + Suspense) → ใช้ DEBUG_INFRASTRUCTURE template → แก้ root cause ก่อน
```

### Commit Message Convention

```
feat(auth): add login page with email/password validation
fix(billing): handle meter reading current < previous in Zod schema
docs: update frontend/docs/02-design/SDD/02-screen-specs/04-meter-reading.md for FR-METER-05
test(billing): add unit test for InvoiceListPage empty state
infra: add PWA service worker config + offline fallback
```

---

## 🔗 Cross-References

| Document | Purpose | Cross-Reference |
|----------|---------|-----------------|
| **frontend/AGENTS.md** | Frontend rules, workflow, patterns | See root `AGENTS.md` for global rules |
| **frontend/docs/02-design/SDD/** | Frontend Implementation Blueprint | Modular SDD (8 files) |
| **frontend/docs/sprints/** | Sprint Plans (1–6 Complete) | Implementation steps, Docker commands |
| **docs/E2E_TEST_STRATEGY.md** | E2E Testing Constitution | Mandatory for all test work |
| **docs/PROMPT.md** | Prompt Templates | COMPREHENSIVE_AUDIT (default), E2E_TEST_CAMPAIGN, etc. |
| **frontend/README.md** | Quick start, commands, architecture | Entry point for frontend devs |

> **Rule:** When in doubt about frontend rules → `frontend/AGENTS.md` | When lost about structure/commands → `INDEX.md` | When in doubt about global rules → root `AGENTS.md`

---

## 📚 References (Verified Paths)

| Document | Path | Purpose |
|----------|------|---------|
| **Frontend Architecture** | `frontend/docs/02-design/SDD/01-architecture.md` | Component hierarchy, data flow, PWA architecture |
| **Screen Specs** | `frontend/docs/02-design/SDD/02-screen-specs/` | Per-screen UI, validation, interaction specs |
| **API Integration** | `frontend/docs/02-design/SDD/04-api-integration.md` | fetchClient usage, error handling, type mapping |
| **State/Data Flow** | `frontend/docs/02-design/SDD/03-state-data-flow.md` | TanStack Query, AuthContext, offline queue |
| **Implementation Guide** | `frontend/docs/02-design/SDD/08-implementation.md` | File inventory, AI protocol, naming conventions |
| **Testing & Quality** | `frontend/docs/02-design/SDD/06-testing-quality.md` | Vitest/Playwright patterns, coverage gates |
| **Coding Standards** | `frontend/docs/CODE_STYLE.md` | JS+JSDoc, React, accessibility, git hooks |
| **Sprint Plans** | `frontend/docs/sprints/SPRINT_1.md ~ SPRINT_6.md` | Steps, Docker commands, exit criteria |
| **E2E Test Strategy** | `docs/E2E_TEST_STRATEGY.md` | Constitution: State Verification, Priority Gates, MVTF |
| **Prompt Templates** | `docs/PROMPT.md` | COMPREHENSIVE_AUDIT, E2E_TEST_CAMPAIGN, etc. |
| **API Contract (SSOT)** | `http://localhost:8000/openapi.json` | Auto-generated from FastAPI — source of truth |
| **Decision Records** | `docs/DECISIONS/README.md` | Architecture Decision Records index |

---

> ℹ️ **หมายเหตุ:** เอกสารนี้เป็น living document — อัปเดตเมื่อมี architecture decision ใหม่  
> 🔄 **เปลี่ยนอะไรในโค้ด → ต้องอัปเดต frontend/docs/02-design/SDD/ + Traceability Matrix + Test Files ที่เกี่ยวข้อง**  
> 🐳 **Docker-First Rule:** ทุกคำสั่งพัฒนา/ทดสอบต้องรันผ่าน `docker compose` เท่านั้น  
> ♻️ **Resource Policy:** รัน `make dev-down` ทันทีเมื่อเสร็จงาน — ห้ามทิ้งคอนเทนเนอร์รันค้าง  
> 🤖 **อ่านไฟล์นี้ + frontend/docs/02-design/SDD/_index.md + ARCHITECTURE.md + CODE_STYLE.md ก่อนเริ่มงานทุกครั้ง**  
> 🔴 **อ่าน .agents/log/nemotron-3-ultra-550b-a55b.md ก่อนเริ่มงานทุกครั้ง — ป้องกันทำผิดซ้ำจาก Session เก่า**

✅ **Status:** Frontend v1.0.0 Complete (Sprint 1–6)  
📅 **Last Updated:** 2026-07-07  
🎯 **Next:** Fullstack Integration Testing & Hardening → v1.0.0 Release & Production Deployment