# Decision Template (ADR) — Property Management System

**ใช้สำหรับ:** `docs/DECISIONS/NNN-adopt-<topic>.md`, `NNN-reject-<topic>.md`, `NNN-supersede-<topic>.md`

> **สำคัญ:** Decision file เป็น **Immutable Record** — ห้ามแก้ไขหลัง approve แล้ว (ยกเว้น typo/formatting) หากต้องเปลี่ยนใจ ให้สร้าง decision ใหม่แบบ `NNN-supersede-...` แทน

---

## Metadata

```yaml
title: "Adopt Single Hermes E2E Profile for Phase 1 E2E Campaign"
status: "✅ Accepted"
number: "001"
topic: "hermes-single-e2e-profile"
type: "adopt"
created: "2026-07-05"
decided: "2026-07-05"
decided_by: "@kawee"
discussion: "000-discussion-hermes-multi-agent.md"
supersedes: []
tags: ["ai-agent", "hermes", "multi-agent", "kanban", "e2e-testing", "profiles"]
```

---

## 1. Decision Statement (ข้อความตัดสินใจ)

> **We will adopt Option B: Single `pms-e2e` Profile for Phase 1 E2E Campaign because it delivers maximum learning with minimum risk, provides a complete E2E testing pipeline (backend + frontend + contract) from day one, and establishes a reversible foundation for future multi-agent scaling.**

---

## 2. Context (บริบท) — *Summary จาก Discussion*

Project Property Management System (PMS) อยู่ในช่วง **Sprint 1-8 Complete** — Backend v1.0.0 + Frontend v1.0.0 พร้อม production-ready แล้ว กำลังจะเข้าสู่ **Fullstack Integration Testing & Hardening Phase** เพื่อยืนยันว่าทุกฟีเจอร์ทำงานถูกต้อง end-to-end ไม่มี bug ก่อนจะไปสู่ **v1.0.0 Release & Production Deployment**

**ปัญหาหลัก:**
- การพัฒนา feature ใหม่ (backend + frontend + test) ใช้เวลานานเพราะทำคนเดียว sequential
- Context switching ระหว่าง backend (FastAPI/Python) ↔ frontend (React/TypeScript) ↔ testing ทำให้ช้า
- ไม่มี work queue ที่จัดการ task ได้แบบ distributed
- AI Agent (Hermes) มีความสามารถ Multi-Agent แต่ยังไม่ได้ใช้ใน project นี้

**Constraints สำคัญ:**
- Single developer (Solo experiment first)
- Learning curve ต้องต่ำที่สุด (Fail fast, learn fast)
- ต้องมีค่าใช้ได้จริงตั้งแต่วันแรก (E2E reports actionable)
- Reversible — ถ้าไม่ work ต้อง pivot/get ได้ง่าย

---

## 3. Options Considered (ตัวเลือกที่พิจารณา) — *Summary*

| Option | Verdict | Key Reason |
|--------|---------|------------|
| A: Status Quo | ❌ Rejected | Does not solve parallel dev problem |
| **B: Single `pms-e2e` Profile (Phase 1)** | ✅ **Accepted** | **Fastest value, lowest risk, maximum learning, reversible** |
| C: 3 Profiles + Kanban | 🔄 Deferred | Good for Phase 2 when parallel needed |
| D: 3 Profiles + Kanban + Parallel Agents | 🔄 Deferred | High resource, complexity — need proven pipeline first |
| E: External Tools | ❌ Rejected | Not integrated with Hermes agents |
| F: Profiles + Kanban + Orchestrator | 🔄 Deferred | Bottleneck risk, complexity — defer until trigger |

---

## 4. Decision Details (รายละเอียดการตัดสินใจ)

### What We Will Do (Phase 1)
- [x] สร้าง Profile `pms-e2e` เดียว ครบทุก tools: `terminal, file, code_execution, web, skills, memory, session_search, cronjob, kanban, browser, delegation`
- [x] สร้าง Kanban Board `pms-sprint-e2e` พร้อม Lane `test-worker`
- [x] Populate E2E tasks: Auth, Billing, Property, Contract, Maintenance (3-5 features)
- [x] รัน E2E Campaign sequential: pytest (backend) + Playwright (frontend) + Schemathesis (contract)
- [x] Generate Master Bug Report (Markdown/JSON) actionable
- [x] Update Kanban tasks: Pass/Fail + Evidence (screenshots, traces, logs)

### What We Will NOT Do (Deferred to Phase 2+)
- ❌ สร้าง Profiles แยก: `pms-backend`, `pms-frontend`, `pms-testing`, `pms-orchestrator`
- ❌ Parallel Agents (tmux 3 agents พร้อมกัน)
- ❌ Orchestrator auto-dispatch / context relay
- ❌ Parallel execution (tasks รัน sequential ก่อน)
- ❌ Advanced context relay / quality gate automation
- ❌ `pms-devops`, `pms-security`, `pms-docs` profiles

### Scope Boundaries

| In Scope (Phase 1) | Out of Scope (Phase 2+) |
|--------------------|------------------------|
| `pms-e2e` profile setup | Parallel agents (tmux) |
| Kanban board `pms-sprint-e2e` | Orchestrator profile |
| E2E Campaign: pytest + Playwright + Schemathesis | Parallel execution |
| Master Bug Report generation | Orchestrator auto-dispatch |
| Kanban task tracking (Pass/Fail) | Advanced context relay |
| Sequential task execution | Quality gate review | DevOps/Security/Docs profiles |

---

## 5. Consequences (ผลกระทบ)

### ✅ Positive (Benefits)
- **Speed to Value:** ได้ E2E reports ทุก feature ในวันแรก
- **Learning Efficiency:** เรียนรู้ Hermes + Kanban + E2E Pipeline ด้วย 1 profile
- **Risk Minimization:** 1 profile = fail fast, pivot ได้ง่าย (ลบ/สร้างใหม่ 5 นาที)
- **Foundation Quality:** ทดสอบ Kanban + E2E pipeline จริงก่อนลงทุน Phase 2
- **Reversibility:** ลบ/สร้าง profile ใหม่ 5 นาที — ไม่มี sunk cost
- **Actionable Reports:** Master Bug Report ช่วยตัดสินใจ fix/release ได้จริง

### ⚠️ Negative (Costs/Risks)

| Risk | Mitigation | Owner | Timeline |
|------|------------|-------|----------|
| Sequential execution ช้าจริง | Measure cycle time at Gate; trigger Phase 2 parallel if > target | @kawee | Phase 1 Gate |
| Single agent = bottleneck | Delegate sub-tasks via `delegation` tool; spawn subagents | @kawee | Phase 1 |
| Kanban CLI ไม่ intuitive | Fallback: manual task creation + tracking | @kawee | Phase 1 |
| E2E pipeline flaky | Retry logic + health checks; fallback to manual re-run | @kawee | Phase 1 |
| Master Report ไม่ actionable | Iterate report format per feature; feedback loop | @kawee | Phase 1 |

### 🔧 Resource Impact

| Resource | Before | After | Delta |
|----------|--------|-------|-------|
| Dev Velocity | Manual sequential | Agent-assisted E2E | +50-70% (estimated) |
| Infrastructure Cost | $0 | Local Hermes only | $0 |
| Team Learning | 0 hrs | ~4-8 hrs (Hermes + Kanban + E2E) | Training needed |
| RAM/CPU (agents) | - | ~1-2GB RAM, 1-2 CPU cores | New requirement |

---

## 6. Implementation Plan (แผนดำเนินการ)

| Phase | Task | Owner | Target | Status |
|-------|------|-------|--------|--------|
| 1 | Setup `pms-e2e` profile + tools | @kawee | 2026-07-05 | 🟡 Planned |
| 1 | Init Kanban board `pms-sprint-e2e` + lane `test-worker` | @kawee | 2026-07-05 | 🟡 Planned |
| 1 | Populate E2E tasks (Auth, Billing, Property, Contract, Maintenance) | @kawee | 2026-07-05 | 🟡 Planned |
| 1 | Run E2E Campaign (sequential) | @kawee | 2026-07-05 | 🟡 Planned |
| 1 | Generate Master Bug Report + Kanban update | @kawee | 2026-07-05 | 🟡 Planned |
| **Gate** | **Phase 1 Gate Review: Proceed to Phase 2?** | @kawee | 2026-07-05 | ⏳ Pending |
| 2 | Parallel Agents (tmux 3 agents) — if triggered | @kawee | Sprint N+1 | ⏸️ Deferred |
| 2 | Orchestrator profile — if triggered | @kawee | Sprint N+1 | ⏸️ Deferred |
| 2 | DevOps/Security profiles — if triggered | @kawee | Sprint N+1 | ⏸️ Deferred |

---

## 7. Success Criteria (เกณฑ์ความสำเร็จ Phase 1)

- [ ] `pms-e2e` profile สร้างและรันได้ (health check pass)
- [ ] Kanban board `pms-sprint-e2e` ทำงาน (create/assign/complete tasks)
- [ ] E2E Campaign รันครบ 3-5 features (Auth, Billing, Property minimum)
- [ ] Master Bug Report ออกมาเป็น Markdown/JSON actionable
- [ ] Kanban tasks update Pass/Fail + Evidence (screenshots, traces, logs) ได้
- [ ] **Decision Gate:** Proceed to Phase 2 (Parallel/Orchestrator)? Yes/No/Modify

---

## 8. Revisit Triggers (เมื่อไหร่ควร review อีกครั้ง)

Decision นี้จะถูก review ใหม่เมื่อ:
- [x] หลัง Phase 1 Gate Review — วัด velocity, quality, learning
- [ ] Resource usage เกิน threshold (RAM > 2GB sustained, CPU > 80%)
- [ ] Sequential execution ช้าจริง (cycle time > target) → Trigger Phase 2 Parallel
- [ ] Tasks > 20 ขนานพร้อมกัน → Trigger Phase 2 Orchestrator
- [ ] Coordination ระหว่าง backend/frontend/test ซับซ้อน → Trigger Phase 2 Orchestrator
- [ ] Team feedback ระบุ blocker ทำไม่ได้
- [ ] มี technology change ทำให้ approach นี้ล้าสมัย

---

## 9. Related Documentation (เอกสารที่เกี่ยวข้อง)

| Document | Link | Purpose |
|----------|------|---------|
| Discussion | [`000-discussion-hermes-multi-agent.md`](000-discussion-hermes-multi-agent.md) | Full analysis & options |
| Architecture | [`../ARCHITECTURE.md`](../ARCHITECTURE.md#ai-agent-infrastructure) | System-level reference |
| Implementation Guide | [`../AI_AGENT_WORKFLOW/HERMES_PROFILES.md`](../AI_AGENT_WORKFLOW/HERMES_PROFILES.md) | Profile setup details |
| Implementation Guide | [`../AI_AGENT_WORKFLOW/HERMES_KANBAN.md`](../AI_AGENT_WORKFLOW/HERMES_KANBAN.md) | Kanban board setup |
| Implementation Guide | [`../AI_AGENT_WORKFLOW/HERMES_PARALLEL_AGENTS.md`](../AI_AGENT_WORKFLOW/HERMES_PARALLEL_AGENTS.md) | Parallel agents patterns |
| Deployment | [`../backend/docs/02-design/SDD/09-deployment.md`](../backend/docs/02-design/SDD/09-deployment.md) | Deployment with Hermes |
| Operations | [`../backend/docs/OPERATIONS.md`](../backend/docs/OPERATIONS.md) | Ops runbooks |

---

## 10. Approval & Sign-off (การอนุมัติ)

| Role | Name | Signature | Date |
|------|------|-----------|------|
| **Decision Owner** | @kawee | ✅ Approved | 2026-07-05 |
| **Technical Lead** | @kawee | ✅ Approved | 2026-07-05 |
| **Product Owner** | @kawee | ✅ Approved | 2026-07-05 |

> **หมายเหตุ:** ใน project นี้ "Decision Owner" = ผู้ขอ decision (@kawee) มีอำนาจตัดสินใจได้เลย — signatures อื่นๆ เป็น advisory

---

## 11. Changelog (สำหรับ Supersede/Amendment เท่านั้น)

| Date | Version | Change Type | Description | Author |
|------|---------|-------------|-------------|--------|
| 2026-07-05 | 1.0 | Initial | Decision created | @hermes-agent (nemotron-3-ultra-550b-a55b) |

> ⚠️ **ห้ามแก้ไข section 1-10 หลัง approve** — ใช้ section 11 สำหรับ track amendment/supersede เท่านั้น

---

## Quick Checklist (ก่อน approve)

- [x] Discussion file exists and linked (`discussion:` field)
- [x] All options considered documented
- [x] Consequences (positive + negative) filled
- [x] Mitigations for each risk identified
- [x] Implementation plan has owners + dates
- [x] Success criteria are measurable
- [x] Revisit triggers defined
- [x] Cross-references to implementation guides added
- [x] Signatures collected (at minimum Decision Owner)
- [x] README.md index updated

---

**Decision Approved. Ready for Phase 1 Implementation.** 🚀