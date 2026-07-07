# Micro-ADR 004: Login Page — Guided Navigation (View Transitions)

**Status:** ✅ Accepted
**Number:** 004
**Date:** 2026-07-07
**Decided By:** @kawee
**Supersedes:** —
**Superseded By:** —
**Tags:** [ux, principle-3, navigation, view-transitions, native-css, login, spa]

---

## 1. Context (The Problem)

**What is the problem we're solving?**
Login Page (Principle 3: Guided Navigation) scores ✅ structure / ⚠️ transition — navigation login→dashboard snaps with no visual continuity. Users lose context between routes.

**Why now?**
Make Principle 3 fully met via Native CSS View Transitions API in the SPA, following modern-web-guidance `same-document-transitions` guide. Browser Support Policy = (ข) Progressive Enhancement (feature-detect + graceful fallback + focus routing).

**Current State:**
- `routes/index.tsx`: `/login` → `LoginPage`, GuestRoute guard, wildcard redirect.
- Navigation uses React Router default (instant swap), no transition.
- `AuthContext.login` performs redirect after auth.

**Desired State:**
Smooth same-document transition on navigate; safe fallback when unsupported; focus routed for accessibility.

---

## 2. Options Considered

| Option | Description | Pros | Cons | Effort | Risk | Verdict |
|--------|-------------|------|------|--------|------|---------|
| A: Status Quo | Instant navigation | - Zero cost | - Principle 3 transition gap | None | Med | ❌ Rejected |
| **B: React Router v7 `viewTransition`** | **`navigate(to, { viewTransition: true })`** | **- Stable in RR v7 (7.15 installed)<br>- No `react-doctor` lint warning<br>- Native CSS VT, no dep** | **- Not React `<ViewTransition>` component (unavailable in React 19.2 stable)** | Low | Low | ✅ **Accepted (v1.2)** |
| C: document.startViewTransition + support check | Wrap DOM update; fallback + focus route | - Guide-exact (SPA)<br>- Native<br>- A11y fallback | - Triggers `react-doctor/no-document-start-view-transition` lint warning; bypasses React integration | Low | Low | ❌ Rejected (v1.1) |

> Chosen: **Option B (React Router v7 `viewTransition: true`)** — revised from v1.1 `<ViewTransition>` on 2026-07-07: React 19.2 stable has no `<ViewTransition>` export (canary-only), so RR v7 `viewTransition` prop is the closest stable, lint-clean approach. See Changelog v1.2.

---

## 3. Decision

> **We will implement guided navigation continuity on the Login Page using React Router v7's `viewTransition: true` navigation option, because it satisfies Principle 3 natively via the CSS View Transitions API, ships stable in RR v7 (7.15), and avoids the `react-doctor/no-document-start-view-transition` lint violation — with automatic feature-detection fallback handled by React Router.**

**Decision Statement (v1.2):**
Navigate login→dashboard (and logout) with `navigate(to, { replace, viewTransition: true })`; rely on React Router's built-in fallback when unsupported and route focus for accessibility via the target page.

**Scope:**
- **In Scope:** `AuthContext` login redirect / logout / nav helper using `viewTransition: true`; `index.css` `::view-transition-*` fade; optional `view-transition-name` on shared elements.
- **Out of Scope:** Cross-document transitions, other routes beyond login flow, other principles (see 002/003).

---

## 4. Consequences

### ✅ Positive (Benefits)
- Principle 3 fully met (visual continuity, context preserved).
- Native SPA transition; no dependency.
- MANDATORY a11y: focus routed to heading after transition / on fallback.

### ⚠️ Negative (Costs/Risks)
| Risk | Likelihood | Impact | Mitigation | Owner | Timeline |
|------|------------|--------|------------|-------|----------|
| Duplicate `view-transition-name` breaks transition | Low | Low | Ensure ≤1 element per name; cleanup after finished | @kawee | Build |
| Focus lost on unsupported browsers | Low | Med | MANDATORY fallback routes focus to heading | @kawee | Build |

### 🔧 Resource Impact
| Resource | Before | After | Delta | Notes |
|----------|--------|-------|-------|-------|
| JS bundle | — | — | 0 | Uses native API |
| CSS size | baseline | +VT fade | Small | ::view-transition-* rules |

---

## 5. Implementation

| Phase | Task | Owner | Target | Status |
|-------|------|-------|--------|--------|
| 1 | Navigate login→dashboard with `navigate('/', { replace: true, viewTransition: true })` in AuthContext | @kawee | 2026-07-07 | 🟡 Ready |
| 2 | Logout via `navigateWithTransition('/login', true)` (uses `viewTransition: true`) | @kawee | 2026-07-07 | 🟡 Ready |
| 3 | Route focus to new heading via target page (React Router a11y) | @kawee | 2026-07-07 | 🟡 Ready |
| 4 | Add `::view-transition-old/new(root)` fade in index.css | @kawee | 2026-07-07 | 🟡 Ready (done) |
| 5 | Validate a11y + visual + lint (no `react-doctor` warning) | @kawee | Build | ⏳ Pending |

---

## 6. Reversibility & Rollback

**Reversible?** Yes
**Rollback Plan:** Remove `<ViewTransition>` wrapper; revert to plain navigate (or to v1.0 `document.startViewTransition` if preferred).
**Rollback Trigger:** Transition error or focus regression.
**Rollback Time:** < 5 min.

---

## 7. Validation & Success Criteria

- [ ] Navigation uses React Router v7 `viewTransition: true`
- [ ] React Router built-in fallback present (no manual `document.startViewTransition`)
- [ ] Focus routed to new heading (a11y via target)
- [ ] `::view-transition-old/new(root)` fade defined
- [ ] ESLint: 0 `react-doctor/no-document-start-view-transition` warnings
- [ ] axe-core: 0 violations; no duplicate `view-transition-name`

**Gate Review:** After Build + Validate loop.

---

## 8. Related Decisions

| Decision | Relationship |
|----------|--------------|
| 002-login-dark-mode-color-scheme.md | Companion (Principle 1) |
| 003-login-physics-easing.md | Companion (Principle 2) |

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
| 2026-07-07 | 1.0 | Initial | Micro-ADR 004 created (Principle 3, Option A = document.startViewTransition) | AI Agent (Hermes) |
| 2026-07-07 | 1.1 | Revision | Switched to React 19 `<ViewTransition>` (Option B) — `document.startViewTransition` rejected for triggering `react-doctor/no-document-start-view-transition` lint warning; aligns with React integration best practice | @kawee |
| 2026-07-07 | 1.2 | Revision | React 19.2 stable has no `<ViewTransition>` export (canary-only) — switched to React Router v7 `viewTransition: true` (Option B, stable, lint-clean); code updated in AuthContext | @kawee |

> ⚠️ IMMUTABLE after creation. Supersede via new Micro-ADR.
