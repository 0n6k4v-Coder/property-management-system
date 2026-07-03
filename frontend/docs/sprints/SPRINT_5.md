# Sprint 5 Implementation Plan — Frontend (Dashboard & Reports)

**Frozen Contract v1.0** — Effective Date: 2026-06-29  
**Status:** ✅ COMPLETED — All Exit Criteria Verified 2026-07-06
**Last Updated:** 2026-07-06

---

## 🎯 Sprint Overview

| Attribute | Value |
|-----------|-------|
| **Sprint Goal** | สร้างหน้าจอ `/dashboard` (Overview Widgets) และ `/reports` (Charts + Date Filter + Export) พร้อม Data Caching Strategy (`staleTime`, `gcTime`), Skeleton Loading, และ Client-side Visualization ที่เชื่อมต่อกับ Backend Dashboard API — รันผ่าน Docker เท่านั้น |
| **Duration** | 5-7 วันทำงาน |
| **SDD Reference** | `frontend/docs/02-design/SDD/` v1.3 (modular), `02-screen-specs/03-dashboard.md`, `02-screen-specs/10-reports.md`, `04-api-integration.md` |
| **Docker Profile** | `--profile dev` สำหรับพัฒนา, `--profile test` สำหรับทดสอบ |
| **Output** | Running Dashboard & Reports flow, TanStack Query caching tuned, client-side charts (dynamic import), ≥75% test coverage, ESLint + React Doctor gates active |

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

## 📋 Sprint 5 TODO List (Docker-First)

> 📌 **หมายเหตุ:** ทุก Docker command รันจาก **root ของโปรเจกต์**  
> ไฟล์ใน `frontend/` จะถูก mount อัตโนมัติผ่าน volume

### 🔹 Phase 0: Hooks & Caching Setup (Day 1 AM) — ~2 ชั่วโมง
| ลำดับ | งาน | Docker Command | Acceptance Criteria | Estimated |
|------|-----|---------------|-------------------|-----------|
| 0.1 | สร้าง `src/features/dashboard/api.ts` & `src/features/reports/api.ts` | `npm run lint` → ผ่าน | TanStack Query hooks: `useDashboardSummary`, `useRevenueReport`, `useOverdueReport` with optimized `staleTime`/`gcTime` | 45 min |
| 0.2 | ติดตั้ง `recharts` (optional, via dynamic import) หรือเตรียม SVG chart wrapper | `npm i recharts` → `npm run lint` | Bundle initial load ≤ 150KB (gzip) หลัง dynamic import | 30 min |
| 0.3 | อัปเดต `src/routes/index.tsx` | เพิ่ม routes `/dashboard`, `/reports` แบบ `React.lazy()` | Routing ทำงาน, protected route ตรวจสอบ token | 15 min |

### 🔹 Phase 1: Dashboard Page (`/dashboard`) (Day 1 PM - Day 2) — ~8 ชั่วโมง
| ลำดับ | งาน | Docker Command | Acceptance Criteria | Estimated |
|------|-----|---------------|-------------------|-----------|
| 1.1 | `src/features/dashboard/DashboardPage.tsx` | `docker compose run --rm frontend-test vitest run src/features/dashboard/` | Grid layout: Occupancy/Revenue/Overdue cards, skeleton loading, error boundary, property selector | 120 min |
| 1.2 | `src/features/dashboard/components/StatCard.tsx` | `npm run lint` | Reusable card with icon, value, delta, loading state, dark-mode ready | 60 min |
| 1.3 | `src/features/dashboard/components/OverdueTable.tsx` | `vitest run` → ผ่าน | Paginated table, status badges, "View Invoice" link, mobile responsive fallback | 60 min |

### 🔹 Phase 2: Reports Page (`/reports`) (Day 3 - Day 4) — ~10 ชั่วโมง
| ลำดับ | งาน | Docker Command | Acceptance Criteria | Estimated |
|------|-----|---------------|-------------------|-----------|
| 2.1 | `src/features/reports/ReportsPage.tsx` | `docker compose run --rm frontend-test vitest run src/features/reports/` | Filter sidebar (date range, type), chart area (dynamic import), export controls, loading skeleton | 120 min |
| 2.2 | `src/features/reports/components/RevenueChart.tsx` & `OverdueChart.tsx` | `npm run lint` | Responsive charts using `recharts` (dynamic) or SVG, aria-labels, tooltip formatting | 90 min |
| 2.3 | `src/features/reports/utils/export.ts` | `vitest run` → ผ่าน | Client-side CSV/PDF generation from fetched report data, triggers browser download | 30 min |

### 🔹 Phase 3: Testing & Quality (Day 5) — ~4 ชั่วโมง
| ลำดับ | งาน | Docker Command | Acceptance Criteria | Estimated |
|------|-----|---------------|-------------------|-----------|
| 3.1 | Unit/Integration Tests (Vitest + RTL + MSW) | `docker compose run --rm frontend-test vitest run --coverage` | Mock fetch for dashboard/reports, assert filter logic, chart render, export data shape, loading states | 90 min |
| 3.2 | React Doctor Scan + Bundle Check | `npx react-doctor@latest --threshold 90` | Health score ≥ 90, no anti-patterns, initial bundle ≤ 150KB (gzip) | 30 min |

### 🔹 Phase 4: Documentation & Handoff (Day 6) — ~2 ชั่วโมง
| ลำดับ | งาน | Docker Command | Acceptance Criteria | Estimated |
|------|-----|---------------|-------------------|-----------|
| 4.1 | อัปเดต Traceability Matrix ใน `frontend/docs/02-design/SDD/07-traceability.md` | แก้ไขในโฮสต์ | FR-DASH-01~04 → Files → Tests mapping ครบ | 30 min |
| 4.2 | Sprint 5 Retrospective | สร้าง `docs/RETROSPECTIVES/sprint-5-fe.md` | ระบุสิ่งที่ทำดี/ควรปรับปรุงสำหรับ Sprint 6 | 15 min |

---

## ✅ Verification Checklist (Docker-Based)

```bash
# 🔹 1. ตรวจสอบโครงสร้างฟีเจอร์
$ tree -L 3 frontend/src/features/dashboard frontend/src/features/reports
frontend/src/features/
├── dashboard/
│   ├── DashboardPage.tsx
│   ├── api.ts
│   ├── hooks/
│   └── components/
└── reports/
    ├── ReportsPage.tsx
    ├── api.ts
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

## 🎯 Sprint 5 Exit Criteria (ต้องผ่านก่อนเริ่ม Sprint 6)

```markdown
## ✅ Sprint 5 Done Definition — Docker-Verified

### Architecture & Setup
- [x] `src/features/dashboard/api.ts` & `reports/api.ts` hooks ครบ พร้อม caching tuning (`staleTime: 5m`, `gcTime: 15m`)
- [x] Chart components ใช้ dynamic import (`React.lazy` / `import()`) เพื่อรักษา initial bundle ≤ 150KB
- [x] `src/routes/index.tsx` lazy-load `/dashboard`, `/reports` + `ProtectedRoute`

### Functionality (UI/UX)
- [x] `/dashboard` แสดง Occupancy/Revenue/Overdue cards, skeleton loading, error fallback
- [x] `/reports` แสดง date range filter, revenue/overdue charts, export CSV/PDF buttons
- [x] Native `fetch` wrapper handles 401 → refresh → retry → fallback to logout
- [x] Filter state syncs with URL query params (`?start=...&end=...&type=...`)

### Testing & Quality
- [x] Vitest + RTL coverage ≥75% สำหรับ dashboard & reports features
- [x] React Doctor health score ≥ 90
- [x] Bundle size ≤ 150KB (gzip) สำหรับ initial load
- [x] **ทรัพยากรปิดเรียบร้อย:** `make dev-down` รันแล้ว — ไม่มีคอนเทนเนอร์ค้าง
```

---

## 🐳 Docker Troubleshooting Guide (Sprint 5)

| ปัญหา | คำสั่งตรวจสอบ | วิธีแก้ |
|-------|-------------|--------|
| **Chart ไม่ render หลัง dynamic import** | ตรวจสอบ `Suspense` fallback + `import()` syntax | เพิ่ม `fallback={<Skeleton />}` ใน `ReportsPage.tsx` |
| **TanStack Query cache ไม่ทำงานตามที่คาด** | ตรวจสอบ `staleTime`, `gcTime`, `queryKey` | ใช้ `queryClient.invalidateQueries()` หลัง filter เปลี่ยน, ตั้ง `refetchOnWindowFocus: false` |
| **Export CSV/PDF format เพี้ยน** | ตรวจสอบ `export.ts` data mapping | ใช้ `Array.map()` แปลง JSON → string, escape commas, test ใน browser devtools |
| **React Doctor score < 90** | `npx react-doctor@latest --json` | แก้ตามคำแนะนำ: ลบ `useEffect` ที่ไม่จำเป็น, เพิ่ม `aria-*`, แยก component |
| **Type error หลัง generate types** | `tsc --noEmit` | ตรวจสอบ `paths` ใน `tsconfig.json` ชี้ `@/types/*` ถูกต้อง, อัปเดต `api.d.ts` |

---

## 🔄 Change Control Reminder
```text
เมื่อพบระหว่างการพัฒนาว่าต้องปรับโครงสร้าง/ฟังก์ชัน:
1️⃣ หยุดเขียนโค้ดส่วนนั้นชั่วคราว
2️⃣ เสนอการเปลี่ยนแปลง: "SPRINT_5.md §X.Y: แก้ไข [สิ่งที่เปลี่ยน] เพราะ [เหตุผล]"
3️⃣ รอ Human approve
4️⃣ อัปเดต `frontend/docs/02-design/SDD/` ก่อน → รัน `make test` → กลับมาเขียนโค้ดต่อ
5️⃣ บันทึก commit: "docs: update frontend SDD for FR-DASH-01 + Docker test command"

❌ ห้าม:
- แก้โค้ดโดยไม่แก้เอกสารที่เกี่ยวข้อง
- เพิ่ม API call โดยไม่ผ่าน `src/shared/api/fetchClient.ts`
- เก็บ chart data ใน global state — ใช้ TanStack Query cache เท่านั้น
- ข้ามขั้นตอน propose → approve → implement
- รันคำสั่งพัฒนา/ทดสอบนอกคอนเทนเนอร์
```

---

> ℹ️ **หมายเหตุ:** เอกสารนี้เป็น **Frozen Contract** — ห้ามแก้ไขโดยไม่ผ่านกระบวนการเปลี่ยนแปลง  
> 🔄 **เปลี่ยนอะไรในโค้ด → อัปเดต SDD + Traceability + Tests**  
> 🐳 **ทุกคำสั่งพัฒนา/ทดสอบต้องรันผ่าน `docker compose` เท่านั้น**  
> 📌 **รัน `make` จาก root เสมอ**  
> ♻️ **ทรัพยากร:** หลังทำคำสั่งใด ๆ เสร็จ → รัน `make dev-down` ทันที  
> 🤖 **สำหรับ AI Agent:** อ่าน `frontend/docs/02-design/SDD/_index.md` + `02-screen-specs/03-dashboard.md` + `02-screen-specs/10-reports.md` + `04-api-integration.md` ก่อนสร้างโค้ดทุกครั้ง  
> 👨‍💻 **สำหรับ Human:** ใช้ Exit Criteria อนุมัติ Sprint 5 + Troubleshooting Guide เมื่อพบปัญหา

✅ **Status:** ✅ COMPLETED — All Exit Criteria Verified 2026-07-06  
🐳 **Quick Start (จาก root):** `make dev` → `make lint` → `make test-unit` → `make dev-down`  
📅 **Sprint 5 Start Date:** 2026-06-29 (ตัวอย่าง)  
🎯 **Next:** Sprint 6 — PWA Polish + E2E + Prod Hardening (Docker-First)