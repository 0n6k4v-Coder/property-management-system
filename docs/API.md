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
- [Proposed Redesign — Property & Rooms Module (Implemented)](#-proposed-redesign--property--rooms-module-implemented-in-code)
- [Tenants](#tenants)
- [Proposed Redesign — Tenant Module (Implemented)](#-proposed-redesign--tenant-module-implemented-in-code)
- [Billing (Meter Readings, Invoices, Payments)](#billing)
- [Proposed Redesign — Billing Module (Target Design)](#-proposed-redesign--billing-module-target-design-not-yet-implemented)
- [Contracts](#contracts)
- [Proposed Redesign — Contract Module (Target Design)](#-proposed-redesign--contract-module-target-design-not-yet-implemented)
- [Maintenance](#maintenance)
- [Proposed Redesign — Maintenance Module (Target Design)](#-proposed-redesign--maintenance-module-target-design-not-yet-implemented)
- [Dashboard](#dashboard)
- [Proposed Redesign — Dashboard Module (Target Design)](#-proposed-redesign--dashboard-module-target-design-not-yet-implemented)
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

## 🔧 Proposed Redesign — Property & Rooms Module (Implemented in Code)

> ⚠️ **Everything above this box is the current, real, shipped Property & Rooms API.** The target design in this box — produced to fix every anti-pattern finding against this module in `docs/FEEDBACK/reviews/REVIEW-2026-07-10-api-anti-pattern-audit.md` (`#5, #3, #13, #23, #11, #10, #1`) — is now **implemented in code** (2026-07-10, branch `feat/property-rooms-redesign`). Per this doc's own rule ("code beats documentation"), the code above and the routers under `backend/app/modules/property/` are now ground truth; this section is kept as the design rationale for that implementation.

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

## 🔧 Proposed Redesign — Tenant Module (Implemented in Code)

> ✅ **This design has been implemented in code** (2026-07-10) — anti-patterns `#5, #1, #7, #20` are fixed (`require_property_scope()` further generalized with a `query_param` source for `GET /tenants/search`; `Idempotency-Key` support on `POST /tenants/`; `search_by` constrained to a `Literal`; `Cache-Control: private, no-store` on search). Verified Docker-free (unit tests only) — live-DB paths (search over real HTTP, idempotency table replay) remain unverified per the Docker-off constraint for this task. The section below is left as-authored (originally a target design) since it still accurately describes the shipped behavior — treat it as current documentation, not a future proposal.

### Fix map (anti-pattern → design decision)

| # | Anti-pattern | Design fix below |
|---|---|---|
| #5 | Any authenticated user can create/search tenants under *any* `property_id` — no scope check | Apply `require_property_scope()` (the shared dependency introduced by the Auth redesign, generalized by the Property & Rooms redesign to support non-body sources) to both endpoints |
| #1 | `POST /tenants/` has no idempotency protection | Reuse the existing `Idempotency-Key` mechanism (`app/shared/idempotency.py`) |
| #7 | `search_by` accepts any string; invalid values silently fall back to a name search instead of being rejected (`TENANT-009` exists but is never raised) | Constrain `search_by` to a `Literal["name", "phone", "email"]` type so FastAPI rejects anything else with a clean `422`, instead of the repository silently coercing bad input |
| #20 | No `Cache-Control`/`ETag` on the search endpoint | Explicitly set `Cache-Control: private, no-store` — this endpoint returns tenant PII (name, phone, email), so the correct fix is an explicit no-caching policy, not making PII cacheable |

Also inherited as **already fixed** by the Auth redesign (cross-cutting, not re-designed here): CORS, the unified `RequestValidationError` envelope, and the logging middleware (`X-Request-ID`).

---

### Authorization (fixes #5)

- **`POST /api/v1/tenants/`** — `property_id` is already in the request body, so this endpoint can use `require_property_scope()`'s **existing, unmodified** body-reading form (the same one `/auth/invite` already uses) — no generalization needed here.
- **`GET /api/v1/tenants/search`** — `property_id` arrives as a **query parameter**, not a path segment or body field. This depends on whichever generalization the Property & Rooms redesign implements for path-based scope checks (see that module's design section) — if that work only special-cased path parameters, this endpoint will need its own small query-param-reading variant of the same underlying scope-check logic (reuse the DB lookup/bypass logic, don't duplicate the `AUTH-005`-raising boilerplate a third time). Whichever implementation task picks this up should read the *actual* generalized dependency's signature at that time rather than assume it already covers query params.
- Both endpoints raise `403 AUTH-005` on failure, same as Auth and the redesigned Property endpoints.

### `POST /api/v1/tenants/` (redesigned)

No request/response shape change. Adds:
- **Authorization (fixes #5):** requires a `user_property_scopes` row for the body's `property_id` (or global owner/admin).
- **Idempotency (fixes #1):** optional `Idempotency-Key` header, same 24h dedupe window as `/auth/register` and the redesigned `POST /properties/`.

**Errors add:** `403 AUTH-005`, `409 VAL-409` (idempotency key reused with a different body — same convention as the other idempotent endpoints)

### `GET /api/v1/tenants/search` (redesigned)

**Query Parameters (changed row in bold):**
| Param | Type | Required | Notes |
|-------|------|----------|-------|
| `property_id` | UUID | yes | now also gates access via `require_property_scope()` (fixes #5) |
| `query` | string | yes | min length 3 |
| **`search_by`** | **`Literal["name","phone","email"]`** | no | default `"name"` — **invalid values now rejected with 422, not silently coerced (fixes #7)** |
| `page` | int | no | default 1, ≥1 |
| `limit` | int | no | default 20, 1-100 |

**Response headers (fixes #20):** `Cache-Control: private, no-store` on every response — this endpoint returns tenant PII, so responses must never be cached by a shared cache or stored by the client beyond the immediate request.

**Errors add:** `403 AUTH-005`; `422` for an invalid `search_by` value (was previously silently treated as `"name"`)

---

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

**⚠️ No authentication at all** — this endpoint has no `Depends(get_current_user)` (verified directly in `billing_router.py`). Any unauthenticated caller can read a room's meter-reading history.

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

**⚠️ No authentication at all** — no `Depends(get_current_user)` on this handler. Any unauthenticated caller can list every invoice in the system (all properties, if `property_id` is omitted).

---

### `GET /api/v1/billing/invoices/{invoice_id}`

Returns 404 via a plain `HTTPException`, **not** the standard `{"error": {...}}` envelope — this endpoint's error path is `{"detail": "Invoice not found"}`.

**⚠️ No authentication at all** — no `Depends(get_current_user)` on this handler either. Any unauthenticated caller can fetch any invoice (and its line items) by guessing/enumerating a UUID.

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

## 🔧 Proposed Redesign — Billing Module (Implemented in Code)

> ✅ **Everything above this box is the current, real, shipped Billing API.** The target design in this box — produced to fix every actionable anti-pattern finding against this module in `docs/FEEDBACK/reviews/REVIEW-2026-07-10-api-anti-pattern-audit.md` (`#5, #4, #3, #13, #1, #11, #12, #19, #20`) — is now **implemented in code** (2026-07-10). Per this doc's own rule ("code beats documentation"), the code above and the routers under `backend/app/modules/billing/` are now ground truth; this section is kept as the design rationale for that implementation.

### Fix map (anti-pattern → design decision)

| # | Anti-pattern | Design fix below |
|---|---|---|
| #5 | **3 of 6 endpoints have no authentication at all** (verified: `get_meter_reading_history`, `list_invoices`, `get_invoice_detail` have no `Depends(get_current_user)`); the 3 POSTs authenticate but don't check property scope | Add auth + `require_property_scope()` to all 6 endpoints |
| #4 | `POST /payments` returns 200, not 201 like every other create endpoint | Change to `status_code=201` |
| #3 | `GET /invoices/{id}` 404 uses `HTTPException`/`{"detail":...}` instead of the module's own `APIError`/`{"error":...}` envelope | Raise `APIError(code="BILL-007", ...)` like every other billing error path |
| #13 | `GET /invoices` has no pagination; history `limit` has no upper bound | Add `page`/`limit` to invoice list; bound history's `limit` to `le=100` |
| #1 | No idempotency on the 3 POSTs | Reuse the existing `Idempotency-Key` mechanism |
| #11 | `RecordPaymentRequest.method` regex contradicts the real `PaymentMethod` enum (accepts `wallet`, rejects `promptpay`) | Use the actual `PaymentMethod` enum as the field type instead of a hand-maintained regex, so the two can never drift apart again |
| #12 | Money modeled as `float` end-to-end, coerced to `Decimal` via a `str()` round-trip | Model `amount`/`total_amount`/`paid_amount` as `Decimal` directly in both request and response schemas |
| #19 | `read_date` in meter-reading history drops time-of-day and UTC offset | Return the full `created_at` timestamp with an explicit `Z`/offset instead of a bare date |
| #20 | No `Cache-Control`/`ETag` on the 3 GET endpoints | `Cache-Control: private, no-store` — this is financial data, same conservative default as the Tenant module's PII endpoint |
| #15 | `POST /invoices/generate` runs the entire bulk-generation synchronously in the request | See "Known limitation" below — a full fix needs job-queue infrastructure this codebase doesn't have yet; documented honestly as a larger follow-up rather than half-designed here |

Also inherited as **already fixed** by the Auth redesign (cross-cutting): CORS, the unified `RequestValidationError` envelope, and the logging middleware. **#6** (rate limiting) and **#9** (versioning) remain deliberate platform-wide gaps, same status as documented for every other module — not re-designed per-module.

---

### Authorization (fixes #5) — applies to all 6 endpoints

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

## 🔧 Proposed Redesign — Contract Module (Implemented in Code)

> ✅ **Everything above this box is the current, real, shipped Contract API.** The target design in this box — produced to fix every actionable anti-pattern finding against this module in `docs/FEEDBACK/reviews/REVIEW-2026-07-10-api-anti-pattern-audit.md` (`#5, #13, #1, #20`) — is now **implemented in code** (2026-07-11). Per this doc's own rule ("code beats documentation"), the code above and the routers under `backend/app/modules/contract/` are now ground truth; this section is kept as the design rationale for that implementation.

### Fix map (anti-pattern → design decision)

| # | Anti-pattern | Design fix below |
|---|---|---|
| #5 | No property-scope authorization on any of the 7 endpoints | Apply scope checks everywhere — direct field check where `property_id` is available, resolve-then-check (via room or contract lookup) where it isn't |
| #13 | `GET /active` and `GET /leases/{room_id}/history` are fully unbounded | Add `page`/`limit` pagination to both |
| #1 | `POST /`, `POST /{id}/extend`, `POST /{id}/renew` have no idempotency protection | Reuse the existing `Idempotency-Key` mechanism |
| #20 | No `Cache-Control` on the 3 GET endpoints | `Cache-Control: private, no-store` — contract terms (rent, deposit) are financial data, same conservative default as Billing/Tenant |

Also inherited as **already fixed** by the Auth redesign (cross-cutting, not re-designed here): CORS, the unified `RequestValidationError` envelope (this closes the original audit's `#3` finding — validation errors and domain errors now share the same `{"error": {...}}` shape everywhere, including this module), and the logging middleware (`X-Request-ID`, closing the original `#17` finding). **#6** (rate limiting) and **#9** (versioning) remain deliberate platform-wide gaps, same as every other module.

---

### Authorization (fixes #5) — applies to all 7 endpoints

Two different mechanisms, depending on whether `property_id` is directly available on the request (same split as the Billing redesign):

- **Direct field check** — `POST /contracts/` (`property_id` in body) and `GET /contracts/active` (`property_id` as an optional query param, when present) use `require_property_scope()` unchanged.
- **Resolve-then-check** — `GET /contracts/{contract_id}`, `PATCH /{contract_id}/terminate`, `POST /{contract_id}/extend`, `POST /{contract_id}/renew` don't have `property_id` directly; each must resolve the contract's `property_id` first (a lookup that's already happening in the service layer to fetch the contract), then call the shared `user_has_property_scope(current_user, db, property_id)` helper directly and raise `403 AUTH-005` if it returns `False` — same pattern as Billing's invoice/room resolution, not a dependency-signature change.
- **`GET /contracts/leases/{room_id}/history`** — resolves the room's `property_id` first, same resolve-then-check pattern.
- **`GET /contracts/active` when `property_id` is omitted** — filters results to only properties the caller holds a scope for (same list-filtering pattern as `GET /properties/`), unless the caller is a global owner/admin.

All raise `403 AUTH-005` on a failed check, `401 AUTH-009` if unauthenticated.

### `POST /api/v1/contracts/` (redesigned)

No shape change. Adds `require_property_scope()` (direct, body-sourced) and optional `Idempotency-Key` support (fixes #1).

### `GET /api/v1/contracts/active` (redesigned)

**Query Parameters (fixes #13):** adds `page: int = Query(1, ge=1)`, `limit: int = Query(20, ge=1, le=100)` alongside the existing `property_id`. Response `meta` gains `{"page", "limit", "total", "has_next"}`.

**Response headers (fixes #20):** `Cache-Control: private, no-store`.

### `GET /api/v1/contracts/{contract_id}` (redesigned)

Adds resolve-then-check authorization (fixes #5) and `Cache-Control: private, no-store` (fixes #20). No shape change.

### `PATCH /api/v1/contracts/{contract_id}/terminate` (redesigned)

Adds resolve-then-check authorization (fixes #5). No shape change.

### `POST /api/v1/contracts/{contract_id}/extend` (redesigned)

Adds resolve-then-check authorization (fixes #5) and optional `Idempotency-Key` support (fixes #1).

### `POST /api/v1/contracts/{contract_id}/renew` (redesigned)

Adds resolve-then-check authorization against the **original** contract's `property_id` (fixes #5) and optional `Idempotency-Key` support (fixes #1).

### `GET /api/v1/contracts/leases/{room_id}/history` (redesigned)

**Query Parameters (fixes #13):** adds `page: int = Query(1, ge=1)`, `limit: int = Query(20, ge=1, le=100)`. Response `meta` gains `{"page", "limit", "total", "has_next"}`.

Adds resolve-then-check authorization via the room's `property_id` (fixes #5) and `Cache-Control: private, no-store` (fixes #20).

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

## 🔧 Proposed Redesign — Maintenance Module (Implemented in Code)

> ✅ **Everything above this box is the current, real, shipped Maintenance API.** The target design in this box — produced to fix every actionable anti-pattern finding against this module in `docs/FEEDBACK/reviews/REVIEW-2026-07-10-api-anti-pattern-audit.md` (`#5, #1`) — is now **implemented in code** (2026-07-11). Per this doc's own rule ("code beats documentation"), the code above and the routers under `backend/app/modules/maintenance/` are now ground truth; this section is kept as the design rationale for that implementation.

### Fix map (anti-pattern → design decision)

| # | Anti-pattern | Design fix below |
|---|---|---|
| #5 | No property-scope authorization on any of the 5 endpoints | Direct field check where `property_id` is already present (`POST /`, `GET /pending`); resolve-then-check via the maintenance request's `property_id` elsewhere |
| #1 | `POST /maintenance/` (the only POST in this module) has no idempotency protection | Reuse the existing `Idempotency-Key` mechanism |

This module has the **shortest** actionable list of the five redesigned so far, because most of its original findings were already cross-cutting gaps resolved elsewhere: **#3** (validation error envelope) and **#17** (logging/request-ID middleware) were fixed app-wide by the Auth redesign; **#23** (CORS double-registration + wildcard/credentials) was also fixed app-wide by the Auth redesign. **#6** (rate limiting) and **#9** (versioning) remain deliberate platform-wide gaps, same as every other module — not re-designed per-module. The original audit also explicitly did **not** flag `GET /pending`'s lack of pagination as a defect (small, property-scoped result set by design) — no `#13` fix needed here.

---

### Authorization (fixes #5) — applies to all 5 endpoints

- **Direct field check** — `POST /maintenance/` (`property_id` already in the body) and `GET /maintenance/pending` (`property_id` already a required query param) use `require_property_scope()` unchanged, no resolution needed.
- **Resolve-then-check** — `GET /maintenance/{request_id}`, `PATCH /{request_id}/status`, `PATCH /{request_id}/assign` don't have `property_id` directly; each resolves the maintenance request's `property_id` first (a lookup already happening in the service layer to fetch the request), then calls the shared `user_has_property_scope(current_user, db, property_id)` helper directly and raises `403 AUTH-005` if it returns `False` — same pattern introduced by the Billing and Contract redesigns, not a change to the shared dependency's signature.

All five raise `403 AUTH-005` on a failed check, `401 AUTH-009` if unauthenticated.

### `POST /api/v1/maintenance/` (redesigned)

No shape change. Adds `require_property_scope()` (direct, body-sourced) and optional `Idempotency-Key` support (fixes #1) — same mechanism as every other redesigned module.

### `GET /api/v1/maintenance/pending` (redesigned)

Adds `require_property_scope()` (direct, query-sourced — `property_id` is already required here, so there's no "omitted" case to handle, unlike the optional `property_id` on `GET /contracts/active` or `GET /billing/invoices`).

### `GET /api/v1/maintenance/{request_id}` (redesigned)

Adds resolve-then-check authorization (fixes #5). No shape change.

### `PATCH /api/v1/maintenance/{request_id}/status` (redesigned)

Adds resolve-then-check authorization (fixes #5). No shape change.

### `PATCH /api/v1/maintenance/{request_id}/assign` (redesigned)

Adds resolve-then-check authorization (fixes #5). No shape change.

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

## 🔧 Proposed Redesign — Dashboard Module (Implemented in Code)

> ✅ **Everything above this box is the current, real, shipped Dashboard API.** The target design in this box — produced to fix every actionable anti-pattern finding against this module in `docs/FEEDBACK/reviews/REVIEW-2026-07-10-api-anti-pattern-audit.md` (`#5, #7, #13, #20, #11`) — is now **implemented in code** (2026-07-11). Per this doc's own rule ("code beats documentation"), the code above and the routers under `backend/app/modules/dashboard/` are now ground truth; this section is kept as the design rationale for that implementation.

### Fix map (anti-pattern → design decision)

| # | Anti-pattern | Design fix below |
|---|---|---|
| #5 | Any authenticated user can read any property's financials/occupancy — no scope check | All three endpoints already require `property_id` as a query param, so this is the **simplest** authorization fix of any module so far — direct field check everywhere, no resolve-then-check needed |
| #7 | `/revenue`'s `start_date`/`end_date` are typed as plain `str`, manually parsed with unguarded `date.fromisoformat()` → uncaught 500 on bad input | Type both as `date \| None` directly in the query signature so FastAPI/Pydantic validates and rejects bad input with a clean `422`, plus a cross-field check that `start_date <= end_date` |
| #13 | `/revenue` accepts an arbitrarily wide date range with no cap | Add a maximum span validation (e.g. reject a range wider than 24 months) rather than page/limit pagination, since this is a monthly aggregate report, not a row-level list |
| #20 | No `Cache-Control` on any of the 3 GETs | `Cache-Control: private, no-store` — same conservative default as every other financial-data endpoint redesigned so far (Billing, Contract) |
| #11 | `OccupancyResponse.data` is an untyped `dict`, diverging from `/summary`'s typed `DashboardSummaryWrapper` | Give occupancy its own typed response schema |

Also inherited as **already fixed** by the Auth redesign (cross-cutting, not re-designed here): the unified `RequestValidationError` envelope (closes this module's `#3` finding — the mixed `{"error"}`/`{"detail"}`/bare-500 situation goes away once `/revenue`'s date fields are typed, since there's no longer an uncaught `ValueError` path, and any remaining validation failures already use the unified envelope), and the logging middleware (`X-Request-ID`, closing `#17`). **#6** (rate limiting) remains a deliberate platform-wide gap, same as every other module.

---

### Authorization (fixes #5) — applies to all 3 endpoints

`property_id` is a required query parameter on every dashboard endpoint already — so all three simply add `require_property_scope(query_param="property_id")` unchanged, no dependency generalization or entity resolution needed (the easiest authorization fix of any module in this series). Raises `403 AUTH-005` on a failed check, `401 AUTH-009` if unauthenticated.

### `GET /api/v1/dashboard/summary` (redesigned)

Adds `require_property_scope(query_param="property_id")` (fixes #5) and `Cache-Control: private, no-store` (fixes #20). No shape change.

### `GET /api/v1/dashboard/revenue` (redesigned)

- Adds `require_property_scope(query_param="property_id")` (fixes #5).
- `start_date`/`end_date` become `date | None = Query(None)` — typed, not manually parsed (fixes #7). A malformed value now yields a clean `422` via the unified validation envelope instead of a 500.
- A `field_validator`/cross-field check rejects `start_date > end_date`, and rejects a span wider than 24 months (fixes #13) — returns `400 VAL-001` with a message explaining the cap, rather than silently truncating the range.
- `Cache-Control: private, no-store` (fixes #20).

### `GET /api/v1/dashboard/occupancy` (redesigned)

- Adds `require_property_scope(query_param="property_id")` (fixes #5) and `Cache-Control: private, no-store` (fixes #20).
- **Response (200)** — new typed `OccupancyResponse` data schema instead of a bare `dict` (fixes #11):
```json
{
  "data": {
    "property_id": "uuid",
    "total_rooms": 150,
    "occupied_rooms": 135,
    "occupancy_rate": 90.0,
    "active_contracts": 135
  }
}
```
Same fields as today's ad-hoc dict, just backed by an actual Pydantic model so the contract is enforced and documented like every other endpoint's response, instead of diverging from `/summary`'s typed-wrapper convention.

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

## 🔧 Proposed Redesign — Notification Module (Target Design)

> **Status**: NOT YET IMPLEMENTED — This design addresses all critical/high findings from the 2026-07-11 security audit (Advisor A + Advisor B + Orchestrator). The Notification module is the **only remaining module** without property-scope authorization (#5) and carries multiple unfixed anti-patterns (#3, #15, #1, #20, #13).

---

### Fix Map (Anti-pattern → Design Decision)

| # | Anti-pattern | Design Fix |
|---|---|---|
| #5 | **No property-scope authorization (CRITICAL IDOR)** on all 3 endpoints | `POST /test`: `require_property_scope()` (body-sourced `property_id`). `GET /history`: `require_property_scope(query_param="property_id")` (required). `PATCH /{id}/resend`: resolve-then-check via notification's `property_id` → `user_has_property_scope()`. |
| #3 | **Fail-silent returns 201 on send failure** | Change `POST /test` to return **202 Accepted** + `notification_id`. Async processing via Celery (or background task if Celery not ready — document limitation). Response: `{data: {notification_id, status: "queued"}, meta: null}`. |
| #15 | **Synchronous external I/O in request path** | Offload send to Celery tasks (`send_line_notification_task`, `send_email_notification_task`, `send_in_app_notification_task` — already exist in `app/workers/tasks/notification_tasks.py`). Return 202 immediately. |
| #1 | **No idempotency on POST /test** | Add optional `Idempotency-Key` header support (reuse `app/shared/idempotency.py`: `check_idempotency`/`store_idempotency`). 24h dedupe window. |
| #20 | **Missing Cache-Control on PII endpoints** | Add `Cache-Control: private, no-store` to all 3 endpoints (mirror `dashboard_router.py:56,80,108` pattern). |
| #13 | **Unbounded GET /history (hardcoded limit=50)** | Add `page`/`limit` query params (`limit` bounded `le=100`). Return `NotificationListResponse` with `meta: {page, limit, total, has_next}`. |
| #5 (resend) | **PATCH /{id}/resend lacks resolve-then-check** | In router: `notification = await repo.get_by_id(notif_id)` → `user_has_property_scope(current_user, db, notification.property_id)` → raise 403 if false → then `service.resend()`. Mirror `maintenance_router.py:190-192`. |
| NEW | **No async queue integration** | Wire existing Celery tasks (`notification_tasks.py`) for real provider sends. Document that if Celery not running, falls back to background task (limitation). |

---

### Authorization (fixes #5)

#### POST /api/v1/notifications/test
- **Body** contains `property_id` → use `require_property_scope()` (body-sourced, default form, same as `/auth/invite`, `POST /properties/`, `POST /tenants/`).
- Dependency: `Depends(require_property_scope())` — reads `property_id` from JSON body.

#### GET /api/v1/notifications/history
- **Required query param**: `property_id` (no longer optional — required for scope check).
- Dependency: `Depends(require_property_scope(query_param="property_id"))` — reads `property_id` from query params.
- Raises `403 AUTH-005` if caller lacks scope for that property (or is not global owner/admin).

#### PATCH /api/v1/notifications/{notif_id}/resend
- **Resolve-then-check**: Router fetches notification by ID first, extracts `property_id`, calls `user_has_property_scope(current_user, db, property_id)` directly.
- Pattern: identical to `maintenance_router.py:190-192`, `billing_router.py:376-379`, `contract_router.py` resolve-then-check endpoints.
- Raises `403 AUTH-005` on scope failure, `404 NOTIF-001` if notification not found.

---

### POST /test Redesign (fixes #3, #15, #1, #20)

#### Request
```http
POST /api/v1/notifications/test
Idempotency-Key: <optional-uuid>        # NEW
Content-Type: application/json

{
  "user_id": "uuid",
  "property_id": "uuid",
  "channel": "email",                    # email | line | sms
  "subject": "Test notification",
  "body": "This is a test message"
}
```

#### Response (202 Accepted) — **NOT 201**
```json
{
  "data": {
    "notification_id": "uuid",
    "status": "queued"
  },
  "meta": null
}
```

#### Headers
```
Cache-Control: private, no-store
```

#### Behavior
1. Validate `Idempotency-Key` if provided (`check_idempotency`).
2. Create `Notification` record with `status=PENDING`.
3. Store idempotency key if provided (`store_idempotency`).
4. **Enqueue to Celery** based on `channel`:
   - `email` → `send_email_notification_task.delay(...)`
   - `line` → `send_line_notification_task.delay(...)`
   - `sms` / `in_app` → `send_in_app_notification_task.delay(...)`
5. Return **202 Accepted** immediately with `notification_id`.
6. Celery task updates status to `SENT`/`FAILED` + `sent_at` + `error_message`.
7. Audit log written by Celery task on completion.

#### Failure Modes
| Scenario | HTTP Status | Notes |
|---|---|---|
| Invalid `Idempotency-Key` (body hash mismatch) | 409 VAL-409 | Per `idempotency.py:75-81` |
| Duplicate `Idempotency-Key` (same body) | 202 (replayed) | Returns original queued response |
| Validation error (schema) | 422 VAL-001 | Unified envelope |
| Missing auth | 401 AUTH-009 | Standard |
| Missing property scope | 403 AUTH-005 | New — body-sourced check |
| Celery not running / broker down | 202 (still) | Task enqueued; if broker down, task stays in local queue — **document limitation**. Fallback: `BackgroundTasks` if Celery unavailable (see "Celery Readiness" below). |

#### Celery Readiness (Documented Limitation)
- **Current state**: `app/workers/tasks/notification_tasks.py` exists with 3 tasks (`send_line_notification_task`, `send_email_notification_task`, `send_in_app_notification_task`) but they are **not wired** to the API.
- **If Celery is running**: Use `.delay()` to enqueue — full async with retries, retries, audit logging.
- **If Celery is NOT running** (dev/test): Fall back to `BackgroundTasks` (FastAPI) — fire-and-forget in-process, no retries, no persistence across restarts. Document this clearly in the endpoint docstring and `docs/OPERATIONS.md`.
- **Do NOT** implement a half-baked custom queue. The Celery infrastructure is already present; the fix is wiring it.

---

### GET /history Redesign (fixes #5, #13, #20)

#### Request
```http
GET /api/v1/notifications/history?property_id=<uuid>&page=1&limit=20
Authorization: Bearer ***
```

#### Query Parameters
| Param | Type | Required | Default | Constraints |
|---|---|---|---|---|
| `property_id` | UUID | **yes** | — | Required for scope check |
| `page` | int | no | 1 | ≥1 |
| `limit` | int | no | 20 | 1-100 (`le=100`) |

#### Response (200)
```json
{
  "data": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "property_id": "uuid",
      "channel": "email",
      "subject": "Test notification",
      "body": "This is a test message",
      "status": "sent",
      "error_message": null,
      "created_by": "uuid",
      "created_at": "2026-07-11T10:30:00Z",
      "sent_at": "2026-07-11T10:30:01Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "has_next": true
  }
}
```

#### Headers
```
Cache-Control: private, no-store
```

#### Behavior
1. `require_property_scope(query_param="property_id")` enforces scope **before** handler runs (403 if no scope).
2. Service `get_history()` accepts `page`, `limit`, calculates `offset = (page-1)*limit`.
3. Repository `get_by_property()` adds `offset`/`limit` params, returns `(items, total)`.
4. Router builds `meta` with `has_next = (page * limit) < total`.
5. Returns `NotificationListResponse(data=..., meta=...)`.

#### Errors
| Code | HTTP | When |
|---|---|---|
| AUTH-009 | 401 | Missing/invalid token |
| AUTH-005 | 403 | Caller lacks scope for `property_id` |
| VAL-001 | 422 | Invalid `property_id` format, `page` < 1, `limit` > 100 |

---

### PATCH /{notif_id}/resend Redesign (fixes #5, #1, #20)

#### Request
```http
PATCH /api/v1/notifications/550e8400-e29b-41d4-a716-446655440000/resend
Idempotency-Key: <optional-uuid>        # NEW
Authorization: Bearer ***
```

#### Response (200)
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "user_id": "uuid",
    "property_id": "uuid",
    "channel": "email",
    "subject": "Test notification",
    "body": "This is a test message",
    "status": "pending",
    "error_message": null,
    "created_by": "uuid",
    "created_at": "2026-07-11T10:30:00Z",
    "sent_at": null
  },
  "meta": null
}
```

#### Headers
```
Cache-Control: private, no-store
```

#### Behavior
1. `notification = await repo.get_by_id(notif_id)` — if not found → 404 NOTIF-001.
2. `allowed = await user_has_property_scope(current_user, db, notification.property_id)` — if false → 403 AUTH-005.
3. Validate `Idempotency-Key` if provided (`check_idempotency`).
4. Call `service.resend(notif_id, resent_by=user_id)` — sets status=PENDING, clears error, enqueues Celery task (same as POST /test).
5. Store idempotency key if provided (`store_idempotency`).
5. Return 200 with updated notification (status=PENDING/queued).

#### Errors
| Code | HTTP | When |
|---|---|---|
| NOTIF-001 | 404 | Notification not found |
| NOTIF-002 | 400 | Notification already SENT (service raises) |
| AUTH-009 | 401 | Missing/invalid token |
| AUTH-005 | 403 | Caller lacks scope for notification's property |
| VAL-409 | 409 | Idempotency-Key reused with different body |

---

### Schemas Changes

#### New: `NotificationQueuedResponse` (for 202 response)
```python
# backend/app/modules/notification/schemas.py

class NotificationQueuedResponse(BaseModel):
    """Response for 202 Accepted — notification queued for async delivery."""
    model_config = ConfigDict(extra="forbid")

    notification_id: uuid.UUID
    status: Literal["queued"] = "queued"
```

#### Updated: `NotificationListResponse` (add pagination meta)
```python
class NotificationListResponse(BaseModel):
    data: list[NotificationResponse]
    meta: NotificationMeta | None = None  # Was: dict | None = None


class NotificationMeta(BaseModel):
    """Pagination metadata for notification list responses."""
    page: int
    limit: int
    total: int
    has_next: bool
```

#### Updated: `NotificationCreateResponse` → reuse for resend (no change needed, but document)
- `PATCH /resend` returns `NotificationCreateResponse` (same wrapper as create) with updated notification.

#### Request Schema: `SendNotificationRequest` — add optional `idempotency_key` field?
- **No** — idempotency key is a **header**, not body field. Keep schema unchanged. Router reads header.

---

### Service Layer Changes

#### `NotificationService.send_test()` — Signature Change
```python
async def send_test(
    self,
    user_id: uuid.UUID,
    property_id: uuid.UUID,
    channel: str,
    subject: str,
    body: str,
    sent_by: uuid.UUID,
    idempotency_key: str | None = None,  # NEW
) -> Notification:
    """
    Create notification record, enqueue async send, return PENDING notification.
    Does NOT await external send. Returns immediately with status=PENDING.
    """
    # 1. Create notification with status=PENDING
    # 2. Enqueue Celery task based on channel
    # 3. Return notification (caller handles 202 response)
```

#### `NotificationService.resend()` — Add Idempotency Support
```python
async def resend(
    self,
    notif_id: uuid.UUID,
    resent_by: uuid.UUID,
    idempotency_key: str | None = None,  # NEW
) -> Notification:
    """
    Reset status to PENDING, clear error, enqueue async send.
    Idempotency handled at router layer (check/store).
    """
```

#### `NotificationService.get_history()` — Add Pagination
```python
async def get_history(
    self,
    property_id: uuid.UUID,           # Now REQUIRED (was optional)
    user_id: uuid.UUID | None = None,  # Optional filter
    page: int = 1,
    limit: int = 20,
) -> tuple[list[Notification], int]:  # Return (items, total)
    """
    Returns paginated notifications for a property.
    Raises if property_id is None (caller must enforce scope first).
    """
    offset = (page - 1) * limit
    # query with offset/limit, return (items, total_count)
```

---

### Repository Changes

#### `NotificationRepository.get_by_property()` — Add Pagination
```python
async def get_by_property(
    self, 
    property_id: uuid.UUID, 
    limit: int = 50, 
    offset: int = 0
) -> tuple[list[Notification], int]:
    """Returns (items, total_count) for pagination."""
    # COUNT(*) for total
    # SELECT ... LIMIT limit OFFSET offset
```

#### `NotificationRepository.get_by_user()` — Add Pagination (for future use)
```python
async def get_by_user(
    self, 
    user_id: uuid.UUID, 
    limit: int = 50, 
    offset: int = 0
) -> tuple[list[Notification], int]:
    ...
```

---

### Celery Task Wiring (app/workers/tasks/notification_tasks.py)

The tasks **already exist** — wire them in `service.send_test()`:

```python
# In send_test(), after creating notification:
if channel == NotificationChannel.EMAIL:
    from app.workers.tasks.notification_tasks import send_email_notification_task
    send_email_notification_task.delay(
        notification_id=str(notif.id),
        user_id=str(sent_by),
        recipient_email=await self._get_user_email(user_id),  # helper needed
        subject=subject,
        body=body,
    )
elif channel == NotificationChannel.LINE:
    from app.workers.tasks.notification_tasks import send_line_notification_task
    send_line_notification_task.delay(
        notification_id=str(notif.id),
        user_id=str(sent_by),
        recipient_line_id=await self._get_user_line_id(user_id),
        message=body,
    )
else:  # IN_APP or SMS
    from app.workers.tasks.notification_tasks import send_in_app_notification_task
    send_in_app_notification_task.delay(
        notification_id=str(notif.id),
        user_id=str(sent_by),
        recipient_user_id=str(user_id),
        title=subject,
        body=body,
    )
```

**Note**: Helper methods `_get_user_email()`, `_get_user_line_id()` need to be added to service or repository (query users table).

---

### Router Implementation Sketch

```python
# backend/app/modules/notification/routers/notification_router.py

from fastapi import APIRouter, Depends, Header, Query, Response, status
from app.shared.deps import require_property_scope, get_current_user, get_db
from app.shared.idempotency import check_idempotency, store_idempotency
from app.modules.notification.services.notification_service import NotificationService
from app.modules.notification.repository import NotificationRepository
from app.modules.notification.schemas import (
    SendNotificationRequest,
    NotificationQueuedResponse,
    NotificationResponse,
    NotificationListResponse,
    NotificationMeta,
)

router = APIRouter(tags=["notifications"], redirect_slashes=False)

@router.post(
    "/test",
    response_model=NotificationQueuedResponse,  # NEW schema
    status_code=status.HTTP_202_ACCEPTED,       # 202 not 201
    summary="Send a test notification (async)",
    description="Creates notification and enqueues for async delivery. Returns 202 with notification_id.",
)
async def send_test_notification(
    response: Response,
    body: SendNotificationRequest,
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
    db: Annotated[AsyncSession, Depends(get_db)] = ...,
    current_user: Annotated[dict, Depends(get_current_user)] = ...,
    _: Annotated[None, Depends(require_property_scope())] = ...,  # NEW: body-sourced property_id
) -> dict:
    # Idempotency check
    if idempotency_key:
        cached = await check_idempotency(db, idempotency_key, "POST:/api/v1/notifications/test", body.model_dump())
        if cached:
            return cached

    service = NotificationService(db)
    notif = await service.send_test(
        user_id=body.user_id,
        property_id=body.property_id,
        channel=body.channel,
        subject=body.subject,
        body=body.body,
        sent_by=uuid.UUID(current_user["user_id"]),
        idempotency_key=idempotency_key,
    )

    result = {"data": NotificationQueuedResponse(notification_id=notif.id, status="queued"), "meta": None}

    # Store idempotency
    if idempotency_key:
        await store_idempotency(db, idempotency_key, "POST:/api/v1/notifications/test", body.model_dump(), result, NotificationRepository)

    response.headers["Cache-Control"] = "private, no-store"  # NEW
    return result


@router.get(
    "/history",
    response_model=NotificationListResponse,
    summary="Get notification history (paginated, scoped)",
)
async def get_notification_history(
    response: Response,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[dict, Depends(get_current_user)],
    property_id: Annotated[uuid.UUID, Query(description="Property ID (required for scope)")],  # NOW REQUIRED
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    _: Annotated[None, Depends(require_property_scope(query_param="property_id"))] = ...,  # NEW
) -> dict:
    service = NotificationService(db)
    items, total = await service.get_history(
        property_id=property_id,
        page=page,
        limit=limit,
    )

    response.headers["Cache-Control"] = "private, no-store"  # NEW
    return {
        "data": [NotificationResponse.model_validate(n) for n in items],
        "meta": NotificationMeta(page=page, limit=limit, total=total, has_next=(page * limit) < total),
    }


@router.patch(
    "/{notif_id}/resend",
    response_model=NotificationCreateResponse,  # Reuse create wrapper
    summary="Resend a failed/pending notification",
)
async def resend_notification(
    response: Response,
    notif_id: uuid.UUID,
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
    db: Annotated[AsyncSession, Depends(get_db)] = ...,
    current_user: Annotated[dict, Depends(get_current_user)] = ...,
) -> dict:
    repo = NotificationRepository(db)
    notif = await repo.get_by_id(notif_id)
    if not notif:
        raise APIError(code="NOTIF-001", message="Notification not found", status_code=404)

    # Resolve-then-check (mirror maintenance_router.py:190-192)
    if not await user_has_property_scope(current_user, db, notif.property_id):
        raise APIError(code="AUTH-005", message="Insufficient property scope", status_code=403)

    # Idempotency check
    if idempotency_key:
        cached = await check_idempotency(db, idempotency_key, f"PATCH:/api/v1/notifications/{notif_id}/resend", {})
        if cached:
            return cached

    service = NotificationService(db)
    resent = await service.resend(notif_id=notif_id, resent_by=uuid.UUID(current_user["user_id"]), idempotency_key=idempotency_key)

    result = {"data": NotificationResponse.model_validate(resent), "meta": None}

    response.headers["Cache-Control"] = "private, no-store"  # NEW
    return result
```

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

**Billing module redesign**: 2026-07-10; **implemented in code (fixes `#5, #4, #3, #13, #1, #11, #12, #19, #20`)**: 2026-07-11 — the target design is now **implemented in code** (see [Proposed Redesign — Billing Module](#-proposed-redesign--billing-module-target-design-not-yet-implemented)). The "current" section was also corrected to flag 3 endpoints — `GET /meter-readings/{room_id}/history`, `GET /invoices`, `GET /invoices/{invoice_id}` — that had **zero authentication** in the original code, verified directly in `billing_router.py`. `#15` — synchronous bulk invoice generation — is flagged as a known limitation requiring job-queue infrastructure this codebase doesn't have; not fully designed here. `#6`/`#9` remain deliberate platform-wide gaps, same as every other module.

**Contract module redesign**: 2026-07-10; **implemented in code (fixes `#5, #13, #1, #20`)**: 2026-07-11 — the target design is now **implemented in code** (see [Proposed Redesign — Contract Module (Implemented in Code)](#-proposed-redesign--contract-module-implemented-in-code)). Authorization uses the same direct-field-check / resolve-then-check split introduced by the Billing redesign, since most Contract endpoints only have `contract_id` or `room_id`, not `property_id`, directly available. `#3` and `#17` from the original audit were already resolved app-wide by the Auth redesign implementation. `#6`/`#9` remain deliberate platform-wide gaps.

**Maintenance module redesign**: 2026-07-11 — the target design is now **implemented in code** (anti-patterns `#5, #1` fixed; `#3`, `#17`, `#23` were already resolved app-wide by the Auth redesign; `#6`/`#9` remain deliberate platform-wide gaps; the audit explicitly did not flag `GET /pending`'s list size as a defect). 2 of 5 endpoints already had `property_id` directly available (direct field check via `require_property_scope()`); the other 3 use resolve-then-check via the maintenance request's `property_id` resolved from the repository. `Idempotency-Key` support added on `POST /maintenance/` (same mechanism as Auth/Billing/Tenant). `Cache-Control: private, no-store` on `GET /pending` and `GET /{id}`. All 5 endpoints raise `403 AUTH-005` on failed scope check, `401 AUTH-009` if unauthenticated. Unit tests in `tests/modules/maintenance/test_maintenance_security.py` (DB-free, mocking all DB access).

**Dashboard module redesign**: 2026-07-11 — the target design is now **implemented in code** (anti-patterns `#5, #7, #13, #20, #11` fixed; `#3` and `#17` from the original audit were already resolved app-wide by the Auth redesign. All 3 endpoints already required `property_id` as a query param, making this the simplest authorization fix of the whole series — no resolve-then-check needed anywhere. `start_date`/`end_date` typed as `date | None` with cross-field validation (max 24-month span). Typed `OccupancyResponse` schema. `Cache-Control: private, no-store` on all 3 GETs. Unit tests in `tests/modules/dashboard/test_dashboard_security.py` (DB-free, mocking all DB access). `#6` remains a deliberate platform-wide gap.

**Notification module security audit findings (2026-07-11)**: A post-implementation security audit (Advisor A + Advisor B + Orchestrator) identified critical gaps in the Notification module that were not addressed by prior redesigns:

| Anti-pattern | Status | Details |
|--------------|--------|---------|
| **#5 — No property-scope authorization (IDOR)** | **CRITICAL — UNFIXED** | `GET /notifications/history?property_id=<victim>` returns full history to any authenticated user. `notification_service.py:185-188` checks `if property_id:` before `if user_id:`, allowing cross-property data access. `require_property_scope()` missing from all 3 endpoints. |
| **#3 — Fail-silent error handling** | **UNFIXED** | `POST /notifications/test` returns `201` even when send fails (service catches all exceptions, sets status=FAILED but returns 201). |
| **#15 — Synchronous external I/O in request path** | **UNFIXED** | `POST /notifications/test` sends notification synchronously in request path (no 202 + async). |
| **#1 — No idempotency on mutating endpoint** | **UNFIXED** | `POST /notifications/test` lacks `Idempotency-Key` support. |
| **#20 — No Cache-Control on PII endpoints** | **UNFIXED** | Missing `Cache-Control: private, no-store` on notification endpoints. |

**Immediate remediation required**: Add `require_property_scope(query_param="property_id")` to `GET /notifications/history`; change `POST /test` to return `202 Accepted` with async processing (Celery); add `Idempotency-Key` support; add `Cache-Control: private, no-store` headers.

**CORS Configuration (2026-07-11)**: Fixed — `main.py:151` now calls `setup_cors_middleware(app, settings.CORS_ORIGINS)` passing the explicit origins list. The helper in `cors.py:21` was hardened with a type guard to reject non-list inputs.

**JWT Token Revocation Gap**: Security audit (Advisor B) identified that JWT HS256 tokens have no revocation mechanism. Stolen access tokens remain valid for 15 minutes; logout is only client-side. Recommendation: Add Redis-based token blocklist with TTL matching access token expiry, checked in `verify_token()`.

**JWT Algorithm**: Currently HS256 (symmetric). For multi-service readiness, long-term migration to RS256 with JWKS is recommended.

**Maintenance /pending Pagination**: The `GET /maintenance/pending` endpoint returns all pending requests without pagination (unbounded). Add `page`/`limit` query params with `le=100` bound, consistent with other list endpoints.

**Rate Limiting Gaps**: Per-endpoint limiters exist only for `POST /api/v1/auth/login`. `POST /auth/register`, `POST /auth/invite`, `POST /auth/refresh` lack dedicated limiters. Global limiter (10,000 req/60s/IP) applies uniformly without `X-RateLimit-*` headers.

**Last reconciled against codebase**: 2026-07-11
**API Version**: v1 only (no versioning scheme implemented — see footer note below)
**Auth module redesign**: 2026-07-10 — the target design is now **implemented in code** (anti-patterns `#5, #23, #6, #7, #17, #3, #11, #12, #1`; see the resolution note in `docs/FEEDBACK/reviews/REVIEW-2026-07-10-api-anti-pattern-audit.md`). `#9` (API versioning policy) remains a deliberate platform-wide gap and is documented as such above.
**Property & Rooms module redesign**: 2026-07-10 — the target design is now **implemented in code** (branch `feat/property-rooms-redesign`; anti-patterns `#5, #3, #13, #11, #10, #1`; `#23` was already resolved app-wide by the Auth redesign implementation). See [Proposed Redesign — Property & Rooms Module](#-proposed-redesign--property--rooms-module-implemented-in-code) for the design rationale.
**Tenant module redesign**: 2026-07-10 — the target design is now **implemented in code** (fixes `#5, #1, #7, #20`; `require_property_scope()` extended with a `query_param` source for `GET /tenants/search`, verified not to regress the Auth/Property usages). See [Proposed Redesign — Tenant Module](#-proposed-redesign--tenant-module-implemented-in-code) for the design rationale.
**Billing module redesign**: 2026-07-10; **implemented in code (fixes `#5, #4, #3, #13, #1, #11, #12, #19, #20`)**: 2026-07-11 — the target design is now **implemented in code** (see [Proposed Redesign — Billing Module (Implemented in Code)](#-proposed-redesign--billing-module-implemented-in-code)). The "current" section was also corrected to flag 3 endpoints — `GET /meter-readings/{room_id}/history`, `GET /invoices`, `GET /invoices/{invoice_id}` — that had **zero authentication** in the original code, verified directly in `billing_router.py`. `#15` — synchronous bulk invoice generation — is flagged as a known limitation requiring job-queue infrastructure this codebase doesn't have; not fully designed here. `#6`/`#9` remain deliberate platform-wide gaps, same as every other module.

**Contract module redesign**: 2026-07-10; **implemented in code (fixes `#5, #13, #1, #20`)**: 2026-07-11 — the target design is now **implemented in code** (see [Proposed Redesign — Contract Module (Implemented in Code)](#-proposed-redesign--contract-module-implemented-in-code)). Authorization uses the same direct-field-check / resolve-then-check split introduced by the Billing redesign, since most Contract endpoints only have `contract_id` or `room_id`, not `property_id`, directly available. `#3` and `#17` from the original audit were already resolved app-wide by the Auth redesign implementation. `#6`/`#9` remain deliberate platform-wide gaps.

**Maintenance module redesign**: 2026-07-11 — the target design is now **implemented in code** (anti-patterns `#5, #1` fixed; `#3`, `#17`, `#23` were already resolved app-wide by the Auth redesign; `#6`/`#9` remain deliberate platform-wide gaps; the audit explicitly did not flag `GET /pending`'s list size as a defect). 2 of 5 endpoints already had `property_id` directly available (direct field check via `require_property_scope()`); the other 3 use resolve-then-check via the maintenance request's `property_id` resolved from the repository. `Idempotency-Key` support added on `POST /maintenance/` (same mechanism as Auth/Billing/Tenant). `Cache-Control: private, no-store` on `GET /pending` and `GET /{id}`. All 5 endpoints raise `403 AUTH-005` on failed scope check, `401 AUTH-009` if unauthenticated. Unit tests in `tests/modules/maintenance/test_maintenance_security.py` (DB-free, mocking all DB access).

**Dashboard module redesign**: 2026-07-11 — the target design is now **implemented in code** (anti-patterns `#5, #7, #13, #20, #11` fixed; `#3` and `#17` from the original audit were already resolved app-wide by the Auth redesign. All 3 endpoints already required `property_id` as a query param, making this the simplest authorization fix of the whole series — no resolve-then-check needed anywhere. `start_date`/`end_date` typed as `date | None` with cross-field validation (max 24-month span). Typed `OccupancyResponse` schema. `Cache-Control: private, no-store` on all 3 GETs. Unit tests in `tests/modules/dashboard/test_dashboard_security.py` (DB-free, mocking all DB access). `#6` remains a deliberate platform-wide gap.
