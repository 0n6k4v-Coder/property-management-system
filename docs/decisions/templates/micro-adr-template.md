# Micro-ADR Template

> **Template for Micro Architecture Decision Records**
>
> **Usage:** Copy this file to `NNNN-descriptive-name.md` in `docs/decisions/`
> **Reference:** [DLC.md](../DLC.md) — AI-Native SDLC Continuous Flow Model
> **Lifecycle:** Append-only after creation — Never modify after creation

---

# Micro-ADR NNNN: [Short Descriptive Title]

**Status:** ✅ Accepted | ❌ Rejected | 🔄 Superseded
**Number:** NNNN
**Date:** YYYY-MM-DD
**Decided By:** @author
**Supersedes:** [NNNN-previous-decision.md] (if applicable)
**Superseded By:** [NNNN-new-decision.md] (if superseded)
**Tags:** [tag1, tag2, tag3]

---

## 1. Context (The Problem)

**What is the problem we're solving?**
[2-3 sentences describing the problem, pain point, or opportunity]

**Why now?**
[Timing, urgency, constraints]

**Current State:**
[What exists today]

**Desired State:**
[What we want to achieve]

---

## 2. Options Considered

| Option | Description | Pros | Cons | Effort | Risk | Verdict |
|--------|-------------|------|------|--------|------|---------|
| A: Status Quo | [Keep current] | - Familiar<br>- Zero cost | - Problem persists | None | High | ❌ Rejected |
| B: [Option Name] | [Brief description] | - [Pro 1]<br>- [Pro 2] | - [Con 1]<br>- [Con 2] | Low/Med/High | Low/Med/High | ❌ Rejected |
| **C: [Chosen Option]** | [Brief description] | - [Pro 1]<br>- [Pro 2] | - [Con 1]<br>- [Con 2] | Low/Med/High | Low/Med/High | ✅ **Accepted** |

> **Note:** Minimum 3 options including Status Quo. Bold the chosen option.

---

## 3. Decision

> **We will [action] [what] because [key reason].**

**Decision Statement:**
[One clear sentence stating the decision]

**Scope:**
- **In Scope:** [What this decision covers]
- **Out of Scope:** [What this decision explicitly excludes]

---

## 4. Consequences

### ✅ Positive (Benefits)
- [Benefit 1]: [Description and impact]
- [Benefit 2]: [Description and impact]
- [Benefit 3]: [Description and impact]

### ⚠️ Negative (Costs/Risks)
| Risk | Likelihood | Impact | Mitigation | Owner | Timeline |
|------|------------|--------|------------|-------|----------|
| [Risk 1] | Low/Med/High | Low/Med/High | [Mitigation plan] | @owner | [Date/Sprint] |
| [Risk 2] | Low/Med/High | Low/Med/High | [Mitigation plan] | @owner | [Date/Sprint] |

### 🔧 Resource Impact
| Resource | Before | After | Delta | Notes |
|----------|--------|-------|-------|-------|
| [Resource 1] | [Before] | [After] | [+/-] | [Notes] |
| [Resource 2] | [Before] | [After] | [+/-] | [Notes] |

---

## 5. Implementation (If Applicable)

| Phase | Task | Owner | Target | Status |
|-------|------|-------|--------|--------|
| 1 | [Task 1] | @owner | YYYY-MM-DD | 🟡 Ready |
| 2 | [Task 2] | @owner | YYYY-MM-DD | ⏳ Pending |
| 3 | [Task 3] | @owner | YYYY-MM-DD | ⏳ Pending |

---

## 6. Reversibility & Rollback

**Reversible?** Yes / No
**Rollback Plan:** [How to undo if needed]
**Rollback Trigger:** [Conditions that trigger rollback]
**Rollback Time:** [Estimated time to rollback]

---

## 7. Validation & Success Criteria

- [ ] [Measurable success criterion 1]
- [ ] [Measurable success criterion 2]
- [ ] [Measurable success criterion 3]

**Gate Review:** [When to review this decision: e.g., "After Sprint N", "After 2 weeks", "When metrics available"]

---

## 8. Related Decisions

| Decision | Relationship |
|----------|--------------|
| [NNNN-related-decision.md] | [Related/Supersedes/Depends on] |

---

## 9. Approval & Sign-off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| **Decision Owner** | @author | ✅ Approved | YYYY-MM-DD |
| **Technical Lead** | @lead | ✅ Approved | YYYY-MM-DD |
| **Product Owner** | @po | ✅ Approved | YYYY-MM-DD |

> **Note:** In this project, Decision Owner has authority to approve. Other signatures are advisory.

---

## 10. Changelog (Append-only)

| Date | Version | Change Type | Description | Author |
|------|---------|-------------|-------------|--------|
| YYYY-MM-DD | 1.0 | Initial | Micro-ADR created | @author |

> ⚠️ **This document is IMMUTABLE after creation.** For changes, create a new Micro-ADR that supersedes this one.

---

## 📋 Quick Checklist (Before Creating)

- [ ] Context clearly describes problem
- [ ] At least 3 options considered (including Status Quo)
- [ ] Chosen option clearly marked and bolded
- [ ] Consequences (positive + negative) filled
- [ ] Mitigations for each risk identified
- [ ] Reversibility addressed
- [ ] Success criteria are measurable
- [ ] Signatures collected (at minimum Decision Owner)
- [ ] Linked in DECISIONS/README.md index
EOF