# File: 02-design/SDD/_index.md
# Backend Software Design Document (SDD) — Table of Contents
## Property Management System

**Document ID:** SDD-PMS-001
**Version:** 1.4
**Status:** Approved — Ready for Implementation
**Date:** 2026-05-24
**Author:** Technical Architecture Team
**Approvers:** [Owner], [Tech Lead]
**Input Documents:** `docs/REQUIREMENTS.md` v1.0, `docs/DOMAIN_MODEL.md` v1.0, `docs/ARCHITECTURE.md` v1.2

---

## Quick Navigation

| # | File | Content |
|---|------|---------|
| 1 | [00-overview.md](00-overview.md) | Document Control + Introduction (Purpose, Scope, References) |
| 2 | [01-architecture.md](01-architecture.md) | UML Package/Component Diagram + Dependency Rules |
| 3 | [02-module-specs.md](02-module-specs.md) | Module Specifications (2.1-2.7) + File Structure + Contracts + Flow Diagrams |
| 4 | [03-api-contract.md](03-api-contract.md) | API Specification (3.1-3.5): Conventions, Endpoints, OpenAPI, Frontend Contract |
| 5 | [04-database-schema.md](04-database-schema.md) | Database Design (4.1-4.7): ERD, Physical Schema, Indexing, Security, Lifecycle, Migration, Data Dictionary |
| 6 | [05-business-rules.md](05-business-rules.md) | Sequence Diagrams + State Machines + BR Enforcement Points |
| 7 | [06-security-audit.md](06-security-audit.md) | Test Strategy (7.1-7.7) + Security Guidelines from §4.4 |
| 8 | [07-traceability.md](07-traceability.md) | Traceability Matrix (FR/BR → Module → Function → Test) |
| 9 | [08-file-inventory.md](08-file-inventory.md) | Implementation Checklist + AI Agent Protocol + Dynamic File Registration |
| 10 | [09-deployment.md](09-deployment.md) | Docker-First Strategy + CI/CD Pipeline |

---

## AI Usage Guide

เมื่ออ่านเอกสารนี้ ให้เริ่มตามลำดับดังนี้:
1. **เริ่มที่ `00-overview.md`** — ทำความเข้าใจ Purpose, Scope, References
2. **อ่าน `02-module-specs.md`** — เพื่อทราบโครงสร้างโมดูลและฟังก์ชันที่ต้องสร้าง
3. **ตรวจสอบ `04-database-schema.md`** — สำหรับ SQLAlchemy models และ indexes
4. **ดู `03-api-contract.md`** — สำหรับ endpoint signatures และ error codes
5. **อ้างอิง `07-traceability.md`** — เพื่อ map FR/BR ไปยังไฟล์และทดสอบ
6. **ปฏิบัติตาม `08-file-inventory.md` §9.5** — AI Agent Implementation Protocol

เอกสารทั้งหมดนี้แยกจาก `backend/docs/SDD.md` v1.4 ต้นฉบับ — เนื้อหาเหมือนเดิม 100%

---

## Table of Contents (Original)

1. [Introduction](00-overview.md)
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
11. [Appendix](00-overview.md)

---

## ✅ SDD Exit Criteria (Must pass before coding begins)

### Content Completeness
- [ ] Module Specifications สำหรับทุก MVP module (auth, property, billing, tenant, contract, dashboard, maintenance)
- [ ] API Specification พร้อม Request/Response schema และ Error format
- [ ] Database Schema พร้อม SQLAlchemy models, Indexes, Constraints
- [ ] Critical Sequence Diagrams สำหรับโฟลว์สำคัญ (อย่างน้อย 2 โฟลว์)
- [ ] State Machine Diagrams สำหรับ Entity ที่มีสถานะซับซ้อน (Invoice, Contract, Room)
- [ ] UML Class Diagram สำหรับอย่างน้อย 1 โมดูลตัวอย่าง (Billing)
- [ ] UML Package/Component Diagram แสดง module dependencies
- [ ] Test Strategy พร้อม Test Pyramid และ Critical Test Cases per FR
- [ ] Traceability Matrix เชื่อมโยง FR → Module → Function → Test
- [ ] Implementation Guidelines สำหรับ AI Agents + Coding Standards
- [ ] Docker-First Strategy: docker-compose.dev.yml, Dockerfile multi-stage, Makefile targets

### Quality Gates
- [ ] ทุกฟังก์ชันระบุ Input/Output/Dependencies/FR-Reference ชัดเจน
- [ ] ทุก Validation Rule ระบุทั้งที่ Schema และ Service layer
- [ ] ทุก Business Rule (BR) มีจุดบังคับใช้ (Enforcement Point) ระบุ
- [ ] ทุก Diagram เขียนใน Mermaid syntax (version-controllable)
- [ ] Test Cases ครอบคลุมทั้ง Positive/Negative/Edge cases
- [ ] Traceability Matrix ครอบคลุม 100% ของ FR/BR ในขอบเขต MVP
- [ ] ทุกคำสั่งทดสอบรันผ่าน `docker compose` ได้ผลลัพธ์สม่ำเสมอ

### Process Gates
- [ ] Human review โดย Owner/Tech Lead/QA แล้วอนุมัติ
- [ ] เอกสารอยู่ใน git มี version และ change history
- [ ] Change control process กำหนดชัดเจน (แก้แล้วต้องอัปเดต Traceability + Tests)
- [ ] Docker environment พร้อมสำหรับพัฒนา (docker-compose.dev.yml รันได้)

✅ All criteria met → SDD approved → Begin implementation per module
❌ Criteria not met → Revise document → Re-review before coding

---

## Distribution

Development Team, QA Team, AI Agents