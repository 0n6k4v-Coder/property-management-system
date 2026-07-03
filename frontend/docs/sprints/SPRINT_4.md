# Sprint 4 Implementation Plan — Frontend (Invoices & Payments)

**Frozen Contract v1.0** — Effective Date: 2026-06-22  
**Status:** ✅ COMPLETED — All Exit Criteria Verified 2026-07-06
**Last Updated:** 2026-07-06

---

## 🎯 Sprint Overview

| Attribute | Value |
|-----------|-------|
| **Sprint Goal** | สร้างหน้าจอ `/invoices` (List + Filters + Bulk Generate) และ `/invoices/:id` (Detail + Payment Modal) พร้อม Client-side Export (CSV/PDF) และ Integration กับ Backend Billing API — รันผ่าน Docker เท่านั้น |
| **Duration** | 5-7 วันทำงาน |
| **SDD Reference** | `frontend/docs/02-design/SDD/` v1.3 (modular), `02-screen-specs/05-invoice-list.md`, `02-screen-specs/06-invoice-detail.md`, `04-api-integration.md` |
| **Docker Profile** | `--profile dev` สำหรับพัฒนา, `--profile test` สำหรับทดสอบ |
| **Output** | Running Invoice/Payment flow, Zod-validated payment form, TanStack Query mutations, Client-side export, ≥75% test coverage, ESLint + React Doctor gates active |

> 📌 **สำคัญ:** `Makefile` อยู่ที่ **root ของโปรเจกต์** (`/property-management-system/Makefile`)  
> ✅ **คำสั่ง `make` ทุกคำสั่งต้องรันจากที่นี่** — ไม่ใช่จากใน `frontend/`  
> ♻️ **Resource Policy:** รัน `make dev-down` ทันทีเมื่อเสร็จ — ห้ามทิ้งคอนเทนเนอร์รันค้าง

---

## 🐳 Docker Environment Setup (ก่อนเริ่มงาน)

### 1. ตรวจสอบระบบโฮสต์
```bash
docker --version          # ≥ 24.0
docker compose version    # ≥ 2.20
make --version
```

### 2. เตรียม Backend & Types
```bash
make dev
curl -s http://localhost:8000/health | jq .
cd frontend && npx openapi-typescript http://localhost:8000/openapi.json -o src/types/api.d.ts
```

### 3. เริ่มสภาพแวดล้อมพัฒนา
```bash
make dev
docker compose -f docker-compose.dev.yml --profile dev ps
# Frontend mount :5173, Proxy `/api` → `http://backend:8000`
```

---

## 📋 Sprint 4 TODO List (Docker-First)

> 📌 **หมายเหตุ:** ทุก Docker command รันจาก **root ของโปรเจกต์**  
> ไฟล์ใน `frontend/` จะถูก mount อัตโนมัติผ่าน volume

### 🔹 Phase 0: Hooks & Shared Setup (Day 1 AM) — ~2 ชั่วโมง
| ลำดับ | งาน | Docker Command | Acceptance Criteria | Estimated |
|------|-----|---------------|-------------------|-----------|
| 0.1 | สร้าง `src/features/billing/api.ts` | `npm run lint` → ผ่าน | TanStack Query hooks: `useInvoices`, `useGenerateInvoices`, `useInvoiceDetail`, `useRecordPayment` (type-safe) | 45 min |
| 0.2 | สร้าง `src/features/billing/utils/export.ts` | `vitest run` → ผ่าน | Client-side CSV/PDF generator from fetched JSON, no backend dependency | 30 min |
| 0.3 | อัปเดต `src/routes/index.tsx` | เพิ่ม routes `/invoices`, `/invoices/:id` แบบ `React.lazy()` | Routing ทำงาน, protected route ตรวจสอบ token | 15 min |

### 🔹 Phase 1: Invoice List (`/invoices`) (Day 1 PM - Day 2) — ~8 ชั่วโมง
| ลำดับ | งาน | Docker Command | Acceptance Criteria | Estimated |
|------|-----|---------------|-------------------|-----------|
| 1.1 | `src/features/billing/InvoiceListPage.tsx` | `docker compose run --rm frontend-test vitest run src/features/billing/` | Table view with status/date filters, pagination, bulk generate button, mobile card fallback | 120 min |
| 1.2 | `src/features/billing/hooks/useInvoices.ts` | `npm run lint` | `useQuery` with debounced filters, `refetchOnWindowFocus: false`, `keepPreviousData: true` | 60 min |
| 1.3 | `src/features/billing/components/BulkGenerateModal.tsx` | `vitest run` → ผ่าน | Confirm dialog, trigger `useGenerateInvoices`, poll task status or show success toast | 60 min |

### 🔹 Phase 2: Invoice Detail & Payment (`/invoices/:id`) (Day 3 - Day 4) — ~10 ชั่วโมง
| ลำดับ | งาน | Docker Command | Acceptance Criteria | Estimated |
|------|-----|---------------|-------------------|-----------|
| 2.1 | `src/features/billing/InvoiceDetailPage.tsx` | `docker compose run --rm frontend-test vitest run src/features/billing/` | Two-column layout: left=details/line items, right=payment history, `useParams()` + `useQuery` | 120 min |
| 2.2 | `src/features/billing/components/PaymentModal.tsx` | `npm run lint` | `react-hook-form` + Zod, amount validation (≤ remaining balance), method selection, submit mutation | 90 min |
| 2.3 | `src/features/billing/utils/formatters.ts` | `vitest run` → ผ่าน | Currency/date formatting, status label mapping, safe null handling | 30 min |

### 🔹 Phase 3: Testing & Quality (Day 5) — ~4 ชั่วโมง
| ลำดับ | งาน | Docker Command | Acceptance Criteria | Estimated |
|------|-----|---------------|-------------------|-----------|
| 3.1 | Unit/Integration Tests (Vitest + RTL + MSW) | `docker compose run --rm frontend-test vitest run --coverage` | Mock fetch for list/detail/payment, assert filter logic, modal validation, export data shape | 90 min |
| 3.2 | React Doctor Scan + Bundle Check | `npx react-doctor@latest --threshold 90` | Health score ≥ 90, no anti-patterns, bundle ≤ 150KB (gzip) | 30 min |

### 🔹 Phase 4: Documentation & Handoff (Day 6) — ~2 ชั่วโมง
| ลำดับ | งาน | Docker Command | Acceptance Criteria | Estimated |
|------|-----|---------------|-------------------|-----------|
| 4.1 | อัปเดต Traceability Matrix ใน `frontend/docs/02-design/SDD/07-traceability.md` | แก้ไขในโฮสต์ | FR-METER-06~10 → Files → Tests mapping ครบ | 30 min |
| 4.2 | Sprint 4 Retrospective | สร้าง `docs/RETROSPECTIVES/sprint-4-fe.md` | ระบุสิ่งที่ทำดี/ควรปรับปรุงสำหรับ Sprint 5 | 15 min |

---

## ✅ Verification Checklist (Docker-Based)

```bash
# 🔹 1. ตรวจสอบโครงสร้างฟีเจอร์
$ tree -L 3 frontend/src/features/billing
frontend/src/features/billing/
├── InvoiceListPage.tsx
├── InvoiceDetailPage.tsx
├── api.ts
├── hooks/
├── components/
└── utils/

# 🔹 2. ทดสอบ Type Generation + Lint
$ cd frontend && npx openapi-typescript http://localhost:8000/openapi.json -o src/types/api.d.ts && npm run lint
✅ Types generated, ESLint/React Doctor/TSC passed

# 🔹 3. รัน Test + Coverage
$ docker compose -f docker-compose.dev.yml --profile test run --rm frontend-test \
  vitest run --coverage
# → Coverage ≥75%, 0 failures

# 🔹 4. ตรวจสอบ React Doctor Health Score
$ npx react-doctor@latest --threshold 90 --format table
# → Score: ≥90 ✅

# 🔹 5. 🔴 ปิดทรัพยากรทันทีเมื่อเสร็จ (ตามนโยบาย)
make dev-down
```

---

## 🚀 Quick Start Commands (Docker-Only — รันจาก root)

```bash
make dev                          # เริ่มเฉพาะเมื่อจำเป็น
make test-unit                    # รันเทสต์เฉพาะ frontend
make lint                         # ESLint + React Doctor + TSC
make dev-down                     # 🔴 ปิดทันทีเมื่อเสร็จ
```

---

## 🎯 Sprint 4 Exit Criteria (ต้องผ่านก่อนเริ่ม Sprint 5)

```markdown
## ✅ Sprint 4 Done Definition — Docker-Verified

### Architecture & Setup
- [x] `src/features/billing/api.ts` hooks ครบ: list, detail, bulk-generate, record-payment
- [x] `react-hook-form` + Zod ใช้ใน PaymentModal, amount ≤ remaining balance
- [x] Client-side export (CSV/PDF) ทำงานจาก fetched data, ไม่เรียก backend

### Functionality (UI/UX)
- [x] `/invoices` แสดง table + filters + pagination, bulk generate modal, mobile fallback
- [x] `/invoices/:id` แสดง line items + payment history, record payment flow, status sync
- [x] Native `fetch` wrapper handles 401 → refresh → retry → fallback to logout
- [x] Bulk generate shows progress/loading, refreshes list on success

### Testing & Quality
- [x] Vitest + RTL coverage ≥75% สำหรับ billing features
- [x] React Doctor health score ≥ 90
- [x] Bundle size ≤ 150KB (gzip) สำหรับ initial load
- [x] **ทรัพยากรปิดเรียบร้อย:** `make dev-down` รันแล้ว — ไม่มีคอนเทนเนอร์ค้าง
```

---

## 🐳 Docker Troubleshooting Guide (Sprint 4)

| ปัญหา | คำสั่งตรวจสอบ | วิธีแก้ |
|-------|-------------|--------|
| **TanStack Query ไม่ refresh หลัง bulk generate** | ตรวจสอบ `queryClient.invalidateQueries(['invoices'])` | ใช้ `onSuccess` callback ใน mutation, ตั้ง `staleTime: 0` ชั่วคราว |
| **PaymentModal validate ผิด** | ตรวจสอบ Zod schema `amount.lte(remaining)` | ดึง `remaining = total - paid` จาก API response ก่อนสร้าง form |
| **Export CSV/PDF format เพี้ยน** | ตรวจสอบ `export.ts` data mapping | ใช้ `Array.map()` แปลง JSON → string,  escape commas, test ใน browser devtools |
| **React Doctor score < 90** | `npx react-doctor@latest --json` | แก้ตามคำแนะนำ: ลบ `useEffect` ที่ไม่จำเป็น, เพิ่ม `aria-*`, แยก component |
| **Type error หลัง generate types** | `tsc --noEmit` | ตรวจสอบ `paths` ใน `tsconfig.json` ชี้ `@/types/*` ถูกต้อง, อัปเดต `api.d.ts` |

---

## 🔄 Change Control Reminder
```text
เมื่อพบระหว่างการพัฒนาว่าต้องปรับโครงสร้าง/ฟังก์ชัน:
1️⃣ หยุดเขียนโค้ดส่วนนั้นชั่วคราว
2️⃣ เสนอการเปลี่ยนแปลง: "SPRINT_4.md §X.Y: แก้ไข [สิ่งที่เปลี่ยน] เพราะ [เหตุผล]"
3️⃣ รอ Human approve
4️⃣ อัปเดต `frontend/docs/02-design/SDD/` ก่อน → รัน `make test` → กลับมาเขียนโค้ดต่อ
5️⃣ บันทึก commit: "docs: update frontend SDD for FR-METER-06 + Docker test command"

❌ ห้าม:
- แก้โค้ดโดยไม่แก้เอกสารที่เกี่ยวข้อง
- เพิ่ม API call โดยไม่ผ่าน `src/shared/api/fetchClient.ts`
- เก็บ payment state ใน `localStorage` — ใช้ context/local state เท่านั้น
- ข้ามขั้นตอน propose → approve → implement
- รันคำสั่งพัฒนา/ทดสอบนอกคอนเทนเนอร์
```

---

> ℹ️ **หมายเหตุ:** เอกสารนี้เป็น **Frozen Contract** — ห้ามแก้ไขโดยไม่ผ่านกระบวนการเปลี่ยนแปลง  
> 🔄 **เปลี่ยนอะไรในโค้ด → อัปเดต SDD + Traceability + Tests**  
> 🐳 **ทุกคำสั่งพัฒนา/ทดสอบต้องรันผ่าน `docker compose` เท่านั้น**  
> 📌 **รัน `make` จาก root เสมอ**  
> ♻️ **ทรัพยากร:** หลังทำคำสั่งใด ๆ เสร็จ → รัน `make dev-down` ทันที  
> 🤖 **สำหรับ AI Agent:** อ่าน `frontend/docs/02-design/SDD/_index.md` + `02-screen-specs/05-invoice-list.md` + `02-screen-specs/06-invoice-detail.md` + `04-api-integration.md` ก่อนสร้างโค้ดทุกครั้ง  
> 👨‍💻 **สำหรับ Human:** ใช้ Exit Criteria อนุมัติ Sprint 4 + Troubleshooting Guide เมื่อพบปัญหา

✅ **Status:** ✅ COMPLETED — All Exit Criteria Verified 2026-07-06    
🐳 **Quick Start (จาก root):** `make dev` → `make lint` → `make test-unit` → `make dev-down`  
📅 **Sprint 4 Start Date:** 2026-06-22 (ตัวอย่าง)  
🎯 **Next:** Sprint 5 — Dashboard & Reports (Docker-First)