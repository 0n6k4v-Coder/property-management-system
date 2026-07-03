# Sprint 6 Implementation Plan — Frontend (PWA Polish + E2E + Prod Hardening)

**Frozen Contract v1.0** — Effective Date: 2026-07-06  
**Status:** ✅ COMPLETED — All Exit Criteria Verified 2026-07-06
**Last Updated:** 2026-07-06

---

## 🎯 Sprint Overview

| Attribute | Value |
|-----------|-------|
| **Sprint Goal** | ดำเนินการทดสอบ E2E 3 โฟลว์หลัก, ปรับแต่ง PWA Service Worker สำหรับ Production, ตรวจสอบประสิทธิภาพ Bundle (≤150KB gzip) + Lighthouse CI ≥90, ตรวจสอบ Accessibility 0 violations และสร้างเอกสาร `README.md` สำหรับส่งมอบ — รันผ่าน Docker เท่านั้น |
| **Duration** | 5-7 วันทำงาน |
| **SDD Reference** | `frontend/docs/02-design/SDD/` v1.3 (modular), `05-diagrams.md`, `06-testing-quality.md`, `07-traceability.md`, `08-implementation.md` |
| **Docker Profile** | `--profile dev` สำหรับพัฒนา, `--profile test` สำหรับทดสอบ E2E |
| **Output** | Playwright E2E suite (3 flows), Lighthouse CI config, Bundle analysis report, A11y audit clean, Production-ready Service Worker, `README.md` complete, 100% quality gates pass |

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

### 2. เตรียม Backend & Frontend Dev
```bash
make dev
curl -s http://localhost:8000/health | jq .
cd frontend && npm run dev
```

### 3. เริ่มสภาพแวดล้อมทดสอบ
```bash
make dev
docker compose -f docker-compose.dev.yml --profile test ps
# Frontend test container พร้อมรัน Playwright + Lighthouse CI
```

---

## 📋 Sprint 6 TODO List (Docker-First)

> 📌 **หมายเหตุ:** ทุก Docker command รันจาก **root ของโปรเจกต์**  
> โฟกัสที่ **Testing, Optimization, Documentation** — ห้ามเพิ่มฟีเจอร์ UI ใหม่

### 🔹 Phase 0: E2E Setup & Playwright Config (Day 1 AM) — ~2 ชั่วโมง
| ลำดับ | งาน | Docker Command | Acceptance Criteria | Estimated |
|------|-----|---------------|-------------------|-----------|
| 0.1 | ติดตั้ง `@playwright/test` + `playwright` browsers | `npx playwright install --with-deps` | Playwright config สร้างใน `playwright.config.ts`, target `http://localhost:5173` | 45 min |
| 0.2 | สร้าง `frontend/e2e/` โครงสร้าง | `mkdir -p e2e/specs` | ไฟล์เตรียมพร้อมสำหรับ 3 critical flows | 15 min |
| 0.3 | อัปเดต `docker-compose.dev.yml` (test profile) | เพิ่ม volume mount สำหรับ `playwright-report` | รันเทสต์ผ่าน container ได้, report เก็บในโฮสต์ | 30 min |

### 🔹 Phase 1: PWA Production Hardening (Day 1 PM - Day 2) — ~6 ชั่วโมง
| ลำดับ | งาน | Docker Command | Acceptance Criteria | Estimated |
|------|-----|---------------|-------------------|-----------|
| 1.1 | ปรับ `src/shared/pwa/service-worker.ts` สำหรับ prod | `vite build` → ตรวจสอบ cache strategies | ใช้ `CacheFirst` สำหรับ static assets, `NetworkFirst` สำหรับ API, fallback offline page | 120 min |
| 1.2 | เพิ่ม `src/pwa/manifest.json` + `theme-color` | `npm run lint` → ผ่าน | App icon, short_name, start_url, display: standalone, iOS meta tags | 60 min |
| 1.3 | Setup `@vitejs/plugin-pwa` (optional) หรือ manual inject | `vite preview` → ตรวจสอบ Lighthouse PWA score | Service Worker register, manifest valid, offline fallback working | 60 min |

### 🔹 Phase 2: E2E Critical Flows (Day 3 - Day 4) — ~10 ชั่วโมง
| ลำดับ | งาน | Docker Command | Acceptance Criteria | Estimated |
|------|-----|---------------|-------------------|-----------|
| 2.1 | `e2e/specs/auth-flow.spec.ts` | `docker compose run --rm frontend-test npx playwright test e2e` | Login → Protected route redirect → Dashboard load | 90 min |
| 2.2 | `e2e/specs/meter-offline-sync.spec.ts` | `docker compose run --rm frontend-test npx playwright test e2e` | Fill form → throttle network → submit → online → sync verify | 120 min |
| 2.3 | `e2e/specs/invoice-payment.spec.ts` | `docker compose run --rm frontend-test npx playwright test e2e` | Open invoice → record payment → status update → toast success | 120 min |

### 🔹 Phase 3: Performance, Bundle & Accessibility (Day 5) — ~6 ชั่วโมง
| ลำดับ | งาน | Docker Command | Acceptance Criteria | Estimated |
|------|-----|---------------|-------------------|-----------|
| 3.1 | ติดตั้ง `rollup-plugin-visualizer` | `npm run build` → ตรวจสอบ `stats.html` | Initial bundle ≤ 150KB (gzip), dynamic imports ทำงาน, no unused chunks | 60 min |
| 3.2 | Setup `lighthouse-ci` script | `lhci autorun` → ตรวจสอบ report | Performance ≥90, Accessibility ≥100, Best Practices ≥90 | 90 min |
| 3.3 | A11y Audit & Fix | `npx axe-playwright` ใน E2E tests | 0 violations, keyboard nav complete, contrast ≥ 4.5:1, ARIA correct | 90 min |

### 🔹 Phase 4: Documentation & Handoff (Day 6) — ~4 ชั่วโมง
| ลำดับ | งาน | Docker Command | Acceptance Criteria | Estimated |
|------|-----|---------------|-------------------|-----------|
| 4.1 | สร้าง `frontend/README.md` | แก้ไขในโฮสต์ | Quick start, env vars, scripts, testing commands, architecture overview | 90 min |
| 4.2 | อัปเดต Traceability Matrix + Sprint 6 Retro | แก้ไข `07-traceability.md`, สร้าง `docs/RETROSPECTIVES/sprint-6-fe.md` | Mapping ครบ, lessons learned บันทึก | 45 min |

---

## ✅ Verification Checklist (Docker-Based)

```bash
# 🔹 1. ตรวจสอบ E2E Tests
$ docker compose -f docker-compose.dev.yml --profile test run --rm frontend-test \
  npx playwright test --reporter=html
# → 3/3 flows pass

# 🔹 2. ตรวจสอบ Bundle Size
$ cd frontend && npm run build
$ ls -lh dist/assets/*.js | grep -E "vendor|index"
# → Initial chunks ≤ 150KB gzip

# 🔹 3. ตรวจสอบ Lighthouse Score
$ npx lhci autorun --upload.target=temporary-public-storage
# → Performance: ≥90, A11y: ≥100

# 🔹 4. ตรวจสอบ PWA Offline
$ curl -s http://localhost:5173/manifest.json | jq .short_name
# → แสดงชื่อ app, service-worker registered in prod build

# 🔹 5. 🔴 ปิดทรัพยากรทันทีเมื่อเสร็จ (ตามนโยบาย)
make dev-down
```

---

## 🚀 Quick Start Commands (Docker-Only — รันจาก root)

```bash
make dev                          # เริ่มเฉพาะเมื่อจำเป็น
make test-e2e                     # รัน Playwright tests
make lint                         # ESLint + React Doctor + TSC
make build                        # ตรวจสอบ production build + bundle
make dev-down                     # 🔴 ปิดทันทีเมื่อเสร็จ
```

---

## 🎯 Sprint 6 Exit Criteria (ต้องผ่านก่อนประกาศ Release)

```markdown
## ✅ Sprint 6 Done Definition — Docker-Verified

### E2E & Testing
- [x] Playwright 3 critical flows pass 100% (auth, meter offline, invoice payment)
- [x] A11y audit: 0 violations (axe-core), keyboard navigation complete, contrast ≥ 4.5:1
- [x] Lighthouse CI: Performance ≥90, Accessibility 100, Best Practices ≥90

### Performance & PWA
- [x] Initial JS bundle ≤ 150KB (gzip), dynamic imports สำหรับ charts/reports ทำงาน
- [x] Service Worker ใช้ cache strategy ถูกต้อง (static: CacheFirst, api: NetworkFirst)
- [x] `manifest.json` valid, iOS meta tags ครบ, offline fallback page แสดงผล

### Documentation & Handoff
- [x] `frontend/README.md` ครบถ้วน (setup, scripts, testing, architecture)
- [x] Traceability Matrix อัปเดตครบทุก FR/Screen/Test
- [x] Sprint 6 Retrospective บันทึก lessons learned
- [x] **ทรัพยากรปิดเรียบร้อย:** `make dev-down` รันแล้ว — ไม่มีคอนเทนเนอร์ค้าง
```

---

## 🐳 Docker Troubleshooting Guide (Sprint 6)

| ปัญหา | คำสั่งตรวจสอบ | วิธีแก้ |
|-------|-------------|--------|
| **Playwright browsers ไม่โหลดใน container** | `npx playwright install --with-deps` | ใช้ official `mcr.microsoft.com/playwright:v1.50.0-jammy` base image |
| **Bundle เกิน 150KB** | `npx vite-bundle-visualizer` | ตรวจสอบ static imports, เปลี่ยนเป็น `React.lazy()`, tree-shake unused exports |
| **Lighthouse A11y fail** | `lhci autorun --view` | เพิ่ม `alt`, `aria-label`, `role`, focus management, contrast fix |
| **SW ไม่ cache ใน prod** | ตรวจสอบ `workbox` routing หรือ manual cache events | ใช้ `self.skipWaiting()` + `clientsClaim()`, ตรวจสอบ scope/path |
| **E2E throttle network ไม่ทำงาน** | ตรวจสอบ `page.route()` หรือ `context.setOffline()` | ใช้ `page.route('**/api/**', route => route.abort())` สำหรับจำลอง offline |

---

## 🔄 Change Control Reminder
```text
เมื่อพบระหว่างการพัฒนาว่าต้องปรับโครงสร้าง/ฟังก์ชัน:
1️⃣ หยุดเขียนโค้ดส่วนนั้นชั่วคราว
2️⃣ เสนอการเปลี่ยนแปลง: "SPRINT_6.md §X.Y: แก้ไข [สิ่งที่เปลี่ยน] เพราะ [เหตุผล]"
3️⃣ รอ Human approve
4️⃣ อัปเดต `frontend/docs/02-design/SDD/` ก่อน → รัน `make test` → กลับมาเขียนโค้ดต่อ
5️⃣ บันทึก commit: "docs: update frontend SDD for FR-METER-01 e2e + Docker test command"

❌ ห้าม:
- เพิ่มฟีเจอร์ UI ใหม่ใน Sprint 6
- แก้โค้ดโดยไม่แก้เอกสารที่เกี่ยวข้อง
- ข้าม E2E/A11y/Lighthouse quality gates
- รันคำสั่งพัฒนา/ทดสอบนอกคอนเทนเนอร์
```

---

> ℹ️ **หมายเหตุ:** เอกสารนี้เป็น **Frozen Contract** — ห้ามแก้ไขโดยไม่ผ่านกระบวนการเปลี่ยนแปลง  
> 🔄 **เปลี่ยนอะไรในโค้ด → อัปเดต SDD + Traceability + Tests**  
> 🐳 **ทุกคำสั่งพัฒนา/ทดสอบต้องรันผ่าน `docker compose` เท่านั้น**  
> 📌 **รัน `make` จาก root เสมอ**  
> ♻️ **ทรัพยากร:** หลังทำคำสั่งใด ๆ เสร็จ → รัน `make dev-down` ทันที  
> 🤖 **สำหรับ AI Agent:** อ่าน `frontend/docs/02-design/SDD/_index.md` + `05-diagrams.md` + `06-testing-quality.md` + `08-implementation.md` ก่อนสร้างโค้ดทุกครั้ง  
> 👨‍💻 **สำหรับ Human:** ใช้ Exit Criteria อนุมัติ Sprint 6 + Troubleshooting Guide เมื่อพบปัญหา

✅ **Status:** ✅ COMPLETED — All Exit Criteria Verified 2026-07-06  
🐳 **Quick Start (จาก root):** `make dev` → `make lint` → `make test-e2e` → `make dev-down`  
📅 **Sprint 6 Start Date:** 2026-07-06  
📅 **Sprint 6 Completion Date:** 2026-07-06  
🎯 **Next:** v1.0.0 Release & Production Deployment