# Software Architecture Document (SAD)
## Property Management System

**Document ID:** SAD-PMS-001  
**Version:** 1.2  
**Status:** Approved — Ready for SDD Development  
**Date:** 2026-05-24  
**Author:** Technical Architecture Team  
**Approvers:** [Owner], [Tech Lead]

---

## Document Control

| Version | Date | Author | Changes | Approver |
|---------|------|--------|---------|----------|
| 1.2 | 2026-05-24 | Architecture Team | Updated Sec 5 (Backend + Frontend patterns, boundary rules); Updated Sec 7.1 Conceptual Model alignment with DOMAIN_MODEL.md; Added Partial Index examples + Cache Invalidation scope clarification; Added Evolution Path guidance | [Pending] |
| 1.1 | 2026-05-24 | Architecture Team | Added Frontend Architecture to Sec 5; Fixed FR ID format (2-digit); Updated Context Diagram (Pragmatic C4) | [Pending] |
| 1.0 | 2026-05-24 | Architecture Team | Initial release (Traditional SE format) | [Pending] |
| 0.3 | 2026-05-24 | AI Proposal | Draft architecture proposal | — |
| 0.1 | 2026-05-18 | Requirements Team | Domain discovery baseline | Owner |

**Distribution:** Development Team, QA Team, DevOps, Product Owner

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Architectural Goals & Constraints](#2-architectural-goals--constraints)
3. [System Context (C4 Level 1)](#3-system-context-c4-level-1)
4. [Container Architecture (C4 Level 2)](#4-container-architecture-c4-level-2)
5. [Architecture Pattern & Style](#5-architecture-pattern--style)
6. [Technology Stack Decisions](#6-technology-stack-decisions)
7. [Data Architecture](#7-data-architecture)
8. [Security Architecture](#8-security-architecture)
9. [Deployment Architecture](#9-deployment-architecture)
10. [Cross-Cutting Concerns](#10-cross-cutting-concerns)
11. [Architecture Decision Records (ADRs)](#11-architecture-decision-records-adrs)
12. [Risks & Mitigations](#12-risks--mitigations)
13. [Appendix](#13-appendix)

---

## 1. Introduction

### 1.1 Purpose
เอกสารนี้อธิบายสถาปัตยกรรมระดับสูงของระบบจัดการหอพัก (Property Management System) เพื่อเป็นกรอบการตัดสินใจทางเทคนิคสำหรับทีมพัฒนา และอ้างอิงในการออกแบบรายละเอียด (SDD) และการนำไปปฏิบัติ (Implementation)

### 1.2 Scope
**ระบบนี้ครอบคลุม:**
- ✅ การจัดการโครงสร้างทรัพย์สิน: Property → Building → Floor (optional) → Room
- ✅ การจัดการผู้เช่า (Tenant): ข้อมูลส่วนตัว, ประวัติการเช่า, เอกสาร
- ✅ การจัดการสัญญาเช่า: สร้าง, ต่ออายุ, ยกเลิก, แจ้งเตือนหมดอายุ
- ✅ การบันทึกมิเตอร์และคำนวณบิล: Meter Reading, Utility Rate Cascade, Invoice Generation
- ✅ การติดตามการชำระเงิน: รับเงิน, สถานะบิล, รายงานค้างชำระ
- ✅ Dashboard และรายงาน: ภาพรวมธุรกิจ, รายได้, ผู้เช่าค้างชำระ
- ✅ การบำรุงรักษา: บันทึกและติดตามงานซ่อม

**ระบบนี้ไม่ครอบคลุม (Out of Scope):**
- ❌ Tenant Portal / Tenant Login
- ❌ Role-Based Access Control (RBAC) แบบละเอียด — มีเพียง Owner role
- ❌ ระบบจองห้องออนไลน์สำหรับสาธารณะ
- ❌ Payment Gateway (การชำระเงินออนไลน์)
- ❌ Native Mobile Application
- ❌ ระบบบัญชีรายจ่าย (Expense Tracking)
- ❌ กล้องวงจรปิด / Access Control Hardware Integration
- ❌ Multi-tenant SaaS (Shared Instance) — เป็น Future Scope

### 1.3 Definitions, Acronyms, and Abbreviations

| Term | Definition |
|------|-----------|
| PMS | Property Management System — ระบบจัดการหอพัก |
| Owner | ผู้ใช้งานระบบ: เจ้าของหอพัก (มีสิทธิ์เต็ม) |
| Tenant | ผู้เช่าห้องพัก (ไม่ใช่ผู้ใช้งานระบบในเฟส 1) |
| NFR | Non-Functional Requirement — ข้อกำหนดที่ไม่ใช่ฟังก์ชัน |
| ADR | Architecture Decision Record — บันทึกการตัดสินใจทางสถาปัตยกรรม |
| SDD | Software Design Document — เอกสารออกแบบรายละเอียด |
| C4 Model | Context, Containers, Components, Code — รูปแบบวาดไดอะแกรมสถาปัตยกรรม |
| FR | Functional Requirement — ข้อกำหนดฟังก์ชัน (อ้างอิง REQUIREMENTS.md) |

### 1.4 References
| Document ID | Title | Version | Location |
|-------------|-------|---------|----------|
| REQ-001 | Software Requirements Specification | 1.0 | `docs/REQUIREMENTS.md` |
| US-001 | User Stories | 1.0 | `docs/USER_STORIES.md` |
| DOM-001 | Domain Model | 1.0 | `docs/DOMAIN_MODEL.md` |
| GLO-001 | Glossary | 1.0 | `docs/GLOSSARY.md` |
| AGT-001 | AI Agent Guidelines | 1.0 | `AGENTS.md` |

---

## 2. Architectural Goals & Constraints

### 2.1 Business Goals
| Goal ID | Description | Success Metric |
|---------|-------------|---------------|
| BG-01 | ลดเวลาการจดมิเตอร์และสร้างบิล | จาก 3 วัน → 3 ชั่วโมงต่อ 50 ห้อง |
| BG-02 | รองรับหอพักทุกรูปแบบโดยไม่ต้องแก้โค้ด | เพิ่ม Property ใหม่ได้ภายใน 15 นาที |
| BG-03 | ใช้งานบนมือถือได้สะดวกขณะเดินจดมิเตอร์ | Mobile UX Score > 90 (Lighthouse) |
| BG-04 | ติดตั้งได้ทั้งแบบ Self-hosted และ Cloud | Deploy script ทำงานสำเร็จใน 3 โหมด |

### 2.2 Quality Attributes (Non-Functional Requirements)

| Attribute | Target | Measurement Method | Priority |
|-----------|--------|-------------------|----------|
| **Performance** | Dashboard < 2s, Meter save < 1s, Bulk invoice < 5s | Load test, p95 latency monitoring | High |
| **Security** | ID card encrypt at rest, JWT auth, audit log sensitive ops | Penetration test, code review, compliance check | High |
| **Portability** | Run on any Docker-capable host (2GB RAM minimum) | Deploy test on 3 different environments | High |
| **Maintainability** | New developer onboard < 1 day, modular structure | Documentation completeness, code review feedback | Medium |
| **Scalability** | Support 2 → 10+ properties (~47 → 500 rooms) | Load test with increasing data volume | Medium |
| **Availability** | 99.5% uptime for Cloud mode | Monitoring SLA tracking | Medium |
| **Usability** | Responsive: Desktop/Tablet/Mobile equal priority | UX testing, accessibility audit | High |

### 2.3 Technical Constraints
| Constraint ID | Description | Rationale |
|--------------|-------------|-----------|
| TC-01 | ต้องใช้เทคโนโลยี Open Source เท่านั้น | หลีกเลี่ยง vendor lock-in, ลดต้นทุน, รองรับ Self-hosted |
| TC-02 | ต้องรองรับ Self-hosted บน VPS 2GB RAM | ลูกค้ากลุ่มเป้าหมายมีทรัพยากรจำกัด |
| TC-03 | ทีมพัฒนา ≤ 3 คนในระยะแรก | เลือกเทคโนโลยีที่เรียนรู้เร็ว, AI codegen friendly |
| TC-04 | ต้องใช้ Docker สำหรับ deployment ทั้งหมด | สอดคล้องกับ NFR Portability |
| TC-05 | ข้อมูลบัตรประชาชนต้องเข้ารหัสก่อนเก็บลงฐานข้อมูล | ข้อกำหนดความปลอดภัยและความเป็นส่วนตัว |

### 2.4 Assumptions
| Assumption ID | Description | Impact if False |
|--------------|-------------|----------------|
| AS-01 | เจ้าของหอพักมีความรู้พื้นฐานในการใช้ Docker Compose | หากไม่จริง → ต้องมีเอกสารติดตั้งแบบละเอียดมากขึ้น |
| AS-02 | การเชื่อมต่ออินเทอร์เน็ตมีความเสถียรพอสมควรขณะใช้งาน | หากไม่จริง → ต้องเพิ่ม Offline-first capability มากขึ้น |
| AS-03 | ปริมาณข้อมูลเริ่มต้นไม่เกิน 10 properties (~500 rooms) | หากเกิน → อาจต้องปรับ caching/DB strategy ก่อนกำหนด |

---

## 3. System Context (C4 Level 1)

### 3.1 Context Diagram (Level 1) — Pragmatic C4 for Self-Hosted Clarity

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Property Management System                      │
│                                                                     │
│  ┌──────────┐      ┌─────────────────────┐    ┌──────────┐            │
│  │  Owner    │───▶│   Caddy Proxy      │    │ LINE App │           │
│  │ (Browser) │    │ (Entry Point)      │    │(Manual)  │            │
│  └──────────┘     └────────┬───────────┘    └──────────┘             │
│                           │                                         │
│            ┌──────────────▼──────────────┐                          │
│            │  PMS Core System (Internal) │                          │
│            │  • Frontend (React SPA)     │                          │
│            │  • Backend API (FastAPI)    │                          │
│            │  • Business Logic           │                          │
│            └──────────────┬──────────────┘                          │
│                           │                                         │
│         ┌─────────────────┴─────────────────┐                       │
│         ▼                                   ▼                       │
│ ┌─────────────────┐           ┌─────────────────┐                   │
│ │ PostgreSQL 18.4+│           │ MinIO (S3)      │                   │
│ │ (Internal DB)   │           │ (Internal Files)│                   │
│ └─────────────────┘           └─────────────────┘                   │
│                                                                     │
│  Note: Caddy, PostgreSQL, MinIO are internal containers managed     │
│  via Docker Compose. Shown here for Self-hosted deployment clarity. │
└─────────────────────────────────────────────────────────────────────┘
```

**คำอธิบาย:**
- **Owner (Browser)**: ผู้ใช้งานหลัก เข้าถึงระบบผ่าน HTTPS
- **Caddy Proxy**: จุดเข้าเดียวของระบบ (Single Entry Point) — จัดการ TLS, routing, static files
- **PMS Core System**: กล่องรวมตรรกะธุรกิจทั้งหมด (ไม่แสดงรายละเอียดใน Level 1)
- **PostgreSQL / MinIO**: ระบบจัดเก็บข้อมูลภายใน — แสดงเพื่อให้เห็นความพึ่งพาด้านข้อมูล
- **LINE App**: ระบบภายนอกที่ใช้สำหรับการแจ้งเตือนแบบ manual copy/paste

> ℹ️ **หมายเหตุ:** Diagram นี้ปรับจาก C4 Model มาตรฐานเล็กน้อย โดยแสดง internal containers ที่สำคัญต่อความเข้าใจในการติดตั้งแบบ Self-hosted รายละเอียดการเชื่อมต่อระหว่างคอนเทนเนอร์ดูได้ที่ Container Diagram (Level 2)

### 3.2 Context Description
| Actor/System | Relationship | Data Flow | Protocol |
|-------------|-------------|-----------|----------|
| **Owner (Browser)** | Primary User | HTTP/HTTPS requests, file uploads | HTTPS, WebSocket (optional) |
| **Web App (React SPA)** | Frontend Container | API calls to Backend, static assets from Caddy | REST/JSON, HTTP/2 |
| **Backend API (FastAPI)** | Business Logic Container | DB queries, cache ops, file storage ops, event publishing | Async SQLAlchemy, Redis, MinIO SDK |
| **PostgreSQL** | Primary Data Store | Structured application data, encrypted PII | PostgreSQL wire protocol (SSL) |
| **Redis** | Cache & Message Broker | Session data, rate limiting, Celery task queue | Redis protocol |
| **MinIO (S3-Compatible)** | Object Storage | Room images, tenant documents, generated PDFs | AWS S3 API (HTTPS) |
| **LINE App (External)** | Notification Channel (Manual) | Text copied by Owner → sent via LINE app | Out-of-band (manual) |

---

## 4. Container Architecture (C4 Level 2)

### 4.1 Container Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           Docker Compose                                   │
│                                                                           │
│  ┌─────────────────────────────────────┐                                 │
│  │         Caddy 2.9+ (Reverse Proxy)   │                                 │
│  │  - TLS termination (HTTPS)           │                                 │
│  │  - Static file serving (frontend)    │                                 │
│  │  - Route /api/* → backend            │                                 │
│  │  - Health check: /health             │                                 │
│  └──────────┬──────────────────────────┘                                 │
│             │                                                              │
│  ┌──────────▼──────────────────────────┐                                  │
│  │      Frontend (React 19.2.6+ SPA)   │                                  │
│  │  - /  → index.html (served by Caddy)│                                  │
│  │  - SPA routing via React Router     │                                  │
│  │  - Vite 8.0.14+ build pipeline      │                                  │
│  │  - PWA: Service Worker + IndexedDB  │                                  │
│  └─────────────────────────────────────┘                                  │
│                                                                           │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │              Backend API (FastAPI 0.136.1+ + Uvicorn)             │    │
│  │                                                                    │    │
│  │  ┌────────────┐ ┌───────────┐ ┌──────────┐ ┌──────────────────┐ │    │
│  │  │ Auth       │ │ Property  │ │ Tenant   │ │ Contract         │ │    │
│  │  │ Router     │ │ Router    │ │ Router   │ │ Router           │ │    │
│  │  └─────┬──────┘ └─────┬─────┘ └────┬─────┘ └──────┬───────────┘ │    │
│  │        │              │            │              │              │    │
│  │  ┌─────▼──────────────▼────────────▼──────────────▼───────────┐ │    │
│  │  │              Service Layer (Business Logic)                 │ │    │
│  │  │  PropertyService, TenantService, ContractService,          │ │    │
│  │  │  MeterReadingService, BillingService, MaintenanceService   │ │    │
│  │  │  + Audit Logging for sensitive operations                   │ │    │
│  │  └──────────────────────────┬─────────────────────────────────┘ │    │
│  │                             │                                    │    │
│  │  ┌──────────────────────────▼─────────────────────────────────┐ │    │
│  │  │              Repository Layer (DB Access)                   │ │    │
│  │  │  SQLAlchemy 2.0.49+ async session → repositories           │ │    │
│  │  │  + Input validation + sanitization                          │ │    │
│  │  └──────────────────────────┬─────────────────────────────────┘ │    │
│  └─────────────────────────────┼───────────────────────────────────┘    │
│                                │                                        │
│  ┌─────────────────────────────▼───────────────────────────────────┐    │
│  │              PostgreSQL 18.4+                                     │    │
│  │  - pgdata volume (persistent)                                     │    │
│  │  - JSONB for flexible metadata                                    │    │
│  │  - Composite unique indexes                                       │    │
│  │  - Row-level security policies (future)                           │    │
│  └───────────────────────────────────────────────────────────────────┘    │
│                                                                           │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐           │
│  │   Redis 7.4+    │  │  Celery Worker  │  │  Prometheus     │           │
│  │  - Cache        │  │  - Async tasks  │  │  - Metrics      │           │
│  │  - Session store│  │  - Bulk invoice │  │  - /metrics     │           │
│  │  - Celery broker│  │  - PDF generation│ │  - Business KPIs│           │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘           │
│                                                                           │
│  ┌─────────────────────────────────────────┐                             │
│  │  MinIO RELEASE.2024+ (S3-Compatible)    │                             │
│  │  - Buckets: uploads, backups, temp      │                             │
│  │  - S3 API: AWS SDK / boto3 / minio-py   │                             │
│  │  - Lifecycle: Auto-expire temp files    │                             │
│  │  - Volume: minio_data:/data             │                             │
│  └─────────────────────────────────────────┘                             │
│                                                                           │
│  ┌─────────────────────────────────────────┐                             │
│  │  OpenTelemetry Collector (optional)     │                             │
│  │  - Distributed tracing                  │                             │
│  │  - Export to Jaeger/Tempo/Grafana       │                             │
│  └─────────────────────────────────────────┘                             │
└──────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Container Responsibilities

| Container | Technology | Responsibility | Interfaces |
|-----------|-----------|---------------|------------|
| **Caddy** | Caddy 2.9+ | TLS termination, static file serving, API routing, health checks | HTTPS:443, HTTP:80 → Frontend/Backend |
| **Frontend** | React 19.2.6+, Vite 8.0.14+ | UI rendering, user interaction, PWA offline support, API client | REST API calls to Backend, browser storage |
| **Backend API** | FastAPI 0.136.1+, Python 3.14+ | Business logic, request handling, authentication, event publishing | REST endpoints, SQLAlchemy ORM, Redis client, MinIO SDK |
| **PostgreSQL** | PostgreSQL 18.4+ | Persistent structured data storage, transaction management | PostgreSQL wire protocol (asyncpg driver) |
| **Redis** | Redis 7.4+ | Caching, session storage, Celery message broker | Redis protocol (async client) |
| **Celery Worker** | Celery 5.5+, Python 3.14+ | Background task execution: bulk invoice, PDF generation, email | Task queue from Redis, calls to Backend services |
| **MinIO** | MinIO RELEASE.2024+ | Object storage for files: images, documents, generated PDFs | AWS S3 API (HTTPS) |
| **Prometheus** | Prometheus 2.45+ | Metrics collection for monitoring and alerting | `/metrics` endpoint scraping |

---

## 5. Architecture Pattern & Style

### 5.1 Backend Pattern: Modular Monolith (Feature-First) with Layered Internal Structure

**Design Pattern References:** This architecture is a pragmatic hybrid of:
- **Layered Architecture / N-Tier** (Martin Fowler, *Patterns of Enterprise Application Architecture*) — Clear separation of concerns
- **Repository Pattern + Data Mapper** (Martin Fowler, PoEAA) — Decouple domain logic from persistence
- **Service Layer Pattern** (Martin Fowler, PoEAA) — Encapsulate business logic and use case orchestration
- **Dependency Injection** (FastAPI Native `Depends()`) — Manage dependencies, enable testability
- **DTO Pattern** — Separate API contracts from domain models via Pydantic schemas
- **Publish-Subscribe / Domain Events** (Hohpe & Woolf, *Enterprise Integration Patterns*) — Cross-module communication
- **Vertical Slice Architecture** (Jimmy Bogard) — Organize by feature/use case, not technical layer
- **Clean Architecture Lite** (Robert C. Martin) — Dependency rule: outer layers depend on inner, not vice versa

---

#### 🔹 View 1: High-Level Module Organization (The "Big Picture")

```text
app/
├── modules/                    # 🔑 Feature/Domain Modules (High Cohesion, Low Coupling)
│   ├── auth/                   # Module: Authentication & User Management
│   ├── billing/                # Module: Meter Reading, Invoicing, Payments
│   ├── tenant/                 # Module: Tenant Management
│   ├── contract/               # Module: Contract Management
│   ├── property/               # Module: Property Structure (Building/Floor/Room)
│   ├── maintenance/            # Module: Maintenance Requests
│   └── dashboard/              # Module: Aggregations & Reports
│
├── shared/                     # 🔑 Cross-Cutting Concerns (Kernel)
│   ├── database.py             # AsyncSession factory, connection pool, engine config
│   ├── deps.py                 # Dependency injection helpers (get_db, get_current_user)
│   ├── security.py             # JWT, Argon2id, AES encryption, CSRF, rate limiting
│   ├── events.py               # Internal event bus (sync → Redis pub/sub ready)
│   ├── storage.py              # S3/MinIO client wrapper (upload, download, presign)
│   ├── validators.py           # Input sanitization, business validation, file checks
│   ├── audit.py                # Audit logging for sensitive operations
│   └── utils.py                # Formatters, helpers, LINE text builder
│
├── workers/                    # 🔑 Async & Background Processing
│   ├── celery_app.py           # Celery configuration + Redis broker setup
│   ├── tasks.py                # Background task definitions (bulk invoice, PDF, email)
│   ├── schedulers.py           # Cron-like scheduled jobs (contract expiry, overdue alerts)
│   └── monitoring.py           # Prometheus metrics registration, health checks
│
└── middleware/                 # 🔑 Request/Response middleware
    ├── logging.py              # Structured JSON logging, request tracing
    ├── auth.py                 # JWT validation, property scope enforcement
    ├── rate_limit.py           # Per-IP/user rate limiting (100 req/min)
    └── cors.py                 # CORS configuration for frontend origins
```

> ✅ **Key Principle:** Each module in `modules/` is a self-contained unit with its own `routers/`, `services/`, `repository.py`, `models.py`, `schemas.py`. Cross-module communication happens **ONLY** via `shared/events.py` or shared interfaces — never direct imports.

---

#### 🔹 View 2: Internal Module Structure (Layered Pattern Inside Each Module)

**Example: `app/modules/billing/`**

```text
app/modules/billing/
├── __init__.py                 # Export public interface only (Facade Pattern)
├── models.py                   # 🔹 Domain: SQLAlchemy ORM entities (Billing aggregate)
├── schemas.py                  # 🔹 DTOs: Pydantic request/response models
├── repository.py               # 🔹 Infrastructure: DB queries, connection pool usage
├── services/                   # 🔹 Application: Business logic organized by use case
│   ├── meter_service.py        #   - Record meter reading, calculate usage
│   ├── invoice_service.py      #   - Generate invoices, resolve cascade rates
│   └── payment_service.py      #   - Record payments, update invoice status
├── routers/                    # 🔹 Presentation: FastAPI APIRouter definitions
│   ├── meter_router.py         #   - POST /meter-readings, GET /meter-history
│   ├── invoice_router.py       #   - POST /invoices/bulk-generate, GET /invoices
│   └── payment_router.py       #   - POST /payments, GET /payments/overdue
├── events.py                   # 🔹 Domain Events: publish to shared event bus
└── constants.py                # 🔹 Enums/Config: InvoiceStatus, PaymentMethod, etc.
```

**Layer Responsibilities:**

| Layer | File/Folder | Responsibility | Must Not |
|-------|------------|---------------|----------|
| **Presentation** | `routers/*.py` | Handle HTTP request/response, validate input (Pydantic), call Service, return response | ❌ No business logic, ❌ No direct DB calls |
| **Application** | `services/*.py` | Orchestrate use case flow, control transaction boundary, call Repository, publish events | ❌ No HTTP framework dependencies, ❌ No direct DB session management |
| **Domain** | `models.py`, `schemas.py`, `constants.py` | Define entities, DTOs, business constants, validation rules | ❌ No infrastructure calls (DB, HTTP, file), ❌ No framework imports |
| **Infrastructure** | `repository.py` | Translate domain queries to DB operations, manage indexes, handle optimistic locking | ❌ No business rules, ❌ No calling other services directly |
| **Cross-Cutting** | `events.py` | Declare and publish domain events for cross-module communication | ❌ No business logic processing |

**Dependency Flow (Inside Module):**
```text
HTTP Request
    ↓
routers/<feature>_router.py (Validate input via Pydantic schema)
    ↓
services/<feature>_service.py (Business logic + transaction control)
    ↓
repository.py (DB query via SQLAlchemy async session)
    ↓
models.py (SQLAlchemy ORM entity)
    ↓
PostgreSQL
    ↓
Response ← routers return Pydantic schema ← HTTP Response
```

**Evolution Path (When to Split):**

| Signal | Action |
|--------|--------|
| File in `services/` or `routers/` exceeds 300-400 lines | Split into `services/<use_case>_service.py` + `routers/<use_case>_router.py` |
| 2+ developers working on same module concurrently | Organize branches by use case folder to reduce merge conflicts |
| Need for isolated unit testing of specific business rule | Extract logic into dedicated service function + mock repository |
| Preparing to extract as microservice | Each `services/<use_case>/` can be moved to new service by changing only DI configuration |

**Example Code Snippets:**

```python
# routers/meter_router.py (Presentation Layer)
from fastapi import APIRouter, Depends, HTTPException
from app.modules.billing.schemas import MeterReadingCreate, MeterReadingResponse
from app.modules.billing.services.meter_service import MeterService
from app.shared.deps import get_db, get_current_user

router = APIRouter(prefix="/meter-readings", tags=["meter"])

@router.post("/", response_model=MeterReadingResponse)
async def record_meter(
    payload: MeterReadingCreate,
    db=Depends(get_db),
    user=Depends(get_current_user)
):
    service = MeterService(db)
    try:
        return await service.record_reading(
            room_id=payload.room_id,
            electric_current=payload.electric_current,
            water_current=payload.water_current,
            recorded_by=user.id
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
```

```python
# services/meter_service.py (Application Layer)
from datetime import datetime
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from app.modules.billing.repository import BillingRepository
from app.modules.billing.models import MeterReading
from app.shared.events import EventBus

class MeterService:
    def __init__(self, db: AsyncSession):
        self.repo = BillingRepository(db)
        self.db = db

    async def record_reading(
        self, room_id: UUID, electric_current: float, water_current: float, recorded_by: UUID
    ) -> MeterReading:
        # 1. Fetch previous reading
        prev = await self.repo.get_latest_reading(room_id)
        
        # 2. Validate business rules
        if electric_current < prev.electric_current:
            raise ValueError("ค่ามิเตอร์ไฟปัจจุบันต้องไม่น้อยกว่าก่อนหน้า")
            
        # 3. Create & Save
        reading = MeterReading(
            room_id=room_id,
            electric_previous=prev.electric_current,
            electric_current=electric_current,
            water_previous=prev.water_current,
            water_current=water_current,
            read_date=datetime.utcnow(),
            recorded_by=recorded_by
        )
        self.db.add(reading)
        await self.db.commit()
        await self.db.refresh(reading)
        
        # 4. Publish Event (Decoupled)
        await EventBus.publish("meter.recorded", {
            "room_id": str(room_id),
            "reading_id": str(reading.id)
        })
        return reading
```

```python
# repository.py (Infrastructure Layer)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.modules.billing.models import MeterReading

class BillingRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_latest_reading(self, room_id: str) -> MeterReading | None:
        stmt = (
            select(MeterReading)
            .where(MeterReading.room_id == room_id)
            .order_by(MeterReading.billing_year.desc(), MeterReading.billing_month.desc())
            .limit(1)
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()
```

---

### 5.2 Frontend Pattern: Feature-Oriented SPA + PWA Offline

**Design Pattern References:**
- **Feature-Sliced Design** — Organize by business feature, not technical type
- **Container/Presentational Pattern** — Separate stateful logic from UI components
- **Custom Hooks Pattern** — Reuse stateful logic across components
- **PWA Offline-First** — Service Worker + IndexedDB for resilience

```text
frontend/src/
├── features/                   # 🔑 Business feature modules (mirrors backend structure)
│   ├── auth/                   # Login, Invite, Session management UI
│   │   ├── components/         # Feature-specific components
│   │   ├── hooks/              # Feature-specific hooks (useAuth, useInvite)
│   │   ├── api/                # Feature-specific API calls
│   │   └── index.ts            # Public API export (Facade)
│   ├── billing/                # MeterReading, Invoice, Payment UI
│   ├── tenant/                 # Tenant profiles, documents UI
│   ├── contract/               # Contract creation, renewal UI
│   └── dashboard/              # Dashboard, Reports UI
│
├── shared/                     # 🔑 Cross-Cutting Frontend Concerns
│   ├── ui/                     # Atomic components: Button, Input, Modal, Table, Card
│   ├── api/                    # Axios client, interceptors, endpoint definitions
│   ├── hooks/                  # Global custom hooks (usePropertyScope, useOfflineQueue)
│   ├── utils/                  # Formatters, validators, LINE text builder
│   └── pwa/                    # Service worker, IndexedDB helpers, offline queue
│
├── routes/                     # React Router v7 configuration + lazy loading
├── pages/                      # Route composition (combines features + layouts)
├── layouts/                    # Shared layouts: Sidebar, Header, PageContainer
└── main.tsx                    # App entry, providers (QueryClient, Auth), error boundary
```

**State Management Strategy:**
- **Server State:** React Query (TanStack Query) for caching, background sync, error handling
- **Client State:** React Context + Custom Hooks for feature-level state (no global Redux/Zustand initially)
- **Offline State:** IndexedDB queue for unsaved meter readings; auto-sync via Background Sync API

**Offline Strategy (Critical for Meter Reading):**
```typescript
// shared/pwa/offlineQueue.ts
class OfflineQueue {
  private db: IDBDatabase;
  
  async enqueueMeterReading(reading: MeterReadingCreate): Promise<void> {
    // Store in IndexedDB when offline
    await this.db.transaction('queue', 'readwrite')
      .objectStore('queue')
      .add({ type: 'meter_reading', payload: reading, timestamp: Date.now() });
  }
  
  async sync(): Promise<void> {
    // Auto-sync when connectivity restores
    const queue = await this.getAllPending();
    for (const item of queue) {
      try {
        await apiClient.post('/meter-readings', item.payload);
        await this.remove(item.id);
      } catch (error) {
        // Retry with exponential backoff
      }
    }
  }
}
```

**API Client Pattern:**
```typescript
// shared/api/client.ts
import axios from 'axios';
import { refreshToken } from '@/features/auth/api';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Interceptor: Attach JWT
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Interceptor: Handle 401 + auto-refresh
apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401) {
      await refreshToken(); // Refresh token flow
      return apiClient.request(error.config); // Retry original request
    }
    return Promise.reject(error);
  }
);
```

---

### 5.3 Cross-Stack Design Principles

| Principle | Description | Enforcement |
|-----------|-------------|-------------|
| **High Cohesion, Low Coupling** | Everything related to a business capability lives in its module | Module directory structure, CI check with `pydeps` / `eslint-plugin-boundaries` |
| **Layered Responsibility** | Clear separation: routers → services → repo → models (backend), ui → hook → api (frontend) | Code review checklist, static analysis rules |
| **Event-Driven Cross-Module** | Modules communicate via `shared/events.py` or async messages, not direct imports | Architecture guardrails in `AGENTS.md`, unit tests |
| **Contract-First Integration** | Frontend and Backend agree on OpenAPI spec before implementation | Auto-generate TS types from OpenAPI, contract tests in CI |
| **Security by Design** | Validation, encryption, audit logging built into framework | Shared components, mandatory in code templates |
| **Dependency Rule (Clean Architecture Lite)** | Outer layers (routers, repo) depend on inner layers (services, models), never vice versa | Lint rules, code review, architecture tests |
| **Offline-First for Critical Flows** | Meter reading must work without internet; auto-sync when online | PWA service worker, IndexedDB queue, Background Sync API |

---

### 5.4 Module Boundary Rules (Backend + Frontend)

#### 🔹 Backend Rules (`app/modules/`)

```python
# ✅ Allowed: Within-module imports (same layer or inner layer)
from app.modules.billing.services.invoice_service import InvoiceService
from app.modules.billing.repository import BillingRepository
from app.modules.billing.schemas import InvoiceCreate

# ✅ Allowed: Cross-module via shared interface only
from app.shared.events import EventBus
await EventBus.publish("contract.terminated", payload)

# ❌ Forbidden: Direct cross-module import of internal components
from app.modules.tenant.repository import TenantRepository  # VIOLATION: use EventBus or shared interface
from app.modules.billing.models import Invoice  # VIOLATION: access via repository only

# ❌ Forbidden: Outer layer depending on inner layer in wrong direction
from app.modules.billing.routers import meter_router  # VIOLATION: routers should not be imported by services
```

#### 🔹 Frontend Rules (`frontend/src/`)

```typescript
// ✅ Allowed: Feature-scoped imports via public index
import { useMeterReadings } from '@/features/billing'
import { MeterInput } from '@/features/billing/components'

// ✅ Allowed: Shared API/client usage
import { apiClient } from '@/shared/api'
import { Button, Modal } from '@/shared/ui'

// ❌ Forbidden: Direct cross-feature internal imports
import { TenantForm } from '@/features/tenant/internal/TenantForm' // VIOLATION: use public feature API

// ❌ Forbidden: Importing from deep internal paths
import { validateInvoice } from '@/features/billing/services/internal/utils' // VIOLATION: use public feature export
```

#### 🔹 Enforcement Mechanisms

| Mechanism | Tool/Method | Purpose |
|-----------|------------|---------|
| **Static Analysis** | `pydeps` (Python), `eslint-plugin-boundaries` (TS) | Detect circular imports, cross-module violations in CI |
| **Code Review Checklist** | PR template with architecture questions | Human verification of boundary compliance |
| **Architecture Tests** | `pytest` + custom assertions for import rules | Automated guardrails that fail build on violation |
| **Facade Pattern** | `__init__.py` / `index.ts` exports only public API | Enforce "public contract" per module |

---

#### 🔹 Why This Hybrid Pattern?

| Criteria | How This Pattern Delivers |
|----------|--------------------------|
| ⚡ **Performance** | Repository pattern enables `selectinload`/`joinedload`; Service layer controls transaction boundary; Async SQLAlchemy + connection pool; React Query caching |
| 📐 **Standard + Clean** | Clear layered separation; Dependency rule enforced; No framework coupling in business logic; Feature-sliced frontend |
| 👁️ **Readable** | 1 file = 1 responsibility; Naming convention tells purpose; Max 3-level folder depth; Public API exports clarify usage |
| 👨‍💻 **Dev-Friendly** | FastAPI DI handles dependencies; Pydantic auto-validates; Hot-reload friendly; Mockable for tests; React Query simplifies server state |
| 🔧 **Maintainable** | Fix logic in `services/` without touching routers; Fix query in `repository.py` without touching business rules; Feature isolation reduces blast radius |
| 🚀 **Scalable** | Add feature = add file in `services/` + `routers/`; Extract microservice = move folder + change transport; Frontend features can be lazy-loaded |

> 💡 **Rule of Thumb for Phase 1:**  
> - **Backend:** Start with `api.py`, `service.py`, `repo.py` as single files per module. Split into `routers/` + `services/<use_case>/` only when files exceed 300 lines OR multiple developers work on same module.  
> - **Frontend:** Start with `features/<name>/index.ts` as facade. Add `components/`, `hooks/`, `api/` subfolders only when complexity grows.  
> - **Both:** Always enforce boundary rules via CI + code review from Day 1.

---

## 6. Technology Stack Decisions

### 6.1 Technology Selection Matrix

| Layer | Selected Technology | Version | Justification | Alternatives Considered |
|-------|-------------------|---------|--------------|----------------------|
| **Backend Runtime** | Python | 3.14+ | AI codegen training data richness, Pydantic integration, async support, mature ecosystem | Node.js 22+, Go 1.23+ |
| **Web Framework** | FastAPI | 0.136.1+ | Auto OpenAPI spec, Pydantic v2 integration, async native, lightweight | Flask, Django, Express, Gin |
| **ORM** | SQLAlchemy | 2.0.49+ | Async support, composite indexes, mature migration tooling (Alembic) | Prisma, Tortoise ORM, Peewee |
| **Migration** | Alembic | 1.18.4+ | Integrated with SQLAlchemy, version control friendly | Django Migrations, Flyway |
| **Validation** | Pydantic v2 | 2.13.4+ | Built-in FastAPI integration, strict mode, type safety, security fixes | Marshmallow, Cerberus |
| **Database** | PostgreSQL | 18.4+ | Relational integrity, JSONB flexibility, composite indexes, performance | MySQL 8+, SQLite, MongoDB |
| **Cache/Queue** | Redis + Celery | 7.4+, 5.5+ | Mature async task queue, pub/sub ready, session storage | RQ, Dramatiq, RabbitMQ |
| **File Storage** | MinIO (S3-Compatible) | RELEASE.2024-12+ | Portable, open-source, full AWS S3 API, self-hostable, lifecycle policies | Local FS, Ceph, SeaweedFS |
| **Frontend Framework** | React | 19.2.6+ | Ecosystem size, AI training data, component reusability, TypeScript support | Vue 3, Svelte, Angular |
| **Build Tool** | Vite | 8.0.14+ | Fast builds with Rolldown (Rust), HMR, PWA plugin support | Webpack, esbuild, Next.js |
| **Styling** | Tailwind CSS | 4.1.4+ | Utility-first, mobile-first by default, no media query boilerplate | Bootstrap, CSS Modules, Styled Components |
| **Authentication** | JWT (python-jose) | 3.5.0+ | Stateless, refresh token pattern, cryptography maturity | Session-based, OAuth2 only |
| **Password Hashing** | passlib[argon2] + argon2-cffi | 1.7.4+ + 23.1.0 | OWASP 2026 recommended, RFC 9106, memory-hard, side-channel resistant | scrypt, PBKDF2 |
| **PDF Generation** | WeasyPrint | 68.1+ | HTML/CSS to PDF, print layout support, template flexibility | ReportLab, pdfkit |
| **Excel Export** | OpenPyXL | 3.1.5+ | Full .xlsx support, stable API, formatting capabilities | xlsxwriter, pandas Excel |
| **Reverse Proxy** | Caddy | 2.9+ | Auto HTTPS (Let's Encrypt), simple config, HTTP/3 native | Nginx, Traefik, Apache |
| **Containerization** | Docker + Compose | 29.5.2+, 2.39+ | Portability NFR, layer optimization, multi-stage builds | Podman, Kubernetes (overkill for Phase 1) |
| **CI/CD** | GitHub Actions | Latest (rolling) | Free for public repos, large ecosystem, matrix testing support | GitLab CI, Jenkins, CircleCI |
| **Observability** | OpenTelemetry + Prometheus | 1.28+, prometheus-fastapi-instrumentator | Distributed tracing ready, custom business metrics, production debugging | Jaeger only, Datadog (vendor lock-in) |

### 6.2 Decision Rationale: Python/FastAPI Backend

```
Criteria                Python/FastAPI    Node.js/NestJS    Go/Gin
─────────────────────────────────────────────────────────────────
AI codegen quality     ⭐⭐⭐⭐⭐           ⭐⭐⭐⭐           ⭐⭐⭐
Docker image size      ⭐⭐⭐⭐ (~150MB)  ⭐⭐⭐⭐⭐ (~120MB) ⭐⭐⭐⭐⭐ (~20MB)
CRUD productivity      ⭐⭐⭐⭐⭐           ⭐⭐⭐⭐           ⭐⭐⭐
Thai i18n support      ⭐⭐⭐⭐ (Babel)   ⭐⭐⭐⭐⭐ (ICU)   ⭐⭐⭐
Learning curve         ⭐⭐⭐⭐⭐ (easy)   ⭐⭐⭐⭐          ⭐⭐⭐
On-premise low-spec    ⭐⭐⭐⭐           ⭐⭐⭐⭐          ⭐⭐⭐⭐⭐

Decision: Python/FastAPI selected because:
- Project is CRUD-heavy with complex business rules (not high-throughput real-time)
- AI code generation quality is highest for Python ecosystem
- Team size is small (1-3 people) → learning curve matters
- Performance requirements are achievable with async Python + proper caching
```

---

## 7. Data Architecture

### 7.1 Conceptual Data Model (Reference: DOMAIN_MODEL.md)

```
User (Owner) ──< (N) property_owners >── (1) Property  ← Many-to-Many via association table
                              │
                              ▼
Property (1) ──< (N) Building ──< (N) Floor ──< (N) Room
                    │              │              │
                    │              │              ├──< (N) MeterReading
                    │              │              ├──< (N) Contract ──> (1) Tenant
                    │              │              ├──< (N) Invoice ──< (N) InvoiceLineItem
                    │              │              │                      └──< (N) Payment
                    │              │              └──< (N) MaintenanceRequest
                    │              │
                    │              ├──< (N) UtilityRate (scope: floor)
                    │              └──< (N) UtilityRate (scope: building)
                    │
                    ├──< (N) UtilityRate (scope: property) ← required fallback
                    ├──< (N) UtilityRate (scope: room)     ← via Room relationship
                    ├──< (N) Tenant (scoped to property)
                    └──< (N) User (via property_owners association)

Note: 
- Dashed relationships (---▶) indicate audit fields (created_by/recorded_by → User)
- UtilityRate uses polymorphic association: scope_type ENUM + scope_id UUID
- property_owners table: {property_id, user_id, granted_at} — no roles, all owners equal
```

**Aggregate Boundaries (Reference: DOMAIN_MODEL.md):**
| Aggregate Root | Members | Persistence Boundary |
|---------------|---------|---------------------|
| **Property** | Property, Building, Floor | Transactional consistency within structure changes |
| **UtilityRate** | UtilityRate | Append-only, immutable historical records |
| **Room** | Room | Status changes via Contract events |
| **Tenant** | Tenant | Scoped to property, no cross-property references |
| **Contract** | Contract | Lifecycle: active → expired/terminated |
| **Invoice** | Invoice, InvoiceLineItem, Payment | Billing transaction consistency |
| **MeterReading** | MeterReading | Per-room, per-month immutable record |
| **MaintenanceRequest** | MaintenanceRequest | Independent workflow entity |

**Key Domain Events (Reference: DOMAIN_MODEL.md):**
| Event | Trigger | Effect |
|-------|---------|--------|
| `ContractCreated` | Contract status → active | Room.status → occupied |
| `ContractTerminated` | Contract status → terminated | Room.status → available |
| `MeterReadingRecorded` | MeterReading saved | Ready for invoice generation |
| `InvoiceSent` | Invoice status → sent | Lock invoice, notify Owner |
| `PaymentRecorded` | Payment created | Update Invoice.paid_amount, check if fully paid |
| `ContractNearExpiry` | 30/15/7 days before end_date | Notify Owner for renewal |
| `InvoiceOverdue` | Current date > due_date AND status ≠ paid | Notify Owner for collection |
| `UtilityRateCreated` | New UtilityRate record with effective_from | Close previous record's effective_to, append new record |

### 7.2 Physical Database Design Strategy

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| **Multi-Tenancy** | Row-level isolation via `property_id` column | Matches current single-tenant-per-installation requirement; future schema-per-tenant possible via config |
| **Soft Deletes** | Not implemented in Phase 1 | Simplicity; audit log provides history; hard delete acceptable for MVP |
| **Audit Trail** | Separate `audit_logs` table, append-only | Compliance requirement; immutable by design; separate from business tables |
| **Encryption** | Application-layer AES-256-GCM for `id_card_number` | Database-level TDE not sufficient for field-level access control; key managed via env var |
| **Indexing Strategy** | Composite indexes: `(property_id, status, due_date)`, `(room_id, billing_year, billing_month)`<br>Partial unique index: `CREATE UNIQUE INDEX idx_one_active_contract ON contracts (room_id) WHERE status = 'active'`<br>Unique constraint: `CREATE UNIQUE INDEX idx_unique_meter_reading ON meter_readings (room_id, billing_year, billing_month)` | Optimizes dashboard/billing queries; Enforces BR-01 at DB level; Prevents duplicate meter readings |
| **JSONB Usage** | Limited to `metadata` fields for truly flexible attributes | Avoids overuse; relational structure preferred for queryable data |

### 7.3 Caching Strategy

| Data Type | Cache Level | TTL | Invalidation Trigger |
|-----------|------------|-----|-------------------|
| UtilityRate resolution result | L1: Application memory (functools.lru_cache) | Request lifetime | Invalidate cache เฉพาะ billing_month >= effective_from ของ rate ใหม่ (ไม่ต้อง clear ข้อมูลย้อนหลัง) |
| Dashboard aggregation results | L2: Redis hash | 5 minutes | Invoice/Payment created/updated; scheduled refresh |
| User session data | Redis string | 7 days (matches refresh token) | User logout; token rotation |
| Property structure tree | Redis JSON | 30 minutes | Building/Floor/Room CRUD operation |
| Thai holiday calendar (for due date calculation) | Application memory (loaded at startup) | Application restart | Configuration update (requires restart) |

### 7.4 Data Flow: Cascade Rate Resolution

```
Input: (scope_id, scope_type, billing_month)

1. Query UtilityRate table:
   SELECT * FROM utility_rate 
   WHERE scope_type = :type AND scope_id = :id 
     AND effective_from <= :billing_month_start
     AND (effective_to IS NULL OR effective_to >= :billing_month_start)
   ORDER BY effective_from DESC LIMIT 1

2. If no result AND scope_type != 'property':
   Recursively query parent scope:
   - Room → Floor → Building → Property

3. Property level MUST have a rate (fallback guarantee)

4. Return resolved rates: {electric_rate, water_rate, common_fee}

Optimization: Cache resolved result per (scope_id, billing_month) in Redis with 24h TTL
```

---

## 8. Security Architecture

### 8.1 Defense-in-Depth Layers

| Layer | Control | Implementation | Verification |
|-------|---------|---------------|-------------|
| **Transport** | TLS 1.3, HSTS, HTTP/2 | Caddy auto-HTTPS configuration; `Strict-Transport-Security` header | SSL Labs test; browser dev tools |
| **Authentication** | JWT access (15m) + refresh (7d) + CSRF + token rotation | python-jose for token handling; httpOnly + Secure + SameSite=Strict cookies; `token_version` in DB for revocation | Penetration test; token replay test |
| **Authorization** | Property scope enforcement via middleware | JWT claims include `property_scopes[]`; middleware validates every request against scoped resources | Unit tests for scope enforcement; integration tests |
| **Input Validation** | Pydantic strict mode + custom sanitizers | `model_validate(strict=True)`; `shared/validators.py` for business rules; `python-magic` for file content verification | Fuzz testing; manual security review |
| **Password Storage** | Argon2id (OWASP 2026, RFC 9106) | passlib[argon2]; parameters from env vars | Hash strength verification; migration test |
| **Sensitive Data** | AES-256-GCM encrypt at rest for ID card | App-layer encryption before DB insert; nonce per encryption; key from `ID_CARD_ENCRYPTION_KEY` env var | Encryption/decryption unit tests; key rotation procedure test |
| **File Upload** | MIME + magic bytes + size + filename sanitization | `shared/validators.py`; `python-magic` for content detection; store outside web root | Malicious file upload test; path traversal test |
| **API Security** | Rate limiting (100 req/min/IP) + CORS + SQL injection prevention | FastAPI middleware; SQLAlchemy parameterized queries (never string interpolation) | Load test with rate limit; SQL injection test |
| **Database** | Non-root user + connection pool + SSL + row-level scoping | PostgreSQL roles with minimal privileges; `pool_size` config; `sslmode=require`; `property_id` filter in all queries | Database permission audit; connection leak test |
| **Audit** | Immutable audit log for sensitive operations | `shared/audit.py`; append-only `audit_logs` table; no UPDATE/DELETE permissions on table | Audit log integrity test; tamper detection test |
| **Dependencies** | Pinned versions + CI security scanning | `requirements.txt` with `==`; Dependabot; `safety` and `trivy` in CI pipeline | Dependency vulnerability scan report |

### 8.2 Encryption Strategy: ID Card Number

```
Sequence:
1. Owner submits ID card number via HTTPS
2. Frontend → Backend (plaintext in request body)
3. Backend validates format via shared/validators.py
4. Backend encrypts using AES-256-GCM:
   - Key: from environment variable ID_CARD_ENCRYPTION_KEY (32 bytes)
   - Nonce: cryptographically random per encryption
   - Output: ciphertext + nonce + tag
5. Backend stores base64(ciphertext + nonce + tag) in tenant.id_card_number
6. Backend logs audit event: id_card.encrypted
7. On read (Owner views tenant detail):
   - Backend decrypts using same key
   - Logs audit event: id_card.viewed
   - Returns plaintext to frontend over HTTPS

Key Management:
- Generation: openssl rand -hex 32 (for self-hosted setup)
- Storage: Environment variable only; never in code, config files, or logs
- Rotation: Every 6 months; re-encrypt existing data; audit log key access
- Backup: Encrypted backup of key stored separately from application backup
- Cloud mode: Use cloud provider secrets manager (AWS Secrets Manager, GCP Secret Manager)
```

### 8.3 Authentication & Authorization Flow

```mermaid
sequenceDiagram
    participant Owner as Owner (Browser)
    participant FE as Frontend (React)
    participant BE as Backend API (FastAPI)
    participant DB as PostgreSQL
    participant Redis as Redis

    Owner->>FE: Enter credentials, submit login
    FE->>BE: POST /api/v1/auth/login {email, password}
    BE->>DB: SELECT user WHERE email = :email
    DB-->>BE: User record (password_hash, property_scopes)
    BE->>BE: Verify password (Argon2id)
    BE->>BE: Generate JWT access_token (15m) + refresh_token (7d)
    BE->>Redis: Store refresh_token with token_version
    BE->>DB: INSERT audit_log (action=login)
    BE-->>FE: 200 OK {access_token, user}
    FE->>Owner: Store access_token in memory; redirect to dashboard

    Note over Owner,BE: Subsequent authenticated requests

    Owner->>FE: Navigate to protected page
    FE->>BE: GET /api/v1/... Authorization: Bearer <access_token>
    BE->>BE: Validate JWT signature + expiry
    BE->>BE: Extract property_scopes from token claims
    BE->>BE: Middleware enforces property_id scope on request
    BE->>DB: Execute query with property_id filter
    DB-->>BE: Filtered results
    BE-->>FE: 200 OK {data}
    FE-->>Owner: Render protected content
```

---

## 9. Deployment Architecture

### 9.1 Deployment Modes Overview

| Mode | Target Environment | Infrastructure Responsibility | Configuration Management | Backup Strategy |
|------|------------------|----------------------------|------------------------|----------------|
| **Self-hosted** | Customer's VPS/NAS | Customer | `.env` file (documented in `.env.example`) | Customer runs `scripts/backup.sh` (pg_dump + mc mirror + GPG) |
| **On-premise** | Customer's data center | Project Owner (installer) | Ansible/Puppet (optional); `.env` file | Project Owner provides and manages backup script |
| **Cloud (SaaS)** | Cloud provider (AWS/GCP/Azure) | Project Owner | Cloud secrets manager; environment variables via orchestration | Automated daily backups; 30-day retention; cross-region replication |

### 9.2 Docker Compose Structure (Self-hosted/On-premise)

```yaml
# docker-compose.yml (simplified structure)
services:
  caddy:
    image: caddy:2.9-alpine
    ports: ["80:80", "443:443"]
    volumes:
      - ./caddy/Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - frontend_dist:/srv/frontend:ro
    depends_on: [backend]

  backend:
    build: ./backend
    environment:
      - DATABASE_URL=postgresql://...
      - REDIS_URL=redis://redis:6379/0
      - MINIO_ENDPOINT=minio:9000
      # ... other env vars from .env
    volumes:
      - ./uploads:/app/uploads:ro  # For legacy compatibility only
    depends_on: [postgres, redis, minio]
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  frontend:
    build: ./frontend
    volumes:
      - frontend_dist:/usr/share/nginx/html:ro

  postgres:
    image: postgres:18.4-alpine
    environment:
      - POSTGRES_USER=${DB_USER}
      - POSTGRES_PASSWORD=${DB_PASSWORD}
      - POSTGRES_DB=${DB_NAME}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER}"]
      interval: 10s

  redis:
    image: redis:7.4-alpine
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes

  minio:
    image: minio/minio:RELEASE.2024-12
    environment:
      - MINIO_ROOT_USER=${MINIO_ACCESS_KEY}
      - MINIO_ROOT_PASSWORD=${MINIO_SECRET_KEY}
    volumes:
      - minio_data:/data
    command: server /data --console-address ":9001"

  celery-worker:
    build: ./backend
    command: celery -A app.workers.celery_app worker --loglevel=info
    environment: [same as backend]
    depends_on: [redis, postgres, minio]

volumes:
  pgdata:
  redis_data:
  minio_data:
  caddy_data:
  frontend_dist:
```

### 9.3 Zero-Downtime Deployment Procedure

```bash
#!/bin/bash
# scripts/deploy.sh

set -euo pipefail

VERSION="${1:-$(git rev-parse --short HEAD)}"
PREVIOUS_VERSION="${2:-$(docker-compose ps -q backend | xargs docker inspect --format='{{.Config.Image}}' | cut -d: -f2 || echo 'none')}"

echo "🚀 Deploying version ${VERSION} (previous: ${PREVIOUS_VERSION})"

# 1. Build new backend image
echo "🔨 Building backend image..."
docker build -t pms-backend:${VERSION} ./backend

# 2. Run pre-deployment health check on new image
echo "🩺 Pre-deployment health check..."
docker run --rm \
  --network pms_default \
  -e DATABASE_URL="${DATABASE_URL}" \
  -e REDIS_URL="${REDIS_URL}" \
  pms-backend:${VERSION} \
  python -m app.health_check || {
    echo "❌ Health check failed. Aborting deployment."
    exit 1
  }

# 3. Update docker-compose to use new version
echo "📝 Updating docker-compose configuration..."
sed -i.bak "s|pms-backend:[^ ]*|pms-backend:${VERSION}|" docker-compose.yml

# 4. Zero-downtime rolling update
echo "🔄 Performing rolling update..."
docker-compose up -d --no-deps --build backend

# 5. Wait for new container to pass health check
echo "⏳ Waiting for new backend to be healthy..."
for i in {1..30}; do
  if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
    echo "✅ New backend is healthy"
    break
  fi
  if [ $i -eq 30 ]; then
    echo "❌ Health check timeout. Initiating rollback..."
    docker-compose up -d --no-deps backend:${PREVIOUS_VERSION}
    exit 1
  fi
  sleep 2
done

# 6. Run post-deployment verification
echo "🔍 Running post-deployment verification..."
python scripts/post_deploy_check.py || {
  echo "⚠️ Post-deployment check failed. Manual review required."
  # Do NOT auto-rollback here; alert human
}

# 7. Cleanup old images (keep last 3)
echo "🧹 Cleaning up old images..."
docker image prune -f \
  --filter "label=app=pms-backend" \
  --filter "until=24h"

echo "✅ Deployment complete: ${VERSION}"
```

### 9.4 Backup & Restore Strategy

```bash
#!/bin/bash
# scripts/backup.sh

set -euo pipefail

BACKUP_DIR="/backups/$(date +%Y%m%d_%H%M%S)"
RETENTION_DAYS=30
ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY:?Must set BACKUP_ENCRYPTION_KEY}"

mkdir -p "${BACKUP_DIR}"

echo "🗄️ Starting backup to ${BACKUP_DIR}"

# 1. Database backup (pg_dump)
echo "💾 Backing up PostgreSQL..."
pg_dump "${DATABASE_URL}" | gzip > "${BACKUP_DIR}/database.sql.gz"

# 2. MinIO backup (mc mirror)
echo "📦 Backing up MinIO objects..."
mc mirror --overwrite \
  "${MINIO_ALIAS}/pms-uploads" \
  "${BACKUP_DIR}/minio-uploads"

# 3. Configuration backup (env files, Caddyfile, etc.)
echo "⚙️ Backing up configuration..."
tar -czf "${BACKUP_DIR}/config.tar.gz" \
  .env \
  docker-compose.yml \
  caddy/Caddyfile \
  scripts/

# 4. Encrypt sensitive backups
echo "🔐 Encrypting backups..."
for file in "${BACKUP_DIR}"/*.sql.gz "${BACKUP_DIR}"/config.tar.gz; do
  gpg --batch --yes \
    --cipher-algo AES256 \
    --symmetric \
    --passphrase "${ENCRYPTION_KEY}" \
    --output "${file}.gpg" \
    "${file}"
  rm "${file}"  # Remove unencrypted version
done

# 5. Create manifest
echo "📋 Creating backup manifest..."
cat > "${BACKUP_DIR}/MANIFEST.txt" <<EOF
Backup ID: $(basename "${BACKUP_DIR}")
Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
Database: $(pg_dump --version)
MinIO: $(mc --version)
Files:
$(find "${BACKUP_DIR}" -type f -name "*.gpg" -exec basename {} \;)
EOF

# 6. Retention cleanup
echo "🗑️ Cleaning up backups older than ${RETENTION_DAYS} days..."
find /backups -type d -name "20*" -mtime +${RETENTION_DAYS} -exec rm -rf {} +

# 7. Verify backup integrity (optional but recommended)
echo "✅ Backup completed. Verify with: scripts/restore.sh --dry-run ${BACKUP_DIR}"
```

---

## 10. Cross-Cutting Concerns

### 10.1 Logging & Observability

```python
# middleware/logging.py
import logging
import json
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger("pms")

class StructuredLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        start_time = time.time()
        
        # Log request
        logger.info(json.dumps({
            "event": "request_started",
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
            "client_ip": request.client.host,
            "user_agent": request.headers.get("user-agent"),
        }))
        
        try:
            response = await call_next(request)
            duration = time.time() - start_time
            
            # Log response
            logger.info(json.dumps({
                "event": "request_completed",
                "request_id": request_id,
                "status_code": response.status_code,
                "duration_ms": round(duration * 1000, 2),
            }))
            return response
        except Exception as e:
            logger.error(json.dumps({
                "event": "request_error",
                "request_id": request_id,
                "error": str(e),
                "error_type": type(e).__name__,
            }), exc_info=True)
            raise
```

**Observability Stack:**
- **Metrics**: Prometheus endpoint `/metrics` with custom business metrics (invoice_generated, meter_reading_saved)
- **Tracing**: OpenTelemetry with 10% sampling in production; export to Jaeger/Tempo
- **Logging**: Structured JSON logs; aggregated via Loki or ELK in production
- **Alerting**: Prometheus alert rules for error rate > 1%, latency p95 > 2s, backup failure

### 10.2 Error Handling Strategy

```python
# shared/exceptions.py
from fastapi import HTTPException, status
from enum import Enum

class ErrorCode(str, Enum):
    # Authentication
    AUTH_INVALID_CREDENTIALS = "FR-USER-01"
    AUTH_TOKEN_EXPIRED = "AUTH-02"
    AUTH_PROPERTY_SCOPE_DENIED = "FR-USER-03"
    
    # Validation
    VALIDATION_INPUT_INVALID = "VAL-01"
    VALIDATION_BUSINESS_RULE_FAILED = "VAL-02"
    
    # Not Found
    RESOURCE_NOT_FOUND = "NOT_FOUND-01"
    
    # Business Logic
    BILLING_RATE_NOT_FOUND = "FR-METER-05"
    CONTRACT_CONFLICT_ACTIVE = "FR-CONTRACT-01"
    
    # System
    STORAGE_UPLOAD_FAILED = "SYS-01"
    DATABASE_CONNECTION_ERROR = "SYS-02"

class PMSException(HTTPException):
    def __init__(self, code: ErrorCode, detail: str, status_code: int = 400):
        super().__init__(
            status_code=status_code,
            detail={"code": code.value, "message": detail}
        )

# Global exception handler in main.py
@app.exception_handler(PMSException)
async def pms_exception_handler(request: Request, exc: PMSException):
    # Log with context
    logger.error(f"PMSException: {exc.detail}", extra={
        "request_id": request.state.request_id,
        "user_id": getattr(request.state, "user_id", None),
        "error_code": exc.detail["code"],
    })
    # Return consistent error format
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.detail}
    )
```

### 10.3 Configuration Management

```python
# config.py
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, field_validator
from typing import Optional
import secrets

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="forbid",  # Reject unknown env vars
        frozen=True,     # Immutable after load
    )
    
    # Application
    APP_NAME: str = "Property Management System"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    
    # Security
    SECRET_KEY: str = Field(..., min_length=32)
    ID_CARD_ENCRYPTION_KEY: str = Field(..., min_length=64)  # 32 bytes hex
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # Database
    DATABASE_URL: str = Field(..., pattern=r"^postgresql\+asyncpg://")
    DATABASE_POOL_SIZE: int = 10
    DATABASE_MAX_OVERFLOW: int = 20
    
    # Redis
    REDIS_URL: str = Field(..., pattern=r"^redis://")
    
    # MinIO/S3
    MINIO_ENDPOINT: str
    MINIO_ACCESS_KEY: str
    MINIO_SECRET_KEY: str
    MINIO_BUCKET: str = "pms-uploads"
    MINIO_SECURE: bool = True
    MINIO_PUBLIC_URL: Optional[str] = None
    
    # Observability
    PROMETHEUS_ENABLED: bool = True
    OTEL_EXPORTER_OTLP_ENDPOINT: Optional[str] = None
    OTEL_TRACES_SAMPLE_RATE: float = 0.1
    
    @field_validator("SECRET_KEY", "ID_CARD_ENCRYPTION_KEY")
    @classmethod
    def validate_key_length(cls, v: str) -> str:
        if len(v) < 32:
            raise ValueError("Key must be at least 32 characters")
        return v
    
    @classmethod
    def generate_example_env(cls) -> str:
        """Generate .env.example content"""
        return f"""# Application
APP_NAME=Property Management System
APP_VERSION=1.0.0
DEBUG=false

# Security (generate with: openssl rand -hex 32)
SECRET_KEY=changeme_min_32_chars
ID_CARD_ENCRYPTION_KEY=changeme_min_64_chars_hex

# Database
DATABASE_URL=postgresql+asyncpg://user:pass@postgres:5432/pms

# Redis
REDIS_URL=redis://redis:6379/0

# MinIO
MINIO_ENDPOINT=minio:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=pms-uploads
MINIO_SECURE=false
MINIO_PUBLIC_URL=http://localhost:9000

# Observability
PROMETHEUS_ENABLED=true
"""

settings = Settings()
```

---

## 11. Architecture Decision Records (ADRs)

### ADR-001: REST API over GraphQL

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | 2026-05-24 |
| **Context** | System is CRUD-heavy with specific queries (dashboard, meter reading). Team size is small (1-3 people). Frontend is a single React SPA. |
| **Decision** | Use REST API with FastAPI auto-generated OpenAPI documentation. |
| **Rationale** | GraphQL introduces unnecessary complexity for this use case: over-fetching is acceptable for internal tool, caching is simpler with REST, debugging is more straightforward, and team learning curve is lower. FastAPI provides excellent developer experience with automatic docs and validation. |
| **Consequence** | Some endpoints may have over-fetching (e.g., dashboard). Mitigation: Use field selection query parameters if needed in future. |
| **Compliance** | FR-DASH-01, NFR-Performance, NFR-Maintainability |
| **Future Path** | If multiple client types emerge (mobile app, third-party integrations) with divergent data needs, consider adding GraphQL endpoint alongside REST (incremental adoption). |

### ADR-002: SPA + REST over SSR (Next.js/Nuxt)

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | 2026-05-24 |
| **Context** | Internal tool with no SEO requirements. Mobile-first meter reading is critical. PWA offline support is required. |
| **Decision** | React SPA built with Vite, consuming REST API. |
| **Rationale** | SSR complexity is not justified for internal tool. SPA provides smoother UX for meter reading flow (no full page reloads). PWA offline support is more straightforward to implement in SPA architecture. Initial load time difference is acceptable for authenticated internal users. |
| **Consequence** | Initial load may be slightly slower than SSR. Mitigation: Code splitting, lazy loading, and aggressive caching. |
| **Compliance** | FR-METER-01, NFR-Usability, NFR-Portability |

### ADR-003: Cascade Rate Resolution at Application Layer

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | 2026-05-24 |
| **Context** | Utility rates cascade through 4 levels (Room→Floor→Building→Property) with time-based versioning (effective_from/to). |
| **Decision** | Resolve cascade logic in Python service layer, not database recursive CTE. |
| **Rationale** | PostgreSQL recursive CTE with effective_date logic is complex to maintain and test. Python implementation is more readable, easier to unit test, and the maximum recursion depth is only 4 levels (acceptable N+1 query pattern). |
| **Consequence** | Application layer makes up to 4 queries per rate resolution. Mitigation: Cache resolved rates per (scope_id, billing_month) in Redis with 24h TTL. |
| **Compliance** | FR-METER-05, BR-07, BR-10 |
| **Optimization** | Implement L1 cache (functools.lru_cache) per request + L2 cache (Redis) across requests. |

### ADR-004: S3-Only Storage with MinIO for Portability

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | 2026-05-24 |
| **Context** | System must support self-hosted, on-premise, and cloud deployments without vendor lock-in. File storage needed for room images, tenant documents, generated PDFs. |
| **Decision** | Use MinIO (S3-compatible object storage) for all environments; never use local filesystem for user-uploaded files. |
| **Rationale** | MinIO is industry standard for self-hosted S3, single-binary, Docker-native, supports lifecycle policies and replication. AWS S3 API compatibility allows seamless migration to cloud providers if needed. Avoids path handling complexity of local FS. |
| **Consequence** | Must deploy MinIO container; backup strategy uses `mc mirror` instead of `tar`. Must manage credentials securely via environment variables. |
| **Compliance** | FR-PROP-07, NFR-Portability, NFR-Security |
| **Security** | Bucket policies restrict access; presigned URLs for sensitive downloads; MIME/magic validation before upload; audit log all file operations. |

### ADR-005: Row-Level Multi-Tenancy via property_id

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | 2026-05-24 |
| **Context** | Cloud mode multi-tenant SaaS is future scope. Current requirement is single-tenant per installation (each customer has their own deployment). |
| **Decision** | Single database with row-level isolation via `property_id` column on all relevant tables; enforce via middleware. |
| **Rationale** | Matches current deployment model; simpler to develop and test; migration to schema-per-tenant is possible by modifying only `shared/database.py` when needed. |
| **Consequence** | If multi-tenant SaaS is implemented later, requires refactoring to schema-per-tenant or row-level security policies. Mitigation: Design interfaces to allow this change with minimal code modification. |
| **Compliance** | NFR-Portability, NFR-Security, BR-09 |
| **Safety** | Middleware enforces `property_id` scope on every query; unit tests verify no cross-property data leakage. |

### ADR-006: Pinned Versions + Security Scanning for Production

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | 2026-05-24 |
| **Context** | Dependency updates can introduce breaking changes or security vulnerabilities without notice. |
| **Decision** | Use pinned versions (`==`) in requirements.txt and package.json; integrate Dependabot + safety/trivy scanning in CI pipeline. |
| **Rationale** | Stability is more important than latest features for property management system. Security scanning prevents known vulnerabilities from reaching production. |
| **Consequence** | Must update dependencies deliberately via PR process: Dependabot creates PR → manual review → staging test → production deploy. |
| **Compliance** | NFR-Security, NFR-Availability |
| **Process** | CI pipeline: lint → test → safety check → build → deploy (manual approval for production). |

### ADR-007: Observability First — OpenTelemetry + Structured Logging

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | 2026-05-24 |
| **Context** | System must be debuggable in production, performance measurable against budget, and alertable when issues occur. |
| **Decision** | Structured JSON logging + Prometheus metrics endpoint + OpenTelemetry tracing (low overhead, 10% sampling in production). |
| **Rationale** | Prevents "it works on my machine" problems; enables data-driven optimization; prepares for distributed tracing when extracting microservices in future. |
| **Consequence** | Adds ~5-10% latency overhead for tracing. Mitigation: Use sampling rate in production; disable detailed tracing in development if needed. |
| **Compliance** | NFR-Performance, NFR-Maintainability |
| **Implementation** | `middleware/logging.py` for structured logs; `workers/monitoring.py` for Prometheus metrics; OpenTelemetry SDK configured in `main.py`. |

### ADR-008: No Email/SMTP in Version 1 — Internal Invite Only

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | 2026-05-24 |
| **Context** | FR-USER-02 requires inviting Owners via email, but system should not depend on SMTP infrastructure in Phase 1. |
| **Decision** | Implement internal invite flow: generate signed link → Owner copies link → sends via external channel (LINE, chat, etc.). |
| **Rationale** | Reduces complexity: no SMTP configuration, bounce handling, or spam compliance needed. Most Thai property owners already use LINE as primary communication. |
| **Consequence** | Invite process is slightly more manual. Mitigation: Prepare interface (`EmailService` abstract class) for future SMTP/third-party email service integration without changing business logic. |
| **Compliance** | FR-USER-02, NFR-Portability |
| **Future Path** | If auto-email is required later: implement `EmailService` interface with SendGrid/Resend/etc. backend; business logic unchanged. |

---

## 12. Risks & Mitigations

| Risk ID | Risk Description | Impact | Likelihood | Mitigation Strategy | Owner |
|---------|-----------------|--------|------------|-------------------|--------|
| RISK-001 | N+1 queries in cascade rate resolution causing performance degradation | Medium: Dashboard/billing slow | Medium | Cache resolved rates in Redis with 24h TTL; use `selectinload` for related data; load test with realistic data volume | Backend Lead |
| RISK-002 | Circular import across modules causing build failure or maintenance nightmare | High: Blocks development | Low | CI check with `pydeps` to detect circular dependencies; enforce design rule "no cross-module direct import" in code review | Architecture Lead |
| RISK-003 | MinIO single point of failure in self-hosted mode causing file access downtime | Medium: Cannot upload/view files | Low | Document backup/restore procedure; future: enable MinIO replication or switch to multi-node setup | DevOps |
| RISK-004 | Token replay attack due to insufficient JWT validation | High: Unauthorized access | Low | Short access token expiry (15m); refresh token rotation with `token_version`; CSRF token for cookie-based refresh | Security Lead |
| RISK-005 | Data loss due to backup failure or corruption | Critical: Business continuity | Low | Monthly restore verification test; encrypt backups; store encryption key separately; monitor backup job success | DevOps |
| RISK-006 | Architecture drift: code diverges from documented patterns over time | Medium: Maintenance cost increases | Medium | Architecture guardrails in CI (`pydeps`, custom lint rules); require SDD update for module boundary changes; regular architecture review | Architecture Lead |
| RISK-007 | AI Agent hallucinates architecture decisions when generating code | Medium: Incorrect implementation | Medium | Provide `AGENTS.md` with explicit guardrails; require SDD.md as implementation blueprint; human review mandatory for PRs | Tech Lead |

---

## 13. Appendix

### 13.1 Glossary Reference
See `docs/GLOSSARY.md` for domain terminology definitions.

### 13.2 Reference Standards
- **C4 Model**: https://c4model.com — System architecture visualization
- **IEEE 1471 / ISO/IEC 42010**: Architecture description standard
- **OWASP ASVS**: Application Security Verification Standard — security controls reference
- **12-Factor App**: https://12factor.net — Cloud-native application principles
- **Martin Fowler — Patterns of Enterprise Application Architecture (PoEAA)**: Repository, Service Layer, Layered Architecture
- **Robert C. Martin — Clean Architecture**: Dependency rule, use case interactors
- **Jimmy Bogard — Vertical Slice Architecture**: Feature-first organization

### 13.3 ADR Template for Future Decisions
```markdown
### ADR-XXX: [Title]

| Field | Value |
|-------|-------|
| **Status** | [Proposed \| Accepted \| Deprecated \| Superseded] |
| **Date** | YYYY-MM-DD |
| **Context** | [Problem statement, constraints, stakeholders] |
| **Decision** | [Chosen solution, in imperative voice] |
| **Rationale** | [Why this decision over alternatives; trade-offs considered] |
| **Consequence** | [Positive and negative outcomes; mitigation for negatives] |
| **Compliance** | [FR-XXX, NFR-XXX, BR-XXX this decision addresses] |
| **Future Path** | [Conditions under which this decision might be revisited] |
```

### 13.4 Architecture Exit Criteria Checklist
```markdown
## ✅ Architecture Exit Criteria (Must pass before SDD development)

### Content Completeness
- [ ] Introduction + Scope + Definitions clear and complete
- [ ] Business Goals + Quality Attributes (NFRs) + Constraints documented
- [ ] C4 Context Diagram (Level 1) + Container Diagram (Level 2) included
- [ ] Backend Architecture Pattern specified and enforceable (with internal module structure)
- [ ] Frontend Architecture Pattern specified (SPA, State, Routing, Offline)
- [ ] Technology Stack Table with rationale + alternatives considered
- [ ] Data Architecture: schema overview + multi-tenancy strategy + caching plan
- [ ] Security Architecture: defense-in-depth layers + key management
- [ ] Deployment Architecture: 3 modes + zero-downtime strategy + backup procedure
- [ ] ADRs documented for key decisions with trade-offs
- [ ] Cross-cutting concerns: logging, error handling, configuration management
- [ ] Risks identified with mitigations and owners
- [ ] Design Pattern references documented for backend structure

### Quality Gates
- [ ] Document reviewed by 2+ team members → consistent understanding >90%
- [ ] Development team can start SDD/coding without clarification questions
- [ ] Abstraction layers exist for easy implementation changes (e.g., storage, cache)
- [ ] Design enables testability (dependency injection, interface segregation)
- [ ] Every architecture decision traceable to FR/NFR/BR (using 2-digit FR format)
- [ ] Module internal structure follows layered responsibility rule

### Process Gates
- [ ] Human approval obtained (Owner/Tech Lead sign-off)
- [ ] AI Agent can propose SDD without hallucination when given this document
- [ ] Document version-controlled in git with change history
- [ ] Change control process defined for future updates

✅ All criteria met → Architecture complete → Proceed to SDD development
❌ Criteria not met → Revise document → Re-review before proceeding
```

---

## Document Approval

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Product Owner | [Owner Name] | __________________ | 2026-05-24 |
| Technical Lead | [Tech Lead Name] | __________________ | 2026-05-24 |
| Security Reviewer | [Security Reviewer Name] | __________________ | 2026-05-24 |
| DevOps Lead | [DevOps Lead Name] | __________________ | 2026-05-24 |

---

> **Document Status**: APPROVED — Ready for SDD Development  
> **Next Phase**: Software Design Document (SDD) — Implementation Blueprint  
> **Change Control**: Any modification to this document requires update of downstream documents: `SDD.md`, `DATABASE.md`, `SECURITY.md`, `DEPLOYMENT_MODES.md`  
> **Review Cycle**: Architecture document reviewed quarterly or when major requirement changes occur