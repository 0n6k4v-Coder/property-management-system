# Frontend — Property Management System

> **Version:** 1.0.0 | **Sprint:** 6 (PWA Polish + E2E + Prod Hardening)  
> **Tech:** React 19 + Vite 8 + TypeScript 6 + Tailwind CSS 4

---

## Quick Start

### Prerequisites

- Docker ≥ 24.0 & Docker Compose ≥ 2.20
- Node.js 22+ (for local dev outside Docker)

### Docker (Recommended)

```bash
# From project root (/property-management-system/)
make dev          # Start all services (backend, frontend, db, redis, minio)

# Access:
#   Frontend:    http://localhost:5173
#   Backend API: http://localhost:8000
#   API Docs:    http://localhost:8000/openapi.json
```

### Seed Data (First-Time Setup)

```bash
# From project root — create admin user + sample property + rooms
docker compose -f docker-compose.dev.yml exec -e PYTHONPATH=/app backend \
    python3 /app/scripts/seed_admin.py

# Login credentials:
#   Email:    admin@example.com
#   Password: Admin123!

# Sample data created:
#   - Sathorn Condominium (123 Sathorn Road, Bangkok)
#   - Building A with 10 rooms (Studio ฿8,500–10,500 / 1-Bedroom ฿11,000–13,000)
```

### Local Development

```bash
cd frontend
npm install
npm run dev       # Vite dev server at http://localhost:5173
```

---

## Environment Variables

Create `.env` in `frontend/` (if not present):

```env
VITE_API_URL=/api/v1              # API base path (proxied by Vite)
VITE_API_BASE_URL=http://localhost:8000  # Direct API URL (non-Docker)
```

---

## Available Scripts

| Script | Command | Description |
|--------|---------|-------------|
| **dev** | `npm run dev` | Start Vite dev server with HMR |
| **build** | `npm run build` | TypeScript compile + Vite production build |
| **preview** | `npm run preview` | Preview production build locally |
| **lint** | `npm run lint` | ESLint + React Doctor (zero warnings) |
| **typecheck** | `npm run typecheck` | TypeScript strict type checking |
| **test** | `npm run test` | Unit tests with Vitest |
| **test:coverage** | `npm run test:coverage` | Unit tests with coverage report |
| **test:e2e** | `npm run test:e2e` | Playwright E2E tests (3 critical flows) |
| **test:a11y** | `npm run test:a11y` | A11y audit with axe-core (0 violations) |
| **lighthouse** | `npm run lighthouse` | Lighthouse CI audit (≥90 performance) |
| **bundle:analyze** | `npm run bundle:analyze` | Build + open treemap visualization |
| **bundle:size** | `npm run bundle:size` | Build + display chunk sizes |

### Docker Testing (from project root)

```bash
make test-frontend   # Vitest unit tests
make test-e2e        # Playwright E2E tests
make lint-frontend   # ESLint + TSC
make dev-down        # Stop all containers
```

---

## Architecture Overview

```
frontend/
├── src/
│   ├── features/          # Feature modules (flat structure)
│   │   ├── auth/          # Login, Register
│   │   ├── billing/       # Invoice list, detail, export
│   │   ├── dashboard/     # Stats, overdue table
│   │   ├── meter/         # Meter reading + offline queue
│   │   ├── property/      # Property list, room detail
│   │   ├── reports/       # Charts (dynamic import)
│   │   └── tenant/        # Tenant list
│   ├── shared/
│   │   ├── api/           # fetchClient (token attach, retry, error map)
│   │   ├── auth/          # AuthContext, useAuth hook
│   │   ├── pwa/           # Service worker, IDB queue, sync
│   │   └── ui/            # Button, Card, Input, Modal, Toast, etc.
│   ├── routes/            # React Router config + ProtectedRoute
│   ├── layouts/           # AuthLayout, MainLayout
│   ├── mocks/             # MSW handlers (dev/test)
│   └── types/             # API type definitions
├── e2e/
│   ├── specs/             # E2E test specifications
│   │   ├── auth-flow.spec.ts
│   │   ├── meter-offline-sync.spec.ts
│   │   └── invoice-payment.spec.ts
│   └── a11y.spec.ts       # Accessibility audit tests
├── public/                # Static assets, manifest.json, offline.html
├── playwright.config.ts   # Playwright E2E configuration
├── lighthouserc.js        # Lighthouse CI configuration
├── vite.config.ts         # Vite build + test config
└── package.json           # Dependencies and scripts
```

### Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Framework | React 19 + TypeScript 6 | UI components, strict typing |
| Build | Vite 8 + Rollup | Fast HMR, code splitting, treemap analysis |
| Styling | Tailwind CSS 4 | Utility-first CSS |
| State | TanStack Query 5 | Server state management, caching |
| Forms | React Hook Form + Zod | Form validation |
| Routing | React Router DOM v7 | SPA routing with lazy loading |
| Testing | Vitest (unit), Playwright (E2E), axe-core (A11y) | Quality gates |
| PWA | Custom Service Worker + IndexedDB | Offline meter reading queue |

---

## PWA & Offline Support

### How It Works

The app is a Progressive Web App with offline-first meter reading:

1. **Service Worker** (`src/shared/pwa/service-worker.ts`):
   - `CacheFirst` for static assets (JS/CSS/images/fonts)
   - `NetworkFirst` for API requests (`/api/*`)
   - Offline fallback page for navigation failures
   - Auto-activates with `skipWaiting()` + `clientsClaim()`

2. **Offline Queue** (`src/shared/pwa/idb-queue.ts`):
   - Meter readings queued in IndexedDB when offline
   - Background sync (`sync` event) when connection restored
   - Queue items: `pending` → `syncing` → deleted (success) or `failed`

3. **Manifest** (`public/manifest.json`):
   - Standalone display mode
   - iOS compatible (apple-mobile-web-app-capable)
   - Maskable icon for Android adaptive icons

### Testing Offline

```bash
# 1. Build and preview
npm run build && npm run preview

# 2. Open Chrome DevTools → Application → Service Workers
# 3. Check "Offline" checkbox
# 4. Refresh — app loads from cache with offline page
# 5. Navigate to meter reading — form submits to IDB queue
# 6. Uncheck "Offline" — queue syncs automatically
```

---

## E2E Testing (Playwright)

### Running Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run specific test file
npx playwright test e2e/specs/auth-flow.spec.ts

# Run A11y tests only
npm run test:a11y

# Run with UI (headed mode)
npm run test:e2e:headed

# View HTML report
npx playwright show-report
```

### Test Coverage (3 Critical Flows)

| Flow | File | What It Tests |
|------|------|---------------|
| Auth | `auth-flow.spec.ts` | Redirect → Login → Dashboard → Token storage |
| Meter Offline Sync | `meter-offline-sync.spec.ts` | Fill form → Offline → Queue → Online → Sync |
| Invoice Payment | `invoice-payment.spec.ts` | List → Detail → Record payment → Status update |

### API Mocking

All E2E tests use `page.route('**/api/**', ...)` to mock API responses.
This ensures tests are deterministic and don't require a running backend.

---

## Accessibility (A11y)

### Standards

- WCAG 2.1 Level AA compliance
- axe-core scanning with zero violations
- Keyboard navigation support for all interactive elements
- Minimum contrast ratio: 4.5:1

### Running A11y Audit

```bash
npm run test:a11y
# Scans: /login, /dashboard, /meter-reading, /invoices
# Asserts: 0 violations on all pages
```

---

## Lighthouse CI

### Running

```bash
npm run lighthouse
# Thresholds: Performance ≥90, A11y 100, Best Practices ≥90, SEO ≥90
# FCP < 1.5s, TTI < 3s
```

---

## Bundle Analysis

```bash
npm run bundle:analyze
# Opens treemap visualization (stats.html)
# Target: Initial JS bundle ≤ 150KB (gzip)

npm run bundle:size
# Shows chunk sizes in terminal
```

### Code Splitting

- **Vendor chunk**: React, ReactDOM, React Router (~45KB gzip)
- **Query chunk**: TanStack Query (~15KB gzip)
- **Feature chunks**: Lazy-loaded via `React.lazy()` (reports/charts)

---

## Troubleshooting

### Service Worker Not Updating

1. Ensure production build: `npm run build && npm run preview`
2. DevTools → Application → Service Workers → Unregister
3. Hard refresh (Ctrl+Shift+R)

### API Proxy Not Working (Dev)

1. Vite proxies `/api` → `http://backend:8000` (see `vite.config.ts`)
2. Ensure backend is running: `make dev`
3. Check Network tab for proxied requests

### E2E Tests Failing

1. Ensure Playwright browsers installed: `npx playwright install --with-deps`
2. Check Playwright trace: `npx playwright show-trace e2e-results/...`
3. All E2E tests use API mocking — no backend needed

### Bundle Size Too Large (>150KB)

1. Run `npm run bundle:analyze` to find large modules
2. Ensure `recharts` is dynamically imported (not static)
3. Check for unused imports with `knip`

### A11y Violations

1. Run `npm run test:a11y` for detailed report
2. Common fixes: add `alt`, `aria-label`, `role`, improve contrast
3. Check keyboard focus order with Tab key

---

## Docker-First Workflow

All development and testing should be done via Docker:

```bash
make dev            # Start services
make test-frontend  # Unit tests
make test-e2e       # E2E tests
make lint-frontend  # Lint + type check
make dev-down       # Stop all containers (ALWAYS run when done)
```

> **Important:** Always run `make dev-down` when finished to free system resources.

---

*This README is part of Frontend Sprint 6 deliverables. Last updated: 2026-07-06*
