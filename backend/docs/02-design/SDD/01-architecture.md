# File: 02-design/SDD/01-architecture.md
# UML Design Diagrams + Architecture Rules
## Property Management System

ส่วนนี้อ้างอิงสถาปัตยกรรมรวมใน `docs/ARCHITECTURE.md` และระบุรายละเอียด UML สำหรับระบบ รวมถึงกฎ Dependency ระหว่างโมดูล

---

## 10.1 UML Class Diagram — Billing Module

```mermaid
classDiagram
    %% Domain Entities
    class MeterReading {
        +uuid id
        +uuid room_id
        +int billing_month
        +int billing_year
        +decimal electric_previous
        +decimal electric_current
        +decimal electric_used
        +decimal water_previous
        +decimal water_current
        +decimal water_used
        +date read_date
        +uuid recorded_by
        +calculateUsed() decimal
    }

    class Invoice {
        +uuid id
        +string invoice_number
        +uuid contract_id
        +uuid room_id
        +uuid tenant_id
        +int billing_month
        +int billing_year
        +date due_date
        +InvoiceStatus status
        +decimal total_amount
        +decimal paid_amount
        +addLineItem() void
        +markAsSent() void
        +markAsPaid() void
    }

    class InvoiceLineItem {
        +uuid id
        +uuid invoice_id
        +LineItemType type
        +string description
        +decimal quantity
        +decimal unit_price
        +decimal amount
        +calculateAmount() decimal
    }

    class Payment {
        +uuid id
        +uuid invoice_id
        +decimal amount
        +date payment_date
        +PaymentMethod method
        +string reference_number
        +record() void
    }

    class UtilityRate {
        +uuid id
        +UtilityScopeType scope_type
        +uuid scope_id
        +decimal electric_rate_per_unit
        +decimal water_rate_per_unit
        +decimal common_fee
        +date effective_from
        +date effective_to
        +isActiveForMonth() bool
    }

    %% Services (Application Layer)
    class MeterService {
        -BillingRepository repo
        -EventBus events
        +record_reading(room_id, electric_current, water_current, recorded_by) MeterReading
        -validateCurrentVsPrevious(current, previous) bool
    }

    class InvoiceService {
        -BillingRepository repo
        -RedisCache cache
        +generate_monthly_invoices(property_id, month, year) List~Invoice~
        +resolve_utility_rate(scope_id, scope_type, month) UtilityRateDTO
        +calculate_invoice(contract, reading, rates) InvoiceCreate
    }

    class PaymentService {
        -BillingRepository repo
        +record_payment(invoice_id, amount, method, recorded_by) Payment
        -updateInvoicePaidAmount(invoice_id) void
    }

    %% Repository (Infrastructure Layer)
    class BillingRepository {
        -AsyncSession db
        +get_latest_reading(room_id) MeterReading~?~
        +get_active_contracts(property_id, month, year) List~Contract~
        +get_utility_rate(scope_id, scope_type, month) UtilityRate~?~
        +save_invoice(invoice) Invoice
        +save_payment(payment) Payment
    }

    %% Relationships
    MeterReading "1" -- "1" Room : >
    Invoice "1" *-- "1..*" InvoiceLineItem : contains
    Invoice "1" -- "1" Contract : billed_for
    Invoice "1" -- "1" Tenant : billed_to
    Payment "1..*" -- "1" Invoice : pays
    UtilityRate "1" -- "1" Property : applies_to
    UtilityRate "1" -- "1" Building : applies_to
    UtilityRate "1" -- "1" Floor : applies_to
    UtilityRate "1" -- "1" Room : applies_to

    %% Service Dependencies
    MeterService ..> BillingRepository : uses
    MeterService ..> EventBus : publishes
    InvoiceService ..> BillingRepository : uses
    InvoiceService ..> RedisCache : caches
    PaymentService ..> BillingRepository : uses

    %% Layer Boundaries
    subgraph Domain_Layer
        MeterReading
        Invoice
        InvoiceLineItem
        Payment
        UtilityRate
    end

    subgraph Application_Layer
        MeterService
        InvoiceService
        PaymentService
    end

    subgraph Infrastructure_Layer
        BillingRepository
    end
```

**คำอธิบายสัญลักษณ์:**
- `+` = public, `-` = private, `#` = protected
- `--` = Association, `*--` = Composition, `..>` = Dependency
- `1`, `1..*`, `0..1` = Multiplicity
- Subgraph = Layer boundary (Domain/Application/Infrastructure)

---

## 10.2 UML Package/Component Diagram — Module Dependencies

```mermaid
classDiagram
    %% Packages as classes with <<package>> stereotype
    class auth <<package>> {
        +AuthService
        +InviteService
        +UserRepo
    }

    class property <<package>> {
        +PropertyService
        +RoomService
        +PropertyRepo
    }

    class tenant <<package>> {
        +TenantService
        +TenantRepo
    }

    class contract <<package>> {
        +ContractService
        +ContractRepo
    }

    class billing <<package>> {
        +MeterService
        +InvoiceService
        +PaymentService
        +BillingRepo
    }

    class dashboard <<package>> {
        +DashboardService
        +DashboardRepo
    }

    class maintenance <<package>> {
        +MaintenanceService
        +MaintenanceRepo
    }

    class shared <<package>> {
        +EventBus
        +Database
        +Storage
        +Audit
        +Validators
    }

    %% Allowed Dependencies (solid arrows)
    auth ..> shared : uses
    property ..> shared : uses
    tenant ..> shared : uses
    tenant ..> property : reads Room/Property info
    contract ..> shared : uses
    contract ..> property : reads Room
    contract ..> tenant : links Tenant
    billing ..> shared : uses
    billing ..> property : reads Room/Building/Property
    billing ..> tenant : reads Tenant for invoice
    billing ..> contract : reads Contract for billing
    dashboard ..> shared : uses
    dashboard ..> billing : aggregates Invoice/Payment
    dashboard ..> property : aggregates Room status
    dashboard ..> contract : aggregates expiry
    maintenance ..> shared : uses
    maintenance ..> property : reads Room

    %% Forbidden Dependencies (dashed red with note)
    note for billing "❌ Cannot import tenant.repo directly\\n✅ Use shared/events.py or tenant.service interface"
    note for contract "❌ Cannot import billing.service directly\\n✅ Use domain events for cross-module triggers"

    %% Dependency Rules Legend
    class Dependency_Rules {
        ✅ Within-module: free import
        ✅ Cross-module: via shared/events.py or service interface only
        ❌ Direct import of another module's repo/models: FORBIDDEN
        ✅ All modules depend on shared/ (kernel)
    }
```

---

## 10.5 UML Activity Diagram — Cascade Rate Resolution Algorithm

```mermaid
flowchart TD
    Start([Start: resolve_utility_rate]) --> Input[Input: scope_id, scope_type, billing_month]
    Input --> QueryDB[Query utility_rates table]
    QueryDB --> CheckFound{Rate found?}
    
    CheckFound -- Yes --> ReturnRate[Return resolved rates]
    
    CheckFound -- No --> CheckScope{scope_type == 'property'?}
    
    CheckScope -- Yes --> Error[❌ Error: Property must have rate]
    
    CheckScope -- No --> GetParent[Get parent scope:\\nRoom→Floor→Building→Property]
    GetParent --> Recurse[Recursive call:\\nresolve_utility_rate(parent_id, parent_type, month)]
    Recurse --> QueryDB
    
    ReturnRate --> CacheL1[Cache in L1: request-scoped lru_cache]
    CacheL1 --> CacheL2[Cache in L2: Redis 24h TTL]
    CacheL2 --> End([End: return UtilityRateDTO])
    
    Error --> End
```

> **หมายเหตุ:** ไดอะแกรมทั้งหมดเขียนใน **Mermaid syntax** เพื่อให้:
> - ✅ แสดงใน GitHub/GitLab Markdown ได้ทันที
> - ✅ เวอร์ชันคอนโทรลได้ (เก็บเป็น text ใน git)
> - ✅ แก้ไขง่ายกว่าภาพวาด (Visio/Draw.io)
> - ✅ AI Agent อ่านและสร้างโค้ดจากโครงสร้างได้

---

## Layer Responsibility & Cross-Module Rules

### ✅ Layer Responsibility
- `routers/` ไม่มี business logic — เรียกเฉพาะ `service.method()`
- `services/` ไม่เรียก `db.execute()` โดยตรง — ใช้ `repository.method()` เท่านั้น
- `repository.py` มีเฉพาะ database queries — ไม่มี business rule
- `models.py` มีเฉพาะ SQLAlchemy definitions — ไม่มี method ที่มี logic

### ✅ Cross-Module Rules
- ไม่มีการ `from app.modules.X import ...` ใน `app/modules/Y`
- การสื่อสารข้ามโมดูลใช้ `shared/events.py` หรือ service interface เท่านั้น
- Dependency graph เป็น DAG (ไม่มี circular import) — ตรวจสอบด้วย `pydeps`

### ✅ Security & Audit
- ทุก endpoint ที่ไม่ใช่ `/auth/*` มี `Authorization: Bearer *** dependency
- ID card ถูก encrypt ด้วย `encrypt_sensitive()` ก่อนเก็บลง DB
- ทุก sensitive operation เรียก `audit.log_audit()`
- Password hash ใช้ `Argon2id` (OWASP 2026, RFC 9106)