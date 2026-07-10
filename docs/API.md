# API Reference — Property Management System

> **Base URL**: `https://{domain}/api/v1/`
> **Authentication**: `Authorization: Bearer <JWT>` (except `/auth/login`, `/auth/register`, `/auth/refresh`)
> **Content-Type**: `application/json`
> **Versioning**: `/api/v1/` is hardcoded in every router mount (`app/main.py`) — there is no `/v2`, no version negotiation, and no version-bump mechanism implemented yet. Treat this as the only version that exists.
> **Response envelope**: `{"data": ..., "meta": ...}` on success is a strong convention, not a framework guarantee — most endpoints follow it, a few don't (noted inline below).
> **OpenAPI docs**: `/docs`, `/redoc`, `/openapi.json` only exist when `settings.DEBUG=True` (`app/config.py`, default `True` — must be overridden in production).

This document is generated from the actual routers under `backend/app/modules/*/routers/` and their schemas, not from a spec. Where the code itself is inconsistent or has dead code, that is called out explicitly rather than smoothed over — see [Known Inconsistencies](#known-inconsistencies).

---

## 📋 Table of Contents

- [Authentication](#authentication)
- [Properties & Rooms](#properties--rooms)
- [Proposed Redesign — Property & Rooms Module (Target Design)](#-proposed-redesign--property--rooms-module-target-design-not-yet-implemented)
- [Tenants](#tenants)
- [Billing (Meter Readings, Invoices, Payments)](#billing)
- [Contracts](#contracts)
- [Maintenance](#maintenance)
- [Dashboard](#dashboard)
- [Notifications](#notifications)
- [Admin](#admin)
- [Error Codes](#error-codes)
- [Rate Limiting](#rate-limiting)
- [Known Inconsistencies](#known-inconsistencies)

> Note: there is **no** dedicated `/reports` module, and **no** top-level `/rooms`, `/buildings`, or `/floors` resources. Those do not exist in the codebase.

---

## 🔐 Authentication

Router: `app/modules/auth/routers/auth_router.py`, mounted at `/api/v1/auth`.

> Auth now carries **real property-scope authorization** and a **full refresh
> token set** (anti-patterns `#5, #23, #6, #7, #17, #3, #11, #12, #1` from
> `docs/FEEDBACK/reviews/REVIEW-2026-07-10-api-anti-pattern-audit.md` are
> implemented in code — see the resolution note in that review file).
> `#9` (API versioning policy) remains a **deliberate platform-wide gap**, not
> fixed by this module.

### Authorization model (fixes #5, #11)

`property_scopes` on the JWT, on `TokenResponse`, and on `UserResponse` is the
**real** list of `property_id`s the user holds a row for in the new
`user_property_scopes` table (migration `019` — added by this redesign). It is
no longer hardcoded to `[]`. Roles are per-property: `owner`/`admin` bypass
per-property checks globally; `staff` is scoped strictly to the listed
properties.

The shared `require_property_scope()` dependency in `app/shared/deps.py` reads
the `property_id` from the request body, then raises `403 AUTH-005`
("Insufficient property scope") unless the caller is a global owner/admin or
holds a `user_property_scopes` row for that property. `/invite` enforces it.

### `POST /api/v1/auth/login`

Body — `AuthRequest` (`strict=True, extra="forbid"`):
```json
{
  "email": "user@example.com",
  "password": "SecurePass123"
}
```
`password` requires ≥8 chars, ≥1 uppercase, ≥1 digit.

**New per-route rate limit (fixes #6):** 10 req/min keyed by client IP, in a
*bucket separate* from the global 10,000 req/60s limiter. On hitting the limit
the endpoint returns `429 SYS-429` **with** `Retry-After` and real
`X-RateLimit-Limit` / `X-RateLimit-Remaining` headers (these were advertised in
CORS `expose_headers` but never emitted before). See [Rate Limiting](#rate-limiting).

**Response (200)** — `TokenResponse`:
```json
{
  "data": {
    "access_token": "eyJhbG...NiIs...",
    "refresh_token": "eyJhbG...NiIs...",
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "full_name": "John Doe",
      "property_scopes": ["uuid"],
      "is_active": true
    }
  }
}
```
`refresh_token` is a rotation-enabled token (see `/refresh`).

**Errors:** `401 AUTH-001` (invalid credentials), `403 AUTH-002` (inactive account), `429 SYS-429` (rate limited)

---

### `POST /api/v1/auth/register`

Accepts an invite and creates the account. Body — `RegisterRequest` (`strict=True, extra="forbid"`):
```json
{
  "invite_token": "eyJhbG...NiIs...",
  "full_name": "Jane Smith",
  "password": "NewUserPass1",
  "phone": "0899999999"
}
```
`full_name`: 2-255 chars. `password`: same strength rule as login. `phone`: 10-15 chars, no format regex enforced at this layer.

**Idempotency (fixes #1):** an optional `Idempotency-Key` header is honored. A
repeated request with the same key within the 24h `idempotency_keys` cache
window replays the original `201` response verbatim (the stored body is
re-checked against the request hash, so a key reused with a *different* body is
rejected with `409 VAL-409`).

**Response (201)** — `UserResponse` (registering does **not** log the user in;
`property_scopes` is `[]` because the invited user has no scopes of their own):
```json
{
  "data": {
    "id": "uuid",
    "email": "jane@example.com",
    "full_name": "Jane Smith",
    "property_scopes": [],
    "is_active": true
  }
}
```

**Errors:** `400 VAL-001` (validation error, unified envelope — see below), `401 AUTH-003` (invite expired/invalid/used), `409 AUTH-004` (email exists)

---

### `POST /api/v1/auth/invite`

Requires auth **and** a valid property scope (`403 AUTH-005` otherwise). Body —
`InviteRequest` (`strict=True, extra="forbid"` — keeps strict mode while the
UUID coercion for `property_id` is made explicit via a `field_validator`,
fixes #12):
```json
{
  "email": "newuser@example.com",
  "property_id": "uuid"
}
```

**Idempotency (fixes #1):** same `Idempotency-Key` support as `/register`.

**Response (201)** — new typed `InviteResponse` schema instead of an ad-hoc dict (fixes #11):
```json
{
  "data": {
    "invite_link": "https://app.com/auth/register?token=...",
    "property_id": "uuid",
    "expires_at": "2026-07-17T00:00:00Z"
  }
}
```

**Errors:** `400 VAL-001` (validation error), `403 AUTH-005` (insufficient property scope), `409 AUTH-004` (email already in use)

---

### `POST /api/v1/auth/refresh`

Body — `RefreshRequest` (`strict=True, extra="forbid"`), replacing the old
unvalidated raw dict (fixes #7):
```json
{ "refresh_token": "..." }
```

**Response (200)** — the full `TokenResponse`: a fresh `access_token`, a
**rotated** `refresh_token`, and the `user` document. Rotation invalidates the
presented refresh token (validated against the user's stored
`current_refresh_jti`; a superseded/revoked token now raises `401 AUTH-008`
instead of silently succeeding) — closes the replay window the old single-token
design left open (fixes #11).
```json
{
  "data": {
    "access_token": "eyJhbG...NiIs...",
    "refresh_token": "eyJhbG...NiIs...",
    "user": { "id": "uuid", "email": "...", "full_name": "...", "property_scopes": ["uuid"], "is_active": true }
  }
}
```

**Errors:** `400 VAL-001` (validation error), `401 AUTH-007` (invalid/expired/revoked/mismatched refresh token), `401 AUTH-008` (refresh token superseded by a later rotation)

---

### `GET /api/v1/auth/me`

Requires auth. **Response (200)** — `UserResponse` (same shape as the `user` field on login, `property_scopes` from the token claim):
```json
{
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "full_name": "John Doe",
    "property_scopes": ["uuid"],
    "is_active": true
  }
}
```

**Errors:** `401 AUTH-009` (invalid/expired access token)

---

### Cross-cutting Auth fixes (implemented)

- **Error envelope (#3):** a `RequestValidationError` handler in `main.py`
  returns `{"error": {"code": "VAL-001", "message": "Request validation failed", "details": {...}}}` for any `422` — the same shape as every domain error, not FastAPI's default `{"detail": [...]}` (verified by `TestValidationErrorEnvelope`).
- **CORS (#23):** CORS is registered exactly **once** via `setup_cors_middleware()` in `main.py`, with an explicit origin allowlist (`http://localhost:5173`, `http://localhost:3000`) — never `allow_origins=["*"]` paired with `allow_credentials=True`, even in DEBUG.
- **Observability (#17):** `LoggingMiddleware` (`app/middleware/logging.py`) is registered in `main.py`; every response carries an `X-Request-ID` header (echoing any caller-supplied one, else a generated UUID), and login/register/invite/refresh attempts are structured-logged with that ID.
- **Versioning (#9):** *not* implemented — see [Rate Limiting](#rate-limiting) footer. This is a platform-wide gap; Auth documents the intended policy (breaking changes require a new `/api/v2/auth/...` mount alongside `/v1` for a ≥90-day deprecation window) but the code does not yet implement version negotiation.



## 🏢 Properties & Rooms

Router: `app/modules/property/routers/property_router.py`, mounted at `/api/v1/properties`. There is no separate Buildings or Floors resource, and no top-level `/rooms` resource — rooms are only reachable nested under a property.

### `POST /api/v1/properties/`

Body — `CreatePropertyRequest` (`strict=True, extra="forbid"`):
```json
{
  "name": "Green View Dormitory",
  "address": "123 Sukhumvit Rd, Bangkok",
  "billing_due_day": 5,
  "min_deposit_months": 2
}
```
`billing_due_day`: 1-28. `min_deposit_months`: default `2`, ≥1.

**Response (201)** — `PropertyCreateResponse` (`data: PropertyResponse`).

---

### `GET /api/v1/properties/`

List all properties. No query parameters, no pagination — returns the full list.

**Response (200)** — `PropertyListResponse`:
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Green View Dormitory",
      "address": "123 Sukhumvit Rd",
      "billing_due_day": 5,
      "min_deposit_months": 2,
      "created_by": "uuid",
      "created_at": "2026-01-15T10:30:00Z",
      "updated_at": "2026-01-15T10:30:00Z"
    }
  ]
}
```

---

### `GET /api/v1/properties/{property_id}`

**Response (200)** — `PropertyCreateResponse` (same wrapper class as create — reused for get-by-id too).

---

### `GET /api/v1/properties/{property_id}/rooms`

Returns the property plus its full room list (no pagination/filters).

**Response (200)** — `PropertyWithRoomsResponse`:
```json
{
  "property": { "id": "uuid", "name": "...", "...": "..." },
  "rooms": [
    {
      "id": "uuid",
      "property_id": "uuid",
      "building_id": "uuid",
      "floor_id": "uuid",
      "room_number": "101",
      "room_type": "studio",
      "base_rent": "5000.00",
      "status": "available",
      "images": {}
    }
  ]
}
```
Note: this response is **not** wrapped in `{"data": ...}` — `property`/`rooms` are top-level keys.

---

### `PATCH /api/v1/properties/rooms/{room_id}/status`

Note the path — it lives under the `/properties` prefix even though it addresses a room (`.../properties/rooms/{room_id}/status`, not `/rooms/{room_id}/status`).

Body — `UpdateRoomStatusRequest`:
```json
{ "status": "occupied" }
```
`status` enum: `available | occupied | maintenance`.

**Response (200):** `{"data": {...room...}, "meta": null}`

---

## 🔧 Proposed Redesign — Property & Rooms Module (Target Design, NOT Yet Implemented)

> ⚠️ **Everything above this box is the current, real, shipped Property & Rooms API.** Everything in this box is a **target design** produced to fix every anti-pattern finding against this module in `docs/FEEDBACK/reviews/REVIEW-2026-07-10-api-anti-pattern-audit.md` (`#5, #3, #13, #23, #11, #10, #1`). **No backend code has been changed to match this yet** — this is the blueprint an implementation task should follow. Per this doc's own rule ("code beats documentation"), until implemented, the code above remains ground truth.

### Fix map (anti-pattern → design decision)

| # | Anti-pattern | Design fix below |
|---|---|---|
| #5 | No authorization — any authenticated user can read/mutate any property or room | Apply the `require_property_scope()` dependency (already implemented in `app/shared/deps.py` as part of the Auth redesign) to all 5 endpoints |
| #3 | Two error envelopes; manual UUID parsing on 2 endpoints causes a 500 instead of a 422 on malformed input | Type `property_id`/`room_id` path params as `uuid.UUID` everywhere (FastAPI validates + emits a clean 422 automatically), matching the pattern `GET /{property_id}` already uses correctly |
| #13 | `GET /properties/` and `GET /{property_id}/rooms` are fully unbounded | Add `page`/`limit` query params + `meta` pagination block, matching the pattern already used by `GET /admin/audit-logs` |
| #23 | CORS double-registration, wildcard+credentials | **Already fixed** — this was a cross-cutting `main.py`/`middleware` bug resolved by the Auth redesign implementation; nothing left to do for this module specifically |
| #11 | Room-status route nested oddly under `/properties/rooms/...`; `GET /{property_id}` reuses the create-response wrapper | Move room-status under the room's natural parent path; give `GET /{property_id}` its own response schema (still shaped like `PropertyResponse` data, but not literally the `...CreateResponse` class) |
| #10 | `RoomResponse` leaks `created_by`-style internal ownership data; `PropertyResponse` exposes `created_by` (internal owner UUID) with no client use case | Drop `created_by` from the public `PropertyResponse`; keep `building_id`/`floor_id` on `RoomResponse` (explicitly justified below — these are legitimate cross-references the client needs, not accidental leakage) |
| #1 | `POST /properties/` has no idempotency protection | Reuse the existing `Idempotency-Key` mechanism (`app/shared/idempotency.py`, built for the Auth redesign) — same 24h dedupe pattern |

Also inherited as **already fixed** by the Auth redesign (cross-cutting, not re-designed here): the unified `RequestValidationError` → `{"error":{...}}` envelope (#3's other half), and the logging middleware (`X-Request-ID`) now being registered (closes the `#17` uncertainty the original audit flagged as unverified).

---

### Authorization (fixes #5) — applies to all 5 endpoints

Every endpoint below adds `Depends(require_property_scope(property_id))` (the same dependency introduced for `/auth/invite`) in addition to `get_current_user`. Behavior:
- `POST /properties/` — creating a property has no pre-existing `property_id` to scope against; instead, the creator is auto-granted an `owner` row in `user_property_scopes` for the new property (mirrors how contract/tenant creation already assigns ownership implicitly).
- `GET /properties/` (list) — no longer returns every property in the system; filters to only properties the caller has a `user_property_scopes` row for, unless the caller is a global `owner`/`admin`.
- `GET /properties/{property_id}`, `GET /properties/{property_id}/rooms`, `PATCH .../rooms/{room_id}/status` — all require a scope row for that specific `property_id` (room-status resolves the room's `property_id` first, then checks scope against that).
- Raises `403 AUTH-005` ("Insufficient property scope") on failure — same error code the Auth redesign wired up, now actually reachable from a second module instead of only `/invite`.

---

### `POST /api/v1/properties/` (redesigned)

No request/response shape change. Behavior changes only:
- **Idempotency (fixes #1):** accepts an optional `Idempotency-Key` header — a repeated request with the same key within 24h returns the original `201` response instead of creating a duplicate property (same mechanism as `/auth/register`).
- **Authorization:** creator is auto-granted `owner` scope on the new property (see above).

---

### `GET /api/v1/properties/` (redesigned)

**Query Parameters (fixes #13):**
| Param | Type | Default | Notes |
|---|---|---|---|
| `page` | int | 1 | ≥1 |
| `limit` | int | 20 | 1-100 |

**Response (200):**
```json
{
  "data": [ { "id": "uuid", "name": "...", "...": "..." } ],
  "meta": { "page": 1, "limit": 20, "total": 3, "has_next": false }
}
```
Only returns properties the caller holds a scope for (fixes #5), except global `owner`/`admin` callers who see everything.

---

### `GET /api/v1/properties/{property_id}` (redesigned)

**Response (200)** — new dedicated `PropertyDetailResponse` (fixes #11 — no longer reuses `PropertyCreateResponse`). Same field shape as before, minus `created_by` (fixes #10):
```json
{
  "data": {
    "id": "uuid",
    "name": "Green View Dormitory",
    "address": "123 Sukhumvit Rd",
    "billing_due_day": 5,
    "min_deposit_months": 2,
    "created_at": "2026-01-15T10:30:00Z",
    "updated_at": "2026-01-15T10:30:00Z"
  }
}
```
`created_by` is dropped from the public response — it's an internal ownership column with no documented client use case (contrast `building_id`/`floor_id` on `RoomResponse`, kept deliberately — see below). If audit trail access to "who created this property" is ever needed by a client, it belongs behind `/admin/audit-logs`, not leaked into every property read.

**Errors add:** `403 AUTH-005` (fixes #5)

---

### `GET /api/v1/properties/{property_id}/rooms` (redesigned)

**Query Parameters (fixes #13):** same `page`/`limit` as the list endpoint above, applied to the `rooms` array (the `property` object is unpaginated — it's a single record).

**Response (200):**
```json
{
  "data": {
    "property": { "id": "uuid", "name": "...", "...": "..." },
    "rooms": [
      {
        "id": "uuid",
        "property_id": "uuid",
        "building_id": "uuid",
        "floor_id": "uuid",
        "room_number": "101",
        "room_type": "studio",
        "base_rent": "5000.00",
        "status": "available",
        "images": {}
      }
    ]
  },
  "meta": { "page": 1, "limit": 20, "total": 45, "has_next": true }
}
```
Two changes from today's shape: (1) now wrapped in the standard `{"data": ..., "meta": ...}` envelope instead of bare top-level `property`/`rooms` keys (fixes the `#11`-adjacent envelope inconsistency noted in the current docs); (2) `rooms` is paginated.

**On `#10` (kept deliberately):** `building_id`/`floor_id` stay on `RoomResponse`. Unlike `created_by`, these are cross-references the client actually needs today (grouping rooms by building/floor in the UI) and there's no dedicated Buildings/Floors endpoint to fetch them from instead — removing them would be a functional regression, not a fix. This is a documented judgment call, not an oversight.

---

### `PATCH /api/v1/properties/{property_id}/rooms/{room_id}/status` (redesigned — path changed, fixes #11)

**Path change:** moves from `/api/v1/properties/rooms/{room_id}/status` to `/api/v1/properties/{property_id}/rooms/{room_id}/status` — nests consistently under the same property-scoped path shape as `GET .../rooms`, instead of the current irregular `/properties/rooms/...` shape. `property_id` in the path also gives `require_property_scope()` something to check without an extra DB lookup to resolve the room's property first.

Body — `UpdateRoomStatusRequest` (unchanged):
```json
{ "status": "occupied" }
```

**Response (200):** `{"data": {...room...}, "meta": null}` (unchanged shape)

**Errors add:** `403 AUTH-005` (fixes #5); `404` if `room_id` doesn't belong to `property_id` in the path (fixes part of #3 — previously a mismatched room/property pair had no defined behavior)

---

### Cross-cutting fix carried over from #3 (manual UUID parsing → uncaught 500)

`GET /{property_id}/rooms` and the room-status endpoint currently parse `property_id`/`room_id` as plain `str` and manually call `uuid.UUID(...)`, which raises an uncaught `ValueError` (→ 500) on a malformed id. The redesign types both as `uuid.UUID` directly in the function signature (exactly like `GET /{property_id}` already does correctly) — FastAPI then validates and returns a clean `422 {"error":{"code":"VAL-001",...}}` (via the unified validation-error handler already added by the Auth redesign) instead of a 500.

---

## 👥 Tenants

Router: `app/modules/tenant/routers/tenant_router.py`, mounted at `/api/v1/tenants`.

### `POST /api/v1/tenants/`

Body — `CreateTenantRequest` (`strict=True, extra="forbid"`):
```json
{
  "property_id": "uuid",
  "full_name": "Somchai Jaidee",
  "id_card_number": "1234567890123",
  "phone": "0812345678",
  "email": "somchai@email.com",
  "emergency_contact_name": "Mother",
  "emergency_contact_phone": "0898765432"
}
```
`id_card_number`: exactly 13 digits + Thai checksum validation, encrypted at rest, never returned. `phone`: exactly 10 digits, must match `^0\d{9}$`.

**Response (201)** — `TenantCreateResponse` (`data: TenantResponse`, `id_card_number_encrypted` excluded from the response).

---

### `GET /api/v1/tenants/search`

**Query Parameters:**
| Param | Type | Required | Notes |
|-------|------|----------|-------|
| `property_id` | string | yes | |
| `query` | string | yes | min length 3 |
| `search_by` | string | no | default `"name"` |
| `page` | int | no | default 1, ≥1 |
| `limit` | int | no | default 20, 1-100 |

Response is a raw `dict` — no dedicated schema class; `data` contains `TenantResponse` instances.

---

## 💰 Billing

Router: `app/modules/billing/routers/billing_router.py`, mounted at **`/api/v1/billing`** — meter readings, invoices, and payments are all under this one prefix, not top-level resources.

### `POST /api/v1/billing/meter-readings`

Body — `MeterReadingRequest` (no `strict`/`forbid` — extra fields are allowed here, unlike most other modules):
```json
{
  "room_id": "uuid",
  "billing_month": 1,
  "billing_year": 2026,
  "electric_previous": 100,
  "electric_current": 150,
  "water_previous": 15,
  "water_current": 25
}
```
`electric_current`/`water_current` must be ≥ their `_previous` counterpart (validated).

**Response (201)** — `MeterReadingCreateResponse`:
```json
{
  "data": {
    "id": "uuid",
    "room_id": "uuid",
    "billing_month": 1,
    "billing_year": 2026,
    "electric_previous": 100,
    "electric_current": 150,
    "electric_used": 50,
    "water_previous": 15,
    "water_current": 25,
    "water_used": 10,
    "read_date": "2026-01-20T08:30:00Z"
  }
}
```

**Errors:** meter-reading validation failures use the `BILL-*` codes (see [Error Codes](#error-codes)) — there is no dedicated code for "current < previous" distinct from the general `BILL-*` set.

---

### `GET /api/v1/billing/meter-readings/{room_id}/history`

**Query:** `limit: int = 12` (plain default, no bound enforced).

---

### `POST /api/v1/billing/invoices/generate`

Body — `GenerateInvoiceRequest`:
```json
{ "property_id": "uuid", "billing_month": 1, "billing_year": 2026 }
```

**Response (201)** — `InvoiceCreateResponse` (single generated batch result per invoice, shape follows `InvoiceResponse`).

---

### `GET /api/v1/billing/invoices`

**Query:** `property_id: uuid | None` — that is the only filter implemented; there is no `status`, `page`, or `limit` query parameter on this endpoint despite what a generic list endpoint might imply.

---

### `GET /api/v1/billing/invoices/{invoice_id}`

Returns 404 via a plain `HTTPException`, **not** the standard `{"error": {...}}` envelope — this endpoint's error path is `{"detail": "Invoice not found"}`.

---

### `POST /api/v1/billing/payments`

Body — `RecordPaymentRequest`:
```json
{
  "invoice_id": "uuid",
  "amount": 7500.00,
  "method": "cash",
  "reference_number": "REF123",
  "slip_image_url": null,
  "notes": "January rent"
}
```
`method` pattern accepted: `cash | bank_transfer | credit_card | qr_code | wallet` — **this does not match** the `PaymentMethod` enum used elsewhere (`bank_transfer | cash | promptpay | qr_code | credit_card`): `wallet` is accepted here but isn't a real enum value, and `promptpay` is a valid enum value but rejected by this endpoint's pattern. See [Known Inconsistencies](#known-inconsistencies).

**Response (200)** — note this is **200, not 201**, unlike every other create endpoint in this API.

---

## 📝 Contracts

Router: `app/modules/contract/routers/contract_router.py`, mounted at `/api/v1/contracts`.

### `POST /api/v1/contracts/`

Body — `CreateContractRequest` (`extra="forbid"`):
```json
{
  "room_id": "uuid",
  "tenant_id": "uuid",
  "property_id": "uuid",
  "start_date": "2026-02-01",
  "end_date": "2027-01-31",
  "monthly_rent": 5000.00,
  "deposit_amount": 10000.00,
  "special_conditions": "No pets"
}
```
Field names are `monthly_rent` / `deposit_amount` (not `rent_amount`), and there is no `billing_day` field on this request. `end_date` must be after `start_date`.

**Response (201)** — `ContractCreateResponse` (`data: ContractResponse`, `status: "active"`).

**Business rules enforced in the service layer:** one active contract per room; minimum deposit months; no overlapping date ranges for the same room.

---

### `GET /api/v1/contracts/active`

**Query:** `property_id: uuid | None`

---

### `GET /api/v1/contracts/{contract_id}`

Returns full contract detail including `termination` and `extensions` sub-objects when present.

---

### `PATCH /api/v1/contracts/{contract_id}/terminate`

Method is **`PATCH`, not `POST`**. Body — `TerminateContractRequest`:
```json
{
  "reason": "tenant_request",
  "termination_date": "2026-06-30",
  "notes": "Tenant moving out"
}
```
`reason` is an enum (`TerminationReason`), not a free-text string.

---

### `POST /api/v1/contracts/{contract_id}/extend`

Body — `ExtendLeaseRequest`:
```json
{ "new_end_date": "2027-07-31", "reason": "Tenant requested extension" }
```

---

### `POST /api/v1/contracts/{contract_id}/renew`

Body — `RenewContractRequest`:
```json
{
  "new_start_date": "2027-02-01",
  "new_end_date": "2028-01-31",
  "new_monthly_rent": 5200.00,
  "new_deposit_amount": 10400.00
}
```
**Response (201)** — creates a brand-new contract linked via `renewed_from_id`; the original must already be terminated/expired.

---

### `GET /api/v1/contracts/leases/{room_id}/history`

Full lease history (all past + present contracts) for a room, newest first. **Note the real path is `/api/v1/contracts/leases/{room_id}/history`** (nested under the `/contracts` prefix) — the router's own internal docstrings incorrectly reference `/api/v1/leases/{room_id}/history`; the mount prefix in `app/main.py` is what actually governs the path.

---

## 🔧 Maintenance

Router: `app/modules/maintenance/routers/maintenance_router.py`, mounted at `/api/v1/maintenance`.

### `POST /api/v1/maintenance/`

Body — `CreateMaintenanceRequest`:
```json
{
  "room_id": "uuid",
  "property_id": "uuid",
  "title": "Air conditioner not cooling",
  "description": "AC blowing warm air since yesterday",
  "priority": "high"
}
```
`title`: 3-255 chars. `description`: ≥10 chars. `priority` enum: `low | medium | high | urgent` (default `medium`).

**Response (201)** — `MaintenanceCreateResponse`.

---

### `GET /api/v1/maintenance/pending`

**This is the only list endpoint** — it always returns pending requests; there is no generic `GET /maintenance?status=&priority=` filterable list.

**Query:** `property_id: uuid` (**required**).

---

### `GET /api/v1/maintenance/{request_id}`

---

### `PATCH /api/v1/maintenance/{request_id}/status`

Body — `UpdateMaintenanceStatusRequest`:
```json
{ "status": "in_progress" }
```
Status enum: `pending | in_progress | resolved | cancelled` (note: `resolved`, not `completed`). Invalid transitions are rejected (`MAINT-003`).

---

### `PATCH /api/v1/maintenance/{request_id}/assign`

Body — `AssignMaintenanceRequest`:
```json
{ "assigned_to": "uuid" }
```

---

## 📊 Dashboard

Router: `app/modules/dashboard/routers/dashboard_router.py`, mounted at `/api/v1/dashboard`. There is **no single combined `GET /dashboard` endpoint** and **no separate `/reports` module** — three distinct endpoints cover this ground.

### `GET /api/v1/dashboard/summary`

**Query:** `property_id: uuid` (required).

**Response (200)** — `DashboardSummaryWrapper`:
```json
{
  "data": {
    "property_id": "uuid",
    "total_rooms": 150,
    "occupied_rooms": 135,
    "occupancy_rate": 90.0,
    "monthly_revenue": "675000.00",
    "overdue_count": 8,
    "overdue_amount": "45000.00",
    "pending_maintenance": 5,
    "active_contracts": 135
  }
}
```

---

### `GET /api/v1/dashboard/revenue`

**Query:** `property_id: uuid` (required), `start_date`, `end_date` — plain `YYYY-MM-DD` strings, not validated by Pydantic (parsed manually).

**Response (200)** — `RevenueReportResponse`, a list of monthly metrics: `period`, `collected`, `outstanding`, `total_billed`.

---

### `GET /api/v1/dashboard/occupancy`

**Query:** `property_id: uuid` (required).

**Response (200)** — untyped `dict` (schema declares `data: dict`): `{property_id, total_rooms, occupied_rooms, occupancy_rate, active_contracts}` — note this is a subset of `summary`'s fields (no revenue/overdue/maintenance data), despite both calling the same underlying service method.

---

## 🔔 Notifications

Router: `app/modules/notification/routers/notification_router.py`, mounted at `/api/v1/notifications`. **This entire module was previously undocumented.**

### `POST /api/v1/notifications/test`

Body — `SendNotificationRequest`:
```json
{
  "user_id": "uuid",
  "property_id": "uuid",
  "channel": "email",
  "subject": "Test notification",
  "body": "This is a test"
}
```
`channel` enum: `email | line | sms` (default `email`).

**Response (201)** — `NotificationCreateResponse`.

---

### `GET /api/v1/notifications/history`

**Query:** `property_id: uuid | None`.

**Response (200)** — `NotificationListResponse`.

---

### `PATCH /api/v1/notifications/{notif_id}/resend`

**Response (200)** — `NotificationCreateResponse` (reused, no distinct "resend" schema).

---

## ⚙️ Admin

Router: `app/modules/admin/routers/admin_router.py`, mounted at `/api/v1/admin`. Both routes require the `owner` role (`@require_role("owner")`).

### `GET /api/v1/admin/audit-logs`

**Query:** `property_id: uuid | None`, `action: string | None`, `page: int = 1 (≥1)`, `limit: int = 50 (1-200)`.

**Response (200)** — `AuditLogListResponse`.

---

### `GET /api/v1/admin/config`

Path is `/config`, **not** `/system-config`.

**Response (200)** — `SystemConfigListResponse`: `[{"key": "...", "value": "...", "masked": false}, ...]`.

**There is no `PUT`/`PATCH /admin/config` endpoint.** `UpdateSystemConfigRequest` exists as a schema class but is dead code — no router imports or wires it to a handler. Config is read-only via this API today.

---

## ⚠️ Error Codes

Envelope for `APIError`-derived failures:
```json
{ "error": { "code": "AUTH-001", "message": "Invalid email or password", "details": {} } }
```
Endpoints that raise a plain `HTTPException` instead (e.g. `GET /billing/invoices/{id}` on 404) return Starlette's default `{"detail": "..."}` shape instead — this is an inconsistency in the code, not a documentation simplification.

| Code | HTTP | Description | Notes |
|------|------|--------------|-------|
| `AUTH-001` | 401 | Invalid email or password | |
| `AUTH-002` | 403 | Account is not active | |
| `AUTH-003` | 401 | Invite link expired/invalid/used | |
| `AUTH-004` | 409 | Email already in use | |
| `AUTH-005` | — | Insufficient property scope | Defined, **never actually raised** in code |
| `AUTH-006` | — | User already invited | Defined, **never actually raised** in code |
| `AUTH-007` | 401 | Invalid, expired, revoked, or mismatched refresh token | All 4 conditions collapse to this one code |
| `AUTH-008` | — | Refresh token revoked | Defined, **never actually raised** — `AUTH-007` is used for revocation instead |
| `AUTH-009` | 401 | Invalid or expired access token | |
| `PROP-001`…`PROP-009` | 400/404 | Property/building/floor/room validation (duplicate room number, invalid ref, not found, invalid status transition, etc.) | See `app/modules/property/constants.py` |
| `VAL-003` | 400 | `billing_due_day` must be 1-28 | Defensive re-check in service layer, in addition to the schema-level constraint |
| `TENANT-001`…`TENANT-009` | 400/404/409 | Tenant validation (duplicate phone/email, invalid ID card, not found, query too short, etc.) | See `app/modules/tenant/constants.py` |
| `BILL-001`…`BILL-009` | 400/404/409/500 | Meter reading / invoice / payment validation | See `app/modules/billing/constants.py` |
| `CONT-001`…`CONT-009` | 400/404/409 | Contract validation — room already has active contract, deposit too low, overlapping dates, not active, not found, etc. | See `app/modules/contract/constants.py` |
| `MAINT-001`…`MAINT-009` | 400/404 | Maintenance validation — not found, invalid transition, already resolved/cancelled, etc. | See `app/modules/maintenance/constants.py` |
| `NOTIF-001`…`NOTIF-005` | 400/404 | Notification validation | See `app/modules/notification/constants.py` |
| `ADMIN-001`…`ADMIN-005` | 401/403/404 | Admin resource/permission errors | See `app/modules/admin/constants.py` |
| `SYS-429` | 429 | Rate limit exceeded | See [Rate Limiting](#rate-limiting) |
| `SYS-{status}` | varies | Generic fallback — any unhandled `create_api_error()` call without an explicit code auto-generates `SYS-{status_code}` (e.g. `SYS-500`) | Not a fixed enumerable list |

`VAL-400` does **not** exist as an implemented error — it only appears in a stale docstring comment in `auth_router.py` and is never actually raised.

---

## 🚦 Rate Limiting

Two limiters exist:

1. **Global limiter** (`app/middleware/security.py`): a single in-memory, per-client-IP sliding-window limiter applied uniformly to every route except `/health`:
   | Setting | Value |
   |---|---|
   | Max requests | 10,000 |
   | Window | 60 seconds |
   | Scope | Per client IP, all routes combined |
   | Storage | In-process memory (not Redis-backed, not shared across worker processes) |

2. **Per-route login limiter** (`app/middleware/rate_limit.py`, anti-pattern #6 fix): a *separate*, tighter in-memory sliding-window limiter keyed by client IP, applied only to `POST /api/v1/auth/login`:
   | Setting | Value |
   |---|---|
   | Max requests | 10 |
   | Window | 60 seconds |
   | Scope | Per client IP, login only |
   | Storage | In-process memory |

On hitting the login limiter, `/login` returns `429` with body `{"error": {"code": "SYS-429", "message": "Too many requests. Please try again later.", "details": {}}}` **and** real `Retry-After` + `X-RateLimit-Limit` / `X-RateLimit-Remaining` headers (set by `set_rate_limit_headers`).

> Note: both limiters are in-process memory only — they are **not** shared across worker processes or containers. Under a multi-worker deployment each worker enforces its own independent counters. Redis-backed sharing is a future hardening item, not yet implemented.

There is **no** per-endpoint limit on `/register`, `/invite`, or `/refresh` beyond the global limiter.

---

## Known Inconsistencies

These are real inconsistencies in the current codebase (not documentation errors) — flagged here so they aren't silently "fixed" by describing an idealized version instead of what ships:

1. **Payment method mismatch** — `RecordPaymentRequest.method` accepts `wallet` (not a real enum value) and rejects `promptpay` (a real `PaymentMethod` enum value).
2. **Inconsistent create status codes** — `POST /billing/payments` returns `200`; every other create endpoint returns `201`.
3. **Inconsistent error envelope** — `GET /billing/invoices/{id}` 404s via `HTTPException` (`{"detail": ...}`), not the standard `{"error": {...}}` shape used elsewhere. (Auth's `RequestValidationError` now uses the unified `{"error": {...}}` envelope — see above — but this billing endpoint still does not.)
4. **Mostly-dead error codes** — `AUTH-006` (User already invited) is still defined but never raised. `AUTH-005` (Insufficient property scope) and `AUTH-008` (Refresh token superseded by rotation) **are now raised** by the redesigned `/invite` and `/refresh` paths respectively (anti-patterns #5, #11).
5. **Dead schema** — `UpdateSystemConfigRequest` (admin module) and `RoomListResponse` (property module) are defined but never wired to any route.
6. **No config write path** — `/admin/config` is read-only despite a request schema existing for updates.
7. **Rate limiting now has a dedicated per-route limiter** — `POST /api/v1/auth/login` is protected by a separate 10 req/min IP bucket (`app/middleware/rate_limit.py`); see [Rate Limiting](#rate-limiting). The global 10,000/60s limiter remains for everything else. Both are in-process memory only (not Redis-shared).
8. **No `/reports`, `/buildings`, `/floors`, or top-level `/rooms` modules** — if product intent requires these, they need to be built; they are not simply undocumented, they don't exist.

---

**Last reconciled against codebase**: 2026-07-10
**API Version**: v1 only (no versioning scheme implemented — see footer note below)
**Auth module redesign**: 2026-07-10 — the target design is now **implemented in code** (anti-patterns `#5, #23, #6, #7, #17, #3, #11, #12, #1`; see the resolution note in `docs/FEEDBACK/reviews/REVIEW-2026-07-10-api-anti-pattern-audit.md`). `#9` (API versioning policy) remains a deliberate platform-wide gap and is documented as such above.
**Property & Rooms module target-design added**: 2026-07-10 (design only — see [Proposed Redesign — Property & Rooms Module](#-proposed-redesign--property--rooms-module-target-design-not-yet-implemented); not yet implemented in code, fixes `#5, #3, #13, #11, #10, #1`; `#23` was already resolved app-wide by the Auth redesign implementation).
