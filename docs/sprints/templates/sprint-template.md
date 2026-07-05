# Sprint Template

> **Template for Sprint Planning & Execution**
>
> **Usage:** Copy this file to `SPRINT_N.md` and fill in all sections.
> **Reference:** [DLC.md](../DLC.md) — AI-Native SDLC Continuous Flow Model

---

# Sprint N: [Sprint Name]

**Decision(s):** [`../DECISIONS/XXX-adopt-....md`](../DECISIONS/XXX-adopt-....md)
**Features to Test/Build:** [`features-to-test.md`](features-to-test.md) or [`sprint-backlog.md`](sprint-backlog.md)
**Duration:** YYYY-MM-DD to YYYY-MM-DD (2 weeks recommended)
**Sprint Goal:** [One clear sentence describing the sprint objective]

---

## 🎯 Sprint Goal

[One clear, measurable sentence describing what this sprint will achieve.
Example: "Complete E2E validation for Auth, Billing, and Property modules to validate release readiness."]

---

## 📋 Sprint Backlog (Implementation Plan + Sprint Backlog)

| ID | Task | Decision Ref | Owner | Status | Criteria |
|----|------|--------------|-------|--------|----------|
| SN.1 | [Task description] | Decision XXX | @owner | 🟡 Ready | [Measurable criteria] |
| SN.2 | [Task description] | Decision XXX | @owner | 🟡 Ready | [Measurable criteria] |
| SN.3 | [Task description] | Decision XXX | @owner | ⏳ Pending | [Measurable criteria] |
| SN.4 | [Task description] | Decision XXX | @owner | ⏳ Pending | [Measurable criteria] |
| SN.5 | [Task description] | Decision XXX | @owner | ⏳ Pending | [Measurable criteria] |
| **Gate** | **Sprint Review: [Decision: Continue/Pivot/Complete]** | Decision XXX | @owner | ⏳ Pending | [Yes/No/Modify] |

> **Status Legend:** 🟡 Ready | ⏳ Pending | ✅ Done | ❌ Blocked | 🔄 In Progress

---

## 🎯 Exit Criteria (From Decision)

- [ ] [Exit criteria 1 from Decision]
- [ ] [Exit criteria 2 from Decision]
- [ ] [Exit criteria 3 from Decision]
- [ ] **Decision Gate:** [Proceed to next phase? Yes/No/Modify]

---

## 📊 Success Metrics

| Metric | Target | Measurement | Current |
|--------|--------|-------------|---------|
| [Metric 1] | [Target] | [How measured] | [Current] |
| [Metric 2] | [Target] | [How measured] | [Current] |
| [Metric 3] | [Target] | [How measured] | [Current] |

---

## 🚫 Out of Scope

| Feature/Task | Reason | Next Sprint |
|--------------|--------|-------------|
| [Feature] | [Reason] | Sprint N+1 |
| [Feature] | [Reason] | Sprint N+1 |

---

## ⚠️ Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| [Risk description] | [High/Medium/Low] | [High/Medium/Low] | [Mitigation strategy] |
| [Risk description] | [High/Medium/Low] | [High/Medium/Low] | [Mitigation strategy] |
| [Risk description] | [High/Medium/Low] | [High/Medium/Low] | [Mitigation strategy] |

---

## 🛑 Stop Conditions

| Condition | Action |
|-----------|--------|
| [Condition 1] | [Action: STOP/REVIEW/CONTINUE] |
| [Condition 2] | [Action: STOP/REVIEW/CONTINUE] |
| [Condition 3] | [Action: STOP/REVIEW/CONTINUE] |

---

## 📝 Notes for Hermes (or Implementer)

> **For AI Agent / Implementer:**
> 1. [Instruction 1]
> 2. [Instruction 2]
> 3. [Instruction 3]
>
> **Stop Condition:** [Condition] → [Action]

---

## 📊 Sprint Metrics (Track Daily)

| Metric | Target | Current |
|--------|--------|---------|
| Tasks Completed | [X/Y] | [Current] |
| [Metric 1] | [Target] | [Current] |
| [Metric 2] | [Target] | [Current] |
| Cycle Time (per task) | [Target] | [Current] |

---

## ✅ Definition of Done (Per Task)

- [ ] [DoD criteria 1]
- [ ] [DoD criteria 2]
- [ ] [DoD criteria 3]
- [ ] Evidence captured (logs, screenshots, traces)
- [ ] Kanban/Board updated
- [ ] Documentation updated

---

## 📅 Timeline

| Week | Focus |
|------|-------|
| Week 1 (MM/DD-MM/DD) | [Focus area 1] |
| Week 2 (MM/DD-MM/DD) | [Focus area 2] |

---

## 📝 Changelog

| Date | Version | Change | By |
|------|---------|--------|-----|
| YYYY-MM-DD | 1.0 | Initial Sprint Plan | @author |

---

## 📋 Next Steps

1. **Approve Sprint** → Human confirms scope
2. **Execute Setup Tasks** → Environment, tools, board setup
3. **Execute Core Tasks** → Main deliverables
4. **Execute Wrap-up** → Reports, board updates, gate review
5. **Gate Review** → Decide next sprint / phase

---

## ✅ Sprint Approval

| Role | Name | Signature | Date |
|------|------|-----------|------|
| **Sprint Owner** | @owner | ✅ Approved | YYYY-MM-DD |
| **Decision Owner** | @owner | ✅ Approved | YYYY-MM-DD |

---

## 📋 References

- **Decision:** [`../DECISIONS/XXX-adopt-....md`](../DECISIONS/XXX-adopt-....md)
- **Features/Backlog:** [`features-to-test.md`](features-to-test.md) or [`sprint-backlog.md`](sprint-backlog.md)
- **DLC Reference:** [`../DLC.md`](../DLC.md)
- **DLC Phase:** Implement (Sprint = Cadence, not Phase)

---

> **Reminder:** This is a living document. Update status daily. Update metrics per commit. The best sprint is the one that delivers value and learns fast.
EOF