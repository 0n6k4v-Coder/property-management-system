# Sprint 09: E2E Campaign — pms-e2e Profile

**Decision:** [`../DECISIONS/001-adopt-hermes-single-e2e-profile.md`](../DECISIONS/001-adopt-hermes-single-e2e-profile.md)
**Features to Test:** [`features-to-test.md`](features-to-test.md)
**Duration:** 2026-07-05 to 2026-07-18 (2 weeks)
**Sprint Goal:** Execute E2E Campaign for 5 critical features using `pms-e2e` profile, generate Master Bug Report, validate release readiness.

---

## 🎯 Sprint Goal
Execute full E2E Campaign for **5 critical features** (Auth, Billing, Property, Contract, Maintenance) using `pms-e2e` profile, validate end-to-end user journeys, generate actionable Master Bug Report for release decision.

---

## 📋 Sprint Backlog (Implementation Plan + Sprint Backlog)

| ID | Task | Decision Ref | Owner | Status | Criteria |
|----|------|--------------|-------|--------|----------|
| S9.1 | Create `pms-e2e` profile | Decision 001 | @kawee | 🟡 Ready | Profile runs, tools enabled |
| S9.2 | Enable tools (browser, kanban, delegation) | Decision 001 | @kawee | 🟡 Ready | All 10 tools enabled |
| S9.3 | Init Kanban board `pms-sprint-e2e` | Decision 001 | @kawee | 🟡 Ready | Board created, lane `test-worker` added |
| S9.4 | Populate E2E tasks from Route Inventory | Decision 001 | @kawee | 🟡 Ready | 22 tasks across 3 groups in `test-worker` lane |
| S9.5 | Execute E2E: Auth (Login, Register, JWT Refresh) | Decision 001 | @hermes | ⏳ Pending | 100% pass, evidence captured |
| S9.6 | Execute E2E: Billing (Invoice CRUD, Payment, Meter) | Decision 001 | @hermes | ⏳ Pending | 100% pass, evidence captured |
| S9.7 | Execute E2E: Property (Building/Floor/Room CRUD) | Decision 001 | @hermes | ⏳ Pending | 100% pass, evidence captured |
| S9.8 | Execute E2E: Contract (Lease Create/Renewal/Expiry) | Decision 001 | @hermes | ⏳ Pending | ≥80% pass, evidence captured |
| S9.9 | Execute E2E: Maintenance (Request→Assign→Complete) | Decision 001 | @hermes | ⏳ Pending | ≥80% pass, evidence captured |
| S9.10 | Generate Master Bug Report (Markdown/JSON) | Decision 001 | @hermes | ⏳ Pending | Actionable, evidence-linked |
| S9.11 | Update Kanban with Pass/Fail + Evidence | Decision 001 | @hermes | ⏳ Pending | All tasks updated |
| **Gate** | **Sprint Review: Proceed to Phase 2?** | Decision 001 | @kawee | ⏳ Pending | Yes/No/Modify |

---

## 📋 Test Execution Order (from features-to-test.md)

| Phase | Priority | Group | Routes | Features | Order |
|-------|----------|-------|--------|----------|-------|
| 1 | P0 | Group 1: Auth | 2 | Auth | 1st |
| 2 | P0 | Group 2: Core | 2 | Billing | 2nd |
| 3 | P0 | Group 2: Core | 3 | Property | 3rd |
| 4 | P0 | Group 2: Core | 1 | Dashboard | 4th |
| 5 | P0 | Group 2: Core | 4 | Tenants, Meter, Invoices, Reports | 5th |
| 6 | P1 | Group 3: Phase 4 | 3 | Contract | 6th |
| 7 | P1 | Group 3: Phase 4 | 2 | Maintenance | 7th |
| 8 | P1 | Group 3: Phase 4 | 1 | Settings | 8th |

> **Reference:** See [Route Inventory & Test Execution Order](../features-to-test.md#test-execution-order-priority) in features-to-test.md

---

## 🎯 Exit Criteria (From Decision 001)

- [ ] `pms-e2e` profile สร้างและรันได้
- [ ] Kanban board `pms-sprint-e2e` ทำงาน (create/assign/complete tasks)
- [ ] E2E Campaign รันครบ 5 features (Auth, Billing, Property, Contract, Maintenance)
- [ ] Master Bug Report ออกมาเป็น Markdown/JSON actionable
- [ ] Kanban tasks update Pass/Fail + Evidence (screenshots, traces, logs) ได้
- [ ] **Decision Gate:** Proceed to Phase 2 (Parallel/Orchestrator)? Yes/No/Modify

---

## 📊 Test Coverage Targets (From features-to-test.md)

| Metric | Target | Measurement |
|--------|--------|-------------|
| **User Journey Coverage** | 100% of P0, 80% of P1 | Journeys executed |
| **Edge Case Coverage** | ≥ 3 per journey | Edge cases executed |
| **Contract Test Pass** | 100% | Schemathesis pass rate |
| **Visual Regression** | 0 regressions | Playwright screenshot diff |
| **Performance** | < 2s p95 | API response time |

> **Reference:** See [Route Inventory](../features-to-test.md#complete-route-inventory-all-22-routes) in features-to-test.md for complete route-to-feature mapping

---

## 🚫 Out of Scope (Sprint 09)

| Feature | Reason | Next Sprint |
|---------|--------|-------------|
| Dashboard KPIs/Charts | Low business risk, visual only | Sprint 10+ |
| Notification Preferences | Low risk, background | Sprint 10+ |
| Admin Audit Viewer | Internal tool, low user impact | Sprint 10+ |
| Multi-tenant Lease | Edge case, low frequency | Sprint 11+ |
| Multi-language Support | Not in v1.0.0 scope | Post-v1.0 |

---

## ⚠️ Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Playwright Chromium memory OOM | Medium | High | Run headless, limit concurrency |
| Sequential execution too slow | High | Medium | Measure cycle time → trigger Phase 2 parallel |
| Playwright Chromium flaky | Low | | | | Retry logic + health checks; fallback to manual re-run |
| E2E pipeline flaky | | | Retry logic + health checks; fallback to manual re-run |
| Master Report not actionable | | | Iterate report format per feature; feedback loop |
| Sequential bottleneck | | | Measure cycle time → trigger Phase 2 parallel |

---

## 🛑 Stop Conditions

| Condition | Action |
|-----------|--------|
| P0 feature has blocking bug | **STOP** → Report immediately → Human decision |
| Hermes crashes repeatedly | **STOP** → Debug → Restart from last checkpoint |
| Sequential time > 2 weeks | **REVIEW** → Measure → Decide Phase 2 trigger |

---

## 📝 Notes for Hermes

> **Hermes:** For each feature in `features-to-test.md`:
> 1. **Design** comprehensive test scenarios (happy + edge + negative)
> 2. **Generate** test data covering boundary conditions
> 3. **Execute** in order of priority (P0 → P1)
> 4. **Analyze** failures with root cause hints
> 4. **Generate** Master Bug Report with severity, reproduction steps, evidence
>
> **Stop Condition:** If P0 feature has blocking bug → STOP → Report immediately → Human decision
>
> **Reference:** See [Route Inventory](../features-to-test.md#complete-route-inventory-all-22-routes) and [Test Execution Order](../features-to-test.md#test-execution-order-priority) in features-to-test.md for complete route-to-feature mapping and execution sequence.

---

## 📊 Sprint Metrics (Track Daily)

| Metric | Target | Current |
|--------|--------|---------|
| Tasks Completed | 11/11 | 0/11 |
| P0 Features Pass | 3/3 | 0/3 |
| P1 Features Pass | 2/2 | 0/2 |
| Bugs Found | Track | 0 |
| Critical Bugs | 0 | 0 |
| Cycle Time (per feature) | < 1 day | TBD |

---

## ✅ Definition of Done (Per Task)

- [ ] Test scenarios designed (happy + edge + negative)
- [ ] Test data generated (boundary conditions)
- [ ] Tests executed (sequential, priority order)
- [ ] Results analyzed (root cause hints for failures)
- [ ] Evidence captured (screenshots, traces, logs)
- [ ] Kanban updated (Pass/Fail + Evidence)
- [ ] Master Bug Report updated

---

## 📅 Timeline

| Week | Focus |
|------|-------|
| Week 1 (Jul 5-11) | Profile setup, Kanban, Auth + Billing E2E |
| Week 2 (Jul 12-18) | Property + Contract + Maintenance E2E, Master Report, Gate Review |

---

## 📝 Changelog

| Date | Version | Change | By |
|------|---------|--------|-----|
| 2026-07-05 | 1.0 | Initial Sprint 09 Plan from Decision 001 | @hermes-agent |

---

## 📋 Next Steps

1. **Approve Sprint 09** → Human confirms scope
2. **Execute S9.1-S9.4** → Setup profile, tools, Kanban, tasks
3. **Execute S9.5-S9.9** → Run E2E Campaign (sequential)
4. **Execute S9.10-S9.11** → Generate Report, Update Kanban
5. **Gate Review** → Decide Phase 2

---

**Status:** 🟡 **Ready for Execution** — Awaiting Human approval to start S9.1

---

> **Reference:** [Decision 001](../DECISIONS/001-adopt-hermes-single-e2e-profile.md) | [Features to Test](features-to-test.md) | [DLC.md](../DLC.md)
EOF