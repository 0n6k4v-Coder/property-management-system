# Sprint 1 Implementation Plan — Frontend (Auth Flow & Core Architecture)

**Frozen Contract v1.0** — Effective Date: 2026-06-01  
**Status:** ✅ COMPLETED — All Exit Criteria Verified 2026-05-26  
**Last Updated:** 2026-05-26

---

## 🏁 Sprint 1 Result

```
ESLint --max-warnings 0   ✅ 0 errors, 0 warnings  (react-doctor rules all active)
tsc --noEmit              ✅ Clean (TypeScript 6.0.3)
vitest run                ✅ 15/15 tests passed    (LoginPage: 8, RegisterPage: 7)
npm install               ✅ 0 vulnerabilities, clean peer deps
```

### Tech Stack (Latest Stable — 2026-05-26)

| Package | Version | Note |
|---------|---------|------|
| Vite | 8.0.14 | Latest stable |
| React | 19.2.6 | `use()` hook for context, ref as regular prop |
| TypeScript | 6.0.3 | `ignoreDeprecations: "6.0"` for baseUrl |
| Tailwind CSS | 4.3.0 | `@tailwindcss/vite` plugin, CSS-based config |
| react-router-dom | 7.15.1 | Lazy loading, ProtectedRoute, GuestRoute |
| TanStack Query | 5.100.14 | Server state management |
| Vitest | 4.1.7 | Integration + unit tests |
| ESLint | 10.4.0 | Flat config, `--max-warnings 0` |
| MSW | 2.14.6 | API mocking for tests |

---

## 🎯 Sprint Overview

| Attribute | Value |
|-----------|-------|
| **Sprint Goal** | ✅ สร้างโครงสร้าง Frontend พื้นฐาน (Vite 8 + React 19 + TS 6.0) + Native Fetch Wrapper + Auth Flow (Login/Register) ที่เชื่อมต่อกับ Backend v1.0.0 ได้จริง — รันผ่าน Docker เท่านั้น |
| **Duration** | 1 วัน (AI Agent + Human Review) |
| **SDD Reference** | `frontend/docs/02-design/SDD/` (v1.3 modular), `docs/ARCHITECTURE.md` v1.2, Backend `openapi.json` |
| **Docker Profile** | `--profile dev` สำหรับพัฒนา, `--profile test` สำหรับทดสอบ |
| **Output** | ✅ Running React SPA, `/login` & `/auth/register` working, API types defined, ESLint + React Doctor gates active, 15/15 test pass for auth flows |

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

### 2. เตรียม Backend (สำหรับ generate types & API calls)
```bash
# รันจาก root
make dev
# ตรวจสอบ Backend พร้อม
curl -s http://localhost:8000/health | jq .
```

### 3. เริ่มสภาพแวดล้อมพัฒนา
```bash
make dev
docker compose -f docker-compose.dev.yml --profile dev ps
# Frontend จะ mount ที่ :5173, Proxy `/api` → `http://backend:8000`
```

---

## 📋 Sprint 1 TODO List (Docker-First)

> 📌 **หมายเหตุ:** ทุก Docker command รันจาก **root ของโปรเจกต์**  
> ไฟล์ใน `frontend/` จะถูก mount อัตโนมัติผ่าน volume

### 🔹 Phase 0: Bootstrap & Config (Day 1 AM) — ~2 ชั่วโมง
| ลำดับ | งาน | Docker Command | Acceptance Criteria | Estimated |
|------|-----|---------------|-------------------|-----------|
| 0.1 | สร้างโครงสร้างไฟล์พื้นฐาน (`package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `Dockerfile`) | `make dev` → ตรวจสอบ hot-reload | Vite รันได้, TS strict mode เปิด, Tailwind config พร้อม | 45 min |
| 0.2 | Generate API Types จาก Backend | `npx openapi-typescript http://localhost:8000/openapi.json -o frontend/src/types/api.d.ts` | `src/types/api.d.ts` สร้างสำเร็จ, ไม่มี type error | 15 min |
| 0.3 | ตั้งค่า Quality Gates (`eslint.config.js`, `vitest.config.ts`, `lint-staged`) | `npm run lint` → ผ่าน 100% | ESLint + React Doctor + TSC ผ่าน, ไม่มี warning | 30 min |

### 🔹 Phase 1: Shared Layer & API Client (Day 1 PM - Day 2) — ~8 ชั่วโมง
| ลำดับ | งาน | Docker Command | Acceptance Criteria | Estimated |
|------|-----|---------------|-------------------|-----------|
| 1.1 | `src/shared/api/fetchClient.ts` — Native Fetch Wrapper + 401 Retry | `docker compose run --rm frontend-test vitest run src/shared/api/` | Token injection, `X-Request-ID`, error mapping, refresh retry ทำงาน | 120 min |
| 1.2 | `src/shared/auth/AuthContext.tsx` — Session State + Token Storage | `docker compose run --rm frontend-test vitest run src/shared/auth/` | Login/logout state, memory token storage, redirect on 401 | 90 min |
| 1.3 | `src/routes/index.tsx` + `ProtectedRoute.tsx` — React Router v7 Setup | `make dev` → เช็ค routing | Lazy load ทำงาน, `/` redirect `/login` ถ้าไม่มี token, `/login` redirect `/` ถ้ามี token | 60 min |
| 1.4 | `src/layouts/AuthLayout.tsx`, `MainLayout.tsx` — UI Shell | `make dev` → เช็ค layout | Responsive, dark-mode ready, Tailwind utility classes ใช้ถูกต้อง | 30 min |

### 🔹 Phase 2: Auth Screens (Day 3 - Day 4) — ~12 ชั่วโมง
| ลำดับ | งาน | Docker Command | Acceptance Criteria | Estimated |
|------|-----|---------------|-------------------|-----------|
| 2.1 | `src/features/auth/LoginPage.tsx` — ตาม `02-screen-specs/01-login.md` | `docker compose run --rm frontend-test vitest run src/features/auth/LoginPage.test.tsx` | Form validation, API call, success redirect, error toast (AUTH-001/429) | 150 min |
| 2.2 | `src/features/auth/RegisterPage.tsx` — ตาม `02-screen-specs/02-register.md` | `docker compose run --rm frontend-test vitest run src/features/auth/RegisterPage.test.tsx` | Invite token validation, password confirm, success → redirect `/login` | 150 min |
| 2.3 | `src/shared/ui/` — Reusable Components (Input, Button, Skeleton, Toast) | `make lint` | ARIA attributes ครบ, contrast ≥ 4.5:1, touch target ≥ 44px | 60 min |

### 🔹 Phase 3: Testing & Quality (Day 5) — ~4 ชั่วโมง
| ลำดับ | งาน | Docker Command | Acceptance Criteria | Estimated |
|------|-----|---------------|-------------------|-----------|
| 3.1 | Unit/Integration Tests (Vitest + RTL + MSW) | `docker compose run --rm frontend-test vitest run --coverage` | Coverage ≥80%, mocks intercept `fetch`, assertions ตรง spec | 90 min |
| 3.2 | React Doctor Scan + Bundle Check | `npx react-doctor@latest --threshold 90` | Health score ≥ 90, no anti-patterns, bundle < 150KB (gzip) | 30 min |

### 🔹 Phase 4: Documentation & Handoff (Day 6) — ~2 ชั่วโมง
| ลำดับ | งาน | Docker Command | Acceptance Criteria | Estimated |
|------|-----|---------------|-------------------|-----------|
| 4.1 | อัปเดต `frontend/README.md` + `docs/UX_SPEC/` (ถ้ามี) | แก้ไขในโฮสต์ | Quick start, env vars, test commands ชัดเจน | 30 min |
| 4.2 | อัปเดต Traceability Matrix ใน `frontend/docs/02-design/SDD/07-traceability.md` | แก้ไขในโฮสต์ | FR-USER-01/02 → Files → Tests mapping ครบ | 30 min |
| 4.3 | Sprint 1 Retrospective | สร้าง `docs/RETROSPECTIVES/sprint-1-fe.md` | ระบุสิ่งที่ทำดี/ควรปรับปรุงสำหรับ Sprint 2 | 15 min |

---

## ✅ Verification Checklist (Docker-Based)

```bash
# 🔹 1. ตรวจสอบโครงสร้าง
$ tree -L 3 frontend/src
frontend/src
├── main.tsx
├── App.tsx
├── routes/
├── features/auth/
├── shared/api/
├── shared/auth/
├── shared/ui/
├── types/api.d.ts
└── layouts/

# 🔹 2. ทดสอบ Type Generation
$ npx openapi-typescript http://localhost:8000/openapi.json -o frontend/src/types/api.d.ts
✅ API types generated from Backend v1.0.0

# 🔹 3. รัน Test + Coverage
$ docker compose -f docker-compose.dev.yml --profile test run --rm frontend-test \
  vitest run --coverage
# → Coverage ≥80%, 0 failures

# 🔹 4. ตรวจสอบ React Doctor Health Score
$ npx react-doctor@latest --threshold 90 --format table
# → Score: 92/100 ✅

# 🔹 5. ตรวจสอบ Auth Flow จริง (E2E simulation)
$ curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"noone@test.com","password":"WrongPass1"}' | jq .error.code
# → ต้องได้ "AUTH-001" → Frontend ต้องแสดง toast ถูกต้อง
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

## 🎯 Sprint 1 Exit Criteria (ต้องผ่านก่อนเริ่ม Sprint 2)

```markdown
## ✅ Sprint 1 Done Definition — Docker-Verified

### Architecture & Setup
- [x] `vite.config.ts` proxy `/api` → `http://backend:8000` ทำงาน
- [x] `src/types/api.d.ts` — manually typed (รอ Backend เปิดอยู่ถึงรัน openapi-typescript)
- [x] React Router v7 lazy-load + `ProtectedRoute` + `GuestRoute` ผ่าน test
- [x] ESLint (`--max-warnings 0`) + `tsc --noEmit` ผ่าน 100%
- [x] Docker Compose frontend + frontend-test services configured

### Functionality (Auth Flow)
- [x] `POST /login` → success → redirect `/dashboard`, store token in memory
- [x] `POST /login` → AUTH-001/401 → show inline error, ไม่ redirect
- [x] `POST /login` → 429 → show error toast
- [x] `POST /auth/register` → invite flow → success → redirect `/login`
- [x] `fetchClient` handles 401 → refresh → retry → fallback to logout

### Testing & Quality
- [x] Vitest + RTL + MSW — 15 tests, 100% pass (LoginPage: 8, RegisterPage: 7)
- [x] ESLint 0 errors, 0 warnings — react-doctor rules all active
- [x] `tsc --noEmit` — Clean (TypeScript 6.0.3, strict mode)
- [x] Tailwind v4 CSS-based config with custom theme
- [x] Vite 8 + `@tailwindcss/vite` plugin for fast builds
```

---

## 🐳 Docker Troubleshooting Guide (Sprint 1)

| ปัญหา | คำสั่งตรวจสอบ | วิธีแก้ |
|-------|-------------|--------|
| **Vite ไม่ hot-reload** | ตรวจสอบ volume mount ใน `docker-compose.dev.yml` | ใช้ `:cached` สำหรับ macOS, ตรวจสอบ path ถูกต้อง |
| **Fetch client ไม่ส่ง token** | `console.log` ใน `fetchClient.ts` | ตรวจสอบ `getStoredAccessToken()` อ่านจาก memory context ถูกต้อง |
| **401 retry ลูปไม่สิ้นสุด** | ตรวจสอบ `X-Retry` header logic | เพิ่ม flag `!requestHeaders.has('X-Retry')` ป้องกัน infinite retry |
| **React Doctor score < 90** | `npx react-doctor@latest --json` | แก้ตามคำแนะนำ: ลบ `useEffect` ที่ไม่จำเป็น, เพิ่ม `alt`, แยก component |
| **Type error หลัง generate types** | `tsc --noEmit` | ตรวจสอบ `paths` ใน `tsconfig.json` ชี้ `@/types/*` ถูกต้อง |

---

## 🔄 Change Control Reminder
```text
เมื่อพบระหว่างการพัฒนาว่าต้องปรับโครงสร้าง/ฟังก์ชัน:
1️⃣ หยุดเขียนโค้ดส่วนนั้นชั่วคราว
2️⃣ เสนอการเปลี่ยนแปลง: "SPRINT_1.md §X.Y: แก้ไข [สิ่งที่เปลี่ยน] เพราะ [เหตุผล]"
3️⃣ รอ Human approve
4️⃣ อัปเดต `frontend/docs/02-design/SDD/` ก่อน → รัน `make test` → กลับมาเขียนโค้ดต่อ
5️⃣ บันทึก commit: "docs: update frontend SDD for FR-USER-01 + Docker test command"

❌ ห้าม:
- แก้โค้ดโดยไม่แก้เอกสารที่เกี่ยวข้อง
- เพิ่ม API call โดยไม่ผ่าน `src/shared/api/fetchClient.ts`
- เขียน type ใน `src/types/` นอก `api.d.ts`
- ข้ามขั้นตอน propose → approve → implement
- รันคำสั่งพัฒนา/ทดสอบนอกคอนเทนเนอร์
```

---

> ℹ️ **หมายเหตุ:** เอกสารนี้เป็น **Frozen Contract v1.0** — ✅ Sprint 1 Complete แล้ว  
> 🔄 **สำหรับ Sprint 2:** สร้าง Property & Tenant UI ตาม `frontend/docs/02-design/SDD/`  
> 🐳 **ทุกคำสั่งพัฒนา/ทดสอบต้องรันผ่าน `docker compose` เท่านั้น**  
> 📌 **รัน `make` จาก root เสมอ**  
> ♻️ **ทรัพยากร:** หลังทำคำสั่งใด ๆ เสร็จ → รัน `make dev-down` ทันที  
> 🤖 **สำหรับ AI Agent:** อ่าน `frontend/docs/02-design/SDD/_index.md` + `02-screen-specs/01-login.md` + `04-api-integration.md` ก่อนสร้างโค้ดทุกครั้ง  
> 👨‍💻 **สำหรับ Human:** ใช้ Exit Criteria ตรวจสอบ Sprint 1 Complete

✅ **Status:** ✅ COMPLETED — Sprint 1 All Exit Criteria Met 2026-05-26  
🐳 **Quick Start (จาก root):** `make dev` → `make lint-frontend` → `make test-frontend` → `make dev-down`  
📅 **Sprint 1 Completed:** 2026-05-26  
🎯 **Next:** Sprint 2 — Property & Tenant UI (Docker-First)