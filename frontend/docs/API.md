# API Integration Guide

This document describes how the frontend connects to the backend API
(FastAPI). For full implementation details, see
[`02-design/SDD/04-api-integration.md`](02-design/SDD/04-api-integration.md).

---

## 1. Base URL Configuration

The API base URL is defined via the `VITE_API_URL` environment variable and
read in [`src/shared/api/fetchClient.ts`](../src/shared/api/fetchClient.ts):

```typescript
const BASE_URL = import.meta.env.VITE_API_URL ?? '/api/v1';
```

| Environment    | `VITE_API_URL`              |
| -------------- | --------------------------- |
| Development    | `http://localhost:8000`     |
| Staging        | `https://staging-api.…`      |
| Production     | `https://api.…`              |

> Copy `.env.example` to `.env` and set `VITE_API_URL` before running.

---

## 2. Authentication Flow

### 2.1 Token Storage

Tokens are stored in **`sessionStorage`** (never `localStorage`):

| Key                | Value              |
| ------------------ | ------------------ |
| `pms_access_token` | JWT access token   |
| `pms_refresh_token`| JWT refresh token  |

Helper functions in `fetchClient.ts`:

- `setStoredTokens(access, refresh?)`
- `getStoredAccessToken()` / `getStoredRefreshToken()`
- `clearStoredTokens()`

### 2.2 Request Authorization

Every request automatically includes the access token in the
`Authorization` header:

```
Authorization: Bearer <access_token>
```

Requests can opt out of auth via `{ skipAuth: true }` in `apiFetch()` options
(e.g. login/register endpoints).

### 2.3 Token Refresh on 401

When the API returns `401 Unauthorized`:

1. `fetchClient` calls the registered `onRetryRefresh` callback (set by
   `AuthContext`).
2. `AuthContext` uses the refresh token to call
   `POST /api/v1/auth/refresh`.
3. On success, the new access token is saved and the original request is
   retried **once** (flagged via `X-Retry` header to prevent infinite loops).
4. On failure, `AuthContext` triggers logout and redirects to `/login`.

### 2.4 Auth Callbacks

`AuthContext.tsx` registers callbacks at startup:

```typescript
registerAuthCallbacks(onLogout, onRefresh);
```

- `onLogout` — clears tokens, resets auth state, redirects to `/login`.
- `onRefresh` — calls `POST /auth/refresh` and returns the new access token.

---

## 3. Error Handling

### 3.1 Error Format

The backend (FastAPI) returns errors as JSON with a `detail` field:

```json
{"detail": "Resource not found"}
```

or structured errors:

```json
{"error": {"code": "ERR_…", "message": "…", "details": {}}}
```

`fetchClient.ts` normalizes these into an `ApiRequestError`:

| Property  | Type                          | Description                          |
| --------- | ----------------------------- | ------------------------------------ |
| `code`    | `string`                      | Error code (`SYS-404`, `AUTH_…`, etc)|
| `message` | `string`                      | Human-readable message               |
| `details` | `Record<string, string>?`     | Field-specific validation errors     |
| `status`  | `number`                      | HTTP status code                     |

### 3.2 Client-Side Handling

Use try/catch around `apiFetch()`:

```typescript
import { apiFetch, ApiRequestError } from '@/shared/api/fetchClient';

try {
  const data = await apiFetch<User>('/users/me');
} catch (err) {
  if (err instanceof ApiRequestError) {
    if (err.code === 'AUTH_SESSION_EXPIRED') {
      // Redirect to login
    }
    // Show err.message to user
  }
}
```

### 3.3 No Content Responses

`204 No Content` responses return an empty object `{}`.

---

## 4. Common Endpoints

### 4.1 Auth

| Method | Endpoint      | Purpose                  |
| ------ | ------------- | ------------------------ |
| POST   | `/auth/login` | Obtain access + refresh  |
| POST   | `/auth/refresh`| Refresh access token    |
| POST   | `/auth/register` | Register a new user   |

### 4.2 Property

| Method | Endpoint                    | Purpose                  |
| ------ | --------------------------- | ------------------------ |
| GET    | `/properties`               | List all properties     |
| GET    | `/properties/{id}`          | Property detail         |
| GET    | `/properties/{id}/buildings`| Buildings in a property  |

### 4.3 Tenant

| Method | Endpoint             | Purpose                  |
| ------ | -------------------- | ------------------------ |
| GET    | `/tenants`           | List tenants            |
| GET    | `/tenants/{id}`      | Tenant detail           |

### 4.4 Billing

| Method | Endpoint                   | Purpose                  |
| ------ | -------------------------- | ------------------------ |
| GET    | `/billing/invoices`        | List invoices           |
| GET    | `/billing/invoices/{id}`   | Invoice detail          |
| POST   | `/billing/payments`        | Record a payment        |

### 4.5 Maintenance

| Method | Endpoint                  | Purpose                   |
| ------ | ------------------------- | ------------------------- |
| GET    | `/maintenance`            | List maintenance requests |
| POST   | `/maintenance`            | Create a request          |
| PATCH  | `/maintenance/{id}/status`| Update status (BR-09)     |

### 4.6 Meter (Offline-First)

| Method | Endpoint              | Purpose                          |
| ------ | --------------------- | -------------------------------- |
| POST   | `/meters/readings`    | Submit a meter reading           |

> Meter readings are queued in IndexedDB when offline and synced via
> Background Sync on reconnection. See
> [`src/shared/pwa/idb-queue.ts`](../src/shared/pwa/idb-queue.ts).

### 4.7 Dashboard

| Method | Endpoint      | Purpose                        |
| ------ | ------------- | ------------------------------ |
| GET    | `/dashboard`  | Aggregated stats (optimized)   |

---

## 5. Provider Chain

React app providers (defined in `App.tsx`):

```
BrowserProvider
  └─ QueryClientProvider (TanStack Query)
     └─ ToastProvider
        └─ AuthProvider
           └─ AppRoutes
```

- **QueryClientProvider**: server-state caching (`staleTime: 30s`, `retry: 1`).
- **ToastProvider**: global toast notifications.
- **AuthProvider**: JWT state, refresh-orchestration, logout-on-expiry.
- **AppRoutes**: React Router v7 with lazy-loaded routes and protected routes.

---

## 6. Additional Resources

- **Implementation Spec**: [`02-design/SDD/04-api-integration.md`](02-design/SDD/04-api-integration.md)
- **Full OpenAPI Schema**: `backend/docs/02-design/SDD/03-api-contract.md`
- **fetchClient Source**: [`src/shared/api/fetchClient.ts`](../src/shared/api/fetchClient.ts)
- **AuthContext Source**: [`src/shared/auth/AuthContext.tsx`](../src/shared/auth/AuthContext.tsx)
- **PWA Offline Queue**: [`src/shared/pwa/idb-queue.ts`](../src/shared/pwa/idb-queue.ts)
- **Environment Template**: [`../../.env.example`](../../.env.example)
