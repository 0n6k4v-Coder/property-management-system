# File: 02-design/SDD/05-business-rules.md
# Critical Sequence Diagrams + State Machines + Business Rules
## Property Management System

---

## 5. Critical Sequence Diagrams

### 5.1 Meter Reading → Invoice Generation Flow
```mermaid
sequenceDiagram
    participant Owner as Owner (Mobile)
    participant FE as Frontend (React)
    participant BE as Backend API
    participant MeterSvc as MeterService
    participant Repo as BillingRepository
    participant DB as PostgreSQL
    participant EventBus as EventBus

    Owner->>FE: "Grapมิเตอร์ปัจจุบัน, กดบันทึก"
    FE->>BE: "POST /meter-readings {room_id, electric_current, water_current}"
    BE->>MeterSvc: "record_reading(room_id, electric_current, water_current, user_id)"
    MeterSvc->>Repo: "get_latest_reading(room_id)"
    Repo->>DB: "SELECT ... ORDER BY billing_year DESC, billing_month DESC LIMIT 1"
    DB-->>Repo: "Previous reading"
    MeterSvc->>MeterSvc: "Validate current >= previous (BR-07)"
    MeterSvc->>Repo: "INSERT meter_reading"
    Repo->>DB: "INSERT INTO meter_readings ..."
    MeterSvc->>EventBus: "publish(\"meter.recorded\", {room_id, reading_id})"
    MeterSvc-->>BE: "MeterReading"
    BE-->>FE: "200 OK {reading_id, electric_used, water_used}"
    FE-->>Owner: "✅ บันทึกสำเร็จ, แสดงหน่วยที่ใช้"

    Note over Owner,EventBus: "Later: Bulk invoice generation"

    Owner->>FE: "คลิก \"สร้างบิลทั้งหมด\""
    FE->>BE: "POST /invoices/bulk-generate {property_id, month, year}"
    BE->>InvoiceSvc: "generate_monthly_invoices(property_id, month, year)"
    InvoiceSvc->>Repo: "get_active_contracts(property_id, month, year)"
    Repo->>DB: "SELECT contracts JOIN rooms WHERE status='active'..."
    loop "สำหรับแต่ละสัญญา"
        InvoiceSvc->>InvoiceSvc: "resolve_utility_rate(scope=room, month)"
        InvoiceSvc->>Repo: "get_utility_rate(room_id, 'room', month)"
        alt "ไม่พบที่ room"
            InvoiceSvc->>InvoiceSvc: "resolve_utility_rate(scope=floor, month)"
            alt "ไม่พบที่ floor"
                InvoiceSvc->>InvoiceSvc: "resolve_utility_rate(scope=building, month)"
                alt "ไม่พบที่ building"
                    InvoiceSvc->>Repo: "get_utility_rate(property_id, 'property', month)"
                end
            end
        end
        InvoiceSvc->>InvoiceSvc: "calculate_invoice(contract, meter_reading, rates)"
        InvoiceSvc->>Repo: "INSERT invoice + line_items"
        InvoiceSvc->>EventBus: "publish(\"invoice.generated\", {invoice_id})"
    end
    InvoiceSvc-->>BE: "{created: N, failed: M}"
    BE-->>FE: "200 OK {task_id, summary}"
```

### 5.2 Contract Termination → Room Status Update
```mermaid
sequenceDiagram
    participant Owner as Owner
    participant FE as Frontend
    participant BE as Backend API
    participant ContractSvc as ContractService
    participant RoomSvc as RoomService
    participant EventBus as EventBus
    participant DB as PostgreSQL

    Owner->>FE: "เลือกสัญญา → คลิก \"บันทึกย้ายออก\""
    FE->>BE: "POST /contracts/{id}/terminate {reason}"
    BE->>ContractSvc: "terminate_contract(contract_id, reason, user_id)"
    ContractSvc->>ContractSvc: "Validate status == 'active'"
    ContractSvc->>DB: "UPDATE contracts SET status='terminated', termination_reason=... WHERE id=..."
    ContractSvc->>RoomSvc: "update_status(room_id, 'available')"
    RoomSvc->>DB: "UPDATE rooms SET status='available' WHERE id=..."
    RoomSvc->>EventBus: "publish(\"room.status_changed\", {room_id, new_status='available'})"
    ContractSvc->>EventBus: "publish(\"contract.terminated\", {contract_id, room_id})"
    ContractSvc-->>BE: "Contract"
    BE-->>FE: "200 OK {contract, room_status_updated: true}"
    FE-->>Owner: "✅ บันทึกย้ายออกสำเร็จ, ห้องกลับเป็น \"ว่าง\""
```

---

## 6. State Machines

### 6.1 Invoice Status Machine
```text
draft ──[send]──▶ sent ──[pay]──▶ paid
                  │                │
                  ├─[overdue]──▶ overdue
                  │                │
                  └─[cancel]──▶ cancelled (immutable)

Rules:
- draft → sent: Only if total_amount > 0 (FR-METER-10)
- sent → paid: When paid_amount >= total_amount (BR-05)
- sent → overdue: When current_date > due_date AND paid_amount < total_amount
- Any state → cancelled: Only by Owner, requires audit log
- cancelled, paid: Immutable — no further transitions
```

### 6.2 Contract Status Machine
```text
active ──[terminate]──▶ terminated ──[renew]──▶ active (new record)
        │
        └─[expire]──▶ expired (auto via scheduler)

Rules:
- active → terminated: Requires reason, triggers Room.status → available (BR-01)
- active → expired: Auto via daily scheduler when end_date < today
- terminated → active: Via renew_contract() — creates NEW contract record, does not modify old
- expired: Immutable
```

### 6.3 Room Status Machine
```text
available ──[contract.created]──▶ occupied ──[contract.terminated]──▶ available
              │                          │
              └─[maintenance.requested]─▶ maintenance ──[resolved]──▶ available

Rules:
- available → occupied: Only via ContractService.create_contract() (BR-01)
- occupied → available: Only via ContractService.terminate_contract() or scheduler for expired
- Any → maintenance: Via MaintenanceRequest creation
- maintenance → available: Only via MaintenanceRequest resolved
```

---

## Business Rules Enforcement Points (จาก Module Specs)

### BR-01: หนึ่งห้องต่อหนึ่งสัญญา active
- **จุดบังคับใช้:** `ContractService.create_contract()` → `ContractRepo.has_active_contract(room_id)`
- **ข้อผิดพลาด:** `CONT-001` → HTTP 409
- **Index:** Partial unique `WHERE status='active'`

### BR-02: เงินประกันขั้นต่ำ
- **จุดบังคับใช้:** `ContractService.create_contract()` → `deposit_amount >= monthly_rent * property.min_deposit_months`
- **ข้อผิดพลาด:** `CONT-002` → HTTP 400

### BR-07: ค่ามิเตอร์ปัจจุบันต้องไม่น้อยกว่าก่อนหน้า
- **จุดบังคับใช้:** `MeterService.record_reading()` → validate `current >= previous`
- **ข้อผิดพลาด:** `BILL-001` → HTTP 400
- **Test:** `test_current_must_be_gte_previous`

### BR-08: การคำนวณค่าเช่าและสาธารณูปโภค
- **จุดบังคับใช้:** `InvoiceService.calculate_invoice()` → line items calculation logic
- **FR:** FR-METER-06

### BR-10: Utility rate cascade 4 ระดับ Room → Floor → Building → Property
- **จุดบังคับใช้:** `InvoiceService.resolve_utility_rate()` → recursive fallback
- **ข้อผิดพลาด:** `BILL-003` → HTTP 500 (ถ้าไม่พบที่ Property)
- **Index:** Composite `(scope_type, scope_id, effective_from DESC)`

### BR-11: Room number ไม่ซ้ำในอาคาร
- **จุดบังคับใช้:** `RoomService.create_room()` → `RoomRepo.room_number_exists()`
- **ข้อผิดพลาด:** `PROP-001` → HTTP 409
- **Index:** Unique `(building_id, room_number)`

### BR-12: Floor ID บังคับถ้าอาคารมีชั้น
- **จุดบังคับใช้:** `RoomService.create_room()` → `BuildingRepo.building_has_floors()`
- **ข้อผิดพลาด:** `PROP-002` → HTTP 400