# Glossary — Property Management System

> Phase 1: Domain Discovery | วันที่: 2026-05-21 | Status: **Confirmed**
>
> วัตถุประสงค์: ทำให้ AI Agent และ Developer ใช้คำศัพท์ตรงกัน — ป้องกัน misinterpretation ตอน generate code

---

## 1. Core Business Terms

| ไทย | English | Code/Entity | ความหมาย | Ambiguity Note |
|---|---|---|---|---|
| หอพัก | Property | `Property` | กิจการหอพัก/อพาร์ตเมนต์ 1 แห่ง (เช่น "หอพักสุขใจ") | ไม่ใช่ "อาคาร" — Property 1 แห่งมีหลายอาคารได้ |
| อาคาร | Building | `Building` | อาคารย่อยใน Property เช่น "อาคาร A", "แถวที่ 1" | ห้องแถว 1 แถว = 1 Building |
| ชั้น | Floor | `Floor` | ชั้น/โซนภายใน Building — optional ไม่มีก็ได้ | ชื่อตั้งเองได้ เช่น "ชั้น 1", "Zone A" ไม่จำเป็นต้องเป็น "ชั้น" จริง |
| ห้องพัก | Room | `Room` | หน่วยย่อยที่สุดที่ให้เช่า | มี room_number, base_rent, status |
| เจ้าของ | Owner | `User` | เจ้าของหอพัก มีสิทธิ์ full access ทุก property | ทุก User คือ Owner — ไม่มี role อื่น |
| ผู้เช่า | Tenant | `Tenant` | ผู้เช่าห้องพัก | Scoped ต่อ property — ไม่มีระบบ login |

---

## 2. Finance & Billing

| ไทย | English | Code/Entity | ความหมาย | Ambiguity Note |
|---|---|---|---|---|
| ค่าเช่า | Rent | `Contract.monthly_rent` | ค่าเช่ารายเดือนตามสัญญา | **ต่างจาก** `Room.base_rent` (ราคาตั้งต้น) — สัญญา override ได้ |
| ราคาตั้งต้น | Base Rent | `Room.base_rent` | ราคาเช่าพื้นฐานของห้อง | ใช้เป็น default — ถ้าทำสัญญาใช้ `monthly_rent` แทน |
| เงินประกัน | Deposit | `Contract.deposit_amount` | เงินประกันความเสียหาย | ≥ `monthly_rent × min_deposit_months` (min_deposit_months config ที่ Property) |
| คืนเงินประกัน | Deposit Return | `Contract.deposit_returned_amount` | จำนวนเงินที่คืนตอนย้ายออก | อาจหักค่าเสียหาย — deposit_returned_amount < deposit_amount ได้ |
| ค่าไฟ | Electric Bill | `InvoiceLineItem.type=electric` | ค่าไฟฟ้าตามมิเตอร์ | คำนวณจาก (current - previous) × electric_rate |
| ค่าน้ำ | Water Bill | `InvoiceLineItem.type=water` | ค่าน้ำประปาตามมิเตอร์ | คำนวณจาก (current - previous) × water_rate |
| ค่าส่วนกลาง | Common Fee | `UtilityRate.common_fee` | ค่าส่วนกลาง (ถ้ามี) | optional — บางหอพักมี บางที่ไม่มี |
| ค่าสาธารณูปโภค | Utility | `InvoiceLineItem.type=electric\|water` | ค่าไฟ + ค่าน้ำ — รวมเรียก | ใช้กับ cascade rate resolution |
| อัตราต่อหน่วย | Rate Per Unit | `UtilityRate.electric_rate_per_unit` | ราคาต่อ 1 หน่วย (บาท) | หน่วย: ไฟฟ้า = kWh, น้ำ = ลบ.ม. |
| ใบแจ้งหนี้ | Invoice | `Invoice` | ใบแจ้งหนี้รายเดือน | status: draft → sent → paid/overdue |
| draft | Draft | `Invoice.status=draft` | ยังแก้ไขได้ ยังไม่ lock | Owner สามารถปรับปรุงก่อน sent |
| ส่งแล้ว | Sent | `Invoice.status=sent` | lock แล้ว แก้ไขไม่ได้ | แจ้ง Tenant ผ่าน LINE แล้ว |
| ชำระแล้ว | Paid | `Invoice.status=paid` | ชำระครบแล้ว | paid_amount ≥ total_amount |
| ค้างชำระ | Overdue | `Invoice.status=overdue` | เลยวันกำหนดชำระ | ต้องมี due_date และเกินมา 1+ วัน |
| ยอดค้างชำระ | Outstanding | — | ยอดรวมที่ยังไม่จ่าย | คำนวณจาก Invoices ที่ status=overdue + sent ที่ยังไม่ paid |
| วันครบกำหนด | Due Date | `Invoice.due_date` | วันที่ต้องชำระ | กำหนดต่อ property: `Property.billing_due_day` (1-28) |
| การรับเงิน | Payment | `Payment` | บันทึกการรับเงิน | Immutable — ลบไม่ได้ / method: cash, bank_transfer, qr_code |
| จ่ายบางส่วน | Partial Payment | — | จ่ายไม่ครบในครั้งเดียว | 1 invoice มีหลาย payment ได้ — total paid = SUM(payments) |
| รอบบิล | Billing Month | `MeterReading.billing_month` | เดือนที่คิดบิล | 1 record ต่อห้องต่อเดือน |

---

## 3. Meter Reading

| ไทย | English | Code/Entity | ความหมาย | Ambiguity Note |
|---|---|---|---|---|
| มิเตอร์ | Meter | — | อุปกรณ์วัดค่าไฟฟ้า/น้ำ | ระบบคิดแยกประเภท: electric_meter, water_meter |
| เลขมิเตอร์ครั้งก่อน | Previous Reading | `MeterReading.electric_previous` | ค่ามิเตอร์เดือนที่แล้ว | ระบบนำมาอัตโนมัติจาก record ล่าสุดของห้องนั้น |
| เลขมิเตอร์ปัจจุบัน | Current Reading | `MeterReading.electric_current` | ค่ามิเตอร์ที่กรอกในเดือนนี้ | Owner กรอกขณะเดินตรวจ |
| หน่วยที่ใช้ | Usage | `MeterReading.electric_used` | ปัจจุบัน − ก่อนหน้า | คำนวณอัตโนมัติ — validation: current ≥ previous |
| เดินมิเตอร์ | Meter Walk | — | กิจกรรมเดินตรวจมิเตอร์ทีละห้อง | Pain point เดิม — ต้องทำให้สะดวกบนมือถือ |
| ยังไม่จด | Unread | — | ห้องที่ยังไม่ได้กรอกค่าในเดือนนี้ | ระบบต้องแสดงให้เห็นว่าขาดห้องไหนบ้าง |

---

## 4. Contract & Rental

| ไทย | English | Code/Entity | ความหมาย | Ambiguity Note |
|---|---|---|---|---|
| สัญญาเช่า | Contract | `Contract` | สัญญาระหว่าง Owner กับ Tenant | 1 ห้อง = 1 active contract |
| สัญญาปัจจุบัน | Active Contract | `Contract.status=active` | สัญญาที่ยังมีผลอยู่ | start_date ≤ today ≤ end_date |
| ย้ายเข้า | Move In | `ContractCreated` event | Tenant เข้าอยู่ | Room.status → occupied |
| ย้ายออก | Move Out | `ContractTerminated` event | Tenant ออกจากห้อง | Room.status → available |
| ต่ออายุสัญญา | Renewal | `Contract` — ใหม่ | ต่อสัญญาพร้อมปรับเงื่อนไข | สร้าง Contract ใหม่ ไม่ใช่แก้ของเก่า |
| ยกเลิกสัญญา | Termination | `Contract.termination_reason` | ยกเลิกก่อนครบกำหนด | ต้องบันทึกเหตุผล |
| สัญญาใกล้หมด | Near Expiry | — | เหลืออีก 30/15/7 วัน | ระบบแจ้งเตือน Owner |

---

## 5. Utility Rate Cascade

| ไทย | English | Code/Entity | ความหมาย | Ambiguity Note |
|---|---|---|---|---|
| การไล่ระดับ | Cascade | — | หา rate จากล่างขึ้นบน | Room → Floor → Building → Property |
| ระดับ Property | Property Scope | `UtilityRate.scope_type=property` | อัตราพื้นฐานของหอพัก | **ต้องมีเสมอ** — required fallback |
| ระดับ Building | Building Scope | `UtilityRate.scope_type=building` | override เฉพาะอาคาร | null = ไม่ override ใช้ระดับบน |
| ระดับ Floor | Floor Scope | `UtilityRate.scope_type=floor` | override เฉพาะชั้น | null = ไม่ override |
| ระดับ Room | Room Scope | `UtilityRate.scope_type=room` | override เฉพาะห้อง | null = ไม่ override |
| มีผลตั้งแต่วันที่ | Effective From | `UtilityRate.effective_from` | วันที่เริ่มใช้อัตราใหม่ | **ห้ามแก้ record เก่า** — สร้าง record ใหม่เสมอ |
| มีผลถึงวันที่ | Effective To | `UtilityRate.effective_to` | สิ้นสุดการใช้อัตรา | null = กำลังใช้อยู่ |
| Snapshot ราคา | Price Snapshot | `InvoiceLineItem.unit_price` | จับราคาตอน generate invoice | ทำให้ invoice ย้อนหลังยังคำนวณถูก |

---

## 6. Deployment

| ไทย | English | ความหมาย |
|---|---|---|
| Self-hosted | Self-hosted | Owner host เอง — Docker compose, PostgreSQL |
| On-premise | On-premise | เจ้าของโปรเจกต์ไปติดตั้งที่ server ลูกค้า |
| Cloud | Cloud | SaaS — เจ้าของโปรเจกต์ host กลาง |
| Single-tenant | Single-tenant | 1 installation ต่อ 1 Property group |
| Containerized | Containerized | Docker — deploy ได้ทุก environment |

---

## 7. Data Security

| ไทย | English | Code/Entity | ความหมาย |
|---|---|---|---|
| เลขบัตรประชาชน | ID Card Number | `Tenant.id_card_number` | เลข 13 หลัก — **encrypt at rest** |
| เข้ารหัสขณะจัดเก็บ | Encrypt at Rest | — | ข้อมูลเข้ารหัสใน database ไม่ใช่ plaintext |
| Audit Trail | Audit Trail | `Payment` (immutable) | ประวัติการเงินลบไม่ได้ |
| Immutable Record | Immutable Record | UtilityRate, Payment | สร้างใหม่เท่านั้น — ห้ามแก้/ลบ |

---

## 8. Status Values

| Entity | Field | Values | ไทย |
|---|---|---|---|
| Room | `status` | `available` | ว่าง |
| | | `occupied` | มีผู้เช่า |
| | | `maintenance` | ซ่อมบำรุง |
| Contract | `status` | `active` | ปัจจุบัน |
| | | `expired` | หมดอายุ |
| | | `terminated` | ยกเลิก |
| Invoice | `status` | `draft` | ร่าง |
| | | `sent` | ส่งแล้ว |
| | | `paid` | ชำระแล้ว |
| | | `overdue` | ค้างชำระ |
| | | `cancelled` | ยกเลิก |
| Maintenance | `status` | `pending` | รอดำเนินการ |
| | | `in_progress` | กำลังดำเนินการ |
| | | `resolved` | เสร็จแล้ว |
| | | `cancelled` | ยกเลิก |
| Deposit | `deposit_status` | `held` | ถืออยู่ |
| | | `partially_returned` | คืนบางส่วน |
| | | `returned` | คืนแล้ว |
| Payment | `method` | `cash` | เงินสด |
| | | `bank_transfer` | โอน |
| | | `qr_code` | QR พร้อมเพย์ |
| | | `other` | อื่นๆ |
| LineItem | `type` | `rent` | ค่าเช่า |
| | | `electric` | ค่าไฟ |
| | | `water` | ค่าน้ำ |
| | | `other` | รายการพิเศษ |
