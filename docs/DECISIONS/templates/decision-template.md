# Decision Template (ADR) — Property Management System

**ใช้สำหรับ:** `docs/DECISIONS/NNN-adopt-<topic>.md`, `NNN-reject-<topic>.md`, `NNN-supersede-<topic>.md`

> **สำคัญ:** Decision file เป็น **Immutable Record** — ห้ามแก้ไขหลัง approve แล้ว (ยกเว้น typo/formatting) หากต้องเปลี่ยนใจ ให้สร้าง decision ใหม่แบบ `NNN-supersede-...` แทน

---

## Metadata

```yaml
title: "<Short topic title>"
status: "✅ Accepted"  # ✅ Accepted | ❌ Rejected | 🔄 Superseded
number: "NNN"          # 001, 002, 003...
topic: "<kebab-case-topic>"
type: "adopt"          # adopt | reject | supersede
created: "YYYY-MM-DD"
decided: "YYYY-MM-DD"
decided_by: "@username"
discussion: "000-discussion-<topic>.md"  # link to discussion
supersedes: []         # e.g., ["001-adopt-old-decision"] (for supersede type)
tags: []               # e.g., ["ai-agent", "hermes", "multi-agent", "kanban"]
```

---

## 1. Decision Statement (ข้อความตัดสินใจ)

> **We will <action> <what> because <reason>.**

ตัวอย่าง:
> **We will adopt Hermes Multi-Agent Profiles + Kanban Board for Sprint work management because it enables parallel development (backend+frontend+test), provides durable work queue, and isolates agent contexts.**

---

## 2. Context (บริบท) — *Summary จาก Discussion*

สรุปสั้นๆ (2-3 ย่อหน้า) จาก `000-discussion-<topic>.md`:
- ปัญหา/โอกาสหลัก
- Constraints ที่สำคัญ
- Timeline pressure (ถ้ามี)

> **อ้างอิง:** ดูรายละเอียดเต็มใน [`000-discussion-<topic>.md`](000-discussion-<topic>.md)

---

## 3. Options Considered (ตัวเลือกที่พิจารณา) — *Summary*

| Option | Verdict | Key Reason |
|--------|---------|------------|
| A: Status Quo | ❌ Rejected | Does not solve parallel dev problem |
| B: <Option Name> | ❌ Rejected | <reason> |
| **C: <Chosen Option>** | ✅ **Accepted** | **<key reason>** |

---

## 4. Decision Details (รายละเอียดการตัดสินใจ)

### What We Will Do
- Action 1: ...
- Action 2: ...
- Action 3: ...

### What We Will NOT Do
- Non-action 1: ...
- Non-action 2: ...

### Scope Boundaries
| In Scope | Out of Scope |
|----------|--------------|
| - Item 1 | - Item A |
| - Item 2 | - Item B |

---

## 5. Consequences (ผลกระทบ)

### ✅ Positive (Benefits)
- Benefit 1: ...
- Benefit description
- Benefit 2:  Benefit description
- Benefit 3:  Benefit description

### ⚠️ Negative (Costs/Risks)
| Risk | Mitigation | Owner | Timeline |
|------|------------|-------|----------|
| Risk 1 | Mitigation plan | @owner | Sprint N |
| Risk 2 | Mitigation plan | @owner | Sprint N+1 |

### 🔧 Resource Impact
| Resource | Before | After | Delta |
|----------|--------|-------|-------|
| Dev Velocity | X pts/sprint | Y pts/sprint | +Z% |
| Infrastructure Cost | $X/mo | $Y/mo | +$Z |
| Team Learning | 0 hrs | X hrs | Training needed |
| RAM/CPU (agents) | - | ~2-3GB | New requirement |

---

## 6. Implementation Plan (แผนดำเนินการ)

| Phase | Task | Owner | Target | Status |
|-------|------|-------|--------|--------|
| 1 | Setup profiles (backend, frontend, testing) | @owner | YYYY-MM-DD | 🟡 Planned |
| 2 | Init Kanban board + worker lanes | @owner | YYYY-MM-DD | 🟡 Planned |
| 3 | Test parallel agents on pilot feature | @owner | YYYY-MM-DD | 🟡 Planned |
| 4 | Document patterns in AI_AGENT_WORKFLOW/ | @owner | YYYY-MM-DD | 🟡 Planned |
| 5 | Team rollout / next sprint | @owner | Sprint N+1 | 🟡 Planned |

---

## 7. Success Criteria (เกณฑ์ความสำเร็จ)

- [ ] Metric 1: e.g., "Sprint velocity increase ≥20%"
- [ ] Metric 2: e.g., "Parallel feature delivery (backend+frontend) in same sprint"
- [ ] Metric 3: e.g., "Team satisfaction survey ≥4/5"
- [ ] Metric 4: e.g., "No critical git conflicts with worktree mode"

---

## 8. Revisit Triggers (เมื่อไหร่ควร review อีกครั้ง)

Decision นี้จะถูก review ใหม่เมื่อ:
- [ ] หลังใช้งาน **3 Sprints** — วัด velocity, quality, team satisfaction
- [ ] Resource usage เกิน threshold (RAM > 4GB, CPU > 80% sustained)
- [ ] Kanban dispatcher มีปัญหา critical > 2 ครั้ง/สัปดาห์
- [ ] Team feedback ระบุ blocker ทำไม่ได้
- [ ] มี technology change ทำให้ approach นี้ล้าสมัย

---

## 9. Related Documentation (เอกสารที่เกี่ยวข้อง)

| Document | Link | Purpose |
|----------|------|---------|
| Discussion | [`000-discussion-<topic>.md`](000-discussion-<topic>.md) | Full analysis & options |
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
| **Decision Owner** | @username | ✅ Approved | YYYY-MM-DD |
| **Technical Lead** | @username | ✅ Approved | YYYY-MM-DD |
| **Product Owner** | @username | ✅ Approved | YYYY-MM-DD |

> **หมายเหตุ:** ใน project นี้ "Decision Owner" = ผู้ขอ decision (มักเป็น @kawee) มีอำนาจตัดสินใจได้เลย — signatures อื่นๆ เป็น advisory

---

## 11. Changelog (สำหรับ Supersede/Amendment เท่านั้น)

| Date | Version | Change Type | Description | Author |
|------|---------|-------------|-------------|--------|
| YYYY-MM-DD | 1.0 | Initial | Decision created | @author |
| YYYY-MM-DD | 1.1 | Amendment | Updated success criteria | @author |
| YYYY-MM-DD | 2.0 | Supersede | Replaced by 005-... | @author |

> ⚠️ **ห้ามแก้ไข section 1-10 หลัง approve** — ใช้ section 11 สำหรับ track amendment/supersede เท่านั้น

---

## Usage Instructions

1. **Copy** this template → `docs/DECISIONS/NNN-adopt-<topic>.md`
2. **Fill** from discussion summary (`000-discussion-<topic>.md`)
3. **Review** with stakeholders (async or meeting)
4. **Approve** → Update status to ✅, fill signatures
5. **Link** back to discussion file (cross-reference)
6. **Update** `README.md` index table
7. **Propagate** → Update cross-references in ARCHITECTURE.md, SDD, OPERATIONS.md
8. **Implement** per Implementation Plan
9. **Track** success criteria at revisit triggers

---

## Quick Checklist (ก่อน approve)

- [ ] Discussion file exists and linked (`discussion:` field)
- [ ] All options considered documented
- [ ] Consequences (positive + negative) filled
- [ ] Mitigations for each risk identified
- [ ] Implementation plan has owners + dates
- [ ] Success criteria are measurable
- [ ] Revisit triggers defined
- [ ] Cross-references to implementation guides added
- [ ] Signatures collected (at minimum Decision Owner)
- [ ] README.md index updated