# Discussion Template — Property Management System

**ใช้สำหรับ:** `docs/DECISIONS/000-discussion-<topic>.md`

---

## Metadata

```yaml
title: "Adopt Hermes Multi-Agent Profiles + Kanban Board for PMS Fullstack Integration Testing & Hardening"
status: "🟢 Accepted"
number: "000"
topic: "hermes-multi-agent"
created: "2026-07-05"
updated: "2026-07-05"
author: "@hermes-agent (nemotron-3-ultra-550b-a55b)"
participants:
  - "@kawee"
related_decisions: []
supersedes: []
tags: ["ai-agent", "hermes", "multi-agent", "kanban", "profiles", "parallel-agents", "orchestrator", "e2e-testing"]
```

---

## 1. Context & Problem Statement (บริบทและปัญหา)

**What is the problem we're trying to solve?**

Project Property Management System (PMS) อยู่ในช่วง **Sprint 1-8 Complete** — Backend v1.0.0 + Frontend v1.0.0 พร้อม production-ready แล้ว กำลังจะเข้าสู่ **Fullstack Integration Testing & Hardening Phase** เพื่อยืนยันว่าทุกฟีเจอร์ทำงานถูกต้อง end-to-end ไม่มี bug ก่อนจะไปสู่ **v1.0.0 Release & Production Deployment** และ Sprint ใหม่ๆ

**ปัญหาที่เจอ:**
- การพัฒนา feature ใหม่ (backend + frontend + test) ใช้เวลานานเพราะทำคนเดียว sequential
- Context switching ระหว่าง backend (FastAPI/Python) ↔ frontend (React/TypeScript) ↔ testing ทำให้ช้า
- ไม่มี work queue ที่จัดการ task ได้แบบ distributed — task assignment, tracking, progress visibility ขาด
- AI Agent (Hermes) มีความสามารถ Multi-Agent แต่ยังไม่ได้ใช้ใน project นี้

**Current State:**
- Single-agent workflow: 1 agent ทำ backend → frontend → test ทีละอย่าง
- No structured work queue for AI agents
- Manual task assignment และ tracking

**Desired State:**
- Parallel development: Backend agent + Frontend agent + Test agent ทำงานพร้อมกันใน feature เดียวกัน
- Durable work queue (Kanban) จัดการ task assignment, auto-dispatch, progress tracking
- Isolated environments per role (profiles) — skills, tools, memory แยกกัน
- **Accelerate Fullstack Integration Testing & Hardening** — เร่งการทดสอบ end-to-end ทุกฟีเจอร์ให้ครบถ้วน ไม่มี regression
- Faster sprint velocity, better quality through specialization

---

## 2. Scope (ขอบเขต)

| In Scope | Out of Scope |
|----------|--------------|
| - Hermes Profiles setup (backend, frontend, testing) | - Full team rollout (เริ่มต้นทดสอบคนเดียว) |
| - Kanban board `pms-sprint` + worker lanes | - Integration with external PM tools (Jira, Linear) |
| - Parallel agents via tmux + worktree | - Mobile/desktop app agents |
| - Basic cron jobs for auto test/security scan | - Advanced dispatcher AI routing |
| - Skills for PMS patterns (backend/frontend/testing) | - Cross-project agent coordination |
| - Gateway notifications (Telegram/Slack) | - Full CI/CD replacement |

---

## 2.5. Phase 1 Architecture: Single E2E Profile (Option B)

### Recommended Approach: **Option B — Single `pms-e2e` Profile**

**Phase 1 Scope:** หนึ่ง Profile (`pms-e2e`) ที่รวมทุก tools สำหรับรัน E2E Campaign ครบวงจร

| Profile | Role | Tools Enabled | Purpose |
|---------|------|---------------|---------|
| `pms-e2e` | E2E Test Engineer | `terminal, file, code_execution, web, skills, memory, session_search, cronjob, kanban, browser, delegation` | รัน E2E Campaign ครบ: pytest (backend), Playwright (frontend), Schemathesis (contract), Master Bug Report |

### Design Rationale

| Decision | Rationale |
|----------|-----------|
| **Single Profile (`pms-e2e`)** | เรียนรู้ Hermes + Kanban + E2E Pipeline ให้รู้เรื่องก่อน — ไม่กระจายความสนใจ |
| **All tools in one profile** | E2E Campaign ต้องการ: backend (pytest), frontend (Playwright browser), contract (Schemathesis), Kanban tracking — รวมใน profile เดียวทำงานได้เร็วที่สุด |
| **Sequential execution first** | Tasks รันตามลำดับใน Kanban lane `test-worker` — เรียนรู้ pipeline reliability ก่อน |
| **No Orchestrator yet** | Human เป็น Coordinator ตรงๆ — เรียนรู้ workflow จริงก่อนค่อย automate |
| **Trigger-based scaling** | เพิ่ม Profiles (Orchestrator, Parallel Agents) เฉพาะเมื่อ "เจ็บ" จริง (sequential ช้า, tasks > 20, coordination ซับซ้อน) |

### Kanban Board Design

| Board | Lane | Purpose |
|-------|------|---------|
| `pms-sprint-e2e` | `test-worker` | E2E tasks ทั้งหมด (sequential queue) |

### Phase 1 Exit Criteria (Gate to Phase 2)

- [ ] `pms-e2e` profile สร้างและรันได้
- [ ] Kanban board `pms-sprint-e2e` ทำงาน (create/assign/complete tasks)
- [ ] E2E Campaign รันครบ 3-5 features (Auth, Billing, Property, Contract, Maintenance)
- [ ] Master Bug Report ออกมาเป็น Markdown/JSON actionable
- [ ] Kanban tasks update Pass/Fail + Evidence (screenshots, traces, logs) ได้
- [ ] **Decision Gate**: Proceed to Phase 2 (Parallel/Orchestrator)? Yes/No/Modify

### Phase 2+ Trigger Conditions (เพิ่ม Profiles เมื่อ "เจ็บ")

| Trigger | Phase 2 Action |
|---------|----------------|
| Sequential execution ช้าจริง (cycle time > target) | เพิ่ม Parallel Agents (tmux 3 agents) |
| Tasks > 20 ขนานพร้อมกัน | เพิ่ม `pms-orchestrator` สำหรับ auto-dispatch |
| Coordination ระหว่าง backend/frontend/test ซับซ้อน | เพิ่ม `pms-orchestrator` สำหรับ context relay |
| Need CI/CD automation | เพิ่ม `pms-devops` |
| Security audit ต้องการ | เพิ่ม `pms-security` |
| Docs outdated บ่อย | เพิ่ม `pms-docs` |

---

## 3. Options Considered (ตัวเลือกที่พิจารณา)

| Option | Description | Pros | Cons | Effort | Risk |
|--------|-------------|------|------|--------|------|
| **A: Status Quo** | คงเดิม Single agent sequential workflow | - รู้จักแล้ว<br>- Setup 0 | - ช้า (sequential)<br>- Context switch overhead<br>- ไม่ scale | Low | High (velocity bottleneck) |
| **B: Single E2E Profile (Phase 1)** ✅ 🔥 | 1 Profile `pms-e2e` + Kanban board `pms-sprint-e2e` | - Setup เร็วที่สุด<br>- เรียนรู้ Hermes + Kanban + E2E ด้วย 1 profile<br>- Master Report เดียว<br>- Fail fast, learn fast | - ไม่ parallel (sequential per task)<br>- Bottleneck ถ้า tasks เยอะ | **Very Low** | **Very Low** |
| **C: 3 Profiles + Kanban** | `pms-backend`, `pms-frontend`, `pms-testing` + Kanban | - Parallel execution<br>- Separation of concerns | - Setup complexity สูงกว่า<br>- เรียนรู้ 3 profiles พร้อมกัน | Medium | Low |
| **D: 3 Profiles + Kanban + Parallel Agents** 🔥 | Option C + Spawn 3 tmux agents (backend, frontend, test) พร้อมกัน | - True parallel development<br>- Max velocity<br>- Specialization per agent<br>- Worktree mode prevents git conflicts | - Highest resource (RAM ~2-3GB)<br>- Complex debugging<br>- tmux session management | High | Medium |
| **E: External Tools** | ใช้ GitHub Projects / Jira / Linear + manual agent spawn | - ทีมคุเคย<br>- Rich UI | - ไม่ integrated กับ Hermes agents<br>- Manual bridge required<br>- No auto-dispatch | Medium | High |
| **F: Profiles + Kanban + Orchestrator** | Option C + `pms-orchestrator` profile สำหรับ planning/dispatch/context-relay | - Single point of contact<br>- Holistic architecture view<br>- Automatic task distribution<br>- Quality gate (review before merge)<br>- Context relay between agents | - Highest complexity<br>- Orchestrator = bottleneck risk<br>- +1 agent resource<br>- Advanced delegation skills needed | High | Medium |

> **หมายเหตุ:** **Option B (Single E2E Profile) = Phase 1** → Option C/D/F เป็น Phase 2+ เมื่อ trigger criteria ถูกต้อง

---

## 3.1. Option B Deep Dive: Single E2E Profile (Phase 1)

### Why Option B for Phase 1?

| Criteria | Score (1-5) | Reason |
|----------|-------------|--------|
| **Speed to Value** | 5/5 | ได้ E2E reports ในวันแรก |
| **Learning Efficiency** | 5/5 | เรียนรู้ 1 profile, 1 Kanban, 1 agent |
| **Risk** | 1/5 | 1 profile = fail fast, pivot ได้ง่าย |
| **Foundation Quality** | 4/5 | ทดสอบ Kanban + E2E pipeline จริง |
| **Reversibility** | 5/5 | ลบ/สร้าง profile ใหม่ 5 นาที |

### Phase 1 Scope (Option B)

| In Scope | Out of Scope |
|----------|--------------|
| - `pms-e2e` profile setup | - Parallel agents (tmux) |
| - Kanban board `pms-sprint-e2e` | - Orchestrator profile |
| - E2E Campaign: pytest + Playwright + Schemathesis | - Parallel execution (tasks sequential) |
| - Master Bug Report generation | - Orchestrator auto-dispatch |
| - Kanban task tracking (Pass/Fail) | - Advanced context relay |

### Exit Criteria (Phase 1 Gate)

- [ ] `pms-e2e` profile สร้างและรันได้
- [ ] Kanban board `pms-sprint-e2e` ทำงาน (create/assign/complete tasks)
- [ ] E2E Campaign รันครบ 3-5 features (Auth, Billing, Property)
- [ ] Master Bug Report ออกมาเป็น Markdown/JSON
- [ ] Kanban tasks update Pass/Fail + Evidence ได้
- [ ] **Decision Gate**: Proceed to Phase 2 (Parallel/Orchestrator)? Yes/No/Modify

---

## 4. Detailed Analysis (วิเคราะห์ละเอียด)

### Option C: Profiles + Kanban Board (Recommended Phase 1)

#### Technical Details
- **Profiles (3):**
  - `pms-backend` — tools: terminal, file, code_execution, web, skills, memory, session_search, delegation, cronjob, kanban
  - `pms-frontend` — tools: terminal, file, code_execution, web, skills, memory, session_search, delegation, cronjob, kanban, browser
  - `pms-testing` — tools: terminal, file, code_execution, web, skills, memory, session_search, delegation, cronjob, kanban
- **Kanban Board:** `pms-sprint`
  - Columns: Backlog → Ready → In Progress → Review → Done
  - Worker lanes: `backend-worker`, `frontend-worker`, `test-worker`
  - Dispatcher daemon: `hermes kanban dispatch --daemon`
- **Skills:** Project-specific skills ใน `~/.hermes/skills/pms-*`
  - `pms-backend-patterns` — FastAPI, SQLAlchemy, Argon2id, Alembic patterns
  - `pms-frontend-patterns` — React 19, Vite 8, PWA, Playwright patterns
  - `pms-testing-patterns` — pytest, async_client, Vitest, Playwright, contract testing

#### Resource Requirements
| Resource | Estimate | Notes |
|----------|----------|-------|
| Time | 1-2 weeks | Setup + pilot 1 feature |
| People | 1 (me) | Solo experiment first |
| Infrastructure | Existing | Hermes local, no new servers |
| Learning Curve | ~1 day | Hermes Kanban CLI, dispatcher |

#### Risks & Mitigations
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Kanban dispatcher bug/stall | Medium | High | Manual assign fallback; `failure_limit: 2` auto-block |
| Resource exhaustion (RAM/CPU) | Low | Medium | Monitor; limit concurrent agents; use worktree mode |
| Git conflicts between agents | Low | High | Mandatory `-w` worktree mode; separate branches |
| Skills not comprehensive enough | Medium | Medium | Iterate skills per sprint; start with core patterns |
| Dispatcher daemon dies silently | Low | High | Cron job health check + gateway notification |

---

### Option D: Add Parallel Agents (Phase 2)

#### Technical Details
- Spawn 3 tmux sessions with worktree mode:
  ```bash
  # Backend agent
  tmux new-session -d -s pms-backend 'hermes -p pms-backend -w'
  tmux send-keys -t pms-backend 'Build billing module APIs' Enter
  
  # Frontend agent
  tmux new-session -d -s pms-frontend 'hermes -p pms-frontend -w'
  tmux send-keys -t pms-frontend 'Build billing dashboard UI' Enter
  
  # Test agent
  tmux new-session -d -s pms-testing 'hermes -p pms-testing -w'
  tmux send-keys -t pms-testing 'Write integration tests for billing' Enter
  ```
- Context relay: Backend agent shares API schema → Frontend agent consumes

#### Additional Resource Requirements
| Resource | Estimate |
|----------|----------|
| RAM | +2-3 GB (3 agents × ~1GB) |
| CPU | +2-4 cores |
| Disk | Worktree clones (~500MB each) |

---

## 5. Open Questions (คำถามที่ยังไม่มีคำตอบ)

### Phase 1 (Option B - Single `pms-e2e` Profile)
- [ ] **Hardware capacity:** Local machine รองรับ 1 Hermes agent + Playwright Chromium ได้ไหม?
- [ ] **Kanban usability:** `hermes kanban` CLI intuitive พอสำหรับ manual task management ไหม?
- [ ] **E2E Pipeline reliability:** `pytest + playwright + schemathesis` รัน sequential ไปหมด ไม่ timeout/crash ไหม?
- [ ] **Master Report quality:** Report ที่ generate ออกมา actionable พอสำหรับตัดสินใจ fix/release ไหม?
- [ ] **Sequential bottleneck:** Tasks รัน sequential ช้าจริงไหม? (ถ้าช้า → Phase 2 parallel)

### Phase 2+ (Deferred - รอ Trigger Criteria)
- [ ] **Hardware capacity (Phase 2):** 3-4 agents + tmux + containers OK?
- [ ] **Orchestrator authority:** Orchestrator merge PR ได้เลยไหม? Phase 2: ยังรอ Human Approval
- [ ] **Orchestrator failure:** Crash → workers ทำต่อได้ไหม?
- [ ] **Model consistency:** ทุก profiles ใช้ model เดียวกัน (`nemotron-3-ultra-550b-a55b`)?
- [ ] **Phase strategy:** Orchestrator เริ่ม Phase 2 หรือ 3?
- [ ] **Notification setup:** Gateway (Telegram/Slack) ใช้ได้ใน WSL environment ไหม?
- [ ] **Cost/benefit measurement:** จะวัด velocity improvement ยังไง? (story points/sprint? lead time? cycle time?)

---

## 6. Stakeholder Feedback (ความคิดเห็นจากผู้เกี่ยวข้อง)

| Stakeholder | Role | Feedback | Date |
|-------------|------|----------|------|
| @kawee | Project Owner | **Phase 1: Option B (Single `pms-e2e` Profile)** — เริ่ม Simple, เรียนรู้ Hermes + Kanban + E2E ก่อน | 2026-07-05 |
| @kawee | Project Owner | **Phase 2 Trigger:** เพิ่ม Profiles เมื่อ "เจ็บ" (sequential ช้า, tasks > 20, coordination ซับซ้อน) | 2026-07-05 |
| @kawee | Project Owner | **Model:** Phase 1 ใช้ `nemotron-3-ultra-550b-a55b` เดียวกัน | 2026-07-05 |
| @hermes-agent (nemotron-3-ultra-550b-a55b) | AI Assistant | แนะนำ Option B First — Maximum learning, minimum risk, reversible | 2026-07-05 |

---

## 7. Related Documentation (เอกสารที่เกี่ยวข้อง)

- [Architecture Decision Log](README.md)
- [Decision Template](../templates/decision-template.md)
- [ARCHITECTURE.md](../ARCHITECTURE.md#ai-agent-infrastructure) — *จะเพิ่ม section AI Agent Infrastructure*
- [SDD: 09-deployment.md](../backend/docs/02-design/SDD/09-deployment.md)
- [OPERATIONS.md](../backend/docs/OPERATIONS.md)
- [Hermes Multi-Agent Ref](../.agents/hermes_multi_agent.md)
- [Hermes Agent Skill](~/.hermes/skills/autonomous-ai-agents/hermes-agent/SKILL.md)

---

## 8. Decision Outcome (ผลลัพธ์การตัดสินใจ) — *Update เมื่อมีการตัดสินใจ*

> **ยังไม่ตัดสินใจ** — รอ Human approve และ pilot test

| Field | Value |
|-------|-------|
| **Decision** | ✅ Accepted / ❌ Rejected / 🔄 Superseded |
| **Decision File** | `001-adopt-hermes-multi-agent-profiles.md` or `001-reject-hermes-multi-agent.md` |
| **Decided By** | @kawee |
| **Decision Date** | YYYY-MM-DD |
| **Implementation Target** | Sprint N / YYYY-MM-DD |

---

## 9. Changelog (การเปลี่ยนแปลง)

| Date | Version | Changes | By |
|------|---------|---------|-----|
| 2026-07-05 | 0.1 | Initial draft from Hermes analysis | @hermes-agent (nemotron-3-ultra-550b-a55b) |
| 2026-07-05 | 0.2 | Added Option C/D/F, Orchestrator profile, 4-profile design | @hermes-agent (nemotron-3-ultra-550b-a55b) |
| 2026-07-05 | 0.3 | **Pivot to Option B (Single `pms-e2e` Profile) for Phase 1** — Simplified architecture, phased approach, trigger-based scaling | @hermes-agent (nemotron-3-ultra-550b-a55b) |

---

## Usage Instructions

1. **Copy** this template → `docs/DECISIONS/000-discussion-<topic>.md`
2. **Fill** metadata (YAML frontmatter) + sections 1-7
3. **Share** for review (tag stakeholders)
4. **Iterate** based on feedback (update changelog)
5. **Decide** → Create decision file from `decision-template.md`
6. **Link** both files together (cross-references)
7. **Update** `README.md` index table

---

> 💡 **Tip:** Discussion file เป็น living document — อัปเดตตลอดการวิเคราะห์ Decision file เป็น immutable record — สร้างครั้งเดียวเมื่อตัดสินใจแล้ว