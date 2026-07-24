# Micro-ADR 005: Adopt Orchestrator Evaluation Checklist as Mandatory Standard

**Status:** ✅ Accepted
**Number:** 005
**Date:** 2026-07-24
**Decided By:** @kawee
**Supersedes:** —
**Superseded By:** —
**Tags:** [ai-agent, orchestrator, executor, verification, docker, file-permissions, quality-gate]

---

## 1. Context (The Problem)

**What is the problem we're solving?**
On 2026-07-24, an incident revealed a gap in the Orchestrator-Executor delegation verification flow. Sub-agents (Executors) created files with permission `600` (owner read/write only) instead of the standard `644` (world-readable). The Orchestrator's verification step — TypeScript Compiler (`tsc --noEmit`) and ESLint — passed on the host because the host user (`kawee`) owned the files. However, the Vite dev server running inside the Docker container (user `node`) failed at runtime with an `EACCES` permission error when trying to read those files.

**Why now?**
The Orchestrator-Executor pattern is the primary delegation mechanism for this project. Without a mandatory verification checklist that accounts for the environment mismatch between host and container, the same class of bug will recur. TSC + ESLint alone are insufficient because they validate syntax and lint rules but not file-system permissions or container readability.

**Root Cause:**
The verification environment (host, user=`kawee`) differs from the runtime environment (Docker container, user=`node`). A file that is readable by `kawee` may not be readable by `node`, and no verification step checked for this.

**Current State:**
- Orchestrator runs `tsc --noEmit` and `eslint` after each Executor task.
- No file-permission check, no container-readability check, no runtime smoke test.
- Bugs surface only at runtime in the Docker container, after the Orchestrator has already marked the task complete.

**Desired State:**
A mandatory 5-step Evaluation Checklist that the Orchestrator must run after every Executor task, catching environment-mismatch bugs before they reach runtime.

---

## 2. Options Considered

| Option | Description | Pros | Cons | Effort | Risk | Verdict |
|--------|-------------|------|------|--------|------|---------|
| A: Status Quo (TSC + ESLint only) | Keep current 2-step verification | - Zero additional cost | - Does not catch permission/container bugs | None | High | ❌ Rejected |
| B: Fix permissions reactively | Manually `chmod 644` when a bug is reported | - Minimal setup | - Reactive, not preventive; bugs still reach runtime | Low | High | ❌ Rejected |
| **C: Mandatory 5-Step Evaluation Checklist** | **TSC + ESLint + permission check + container readability + runtime smoke test** | **- Catches environment-mismatch bugs pre-runtime<br>- Standardized, repeatable<br>- Full coverage** | **- Additional verification time per task** | Low | Low | ✅ **Accepted** |

---

## 3. Decision

> **We will adopt a mandatory 5-step Evaluation Checklist that the Orchestrator must run after every Executor task, because TSC + ESLint alone cannot catch environment-mismatch bugs (host vs. Docker container) such as file permission errors that only surface at runtime.**

**Decision Statement:**
Adopt the following mandatory 5-step Evaluation Checklist, executed by the Orchestrator after every Executor task completes, before marking the task as done:

1. **TSC `--noEmit`** — Syntax/type check (`npx tsc --noEmit`).
2. **ESLint `--max-warnings 0`** — Lint check with zero-tolerance for warnings (`npx eslint . --max-warnings 0`).
3. **`ls -la` on all new/modified files** — File permissions must be `644` (not `600`). Fail if any file is not `644`.
4. **`docker exec cat <file>`** — Container readability check. The Docker container's runtime user (`node`) must be able to read every new/modified file.
5. **Runtime smoke test** — Verify the app runs: `curl` the dev server health endpoint and/or check browser console for errors.

**Scope:**
- **In Scope:** Orchestrator verification workflow after every Executor task; file-permission enforcement; container-readability check; runtime smoke test.
- **Out of Scope:** Changing the Docker container's user, modifying the Orchestrator-Executor delegation protocol itself, CI/CD pipeline changes.

---

## 4. Consequences

### ✅ Positive (Benefits)
- Catches environment-mismatch bugs (permissions, container readability) before they reach runtime.
- Standardized verification — every Executor task is held to the same quality gate.
- Reduces debugging time: bugs are caught immediately at the source rather than surfacing later as mysterious `EACCES` errors.
- Creates an auditable verification trail per task.

### ⚠️ Negative (Costs/Risks)
| Risk | Likelihood | Impact | Mitigation | Owner | Timeline |
|------|------------|--------|------------|-------|----------|
| Additional verification time per task | High | Low | Acceptable trade-off; steps 3-5 are fast (`ls`, `docker exec cat`, `curl`) | @kawee | Immediate |
| Docker container not running during verification | Med | Med | Orchestrator must ensure dev container is up before step 4; skip with warning if intentionally down | @kawee | Immediate |
| Checklist becomes checkbox theater (skipped/ignored) | Med | High | Enforce as mandatory gate — task is NOT done until all 5 steps pass | @kawee | Ongoing |

### 🔧 Resource Impact
| Resource | Before | After | Delta | Notes |
|----------|--------|-------|-------|-------|
| Verification time per task | ~10-15s (TSC+ESLint) | ~20-30s (5 steps) | +10-15s | Steps 3-5 add minimal time |
| Bug-detection rate (env-mismatch) | Reactive (runtime) | Proactive (pre-runtime) | ↑ Significant | Catches `EACCES`-class bugs early |

---

## 5. Implementation

| Phase | Task | Owner | Target | Status |
|-------|------|-------|--------|--------|
| 1 | Document the 5-step checklist in `docs/AI_AGENT_WORKFLOW/` Orchestrator guide | @kawee | 2026-07-24 | 🟡 Planned |
| 2 | Update Orchestrator instructions to run all 5 steps after every Executor task | @kawee | 2026-07-24 | 🟡 Planned |
| 3 | Add `ls -la` permission assertion (must be 644) to post-task verification | @kawee | 2026-07-24 | 🟡 Planned |
| 4 | Add `docker exec cat` container-readability check to post-task verification | @kawee | 2026-07-24 | 🟡 Planned |
| 5 | Add runtime smoke test (`curl` / browser console) to post-task verification | @kawee | 2026-07-24 | 🟡 Planned |

---

## 6. Reversibility & Rollback

**Reversible?** Yes
**Rollback Plan:** Revert to TSC + ESLint only (2-step verification). Remove steps 3-5 from Orchestrator instructions.
**Rollback Trigger:** Verification time becomes prohibitive (>60s per task) or steps produce excessive false positives.
**Rollback Time:** < 5 min (update Orchestrator instructions).

---

## 7. Validation & Success Criteria

- [ ] All 5 steps documented in Orchestrator workflow guide.
- [ ] Orchestrator runs all 5 steps after every Executor task.
- [ ] File permission errors (`600` instead of `644`) are caught at step 3, never reaching runtime.
- [ ] Container readability errors are caught at step 4, never reaching runtime.
- [ ] Zero `EACCES` runtime errors in Docker container caused by file permissions.

**Gate Review:** After 1 week of usage — confirm no environment-mismatch bugs have reached runtime.

---

## 8. Related Decisions

| Decision | Relationship |
|----------|--------------|
| 001-adopt-hermes-single-e2e-profile.md | Foundation: multi-agent delegation pattern this checklist protects |
| 000-discussion-hermes-multi-agent.md | Discussion origin for the Orchestrator-Executor pattern |

---

## 9. Approval & Sign-off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| **Decision Owner** | @kawee | ✅ Approved | 2026-07-24 |
| **Technical Lead** | @kawee | ✅ Approved | 2026-07-24 |
| **Product Owner** | @kawee | ✅ Approved | 2026-07-24 |

> Note: Decision Owner has authority to approve. Other signatures advisory.

---

## 10. Changelog (Append-only)

| Date | Version | Change Type | Description | Author |
|------|---------|-------------|-------------|--------|
| 2026-07-24 | 1.0 | Initial | Micro-ADR 005 created (Orchestrator Evaluation Checklist) | AI Agent (Hermes) |

> ⚠️ This document is IMMUTABLE after creation. For changes, create a new Micro-ADR that supersedes this one.
