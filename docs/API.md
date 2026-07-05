# API Reference — Property Management System v1.0.0

> **Base URL**: `https://{domain}/api/v1/`
> **Authentication**: `Authorization: Bearer <JWT>` (except `/auth/*`)
> **Content-Type**: `application/json`
> **Versioning**: URL path (`/v1/`)

---

## 📋 Table of Contents

- [Authentication](#authentication)
- [Properties](#properties)
- [Buildings](#buildings)
- [Floors](#floors)
- [Rooms](#rooms)
- [Tenants](#tenants)
- [Meter Readings](#meter-readings)
- [Invoices](#invoices)
- [Payments](#payments)
- [Contracts](#contracts)
- [Maintenance](#maintenance)
- [Dashboard](#dashboard)
- [Reports](#reports)
- [Admin](#admin)
- [Error Codes](#error-codes)
- [Rate Limiting](#rate-limiting)

---

## 🔐 Authentication

### `POST /api/v1/auth/login`

Authenticate user and return JWT tokens.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123"
}
```

**Response (200):**
```json
{
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
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

**Errors:** `401 AUTH-001` (invalid credentials), `403 AUTH-002` (inactive), `429` (rate limited)

---

### `POST /api/v1/auth/register`

Accept invitation and create new user account.

**Request:**
```json
{
  "invite_token": "eyJhbGciOiJIUzI1NiIs...",
  "full_name": "Jane Smith",
  "password": "NewUserPass1",
  "phone": "0899999999"
}
```

**Response (201):**
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

**Errors:** `400 VAL-001` (invalid token/password), `409 AUTH-004` (email exists), `410 AUTH-003` (token expired)

---

### `POST /api/v1/auth/invite`

Send invitation to new user (requires auth + property scope).

**Request:**
```json
{
  "email": "newuser@example.com",
  "property_id": "uuid"
}
```

**Response (201):**
```json
{
  "data": {
    "invite_link": "https://app.com/auth/register?token=eyJhbGciOiJIUzI1NiIs..."
  }
}
```

---

### `POST /api/v1/auth/refresh`

Issue new access token from refresh token (sent via httpOnly cookie).

**Response (200):**
```json
{
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

---

### `GET /api/v1/auth/me`

Get authenticated user profile.

**Response (200):**
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

---

## 🏢 Properties

### `POST /api/v1/properties`

Create new property.

**Request:**
```json
{
  "name": "Green View Dormitory",
  "address": "123 Sukhumvit Rd, Bangkok",
  "billing_due_day": 5,
  "min_deposit_months": 2
}
```

**Response (201):** Property object with `id`, `created_at`, `updated_at`

---

### `GET /api/v1/properties`

List all properties accessible to user.

**Response (200):**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Green View Dormitory",
      "address": "123 Sukhumvit Rd",
      "billing_due_day": 5,
      "min_deposit_months": 2,
      "created_at": "2026-01-15T10:30:00Z",
      "updated_at": "2026-01-15T10:30:00Z"
    }
  ]
}
```

---

### `GET /api/v1/properties/{id}`

Get property details.

**Response (200):** Full property object

---

## 🏗️ Buildings

### `POST /api/v1/buildings`

Create building within a property.

**Request:**
```json
{
  "property_id": "uuid",
  "name": "Building A",
  "display_order": 1,
  "description": "Main building"
}
```

**Response (201):** Building object with `id`

---

## 🏢 Floors

### `POST /api/v1/floors`

Create floor within a building.

**Request:**
```json
{
  "building_id": "uuid",
  "name": "Floor 1",
  "display_order": 1,
  "description": "Ground floor"
}
```

**Response (201):** Floor object with `id`

---

## 🚪 Rooms

### `POST /api/v1/rooms`

Create room.

**Request:**
```json
{
  "property_id": "uuid",
  "building_id": "uuid",
  "floor_id": "uuid",  // optional if building has no floors
  "room_number": "101",
  "room_type": "studio",
  "base_rent": 5000.00,
  "images": {}
}
```

**Response (201):**
```json
{
  "data": {
    "id": "uuid",
    "property_id": "uuid",
    "building_id": "uuid",
    "floor_id": "uuid",
    "room_number": "101",
    "room_type": "studio",
    "base_rent": "5000.00",
    "status": "available",
    "images": {},
    "created_at": "2026-01-15T10:30:00Z",
    "updated_at": "2026-01-15T10:30:00Z"
  }
}
```

**Errors:** `409 PROP-001` (room_number exists in building)

---

### `GET /api/v1/rooms`

List rooms with filters.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `property_id` | UUID | Filter by property |
| `building_id` | UUID | Filter by building |
| `floor_id` | UUID | Filter by floor |
| `status` | Enum | `available`, `occupied`, `maintenance` |
| `room_type` | String | Filter by type |
| `page` | Int | Page number (default: 1) |
| `limit` | Int | Items per page (default: 20, max: 100) |
| `sort` | String | Sort field, prefix `-` for desc |

**Response (200):**
```json
{
  "data": [...],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "has_next": true
  }
}
```

---

## 👥 Tenants

### `POST /api/v1/tenants`

Create tenant (ID card encrypted with Fernet).

**Request:**
```json
{
  "property_id": "uuid",
  "full_name": "Somchai Jaidee",
  "id_card_number": "1234567890123",  // will be encrypted
  "phone": "0812345678",
  "email": "somchai@email.com",
  "emergency_contact_name": "Mother",
  "emergency_contact_phone": "0898765432"
}
```

**Response (201):** Tenant object (id_card_number_encrypted in DB, not returned)

---

### `GET /api/v1/tenants/search`

Search tenants.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `q` | `q` | String | Search query (name, phone, email) |
| `property_id` | UUID | Filter by property |
| `page` | Int | Page number |
| `limit` | Int | Items per page |

---

## 📊 Meter Readings

### `POST /api/v1/meter-readings`

Record meter reading (validates current ≥ previous).

**Request:**
```json
{
  "room_id": "uuid",
  "electric_current": 150,
  "water_current": 25
}
```

**Response (201):**
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
    "read_date": "2026-01-20T08:30:00Z",
    "recorded_by": "uuid"
  }
}
```

**Errors:** `400 BILL-001` (current < previous)

---

### `GET /api/v1/meter-readings/history`

Get meter reading history for a room.

**Query:** `?room_id=uuid&limit=12`

---

## 🧾 Invoices

### `POST /api/v1/invoices/bulk-generate`

Generate invoices for all occupied rooms in a property.

**Request:**
```json
{
  "property_id": "uuid",
  "billing_month": 1,
  "billing_year": 2026
}
```

**Response (201):**
```json
{
  "data": {
    "generated_count": 42,
    "skipped_count": 3,
    "invoices": [
      {
        "id": "uuid",
        "invoice_number": "INV-A1B2C3D4",
        "room_id": "uuid",
        "tenant_id": "uuid",
        "total_amount": "7500.00",
        "due_date": "2026-02-05"
      }
    ]
  }
}
```

---

### `GET /api/v1/invoices`

List invoices with pagination and filters.

**Query:** `?property_id=uuid&status=overdue&page=1&limit=20`

**Status values:** `draft`, `issued`, `paid`, `partial`, `overdue`, `cancelled`

---

### `GET /api/v1/invoices/{id}`

Get invoice detail with line items.

---

## 💳 Payments

### `POST /api/v1/payments`

Record payment for an invoice.

**Request:**
```json
{
  "invoice_id": "uuid",
  "amount": 7500.00,
  "payment_method": "cash",
  "paid_at": "2026-01-25T14:30:00Z",
  "notes": "January rent"
}
```

**Response (201):** Payment object with updated invoice status

**Idempotency:** Supports `Idempotency-Key` header for safe retries

---

## 📝 Contracts

### `POST /api/v1/contracts`

Create lease contract.

**Request:**
```json
{
  "property_id": "uuid",
  "room_id": "uuid",
  "tenant_id": "uuid",
  "start_date": "2026-02-01",
  "end_date": "2027-01-31",
  "rent_amount": 5000.00,
  "deposit_amount": 10000.00,
  "billing_day": 5
}
```

**Response (201):** Contract object with `id`, `status: "active"`

**Business Rule (BR-01):** Only one active contract per room (partial unique index)

---

### `POST /api/v1/contracts/{id}/terminate`

Terminate contract early.

**Request:**
```json
{
  "termination_date": "2026-06-30",
  "reason": "Tenant moving out"
}
```

---

## 🔧 Maintenance

### `POST /api/v1/maintenance`

Create maintenance request.

**Request:**
```json
{
  "room_id": "uuid",
  "title": "Air conditioner not cooling",
  "description": "AC blowing warm air since yesterday",
  "priority": "high"
}
```

**Response (201):**
```json
{
  "data": {
    "id": "uuid",
    "room_id": "uuid",
    "title": "Air conditioner not cooling",
    "status": "pending",
    "priority": "high",
    "created_at": "2026-01-20T09:00:00Z"
  }
}
```

**Status Flow (BR-09):** `pending` → `in_progress` → `completed` / `cancelled`

---

### `GET /api/v1/maintenance`

List maintenance requests.

**Query:** `?status=pending&priority=high&page=1&limit=20`

---

## 📊 Dashboard

### `GET /api/v1/dashboard`

Get aggregated business metrics.

**Response (200):**
```json
{
  "data": {
    "total_properties": 3,
    "total_rooms": 150,
    "occupied_rooms": 135,
    "available_rooms": 10,
    "maintenance_rooms": 5,
    "monthly_revenue": "675000.00",
    "overdue_invoices": 8,
    "overdue_amount": "45000.00",
    "occupancy_rate": 90.0
  }
}
```

---

## 📈 Reports

### `GET /api/v1/reports/revenue`

Revenue report by month.

**Query:** `?property_id=uuid&year=2026`

---

### `GET /api/v1/reports/overdue`

Overdue invoices report.

**Query:** `?property_id=uuid`

---

## ⚙️ Admin

### `GET /api/v1/admin/audit-logs`

View audit logs (requires admin role).

**Query:** `?user_id=uuid&action=login&from=2026-01-01&to=2026-01-31&page=1&limit=50`

---

### `GET /api/v1/admin/system-config`

Get system configuration.

---

### `PUT /api/v1/admin/system-config`

Update system configuration.

---

## ⚠️ Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `AUTH-001` | 401 | Invalid email or password |
| `AUTH-002` | 403 | Account is not active |
| `AUTH-003` | 410 | Invite token expired |
| `AUTH-004` | 409 | Email already in use |
| `AUTH-005` | 403 | Insufficient property scope |
| `AUTH-007` | 401 | Invalid or expired refresh token |
| `AUTH-008` | 403 | Token revoked |
| `AUTH-009` | 401 | Invalid or expired access token |
| `VAL-001` | 400 | Validation error (details in response) |
| `VAL-003` | 400 | billing_due_day must be 1-28 |
| `VAL-006` | 400 | Invalid floor_id or room_number format |
| `VAL-400` | 400 | Generic validation error |
| `PROP-001` | 409 | Room number already exists in building |
| `BILL-001` | 400 | Current meter reading must be ≥ previous |
| `SYS-500` | 500 | Internal server error |

**Error Response Format:**
```json
{
  "error": {
    "code": "AUTH-001",
    "message": "Invalid email or password",
    "details": {}
  }
}
```

---

## 🚦 Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/auth/login` | 10 req | 1 minute |
| `/auth/register` | 5 req | 1 minute |
| `/auth/invite` | 20 req | 1 minute |
| All other auth | 100 req | 1 minute |
| General API | 1000 req | 1 minute |

**Headers:**
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining in window
- `Retry-After`: Seconds until next request allowed (on 429)

---

## 📄 OpenAPI Specification

Full machine-readable specification available at:
- **Development**: `GET /openapi.json` (when `DEBUG=true`)
- **File**: `openapi.json` in repository root
- **Generated Types**: `shared-contracts/types/frontend/api.ts`

---

## 🔄 Versioning Policy

- **v1** — Current stable (this document)
- **Breaking changes** → New version `/v2/`
- **Additive changes** — Added to v1 without version bump
- **Deprecation** — 6-month notice via `Deprecation` header

---

**Last Updated**: 2026-07-02  
**API Version**: 1.0.0  
**OpenAPI Spec**: 3.1.0