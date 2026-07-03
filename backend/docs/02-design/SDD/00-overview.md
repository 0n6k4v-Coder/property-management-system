# File: 02-design/SDD/00-overview.md
# Backend Software Design Document (SDD)
## Property Management System

**Document ID:** SDD-PMS-001
**Version:** 1.4
**Status:** Approved — Ready for Implementation
**Date:** 2026-05-24
**Author:** Technical Architecture Team
**Approvers:** [Owner], [Tech Lead]
**Input Documents:** `docs/REQUIREMENTS.md` v1.0, `docs/DOMAIN_MODEL.md` v1.0, `docs/ARCHITECTURE.md` v1.2

---

## Document Control

| Version | Date | Author | Changes | Approver |
|---------|------|--------|---------|----------|
| 1.4 | 2026-05-24 | Architecture Team | Added Docker-First Development & Testing Strategy (§1.2, §7.5, §7.7, §9.5); Updated Document Control & TOC | [Pending] |
| 1.3 | 2026-05-24 | Architecture Team | Removed Section 9 (Implementation Guidelines moved to AGENTS.md); Renumbered subsequent sections; Updated TOC | [Pending] |
| 1.2 | 2026-05-24 | Architecture Team | Added Section 3.5 (Frontend Integration Contract); Updated Document Control & TOC; Finalized for 10/10 SE Standard | [Pending] |
| 1.1 | 2026-05-24 | Architecture Team | Fixed Section 3.2 (Endpoint Summary table); Added 2 critical endpoints to 3.3; Enhanced Section 4.3 (Migration); Added Error Handling to all modules; Added Coverage Target + Security Checklist | [Pending] |
| 1.0 | 2026-05-24 | Architecture Team | Initial SDD release — MVP modules: auth, property, billing, tenant, contract, dashboard (+ maintenance Phase 1.5) | [Pending] |

**Distribution:** Development Team, QA Team, AI Agents

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Module Specifications](02-module-specs.md)
3. [API Specification](03-api-contract.md)
   3.1 [API Conventions](03-api-contract.md#31-api-conventions-กฎมาตรฐาน)
   3.2 [Endpoint Summary](03-api-contract.md#32-endpoint-summary-ตารางครบถ้วน)
   3.3 [Critical Endpoint Specifications](03-api-contract.md#33-critical-endpoint-specifications)
   3.4 [OpenAPI Contract Reference](03-api-contract.md#34-openapi-contract-reference)
   3.5 [Frontend Integration Contract](03-api-contract.md#35-frontend-integration-contract)
4. [Database Design](04-database-schema.md)
5. [Critical Sequence Diagrams](05-business-rules.md)
6. [State Machines](05-business-rules.md)
7. [Test Strategy & Quality Assurance](06-security-audit.md)
8. [Traceability Matrix](07-traceability.md)
9. [Backend Implementation Blueprint — File Inventory & Contracts](08-file-inventory.md)
10. [UML Design Diagrams (Traditional SE Standard)](01-architecture.md)
11. [Appendix](#11-appendix)

---

## 1. Introduction

### 1.1 Purpose
เอกสารนี้ออกแบบรายละเอียดการนำไปปฏิบัติ (Implementation Blueprint) สำหรับระบบจัดการหอพัก (Property Management System) เฟส 1 (MVP) โดยระบุ:
- ไฟล์ที่ต้องสร้าง, ฟังก์ชัน/คลาสสำคัญ, สัญญาณเข้า-ออก
- รายละเอียดตารางฐานข้อมูล, ดัชนี, ข้อจำกัด
- ลำดับการเรียกฟังก์ชันสำหรับโฟลว์สำคัญ
- กลยุทธ์การทดสอบและ Traceability ไปยัง Requirements

### 1.2 Scope (MVP Modules) + Docker-First Strategy
| # | Module | FR Coverage | Priority | Phase |
|---|--------|------------|----------|-------|
| 1 | **auth** | FR-USER-01, FR-USER-02, FR-USER-03 | Critical | 1.0 |
| 2 | **property** | FR-PROP-01 ~ FR-PROP-07 | Critical | 1.0 |
| 3 | **billing** | FR-METER-01 ~ FR-METER-14, BR-07, BR-08, BR-10 | Critical | 1.0 |
| 4 | **tenant** | FR-TENANT-01 ~ FR-TENANT-04 | High | 1.0 |
| 5 | **contract** | FR-CONTRACT-01 ~ FR-CONTRACT-05, BR-01, BR-02 | High | 1.0 |
| 6 | **dashboard** | FR-DASH-01 ~ FR-DASH-04 | Medium | 1.0 |
| 7 | **maintenance** | FR-MAINT-01 ~ FR-MAINT-03 | Low | 1.5 (Post-MVP) |

> ℹ️ **หมายเหตุ:** 
> - โมดูล `maintenance` ถูกระบุในเอกสารนี้เพื่อเตรียมโครงสร้าง แต่การพัฒนาจะเริ่มหลังเฟส 1 เสร็จสิ้น
> - **Docker-First Strategy:** การพัฒนาและทดสอบทั้งหมดต้องรันภายใน Docker container เท่านั้น (`docker compose`) เพื่อรับประกันสภาพแวดล้อมที่สม่ำเสมอระหว่างพัฒนา, ทดสอบ, และผลิต (สอดคล้องกับ NFR Portability)
> - สำหรับ Docker-First Strategy รายละเอียดเพิ่มเติม ดู [09-deployment.md](09-deployment.md)

### 1.3 References
| Document | Version | Location |
|----------|---------|----------|
| Software Requirements Specification | 1.0 | `docs/REQUIREMENTS.md` |
| Domain Model | 1.0 | `docs/DOMAIN_MODEL.md` |
| Software Architecture Document | 1.2 | `docs/ARCHITECTURE.md` |
| AI Agent Guidelines | 1.0 | `AGENTS.md` |
| Docker Compose (Dev) | 1.0 | `docker-compose.dev.yml` |
| Backend Dockerfile | 1.0 | `backend/Dockerfile` |

---

## 11. Appendix

### 11.1 Glossary Reference
See `docs/GLOSSARY.md` for domain terminology definitions.

### 11.2 Reference Standards
- **C4 Model**: https://c4model.com — System architecture visualization
- **IEEE 1016 / ISO/IEC/IEEE 29148**: Software Design Description standard
- **UML 2.5**: Unified Modeling Language specification
- **OWASP ASVS**: Application Security Verification Standard
- **12-Factor App**: https://12factor.net — Cloud-native application principles
- **Docker Best Practices**: https://docs.docker.com/develop/develop-images/dockerfile_best-practices/

### 11.3 ADR Template for Future Decisions
```markdown
### ADR-XXX: [Title]

| Field | Value |
|-------|-------|
| **Status** | [Proposed | Accepted | Deprecated | Superseded] |
| **Date** | YYYY-MM-DD |
| **Context** | [Problem statement, constraints, stakeholders] |
| **Decision** | [Chosen solution, in imperative voice] |
| **Rationale** | [Why this decision over alternatives; trade-offs considered] |
| **Consequence** | [Positive and negative outcomes; mitigation for negatives] |
| **Compliance** | [FR-XXX, NFR-XXX, BR-XXX this decision addresses] |
| **Future Path** | [Conditions under which this decision might be revisited] |
```

### 11.5 Quick Reference — Module File Templates

#### `__init__.py` (Facade Pattern)
```python
# app/modules/billing/__init__.py
"""Billing module public API — only export what other modules may use"""

from .services.meter_service import MeterService
from .services.invoice_service import InvoiceService
from .services.payment_service import PaymentService
from .repository import BillingRepository

__all__ = [
    "MeterService",
    "InvoiceService", 
    "PaymentService",
    "BillingRepository",
]
```

#### `constants.py` (Enums)
```python
# app/modules/billing/constants.py
from enum import StrEnum

class InvoiceStatus(StrEnum):
    DRAFT = "draft"
    SENT = "sent"
    PAID = "paid"
    OVERDUE = "overdue"
    CANCELLED = "cancelled"

class PaymentMethod(StrEnum):
    CASH = "cash"
    BANK_TRANSFER = "bank_transfer"
    QR_CODE = "qr_code"
    OTHER = "other"

class UtilityScopeType(StrEnum):
    PROPERTY = "property"
    BUILDING = "building"
    FLOOR = "floor"
    ROOM = "room"
```

---

## Document Approval

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Product Owner | [Owner Name] | __________________ | 2026-05-24 |
| Technical Lead | [Tech Lead Name] | __________________ | 2026-05-24 |
| QA Lead | [QA Lead Name] | __________________ | 2026-05-24 |

---

> **Document Status**: APPROVED — Ready for Implementation
> **Next Step**: AI Agents begin implementation per module following PR Checklist
> **Change Control**: Any modification requires update of Traceability Matrix + Test Files
> **Docker Command**: `docker compose -f docker-compose.dev.yml --profile dev up` เพื่อเริ่มพัฒนา