# Sprint 3 Implementation Plan — Frontend (Meter Reading + PWA Offline)

**Frozen Contract v1.0** — Effective Date: 2026-06-15  
**Status:** ✅ COMPLETED — All Exit Criteria Verified 2026-07-06
**Last Updated:** 2026-07-06

---

## 🎯 Sprint Overview

| Attribute | Value |
|-----------|-------|
| **Sprint Goal** | สร้างหน้า `/meter-reading` พร้อมระบบ Offline Queue (`idb`), Background Sync, และ UI States (Offline Banner, Sync Indicator) ที่ทำงานได้จริงเมื่อเครือข่ายขาด/เชื่อมต่อกลับ — รันผ่าน Docker เท่านั้น |
| **Duration** | 5-7 วันทำงาน |
| **SDD Reference** | `frontend/docs/02-design/SDD/` v1.3 (modular), `02-screen-specs/04-meter-reading.md`, `03-state-data-flow.md`, `04-api-integration.md`, `05-diagrams.md` |
| **Docker Profile** | `--profile dev` สำหรับพัฒนา, `--profile test` สำหรับทดสอบ |
| **Output** | PWA-ready Meter Reading flow, IndexedDB queue, Background Sync trigger, 100% test coverage for offline/online states, ESLint + React Doctor gates active |

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

## 📋 Sprint 3 TODO List (Docker-First)

> 📌 **หมายเหตุ:** ทุก Docker command รันจาก **root ของโปรเจกต์**  
> ไฟล์ใน `frontend/` จะถูก mount อัตโนมัติผ่าน volume

### 🔹 Phase 0: PWA & Offline Infrastructure (Day 1 AM) — ~2 ชั่วโมง
| ลำดับ | งาน | Docker Command | Acceptance Criteria | Estimated |
|------|-----|---------------|-------------------|-----------|
| 0.1 | ติดตั้ง `idb` + สร้าง `src/shared/pwa/` (idb.ts, queue.ts, sync.ts) | `npm i idb` → `npm run lint` | IndexedDB schema `pms-meter-queue` สร้างได้, CRUD queue ทำงาน | 45 min |
| 0.2 | สร้าง Service Worker Stub (`src/shared/pwa/service-worker.ts`) | `vite build` → ตรวจสอบ SW register | `self.addEventListener('sync')` + `self.addEventListener('fetch')` พร้อม | 30 min |
| 0.3 | อัปเดต `vite.config.ts` + `index.html` | เพิ่ม `registerSW()` ใน `main.tsx` | SW register สำเร็จ, `navigator.serviceWorker.ready` resolve | 15 min |

### 🔹 Phase 1: Meter Reading UI & Validation (Day 1 PM - Day 2) — ~8 ชั่วโมง
| ลำดับ | งาน | Docker Command | Acceptance Criteria | Estimated |
|------|-----|---------------|-------------------|-----------|
| 1.1 | `src/features/meter/MeterReadingPage.tsx` | `make dev` → เช็ค UI | Layout ตรง SDD §3.4, large touch targets, `inputmode="decimal"`, offline banner | 120 min |
| 1.2 | `src/features/meter/hooks/useMeterForm.ts` | `npm run lint` | Zod schema (current ≥ previous), `react-hook-form` integration, inline errors | 90 min |
| 1.3 | `src/features/meter/api.ts` + `useRecordMeterMutation.ts` | `vitest run` | TanStack Query mutation, fallback to queue on network fail, optimistic UI disabled | 60 min |

### 🔹 Phase 2: Offline Queue & Background Sync (Day 3) — ~6 ชั่วโมง
| ลำดับ | งาน | Docker Command | Acceptance Criteria | Estimated |
|------|-----|---------------|-------------------|-----------|
| 2.1 | `src/shared/pwa/sync.ts` — Sync Event Handler | `vitest run` | ดึงรายการจาก queue → POST ทีละตัว → ลบเมื่อ 201 → จัดการ 4xx/5xx | 120 min |
| 2.2 | `src/features/meter/hooks/useOfflineQueue.ts` | `npm run lint` | Subscribe queue length, trigger `navigator.serviceWorker.ready.sync.register('meter-sync')` | 60 min |
| 2.3 | Offline UI States | `make dev` → ปิดเน็ตจำลอง | แสดง `✅ บันทึกแล้ว (รอซิงค์)`, `SyncStatusIndicator` อัปเดตตามสถานะ queue | 60 min |

### 🔹 Phase 3: Testing & Quality (Day 4) — ~4 ชั่วโมง
| ลำดับ | งาน | Docker Command | Acceptance Criteria | Estimated |
|------|-----|---------------|-------------------|-----------|
| 3.1 | Unit/Integration Tests (Vitest + RTL + MSW) | `docker compose run --rm frontend-test vitest run --coverage` | Mock `navigator.onLine`, test online/offline submit, queue insert, sync success | 90 min |
| 3.2 | React Doctor Scan + Bundle Check | `npx react-doctor@latest --threshold 90` | Health score ≥ 90, no anti-patterns, bundle ≤ 150KB (gzip) | 30 min |

### 🔹 Phase 4: Documentation & Handoff (Day 5) — ~2 ชั่วโมง
| ลำดับ | งาน | Docker Command | Acceptance Criteria | Estimated |
|------|-----|---------------|-------------------|-----------|
| 4.1 | อัปเดต Traceability Matrix ใน `frontend/docs/02-design/SDD/07-traceability.md` | แก้ไขในโฮสต์ | FR-METER-01~04 → Files → Tests mapping ครบ | 30 min |
| 4.2 | Sprint 3 Retrospective | สร้าง `docs/RETROSPECTIVES/sprint-3-fe.md` | ระบุสิ่งที่ทำดี/ควรปรับปรุงสำหรับ Sprint 4 | 15 min |

---

## ✅ Verification Checklist (Docker-Based)

```bash
# 🔹 1. ตรวจสอบโครงสร้างฟีเจอร์
$ tree -L 3 frontend/src/features/meter frontend/src/shared/pwa
frontend/src/features/
└── meter/
    ├── MeterReadingPage.tsx
    ├── hooks/
    └── api.ts
frontend/src/shared/
└── pwa/
    ├── idb-queue.ts
    ├── service-worker.ts
    └── sync.ts

# 🔹 2. ทดสอบ Type Generation + Lint
$ cd frontend && npx openapi-typescript http://localhost:8000/openapi.json -o src/types/api.d.ts && npm run lint
✅ Types generated, ESLint/React Doctor/TSC passed

# 🔹 3. รัน Test + Coverage
$ docker compose -f docker-compose.dev.yml --profile test run --rm frontend-test \
  vitest run --coverage
# → Coverage ≥75%, 0 failures

# 🔹 4. ตรวจสอบ Offline Flow (Manual/MSW Simulation)
$ docker compose run --rm frontend-test vitest run src/features/meter/MeterReadingPage.test.tsx
# → ผ่านทั้ง online success, offline queue, sync retry

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

## 🎯 Sprint 3 Exit Criteria (ต้องผ่านก่อนเริ่ม Sprint 4)

```markdown
## ✅ Sprint 3 Done Definition — Docker-Verified

### Architecture & PWA Setup
- [x] `idb` queue schema `pms-meter-queue` สร้าง/อ่าน/ลบได้ถูกต้อง
- [x] Service Worker register สำเร็จ, `sync` event listener ทำงาน
- [x] `useOfflineQueue` hook subscribe queue length + trigger Background Sync

### Functionality (Meter Reading)
- [x] `/meter-reading` แสดง form validation (current ≥ previous), `inputmode="decimal"`
- [x] Online submit → POST → success → clear form + toast
- [x] Offline submit → add to IDB queue → show "✅ บันทึกแล้ว (รอซิงค์)"
- [x] Online กลับมา → Background Sync POST queue → ลบสำเร็จ → อัปเดต UI

### Testing & Quality
- [x] Vitest + RTL coverage ≥75% สำหรับ meter features & pwa queue/sync
- [x] React Doctor health score ≥ 90
- [x] Bundle size ≤ 150KB (gzip) สำหรับ initial load
- [x] **ทรัพยากรปิดเรียบร้อย:** `make dev-down` รันแล้ว — ไม่มีคอนเทนเนอร์ค้าง
```

---

## 🐳 Docker Troubleshooting Guide (Sprint 3)

| ปัญหา | คำสั่งตรวจสอบ | วิธีแก้ |
|-------|-------------|--------|
| **Service Worker ไม่ register** | ตรวจสอบ `vite.config.ts` `base` path, `https` ใน prod | ใช้ `localhost` สำหรับ dev, เพิ่ม `console.log` ใน `main.tsx` |
| **IDB queue ไม่ save** | ตรวจสอบ `idb` transaction mode (`readwrite`) | ใช้ `await db.put('pms-meter-queue', data)` ใน `try/catch` |
| **Sync event ไม่ trigger** | ตรวจสอบ `navigator.onLine` + `serviceWorker.ready.sync.register()` | เรียกหลัง `navigator.serviceWorker.controller !== null` |
| **MSW ไม่ดัก offline fetch** | ตรวจสอบ `setupWorker` + `handlers` mock | ใช้ `ctx.delay()` + `ctx.fetchError()` จำลอง network fail |
| **React Doctor score < 90** | `npx react-doctor@latest --json` | แก้ตามคำแนะนำ: ลบ `useEffect` ที่ไม่จำเป็น, เพิ่ม `aria-*`, แยก component |

---

## 🔄 Change Control Reminder
```text
เมื่อพบระหว่างการพัฒนาว่าต้องปรับโครงสร้าง/ฟังก์ชัน:
1️⃣ หยุดเขียนโค้ดส่วนนั้นชั่วคราว
2️⃣ เสนอการเปลี่ยนแปลง: "SPRINT_3.md §X.Y: แก้ไข [สิ่งที่เปลี่ยน] เพราะ [เหตุผล]"
3️⃣ รอ Human approve
4️⃣ อัปเดต `frontend/docs/02-design/SDD/` ก่อน → รัน `make test` → กลับมาเขียนโค้ดต่อ
5️⃣ บันทึก commit: "docs: update frontend SDD for FR-METER-01 + Docker test command"

❌ ห้าม:
- แก้โค้ดโดยไม่แก้เอกสารที่เกี่ยวข้อง
- เพิ่ม API call โดยไม่ผ่าน `src/shared/api/fetchClient.ts`
- เก็บ offline queue ใน `localStorage` — ใช้ `idb` เท่านั้น
- ข้ามขั้นตอน propose → approve → implement
- รันคำสั่งพัฒนา/ทดสอบนอกคอนเทนเนอร์
```

---

> ℹ️ **หมายเหตุ:** เอกสารนี้เป็น **Frozen Contract** — ห้ามแก้ไขโดยไม่ผ่านกระบวนการเปลี่ยนแปลง  
> 🔄 **เปลี่ยนอะไรในโค้ด → อัปเดต SDD + Traceability + Tests**  
> 🐳 **ทุกคำสั่งพัฒนา/ทดสอบต้องรันผ่าน `docker compose` เท่านั้น**  
> 📌 **รัน `make` จาก root เสมอ**  
> ♻️ **ทรัพยากร:** หลังทำคำสั่งใด ๆ เสร็จ → รัน `make dev-down` ทันที  
> 🤖 **สำหรับ AI Agent:** อ่าน `frontend/docs/02-design/SDD/_index.md` + `02-screen-specs/04-meter-reading.md` + `03-state-data-flow.md` + `04-api-integration.md` ก่อนสร้างโค้ดทุกครั้ง  
> 👨‍💻 **สำหรับ Human:** ใช้ Exit Criteria อนุมัติ Sprint 3 + Troubleshooting Guide เมื่อพบปัญหา

✅ **Status:** ✅ COMPLETED — All Exit Criteria Verified 2026-07-06  
🐳 **Quick Start (จาก root):** `make dev` → `make lint` → `make test-unit` → `make dev-down`  
📅 **Sprint 3 Start Date:** 2026-06-15 (ตัวอย่าง)  
🎯 **Next:** Sprint 4 — Invoices & Payments (Docker-First)