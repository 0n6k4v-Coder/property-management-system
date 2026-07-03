# File: frontend/docs/02-design/SDD/00-overview.md
# Frontend Software Design Document (SDD)
## Property Management System (Client-Side)

**Document ID:** SDD-FE-PMS-001
**Version:** 1.3
**Status:** ✅ Implemented — All Sprints (1–6) Complete
**Date:** 2026-05-24
**Author:** Technical Architecture Team
**Approvers:** [Frontend Lead], [Product Owner], [QA Lead]
**Input Documents:** `docs/SDD.md` (v1.3), `docs/ARCHITECTURE.md` (v1.2), `openapi.json`, `frontend/docs/ARCHITECTURE.md`

---

## Table of Contents

1. [Introduction](#1-introduction)
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

## 1. Introduction

### 1.1 Purpose
เอกสารนี้ออกแบบรายละเอียดการนำไปปฏิบัติ (Implementation Blueprint) สำหรับส่วนหน้า (Client-Side) ของระบบจัดการหอพัก โดยเน้นสถาปัตยกรรม React SPA + PWA, การจัดการ State, การเชื่อมต่อ API แบบ Native `fetch`, และกลยุทธ์ Offline Sync เพื่อให้ทีม Frontend และ AI Agent พัฒนาได้ตรงตามสัญญา (Contract) ที่กำหนดไว้กับ Backend

### 1.2 Scope
| ด้าน | ขอบเขตเฟส 1 (MVP) | หมายเหตุ |
|------|------------------|----------|
| **แพลตฟอร์ม** | React 19 + TypeScript 5.8 + Vite 8 | SPA + PWA (Mobile-First) |
| **Routing** | React Router v7 | Lazy-loaded per feature, Auth Guards, Sub-routes |
| **State Management** | TanStack Query (Server) + React Context (Client) + `idb` (Offline) | ไม่ใช้ Redux/Zustand ในเฟส 1 |
| **Styling** | Tailwind CSS 4 + CSS Variables | Utility-first, responsive, dark-mode ready |
| **API Integration** | Native `fetch` API + Custom Wrapper | Contract-First, Type-Safe, Zero third-party HTTP client |
| **Out of Scope** | Backend Logic, Database, Admin Panel, Multi-tenant UI | จะพัฒนาในเฟส 2+ |

### 1.3 References
| เอกสาร | เวอร์ชัน | ตำแหน่ง |
|--------|---------|---------|
| Backend SDD | v1.3 | `docs/SDD.md` |
| System Architecture | v1.2 | `docs/ARCHITECTURE.md` |
| API Contract (SSOT) | Auto-gen | `http://localhost:8000/openapi.json` |
| Frontend Architecture | v1.0 | `frontend/docs/ARCHITECTURE.md` |