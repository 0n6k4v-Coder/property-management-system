# Domain Model — Property Management System

> Phase 1: Domain Discovery | วันที่: 2026-05-18 | Status: **Confirmed**

---

## Core Entities

### 1. User (เจ้าของหอพัก)
```
User
├── id (uuid)
├── email
├── password_hash
├── full_name
├── phone
├── avatar_url
├── is_active
└── created_at

Role: ทุก User คือ Owner — สิทธิ์เท่าเทียมกัน full access ทุก property
```

### 2. Property (หอพัก/อพาร์ตเมนต์)
```
Property
├── id (uuid)
├── created_by → User  ← ใครเป็นคนสร้าง (audit log เท่านั้น)
├── name (เช่น "หอพักสุขใจ", "หอพักริมทาง")
├── address
├── description
├── billing_due_day: int (1-28)
├── min_deposit_months: int (default 1)
└── created_at

ไม่มี type field — โครงสร้างกำหนดได้อิสระผ่าน Building และ Floor
อัตราค่าสาธารณูปโภคแยกออกไปเป็น UtilityRate entity (cascade per scope)
```

### 3. Building (อาคาร — ชั้นแรกของ grouping)
```
Building
├── id (uuid)
├── property_id → Property
├── name (ตั้งชื่อได้เอง เช่น "อาคาร A", "แถวที่ 1", "ตึกหลัก")
├── display_order: int
└── description

ตัวอย่าง:
  ตึก 2 ชั้น  → Building: "อาคาร A" (มี 2 Floor ภายใน)
  ห้องแถว    → Building: "แถวที่ 1", "แถวที่ 2", "แถวที่ 3" (แต่ละอันมีห้องตรง ไม่มี Floor)
```

### 4. Floor (ชั้น/โซน — optional grouping ภายใน Building)
```
Floor
├── id (uuid)
├── building_id → Building
├── name (เช่น "ชั้น 1", "ชั้น 2", "Zone A")
├── display_order: int
└── description

Business Rule: Floor เป็น optional — Building ที่มีชั้นเดียวไม่ต้องมี Floor
```

### 5. Room (ห้องพัก)
```
Room
├── id (uuid)
├── property_id → Property
├── building_id → Building
├── floor_id → Floor (nullable — ถ้า Building ไม่มี Floor)
├── room_number (เช่น "101", "A-01", "1-9")
├── room_type: single | double | studio | other
├── base_rent: decimal
├── area_sqm: decimal (optional)
├── status: available | occupied | maintenance
├── description
└── images: string[] (urls)
```

### 6. UtilityRate (อัตราค่าสาธารณูปโภค)
```
UtilityRate
├── id (uuid)
├── scope_type: property | building | floor | room  ← ระดับที่ใช้
├── scope_id: uuid  ← FK ไปยัง entity ของ scope_type นั้น
├── electric_rate_per_unit: decimal (nullable — null = ไม่ override ระดับนี้)
├── water_rate_per_unit: decimal (nullable — null = ไม่ override ระดับนี้)
├── common_fee: decimal (nullable)
├── effective_from: date
├── effective_to: date (nullable — null = ยังใช้อยู่ปัจจุบัน)
└── created_by → User

Cascade Resolution (เวลาคำนวณ invoice):
  1. Room level  → หา rate ที่ครอบคลุม billing_month
  2. Floor level (ถ้าไม่มีที่ Room)
  3. Building level (ถ้าไม่มีที่ Floor)
  4. Property level (ถ้าไม่มีที่ Building) ← ต้องมีเสมอ

Business Rules:
- Property level ต้องมี UtilityRate อยู่เสมอ (required fallback)
- เมื่อปรับอัตราใหม่ → สร้าง record ใหม่พร้อม effective_from ห้ามแก้ record เก่า
- effective_to ของ record เก่า = effective_from ของ record ใหม่ − 1 วัน
- InvoiceLineItem.unit_price snapshot อัตราที่ใช้ ณ เวลา generate ไว้เสมอ
```

### 7. Tenant (ข้อมูลผู้เช่า)
```
Tenant
├── id (uuid)
├── property_id → Property  ← scoped ต่อ property
├── full_name
├── id_card_number (encrypted)
├── phone
├── email (optional)
├── line_id (optional)
├── emergency_contact_name
├── emergency_contact_phone
├── id_card_image_url
├── photo_url
├── notes
└── created_at
```

### 8. Contract (สัญญาเช่า)
```
Contract
├── id (uuid)
├── room_id → Room
├── tenant_id → Tenant
├── start_date: date
├── end_date: date
├── monthly_rent: decimal (อาจต่างจาก room.base_rent ได้)
├── deposit_amount: decimal
├── deposit_status: held | partially_returned | returned
├── deposit_returned_amount: decimal
├── deposit_returned_date: date
├── status: active | expired | terminated
├── termination_reason (nullable)
├── special_conditions: text
├── created_by → User
└── created_at

Business Rules:
- 1 ห้อง = 1 active contract เท่านั้น
- deposit_amount ≥ monthly_rent × min_deposit_months
- ContractCreated → Room.status = occupied
- ContractTerminated → Room.status = available
```

### 9. MeterReading (บันทึกมิเตอร์รายเดือน)
```
MeterReading
├── id (uuid)
├── room_id → Room
├── billing_month: int (1-12)
├── billing_year: int
├── electric_previous: decimal
├── electric_current: decimal
├── electric_used: decimal (computed: current - previous)
├── water_previous: decimal
├── water_current: decimal
├── water_used: decimal (computed: current - previous)
├── read_date: date
└── recorded_by → User

Business Rules:
- 1 record ต่อห้องต่อเดือน (unique: room_id + month + year)
- current ≥ previous (validation)
```

### 10. Invoice (ใบแจ้งหนี้)
```
Invoice
├── id (uuid)
├── invoice_number: string (เช่น "INV-2025-05-101")
├── contract_id → Contract
├── room_id → Room
├── tenant_id → Tenant
├── billing_month: int
├── billing_year: int
├── due_date: date
├── status: draft | sent | paid | overdue | cancelled
├── line_items → InvoiceLineItem[]
├── total_amount: decimal
├── paid_amount: decimal (sum of payments)
├── notes
├── created_by → User
└── created_at

Business Rules:
- draft → แก้ไขได้
- sent/paid/overdue → แก้ไขไม่ได้
- Invoice ลบไม่ได้ (เฉพาะ cancel)
```

### 11. InvoiceLineItem (รายการในใบแจ้งหนี้)
```
InvoiceLineItem
├── id (uuid)
├── invoice_id → Invoice
├── type: rent | electric | water | other
├── description: string
├── quantity: decimal
├── unit_price: decimal
└── amount: decimal (quantity × unit_price)
```

### 12. Payment (บันทึกรับเงิน)
```
Payment
├── id (uuid)
├── invoice_id → Invoice
├── amount: decimal
├── payment_date: date
├── method: cash | bank_transfer | qr_code | other
├── reference_number (slip เลขที่อ้างอิง)
├── slip_image_url (optional)
├── notes
└── recorded_by → User

Business Rules:
- Payment ลบไม่ได้ — immutable audit log
- 1 invoice มี payment ได้หลายรายการ (จ่ายบางส่วนได้)
- Invoice.paid_amount = SUM(payments)
- ถ้า paid_amount >= total_amount → Invoice.status = paid
```

### 13. MaintenanceRequest (บันทึกซ่อมบำรุง)
```
MaintenanceRequest
├── id (uuid)
├── room_id → Room
├── title
├── description
├── images: string[]
├── status: pending | in_progress | resolved | cancelled
├── priority: low | medium | high
├── resolved_at: timestamp
├── created_by → User
└── created_at
```

---

## Entity Relationship (ข้อความ)

```
User (owner, หลายคน — สิทธิ์เท่ากัน)

Property ──< Building ──< Floor ──< Room
    │           │              │         │
    │           │              │         └──< UtilityRate (scope: room)
    │           │              └──────────< UtilityRate (scope: floor)
    │           └─────────────────────────< UtilityRate (scope: building)
    ├──────────────────────────────────────< UtilityRate (scope: property) ← required fallback
    │
    └──< Tenant

Room ──< Contract >── Tenant
  │           └── creates ──< Invoice ──< InvoiceLineItem
  │                                  └──< Payment
  │
  ├──< MeterReading
  └──< MaintenanceRequest
```

---

## Aggregate Boundaries

| Aggregate Root | Members | ทำไม |
|---|---|---|
| **Property** | Property, Building, Floor | จัดการโครงสร้างด้วยกัน |
| **UtilityRate** | UtilityRate | อัตราค่าสาธารณูปโภค — immutable log, append-only |
| **Room** | Room | standalone — status เปลี่ยนตาม contract |
| **Tenant** | Tenant | ข้อมูลผู้เช่า scoped ต่อ property |
| **Contract** | Contract | lifecycle ชัดเจน (active/terminated) |
| **Invoice** | Invoice, InvoiceLineItem, Payment | billing aggregate |
| **MeterReading** | MeterReading | standalone บันทึกต่อห้องต่อเดือน |
| **MaintenanceRequest** | MaintenanceRequest | standalone |

---

## Key Domain Events

| Event | Trigger | Effect |
|---|---|---|
| `ContractCreated` | สร้างสัญญา | Room.status → occupied |
| `ContractTerminated` | บันทึกย้ายออก | Room.status → available |
| `MeterReadingRecorded` | บันทึกมิเตอร์ | พร้อม generate invoice |
| `InvoiceSent` | ส่งใบแจ้งหนี้ | lock invoice, แจ้งเตือนผู้จัดการ |
| `PaymentRecorded` | รับเงิน | update Invoice.paid_amount, check if paid |
| `ContractNearExpiry` | 30/15/7 วันก่อนหมด | แจ้งเตือน Owner |
| `InvoiceOverdue` | เลยวัน due_date | แจ้งเตือน Owner |
| `UtilityRateCreated` | เพิ่ม UtilityRate record ใหม่ | สร้าง record ใหม่พร้อม effective_from, ปิด effective_to ของ record เก่า |

---

## Flexibility Design Note

ระบบรองรับ property layout ทุกรูปแบบผ่าน 3 ระดับ: Property → Building → Floor (optional) → Room

| Property Type | Building | Floor | Room Naming |
|---|---|---|---|
| ตึก 2 ชั้น 20 ห้อง | "อาคาร A" | "ชั้น 1", "ชั้น 2" | 101-110, 201-210 |
| ห้องแถว 3 แถว | "แถวที่ 1", "แถวที่ 2", "แถวที่ 3" | ไม่มี | 1-9 ต่อแถว |
| หลายอาคาร หลายชั้น | "ตึก A", "ตึก B" | "ชั้น 1", "ชั้น 2" | A101, B101... |
| อาคารชั้นเดียว | "อาคารหลัก" | ไม่มี | 01-20 |
