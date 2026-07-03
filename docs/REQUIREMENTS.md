# Requirements — Property Management System (หอพัก/อพาร์ตเมนต์)

> Phase 1: Domain Discovery | วันที่: 2026-05-18 | Status: **Confirmed** (Owner Reviewed)

---

### Document Metadata

| | |
|---|---|
| **Owner** | REQUIREMENTS.md |
| **Downstream** | [USER_STORIES.md](USER_STORIES.md) — FR Ref column, [DOMAIN_MODEL.md](DOMAIN_MODEL.md) — entity design, [GLOSSARY.md](GLOSSARY.md) — terminology |
| **Change Rule** | แก้ความหมาย FR → ตรวจ downstream ทั้งสามไฟล์ / ห้ามแก้ downstream โดยไม่ผ่านไฟล์นี้ / คำศัพท์ใหม่ → เพิ่มใน GLOSSARY.md ก่อน |
| **ID Convention** | `FR-[PREFIX]-[NUMBER]` — immutable, append-only ต่อ prefix |

---

## 1. Business Context

ระบบจัดการหอพัก (Property Management System) สำหรับเจ้าของหอพักที่ต้องการบริหารจัดการห้องพัก ผู้เช่า สัญญา และการเรียกเก็บเงินในที่เดียว

ระบบออกแบบให้รองรับหอพักหลากหลายรูปแบบ ไม่ว่าจะเป็นตึกหลายชั้น ห้องแถว หรือ layout อื่น ๆ โดยเจ้าของสามารถกำหนดโครงสร้างอาคารได้อิสระตามสภาพจริงของหอพักตนเอง

---

## 2. Actors (ผู้ใช้งานในระบบ)

| Actor | คำอธิบาย | สิทธิ์ |
|---|---|---|
| **Owner** | เจ้าของหอพัก (มีได้หลายคน) | Full access ทุก property เท่าเทียมกัน |

> **หมายเหตุ:** มี role เดียวคือ Owner ไม่มี Manager, Staff หรือ Tenant portal ระบบนี้**ให้เจ้าของหอพักใช้งานเท่านั้น** ผู้เช่าไม่มีสิทธิ์เข้าถึงในระยะนี้

---

## 2. Actors (ผู้ใช้งานในระบบ)

> **ID Convention:** `FR-[PREFIX]-[NUMBER]` — prefix บอก category, number เรียงภายใน prefix
> เมื่อเพิ่ม requirement ใหม่ให้ append ต่อท้าย prefix นั้น ๆ ห้าม reassign ID ที่มีอยู่แล้ว

### 3.1 Property & Room Management

| FR ID | Functional Requirement |
|---|---|
| FR-PROP-01 | Owner สามารถสร้าง/แก้ไข/ลบ property ได้ |
| FR-PROP-02 | แต่ละ property มี **Building** (ชื่ออาคาร) ที่ Owner กำหนดชื่อเองได้ เช่น "อาคาร A", "แถวที่ 1", "ตึกหลัก" |
| FR-PROP-03 | แต่ละ Building มี **Floor** ที่ตั้งชื่อได้เอง เช่น "ชั้น 1", "ชั้น 2" — Floor เป็น optional ถ้า Building มีชั้นเดียวไม่ต้องมีก็ได้ |
| FR-PROP-04 | Owner กำหนดโครงสร้างได้อิสระ ไม่ผูกกับ property type ใด รองรับทุก layout ทั้งในปัจจุบันและอนาคต |
| FR-PROP-05 | แต่ละห้องมี: หมายเลขห้อง, Building, Floor (ถ้ามี), ประเภทห้อง, ราคาเช่าตั้งต้น, สถานะ (ว่าง/มีผู้เช่า/ซ่อมบำรุง) |
| FR-PROP-06 | ระบบแสดงภาพรวมห้องทั้งหมด แยกตาม Building และ Floor พร้อม occupancy rate |
| FR-PROP-07 | Owner สามารถอัปโหลดรูปภาพห้องได้ |

### 3.2 User Management

| FR ID | Functional Requirement |
|---|---|
| FR-USER-01 | Owner คนแรกลงทะเบียนระบบ (สร้าง account แรก) |
| FR-USER-02 | Owner invite Owner คนอื่นเข้าระบบผ่านอีเมล |
| FR-USER-03 | Owner ทุกคนมีสิทธิ์เท่าเทียมกัน — full access ทุก property |

### 3.3 Tenant Management

| FR ID | Functional Requirement |
|---|---|
| FR-TENANT-01 | Owner สามารถเพิ่ม/แก้ไขข้อมูลผู้เช่าได้ |
| FR-TENANT-02 | ข้อมูลผู้เช่า: ชื่อ, เลขบัตรประชาชน, เบอร์โทร, อีเมล, LINE ID, รูปถ่าย, สำเนาบัตร |
| FR-TENANT-03 | ระบบเก็บประวัติผู้เช่า (เคยเช่าห้องไหน ช่วงไหน) |
| FR-TENANT-04 | ค้นหาผู้เช่าด้วยชื่อหรือเบอร์โทรศัพท์ |

### 3.4 Contract Management

| FR ID | Functional Requirement |
|---|---|
| FR-CONTRACT-01 | Owner สร้างสัญญาเช่าระบุ: ผู้เช่า, ห้อง, วันเริ่ม, วันสิ้นสุด, ค่าเช่า, เงินประกัน, เงื่อนไขพิเศษ |
| FR-CONTRACT-02 | ระบบแจ้งเตือนเมื่อสัญญาใกล้หมดอายุ (30, 15, 7 วัน) |
| FR-CONTRACT-03 | Owner บันทึกการย้ายออกและการคืนเงินประกัน |
| FR-CONTRACT-04 | ระบบ generate PDF สัญญาเช่า |
| FR-CONTRACT-05 | Owner ต่ออายุสัญญาพร้อมแก้ไขเงื่อนไขได้ |

### 3.5 Meter Reading & Billing

> **Pain point เดิม:** Owner ต้องเดินจดมิเตอร์ลงกระดาษทีละห้อง แล้วกลับมาคำนวณบิลทีหลัง
> **เป้าหมาย:** จดมิเตอร์ผ่านมือถือได้เลยขณะเดิน ระบบคำนวณและเตรียมบิลให้ทันที

| FR ID | Functional Requirement |
|---|---|
| FR-METER-01 | UI บันทึกมิเตอร์ออกแบบสำหรับมือถือ — ใช้งานได้ขณะเดินตรวจมิเตอร์ กรอกตัวเลขได้รวดเร็ว |
| FR-METER-02 | หน้าบันทึกมิเตอร์แสดงค่ามิเตอร์เดือนก่อนหน้าทันที เพื่อให้ Owner เห็นตัวเลขอ้างอิงโดยไม่ต้องจำหรือพกกระดาษ |
| FR-METER-03 | ระบบแสดงรายการห้องที่ยังไม่ได้จดมิเตอร์ในรอบเดือนนั้น เพื่อให้ Owner รู้ว่าเดินครบทุกห้องแล้วหรือยัง |
| FR-METER-04 | ระบบคำนวณค่าสาธารณูปโภคอัตโนมัติทันทีที่กรอกมิเตอร์: (ปัจจุบัน − ก่อนหน้า) × อัตราต่อหน่วย |
| FR-METER-05 | อัตราค่าไฟ/น้ำกำหนดได้ที่ระดับ Property, Building, Floor หรือ Room — ระดับที่เจาะจงกว่า override ระดับที่กว้างกว่า (cascade) |
| FR-METER-14 | เมื่อปรับอัตราใหม่ ระบบสร้าง record ใหม่พร้อมวันที่มีผล (effective_from) โดยไม่แก้ record เก่า เพื่อให้ invoice ย้อนหลังยังคำนวณถูกต้อง |
| FR-METER-06 | ระบบสร้างใบแจ้งหนี้รายเดือน: ค่าเช่า + ค่าไฟ + ค่าน้ำ + รายการพิเศษ |
| FR-METER-07 | Bulk generate — สร้างใบแจ้งหนี้ทุกห้องที่มีผู้เช่าพร้อมกันในคลิกเดียวหลังจดมิเตอร์ครบแล้ว |
| FR-METER-08 | กำหนดวันครบกำหนดชำระต่อ property (เช่น วันที่ 5 ของทุกเดือน) |
| FR-METER-09 | Owner บันทึกการรับเงิน ระบุจำนวน วันที่ ช่องทาง (เงินสด/โอน/QR) |
| FR-METER-10 | ระบบแสดงสถานะใบแจ้งหนี้: draft, ส่งแล้ว, ชำระแล้ว, ค้างชำระ, เกินกำหนด |
| FR-METER-11 | แสดงรายชื่อผู้เช่าที่ยังไม่ชำระเงินพร้อมจำนวนวันที่ค้าง |
| FR-METER-12 | ระบบ generate สรุปบิลรูปแบบ LINE-friendly ต่อห้อง เพื่อให้ Owner copy/forward แจ้ง Tenant ทาง LINE ได้ทันที |
| FR-METER-13 | สรุปบิล LINE format มี: ชื่อผู้เช่า, ห้อง, รายละเอียดค่าไฟ/น้ำ (มิเตอร์ก่อน/หลัง/หน่วย), ค่าเช่า, ยอดรวม, กำหนดชำระ |

### 3.6 Maintenance Request

| FR ID | Functional Requirement |
|---|---|
| FR-MAINT-01 | Owner บันทึกรายการซ่อมบำรุงต่อห้อง |
| FR-MAINT-02 | ติดตามสถานะ: รอดำเนินการ / กำลังดำเนินการ / เสร็จแล้ว |
| FR-MAINT-03 | บันทึกรายละเอียดและรูปภาพประกอบ |

### 3.7 Dashboard & Reports

| FR ID | Functional Requirement |
|---|---|
| FR-DASH-01 | Dashboard แสดง: ห้องว่าง/มีผู้เช่า, รายรับเดือนนี้, ยอดค้างชำระ, สัญญาใกล้หมด |
| FR-DASH-02 | รายงานรายรับรายเดือน/รายปี แยกตาม property หรือห้อง |
| FR-DASH-03 | รายงานผู้เช่าค้างชำระ |
| FR-DASH-04 | Export รายงานเป็น Excel/PDF |

---

## 4. Non-Functional Requirements

| หมวด | Requirement |
|---|---|
| **Security** | ข้อมูลบัตรประชาชน encrypt at rest, HTTPS บังคับ |
| **Performance** | Dashboard โหลด < 2 วินาที |
| **Availability** | 99.5% uptime |
| **Scalability** | รองรับ 2 property (~47 ห้อง) เติบโตได้ถึง 10+ property |
| **Usability** | Responsive web รองรับ Desktop, Tablet และ Mobile — ทั้ง 3 platform มี priority เท่ากัน ไม่มี platform ใดเป็น secondary |
| **Backup** | Backup รายวัน เก็บ 30 วัน |
| **Flexibility** | Property layout กำหนดได้อิสระ ไม่ hardcode โครงสร้าง |
| **Portability** | ระบบ self-host บน server ของลูกค้าได้ หรือ deploy บน cloud ได้ — ไม่ผูกกับ infrastructure ใดเป็นพิเศษ |

---

## 5. Business Rules

| Rule ID | Business Rule |
|---|---|
| BR-01 | ห้องหนึ่งมี active contract ได้ 1 รายการในเวลาเดียวกัน |
| BR-02 | สัญญาต้องมีเงินประกัน ≥ 1 เดือน (configurable ต่อ property) |
| BR-03 | ลบห้องที่มีผู้เช่าอยู่ไม่ได้ |
| BR-04 | ลบผู้เช่าที่มีหนี้ค้างชำระไม่ได้ |
| BR-05 | ใบแจ้งหนี้ draft แก้ไขได้ หลัง sent แก้ไขไม่ได้ |
| BR-06 | ประวัติการชำระเงิน (Payment) ลบไม่ได้ — immutable |
| BR-07 | ค่าสาธารณูปโภค = (มิเตอร์ปัจจุบัน − มิเตอร์ก่อนหน้า) × อัตราต่อหน่วย |
| BR-08 | ค่าเช่าในสัญญา override ราคาตั้งต้นของห้อง |
| BR-09 | Owner ทุกคนมีสิทธิ์เท่าเทียมกัน — full access ทุก property |
| BR-10 | อัตราค่าไฟ/น้ำ กำหนดต่อ property และแก้ไขได้ตามประกาศภาครัฐ |
| BR-11 | Floor เป็น grouping อิสระ — ตั้งชื่อได้เอง ไม่ผูกกับ "ชั้น" |
| BR-12 | Property สามารถมีหรือไม่มี Floor ก็ได้ (optional grouping) |

---

## 6. Deployment Model

Codebase เดียว รองรับ 3 deployment mode:

| Mode | คำอธิบาย | ผู้จัดการ Infrastructure |
|---|---|---|
| **Self-hosted** | Open source — ผู้ใช้ download และ host เองบน server ตัวเอง | ผู้ใช้จัดการเอง |
| **On-premise** | เจ้าของโปรเจกต์เข้าไปติดตั้งให้ที่ server ของลูกค้า | เจ้าของโปรเจกต์เป็นคนติดตั้ง |
| **Cloud** | เจ้าของโปรเจกต์ host ให้บริการแบบ SaaS กลาง ลูกค้าใช้งานผ่าน cloud โดยไม่ต้องติดตั้งเอง | เจ้าของโปรเจกต์ดูแล infrastructure |

**ข้อกำหนด:**
- ต้อง containerized (Docker) เพื่อให้ deploy ได้ทุก environment
- Config ทั้งหมดผ่าน environment variables — ไม่ hardcode
- ไม่ผูกกับ cloud provider ใดเป็นพิเศษ
- Cloud mode (multi-tenant) เป็น future scope — ปัจจุบัน Self-hosted และ On-premise คือ single-tenant per installation

---

## 7. Out of Scope

- Tenant portal / Tenant login
- Role-based access control (RBAC) — ทุก Owner สิทธิ์เท่ากัน
- ระบบจองห้องออนไลน์สำหรับสาธารณะ
- Payment gateway (จ่ายออนไลน์)
- Native mobile app
- ระบบบัญชีรายจ่าย (expense tracking) — พิจารณาในอนาคต
- กล้องวงจรปิด / access control
- Multi-tenant SaaS (shared instance)

---

## 8. Confirmed Answers

| คำถาม | คำตอบ |
|---|---|
| Property / จำนวนห้อง | ไม่จำกัด — ระบบรองรับทุกขนาดและทุก layout |
| ระบบเดิม | Pure paper-based + แจ้งบิลผ่าน LINE — ไม่มี data migration |
| อัตราค่าไฟ/น้ำ | ตามนโยบายภาครัฐ — configurable ต่อ property |
| Expense tracking | Out of scope ตอนนี้ — พิจารณาอนาคต |
| User roles | Owner เท่านั้น — มีได้หลายคน สิทธิ์เท่ากัน |
| Tenant portal | ไม่มีในระยะนี้ — backend เจ้าของเท่านั้น |