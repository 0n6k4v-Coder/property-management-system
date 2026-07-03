# Sprint 2 Implementation Plan — Frontend (Property & Tenant UI)

**Frozen Contract v1.0** — Effective Date: 2026-06-08  
**Status:** ✅ COMPLETED — All Exit Criteria Verified 2026-07-06
**Last Updated:** 2026-07-06

---

## 🎯 Sprint Overview

| Attribute | Value |
|-----------|-------|
| **Sprint Goal** | สร้างหน้าจอ Property Management (`/property`), Tenant Search/List (`/tenants`), และ Room Detail (`/property/rooms/:id`) พร้อม Shared UI Components, Form Validation (Zod), และ Integration กับ Backend API ผ่าน Native Fetch Wrapper — รันผ่าน Docker เท่านั้น |
| **Duration** | 5-7 วันทำงาน |
| **SDD Reference** | `frontend/docs/02-design/SDD/` v1.3 (modular), `docs/ARCHITECTURE.md` v1.2, Backend `openapi.json` |
| **Docker Profile** | `--profile dev` สำหรับพัฒนา, `--profile test` สำหรับทดสอบ |
| **Output** | Running SPA with 3 new features, Zod validation, TanStack Query integration, ESLint + React Doctor gates active, ≥75% test coverage for new features |

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
# รันจาก root
make dev
# ตรวจสอบ Backend พร้อม
curl -s http://localhost:8000/health | jq .
# Generate types ใหม่ (ถ้า API เปลี่ยน)
cd frontend && npx openapi-typescript http://localhost:8000/openapi.json -o src/types/api.d.ts
```

### 3. เริ่มสภาพแวดล้อมพัฒนา
```bash
make dev
docker compose -f docker-compose.dev.yml --profile dev ps
# Frontend จะ mount ที่ :5173, Proxy `/api` → `http://backend:8000`
```

---

## 📋 Sprint 2 TODO List (Docker-First)

> 📌 **หมายเหตุ:** ทุก Docker command รันจาก **root ของโปรเจกต์**  
> ไฟล์ใน `frontend/` จะถูก mount อัตโนมัติผ่าน volume

### 🔹 Phase 0: Bootstrap & Shared UI (Day 1 AM) — ~2 ชั่วโมง
| ลำดับ | งาน | Docker Command | Acceptance Criteria | Estimated |
|------|-----|---------------|-------------------|-----------|
| 0.1 | สร้าง `src/shared/ui/` Components (Button, Input, Card, Skeleton, Badge, Modal) | `cd frontend && npm run dev` → เช็ค Story/Preview | Tailwind utility classes, ARIA attributes, dark-mode ready, focus rings | 45 min |
| 0.2 | ตั้งค่า Zod + `@hookform/resolvers` + `react-hook-form` | `npm run lint` → ผ่าน 100% | Form validation pattern พร้อมใช้ใน Property/Tenant | 30 min |
| 0.3 | อัปเดต `routes/index.tsx` | เพิ่ม routes ใหม่แบบ `React.lazy()` | Routing ทำงาน, protected route ตรวจสอบ token | 15 min |

### 🔹 Phase 1: Property Management (`/property`) (Day 1 PM - Day 2) — ~8 ชั่วโมง
| ลำดับ | งาน | Docker Command | Acceptance Criteria | Estimated |
|------|-----|---------------|-------------------|-----------|
| 1.1 | `features/property/PropertyListPage.tsx` | `docker compose run --rm frontend-test vitest run src/features/property/` | Accordion: Property → Building → Floor → Room, lazy load, status badges | 120 min |
| 1.2 | `features/property/hooks/` + `api.ts` | `npm run lint` | TanStack Query hooks (`useProperties`, `useCreateProperty`, etc.), type-safe | 90 min |
| 1.3 | Create Property/Building/Room Forms | `vitest run` → ผ่าน validation tests | Zod schema ตรงกับ `api.d.ts`, error inline, success → refresh list | 90 min |

### 🔹 Phase 2: Tenant Management (`/tenants`) (Day 3) — ~6 ชั่วโมง
| ลำดับ | งาน | Docker Command | Acceptance Criteria | Estimated |
|------|-----|---------------|-------------------|-----------|
| 2.1 | `features/tenant/TenantListPage.tsx` | `docker compose run --rm frontend-test vitest run src/features/tenant/` | Search bar (debounce 300ms), table/card view, ILIKE/phone match | 120 min |
| 2.2 | `features/tenant/hooks/useSearchTenants.ts` | `npm run lint` | TanStack Query `useQuery`, `enabled: !!query`, pagination | 60 min |
| 2.3 | `features/tenant/CreateTenantModal.tsx` | `vitest run` | Phone/ID format validation, API call, success toast | 60 min |

### 🔹 Phase 3: Room Detail & Contract Flow (`/property/rooms/:id`) (Day 4) — ~6 ชั่วโมง
| ลำดับ | งาน | Docker Command | Acceptance Criteria | Estimated |
|------|-----|---------------|-------------------|-----------|
| 3.1 | `features/property/RoomDetailPage.tsx` | `docker compose run --rm frontend-test vitest run src/features/property/` | Tabs: Overview / Contract / Meter History, `useParams()` + `useQuery` | 120 min |
| 3.2 | Contract Create/Terminate Modals | `npm run lint` | Tenant search inside modal, validation, status sync on success | 120 min |

### 🔹 Phase 4: Testing & Quality (Day 5) — ~4 ชั่วโมง
| ลำดับ | งาน | Docker Command | Acceptance Criteria | Estimated |
|------|-----|---------------|-------------------|-----------|
| 4.1 | Unit/Integration Tests (Vitest + RTL + MSW) | `docker compose run --rm frontend-test vitest run --coverage` | Coverage ≥75% สำหรับ features/property & tenant, mocks intercept `fetch` | 90 min |
| 4.2 | React Doctor Scan + Bundle Check | `npx react-doctor@latest --threshold 90` | Health score ≥ 90, no anti-patterns, bundle ≤ 150KB (gzip) | 30 min |

### 🔹 Phase 5: Documentation & Handoff (Day 6) — ~2 ชั่วโมง
| ลำดับ | งาน | Docker Command | Acceptance Criteria | Estimated |
|------|-----|---------------|-------------------|-----------|
| 5.1 | อัปเดต Traceability Matrix ใน `frontend/docs/02-design/SDD/07-traceability.md` | แก้ไขในโฮสต์ | FR-PROP/FR-TENANT → Files → Tests mapping ครบ | 30 min |
| 5.2 | Sprint 2 Retrospective | สร้าง `docs/RETROSPECTIVES/sprint-2-fe.md` | ระบุสิ่งที่ทำดี/ควรปรับปรุงสำหรับ Sprint 3 | 15 min |

---

## ✅ Verification Checklist (Docker-Based)

```bash
# 🔹 1. ตรวจสอบโครงสร้างฟีเจอร์
$ tree -L 3 frontend/src/features/property frontend/src/features/tenant
frontend/src/features/
├── property/
│   ├── PropertyListPage.tsx
│   ├── RoomDetailPage.tsx
│   ├── hooks/
│   └── components/
└── tenant/
    ├── TenantListPage.tsx
    ├── hooks/
    └── components/

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

# 🔹 5. ตรวจสอบ API Integration จริง
$ curl -s http://localhost:8000/api/v1/properties | jq '.data[0].name'
# → Frontend ต้องแสดงชื่อ property ได้ถูกต้อง
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

## 🎯 Sprint 2 Exit Criteria (ต้องผ่านก่อนเริ่ม Sprint 3)

```markdown
## ✅ Sprint 2 Done Definition — Docker-Verified

### Architecture & Setup
- [x] `src/shared/ui/` components ครบตาม SDD §4.2 (Button, Input, Card, Skeleton, Badge, Modal)
- [x] Zod validation pattern ใช้ใน Property/Tenant forms ทั้งหมด
- [x] React Router v7 `useParams()` + TanStack Query `useQuery` ใน RoomDetail ทำงาน
- [x] ESLint + React Doctor + `tsc --noEmit` ผ่าน 100% ใน CI

### Functionality (UI/UX)
- [x] `/property` แสดง Accordion CRUD, status badges, loading skeletons
- [x] `/property` แสดง property list จาก DB (GET /properties) แบบ dynamic
- [x] `/property` empty state + create property form เมื่อยังไม่มี data
- [x] `/property` detail view แสดง rooms จาก GET /properties/{id}/rooms
- [x] `/tenants` แสดง Search (debounce), table/card fallback, create modal
- [x] `/property/rooms/:id` แสดง Tabs, contract flow, status sync on mutation
- [x] Native `fetch` wrapper handles 401 → refresh → retry → fallback to logout

### Testing & Quality
- [x] Vitest + RTL coverage ≥75% สำหรับ property & tenant features
- [x] React Doctor health score ≥ 90
- [x] Bundle size ≤ 150KB (gzip) สำหรับ initial load
- [x] **ทรัพยากรปิดเรียบร้อย:** `make dev-down` รันแล้ว — ไม่มีคอนเทนเนอร์ค้าง
```

---

## 🐳 Docker Troubleshooting Guide (Sprint 2)

| ปัญหา | คำสั่งตรวจสอบ | วิธีแก้ |
|-------|-------------|--------|
| **TanStack Query ไม่ refresh** | ตรวจสอบ `staleTime`, `gcTime`, `refetchOnWindowFocus` | ตั้ง `staleTime: 0` สำหรับ mutation success, ใช้ `queryClient.invalidateQueries()` |
| **Zod schema ไม่ match `api.d.ts`** | `tsc --noEmit` | ตรวจสอบ type import จาก `@/types/api` ตรงกับ Zod schema |
| **Accordion render ล่ม** | ตรวจสอบ `React.lazy()` + `Suspense` fallback | เพิ่ม `fallback={<Skeleton />}` ใน route config |
| **React Doctor score < 90** | `npx react-doctor@latest --json` | แก้ตามคำแนะนำ: ลบ `useEffect` ที่ไม่จำเป็น, เพิ่ม `alt`, แยก component |
| **Type error หลัง generate types** | `tsc --noEmit` | ตรวจสอบ `paths` ใน `tsconfig.json` ชี้ `@/types/*` ถูกต้อง |

---

## 🔄 Change Control Reminder
```text
เมื่อพบระหว่างการพัฒนาว่าต้องปรับโครงสร้าง/ฟังก์ชัน:
1️⃣ หยุดเขียนโค้ดส่วนนั้นชั่วคราว
2️⃣ เสนอการเปลี่ยนแปลง: "SPRINT_2.md §X.Y: แก้ไข [สิ่งที่เปลี่ยน] เพราะ [เหตุผล]"
3️⃣ รอ Human approve
4️⃣ อัปเดต `frontend/docs/02-design/SDD/` ก่อน → รัน `make test` → กลับมาเขียนโค้ดต่อ
5️⃣ บันทึก commit: "docs: update frontend SDD for FR-PROP-01 + Docker test command"

❌ ห้าม:
- แก้โค้ดโดยไม่แก้เอกสารที่เกี่ยวข้อง
- เพิ่ม API call โดยไม่ผ่าน `src/shared/api/fetchClient.ts`
- เขียน type ใน `src/types/` นอก `api.d.ts`
- ข้ามขั้นตอน propose → approve → implement
- รันคำสั่งพัฒนา/ทดสอบนอกคอนเทนเนอร์
```

---

> ℹ️ **หมายเหตุ:** เอกสารนี้เป็น **Frozen Contract** — ห้ามแก้ไขโดยไม่ผ่านกระบวนการเปลี่ยนแปลง  
> 🔄 **เปลี่ยนอะไรในโค้ด → อัปเดต SDD + Traceability + Tests**  
> 🐳 **ทุกคำสั่งพัฒนา/ทดสอบต้องรันผ่าน `docker compose` เท่านั้น**  
> 📌 **รัน `make` จาก root เสมอ**  
> ♻️ **ทรัพยากร:** หลังทำคำสั่งใด ๆ เสร็จ → รัน `make dev-down` ทันที  
> 🤖 **สำหรับ AI Agent:** อ่าน `frontend/docs/02-design/SDD/_index.md` + `02-screen-specs/07-tenant-list.md` + `02-screen-specs/08-property-list.md` + `04-api-integration.md` ก่อนสร้างโค้ดทุกครั้ง  
> 👨‍💻 **สำหรับ Human:** ใช้ Exit Criteria อนุมัติ Sprint 2 + Troubleshooting Guide เมื่อพบปัญหา

✅ **Status:** ✅ COMPLETED — All Exit Criteria Verified 2026-07-06  
🐳 **Quick Start (จาก root):** `make dev` → `make lint` → `make test-unit` → `make dev-down`  
📅 **Sprint 2 Start Date:** 2026-06-08 (ตัวอย่าง)  
🎯 **Next:** Sprint 3 — Meter Reading + PWA Offline (Docker-First)