# File: frontend/docs/02-design/SDD/_index.md
# Frontend Software Design Document (SDD) — Table of Contents
## Property Management System (Client-Side)

**Document ID:** SDD-FE-PMS-001
**Version:** 1.3
**Status:** ✅ Implemented — All Sprints (1–6) Complete
**Date:** 2026-05-24
**Author:** Technical Architecture Team
**Approvers:** [Frontend Lead], [Product Owner], [QA Lead]
**Input Documents:** `docs/SDD.md` (v1.3), `docs/ARCHITECTURE.md` (v1.2), `openapi.json`, `frontend/docs/ARCHITECTURE.md`

---

## Quick Navigation

| # | File | Content |
|---|------|---------|
| 1 | [00-overview.md](00-overview.md) | Document Control + Introduction (Purpose, Scope, References) |
| 2 | [01-architecture.md](01-architecture.md) | Information Architecture + Frontend Architecture & Layering |
| 3 | [02-screen-specs.md](02-screen-specs.md) | Screen/View Specifications (11 screens: SCR-LOGIN → SCR-404/500) |
| 4 | [03-state-data-flow.md](03-state-data-flow.md) | State & Data Flow Design |
| 5 | [04-api-integration.md](04-api-integration.md) | API Integration Contract (Native Fetch) |
| 6 | [05-diagrams.md](05-diagrams.md) | UML/Design Diagrams (Client-Side) |
| 7 | [06-testing-quality.md](06-testing-quality.md) | Testing & Quality Strategy |
| 8 | [07-traceability.md](07-traceability.md) | Traceability Matrix (FR/NFR → Screen → Test) |
| 9 | [08-implementation.md](08-implementation.md) | Implementation Checklist & Change Control |

---

## AI Usage Guide

เมื่ออ่านเอกสารนี้ ให้เริ่มตามลำดับดังนี้:
1. **เริ่มที่ `00-overview.md`** — ทำความเข้าใจ Purpose, Scope, Tech Stack
2. **อ่าน `01-architecture.md`** — รู้โครงสร้าง Navigation + Layered Architecture
3. **ดู `02-screen-specs.md`** — สำหรับ UI Contracts ของแต่ละหน้าที่ต้องสร้าง
4. **ศึกษ `04-api-integration.md`** — สำหรับ Native Fetch wrapper และ Error Mapping
5. **อ้างอิง `07-traceability.md`** — เพื่อ map FR/Test Files ไปยังแต่ละ screen

---

## Table of Contents (Original)

1. [Introduction](00-overview.md)
2. [Information Architecture & Navigation Flow](01-architecture.md)
3. [Screen/View Specifications (UI Contracts)](02-screen-specs.md)
4. [Frontend Architecture & Layering](01-architecture.md)
5. [State & Data Flow Design](03-state-data-flow.md)
6. [API Integration Contract (Native Fetch)](04-api-integration.md)
7. [UML/Design Diagrams (Client-Side)](05-diagrams.md)
8. [Testing & Quality Strategy](06-testing-quality.md)
9. [Traceability Matrix (Frontend)](07-traceability.md)
10. [Implementation Checklist & Change Control](08-implementation.md)

---

## Pre-Implementation Checklist

- [ ] `openapi.json` generate สำเร็จ → `src/types/api.d.ts` ตรง spec
- [ ] `fetchClient.ts` + error mapper ทำงาน (attach token, 401 refresh retry, error mapping)
- [ ] React Router v7 config + `ProtectedRoute` ผ่าน test
- [ ] `useAuth` hook เก็บ/ลบ token ได้, redirect ถูกต้อง
- [ ] ทุกหน้าใน §2.2 มี `React.lazy()` wrapper ใน `routes/index.tsx`
- [ ] โครงสร้าง `features/` เริ่มแบบ Flat ตาม §4.3
- [ ] Vite build, ESLint, TSC, Vitest ผ่าน 100% ใน local
- [ ] MSW mock setup สำหรับ dev mode (ดัก native `fetch` อัตโนมัติ)