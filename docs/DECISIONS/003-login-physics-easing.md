# Micro-ADR 003: Login Page — Natural Interactions (Physics-based Easing)

**Status:** ✅ Accepted
**Number:** 003
**Date:** 2026-07-07
**Decided By:** @kawee
**Supersedes:** —
**Superseded By:** —
**Tags:** [ux, principle-2, motion, linear-easing, native-css, login]

---

## 1. Context (The Problem)

**What is the problem we're solving?**
Login Page (Principle 2: Natural Interactions) currently scores ⚠️ Partial — state changes (loading → idle, error appear) flip abruptly with no physics-based motion. Feels "robotic".

**Why now?**
Make Principle 2 fully met via Native CSS `linear()` spring easing, following modern-web-guidance `physics-based-easing` guide. Browser Support Policy = (ข) Progressive Enhancement (CSS-lite fallback, no JS lib).

**Current State:**
- `Input.tsx`: `transition-colors duration-150` only.
- Button loading state has no transition easing.
- No spring/bounce physics.

**Desired State:**
Motion originates naturally with spring physics; respects `prefers-reduced-motion`.

---

## 2. Options Considered

| Option | Description | Pros | Cons | Effort | Risk | Verdict |
|--------|-------------|------|------|--------|------|---------|
| A: Status Quo | Keep abrupt transitions | - Zero cost | - Principle 2 not met | None | High | ❌ Rejected |
| B: @starting-style + transition-behavior | Entrance from first frame | - Complete entrance | - Overkill for login; more complex | Low | Low | ❌ Rejected |
| **C: linear() spring + CSS fallback** | **`--spring-easing: linear(...)` + ease-out fallback + reduced-motion** | **- Native spring<br>- Guide-exact<br>- CSS-lite fallback** | **- Avoid bounce on opacity (guide warning)** | Low | Low | ✅ **Accepted** |

> Chosen: **Option A in the proposal = linear() spring** (labeled "A" by Human).

---

## 3. Decision

> **We will implement physics-based spring easing on Login Page interactions using the Native CSS `linear()` timing function with a CSS-lite `ease-out` fallback and `prefers-reduced-motion` respect, because it satisfies Principle 2 natively without JavaScript libraries.**

**Decision Statement:**
Adopt `linear()` spring easing for Button loading + error alert transitions; provide `ease-out` fallback declaration; disable under `prefers-reduced-motion: reduce`.

**Scope:**
- **In Scope:** `index.css` (define `--spring-easing`), LoginPage Button/error states, Input focus transition.
- **Out of Scope:** Full page choreography, other principles (see 002/004).

---

## 4. Consequences

### ✅ Positive (Benefits)
- Principle 2 fully met (physics-based, natural).
- `linear()` Baseline since 2023-12-11 (Chrome 113+/FF 112+/Safari 17.2+) — wide support.
- CSS-lite fallback satisfies policy (ข); no JS dependency.
- Respects motion-sensitivity.

### ⚠️ Negative (Costs/Risks)
| Risk | Likelihood | Impact | Mitigation | Owner | Timeline |
|------|------------|--------|------------|-------|----------|
| Bounce on opacity flicker | Low | Low | Apply spring to transform/scale only, never opacity overshoot | @kawee | Build |
| Old browser ignores linear() | Low | Low | ease-out fallback declaration precedes it | @kawee | Build |

### 🔧 Resource Impact
| Resource | Before | After | Delta | Notes |
|----------|--------|-------|-------|-------|
| JS bundle | — | — | 0 | No JS |
| CSS size | baseline | +spring var | Small | Reusable token |

---

## 5. Implementation

| Phase | Task | Owner | Target | Status |
|-------|------|-------|--------|--------|
| 1 | Define `--spring-easing: linear(0, 0.016 0.5%, ... 1)` in `:root` (index.css) | @kawee | 2026-07-07 | 🟡 Ready |
| 2 | Button (loading/idle) + error alert: `transition: ... ease-out;` then override `transition-timing-function: var(--spring-easing)` | @kawee | 2026-07-07 | 🟡 Ready |
| 3 | Add `@media (prefers-reduced-motion: reduce) { transition: none; }` | @kawee | 2026-07-07 | 🟡 Ready |
| 4 | Validate visual + a11y | @kawee | Build | ⏳ Pending |

---

## 6. Reversibility & Rollback

**Reversible?** Yes
**Rollback Plan:** Remove `--spring-easing` usage + fallback to default easing.
**Rollback Trigger:** Visual jank or motion-sensitivity complaint.
**Rollback Time:** < 5 min.

---

## 7. Validation & Success Criteria

- [ ] `--spring-easing` defined in `:root`
- [ ] Button + error alert use spring easing with `ease-out` fallback declared first
- [ ] No bounce applied to `opacity`
- [ ] `prefers-reduced-motion: reduce` disables transition
- [ ] axe-core: 0 violations

**Gate Review:** After Build + Validate loop.

---

## 8. Related Decisions

| Decision | Relationship |
|----------|--------------|
| 002-login-dark-mode-color-scheme.md | Companion (Principle 1) |
| 004-login-view-transitions.md | Companion (Principle 3) |

---

## 9. Approval & Sign-off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| **Decision Owner** | @kawee | ✅ Approved | 2026-07-07 |
| **Technical Lead** | @kawee | ✅ Approved | 2026-07-07 |
| **Product Owner** | @kawee | ✅ Approved | 2026-07-07 |

---

## 10. Changelog (Append-only)

| Date | Version | Change Type | Description | Author |
|------|---------|-------------|-------------|--------|
| 2026-07-07 | 1.0 | Initial | Micro-ADR 003 created (Principle 2, Option A) | AI Agent (Hermes) |

> ⚠️ IMMUTABLE after creation. Supersede via new Micro-ADR.
