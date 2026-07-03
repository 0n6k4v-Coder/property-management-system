# User Stories — Property Management System

> Phase 1: Domain Discovery | วันที่: 2026-05-18 | Status: **Confirmed**

---

## Epic 1: Property & Room Management

| ID | As a... | I want to... | So that... | FR Ref | Priority |
|---|---|---|---|---|---|
| US-01 | Owner | สร้างและแก้ไข property พร้อมกำหนด config (อัตราค่าไฟ/น้ำ, วันครบกำหนด) | แต่ละ property มีการตั้งค่าของตัวเอง | FR-PROP-01 | Must |
| US-02 | Owner | สร้าง Building ในแต่ละ property ตั้งชื่อได้เอง (เช่น "อาคาร A", "แถวที่ 1") | โครงสร้างอาคารสะท้อน layout จริงของหอพัก | FR-PROP-02 | Must |
| US-03 | Owner | สร้าง Floor ภายใน Building ตั้งชื่อได้เอง (เช่น "ชั้น 1", "ชั้น 2") | แบ่งกลุ่มห้องตาม layout จริงได้อิสระ | FR-PROP-03 | Must |
| US-04 | Owner | เพิ่ม/แก้ไข/ลบห้องพักภายใน Building หรือ Floor | จัดการห้องได้ยืดหยุ่น | FR-PROP-04, FR-PROP-05 | Must |
| US-05 | Owner | ดูภาพรวมห้องทั้งหมดแบบ grid แยกตาม Building และ Floor | เห็นสถานะห้อง (ว่าง/มีผู้เช่า/ซ่อม) ได้ทันที | FR-PROP-06 | Must |
| US-06 | Owner | อัปโหลดรูปภาพห้อง | มีหลักฐานสภาพห้องก่อน/หลังเช่า | FR-PROP-07 | Should |

---

## Epic 2: User Management

| ID | As a... | I want to... | So that... | FR Ref | Priority |
|---|---|---|---|---|---|
| US-07 | Owner | ลงทะเบียนและ login เข้าระบบ | เข้าใช้งานได้อย่างปลอดภัย | FR-USER-01 | Must |
| US-08 | Owner | invite Owner คนอื่นเข้าระบบผ่านอีเมล | ให้เจ้าของหอพักคนอื่นเข้าใช้งานได้ | FR-USER-02 | Must |
| US-09 | Owner | ดูและยกเลิกสิทธิ์ Owner คนอื่นได้ | ควบคุมว่าใครเข้าถึงระบบได้บ้าง | FR-USER-03 | Should |

---

## Epic 3: Tenant Management

| ID | As a... | I want to... | So that... | FR Ref | Priority |
|---|---|---|---|---|---|
| US-10 | Owner | เพิ่มผู้เช่าใหม่พร้อมข้อมูลครบ (บัตร ปชช., เบอร์, LINE) | มีฐานข้อมูลผู้เช่าในระบบ | FR-TENANT-01, FR-TENANT-02 | Must |
| US-11 | Owner | ค้นหาผู้เช่าด้วยชื่อหรือเบอร์โทร | หาข้อมูลผู้เช่าได้รวดเร็ว | FR-TENANT-04 | Must |
| US-12 | Owner | ดูประวัติการเช่าของผู้เช่าแต่ละคน | ทราบว่าเคยเช่าห้องไหน ช่วงไหน | FR-TENANT-03 | Should |

---

## Epic 4: Contract Management

| ID | As a... | I want to... | So that... | FR Ref | Priority |
|---|---|---|---|---|---|
| US-13 | Owner | สร้างสัญญาเช่าใหม่เชื่อมผู้เช่ากับห้อง | การเช่าถูกบันทึกอย่างเป็นทางการ | FR-CONTRACT-01 | Must |
| US-14 | Owner | รับแจ้งเตือนเมื่อสัญญาใกล้หมดอายุ (30/15/7 วัน) | มีเวลาเตรียมต่อสัญญาหรือหาผู้เช่าใหม่ | FR-CONTRACT-02 | Must |
| US-15 | Owner | บันทึกการย้ายออกและการคืนเงินประกัน | ปิดสัญญาได้ถูกต้องและมีหลักฐาน | FR-CONTRACT-03 | Must |
| US-16 | Owner | ต่ออายุสัญญาพร้อมปรับเงื่อนไขได้ | ปรับราคาเช่าเมื่อต่อสัญญา | FR-CONTRACT-05 | Should |
| US-17 | Owner | print/export PDF สัญญาเช่า | มีเอกสารฉบับกระดาษให้ผู้เช่าเซ็น | FR-CONTRACT-04 | Should |

---

## Epic 5: Meter Reading & Billing

| ID | As a... | I want to... | So that... | FR Ref | Priority |
|---|---|---|---|---|---|
| US-18 | Owner | กรอกค่ามิเตอร์บนมือถือได้เลยขณะเดินตรวจมิเตอร์ | ไม่ต้องจดกระดาษแล้วกลับมาพิมพ์ที่หลัง | FR-METER-01 | Must |
| US-19 | Owner | เห็นค่ามิเตอร์เดือนก่อนหน้าขณะกรอก | ไม่ต้องจำหรือพกกระดาษอ้างอิง | FR-METER-02 | Must |
| US-20 | Owner | เห็นรายการห้องที่ยังไม่ได้จดมิเตอร์ในรอบนั้น | ไม่ข้ามห้องโดยไม่รู้ตัว | FR-METER-03 | Must |
| US-21 | Owner | ให้ระบบคำนวณค่าไฟ/น้ำอัตโนมัติหลังกรอกมิเตอร์ | ไม่ต้องนั่งคิดเลขเอง | FR-METER-04, FR-METER-05 | Must |
| US-22 | Owner | สร้างใบแจ้งหนี้ทุกห้องพร้อมกันในคลิกเดียว | ประหยัดเวลาช่วงสิ้นเดือน | FR-METER-06, FR-METER-07 | Must |
| US-23 | Owner | ดูและแก้ไขใบแจ้งหนี้ draft ก่อน lock | ตรวจสอบความถูกต้องก่อนส่ง | FR-METER-10 | Must |
| US-24 | Owner | บันทึกรับเงินพร้อมระบุช่องทาง (เงินสด/โอน/QR) | มี audit trail การรับเงินครบถ้วน | FR-METER-09 | Must |
| US-25 | Owner | ดูรายชื่อผู้เช่าที่ยังไม่ชำระเงินพร้อมจำนวนวันค้าง | follow-up ได้ตรงจุด | FR-METER-11 | Must |
| US-26 | Owner | copy ข้อความสรุปบิลรูปแบบ LINE ต่อห้องได้ทันที | ส่งแจ้งผู้เช่าทาง LINE ได้เลยโดยไม่ต้องพิมพ์เอง | FR-METER-12, FR-METER-13 | Must |
| US-27 | Owner | ปรับอัตราค่าไฟ/น้ำต่อ property ได้ | อัปเดตตามประกาศภาครัฐ | FR-METER-05, FR-METER-08 | Must |

---

## Epic 6: Maintenance

| ID | As a... | I want to... | So that... | FR Ref | Priority |
|---|---|---|---|---|---|
| US-28 | Owner | บันทึกรายการซ่อมบำรุงต่อห้อง พร้อมรูปภาพ | มีหลักฐานและ tracking งานซ่อม | FR-MAINT-01, FR-MAINT-03 | Should |
| US-29 | Owner | อัปเดตสถานะงานซ่อม | ติดตามความคืบหน้าได้ | FR-MAINT-02 | Should |

---

## Epic 7: Dashboard & Reports

| ID | As a... | I want to... | So that... | FR Ref | Priority |
|---|---|---|---|---|---|
| US-30 | Owner | ดู dashboard: ห้องว่าง, รายรับเดือนนี้, ค้างชำระ, สัญญาใกล้หมด | เห็นภาพรวมธุรกิจในหน้าเดียว | FR-DASH-01 | Must |
| US-31 | Owner | ดูรายงานรายรับรายเดือน แยกตาม property | ติดตามรายได้แต่ละหอพัก | FR-DASH-02, FR-DASH-03 | Must |
| US-32 | Owner | export รายงานเป็น Excel/PDF | นำไปทำบัญชีต่อได้ | FR-DASH-04 | Should |

---

## Priority Legend
- **Must** — MVP ต้องมี ไม่มีไม่ได้
- **Should** — ควรมีใน v1.0
- **Could** — nice to have ถ้ามีเวลา

---

## MVP Scope

```
Epic 1: Property & Room     (US-01 ถึง US-05)
Epic 2: User Management     (US-07, US-08)
Epic 3: Tenant              (US-10, US-11)
Epic 4: Contract            (US-13 ถึง US-15)
Epic 5: Billing             (US-18 ถึง US-27)
Epic 7: Dashboard           (US-30, US-31)
```

Epic 6 (Maintenance) และ remaining Should items → หลัง MVP
