# Micro-ADR 002: Login Page — Respect User Preferences (Dark Mode + color-scheme)

**Status:** ✅ Accepted
**Number:** 002
**Date:** 2026-07-07
**Decided By:** @kawee
**Supersedes:** —
**Superseded By:** —
**Tags:** [ux, principle-1, dark-mode, native-css, login]

---

## 1. Context (The Problem)

**What is the problem we're solving?**
Login Page (Principle 1: Respect User Preferences) currently scores ❌ — no dark mode support and no OS text-scaling meta. Users with OS Dark Mode see a light page; OS-level text scaling is not declared.

**Why now?**
Part of making the 3 target UX Principles (1/2/3) fully met via Native CSS, following Google I/O 2026 "5 Core UX Principles" + modern-web-guidance skill (`dark-mode` guide).

**Current State:**
- `index.css`: defines `surface-*` / `primary-*` tokens, no `color-scheme`, no `dark:` variant.
- No `<meta name="color-scheme">` / `<meta name="text-scale">` in `index.html`.
- Accessibility base (focus-visible, aria-*) is solid.

**Desired State:**
Page adapts to OS light/dark automatically; OS text scaling declared; Principle 1 fully met.

---

## 2. Options Considered

| Option | Description | Pros | Cons | Effort | Risk | Verdict |
|--------|-------------|------|------|--------|------|---------|
| A: Status Quo | Keep light-only | - Zero cost | - Principle 1 not met | None | High | ❌ Rejected |
| B: prefers-color-scheme media query | Manual `@media (prefers-color-scheme: dark)` block | - Broader old-browser support | - Duplicated token code; guide prefers light-dark() | Low | Low | ❌ Rejected |
| **C: color-scheme + light-dark()** | **MANDATORY meta + `:root` color-scheme + light-dark() tokens** | **- Matches guide exactly<br>- Native, no JS<br>- Auto-adapt** | **- Rewrite tokens as pairs** | Low | Low | ✅ **Accepted** |

> Chosen: **Option A in the proposal = color-scheme + light-dark()** (labeled "A" by Human).

---

## 3. Decision

> **We will implement dark mode on the Login Page (and global theme) using `color-scheme: light dark` + `light-dark()` Native CSS functions, because it directly satisfies Principle 1 with zero JavaScript and follows the modern-web-guidance `dark-mode` best-practice guide.**

**Decision Statement:**
Adopt Native CSS `color-scheme` + `light-dark()` for light/dark adaptation; add `<meta name="color-scheme" content="light dark">` and `<meta name="text-scale" content="scale">`.

**Scope:**
- **In Scope:** `index.html` (meta tags), `index.css` (`:root` color-scheme + token rewrite to light-dark pairs), Login/Auth/Input components consuming tokens.
- **Out of Scope:** User-toggle theme switch (JS state), other principles (see 003/004).

---

## 4. Consequences

### ✅ Positive (Benefits)
- Principle 1 fully met (auto-adapt to OS preference).
- Zero JavaScript added; no new dependency.
- Prevents FOUC via MANDATORY meta tag.
- Accessibility base preserved.

### ⚠️ Negative (Costs/Risks)
| Risk | Likelihood | Impact | Mitigation | Owner | Timeline |
|------|------------|--------|------------|-------|----------|
| Safari < 17.5 sees light-only | Med | Low | light-dark() degrades to first value (safe); acceptable fallback | @kawee | Immediate |
| Token rewrite introduces contrast regression | Low | Med | Validate contrast ≥ 4.5:1 in a11y test after change | @kawee | Build |

### 🔧 Resource Impact
| Resource | Before | After | Delta | Notes |
|----------|--------|-------|-------|-------|
| JS bundle | — | — | 0 | No JS added |
| CSS size | baseline | +pairs | Small | Token duplication as light/dark pairs |

---

## 5. Implementation

| Phase | Task | Owner | Target | Status |
|-------|------|-------|--------|--------|
| 1 | Add `<meta name="color-scheme" content="light dark">` + `<meta name="text-scale" content="scale">` to index.html | @kawee | 2026-07-07 | 🟡 Ready |
| 2 | Add `color-scheme: light dark;` to `:root` in index.css | @kawee | 2026-07-07 | 🟡 Ready |
| 3 | Rewrite surface-*/primary-* tokens as `light-dark(raw-light, raw-dark)` pairs (keep raw values) | @kawee | 2026-07-07 | 🟡 Ready |
| 4 | Validate a11y (axe-core) + visual dark/light | @kawee | Build | ⏳ Pending |

---

## 6. Reversibility & Rollback

**Reversible?** Yes
**Rollback Plan:** Revert token rewrite + remove meta tags / `:root` color-scheme.
**Rollback Trigger:** Contrast regression or unexpected rendering in target browsers.
**Rollback Time:** < 5 min (git revert).

---

## 7. Validation & Success Criteria

- [ ] `<meta name="color-scheme" content="light dark">` present in index.html
- [ ] `<meta name="text-scale" content="scale">` present in index.html
- [ ] `:root { color-scheme: light dark; }` in index.css
- [ ] All surface-*/primary-* tokens use `light-dark()` with raw-value fallbacks
- [ ] Page renders correctly in OS Dark Mode (no light flash)
- [ ] axe-core: 0 violations

**Gate Review:** After Build + Validate loop (a11y pass).

---

## 8. Related Decisions

| Decision | Relationship |
|----------|--------------|
| 003-login-physics-easing.md | Companion (Principle 2) |
| 004-login-view-transitions.md | Companion (Principle 3) |
| ../DECISIONS/001-adopt-hermes-single-e2e-profile.md | Legacy ADR (Phase 1) |

---

## 9. Approval & Sign-off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| **Decision Owner** | @kawee | ✅ Approved | 2026-07-07 |
| **Technical Lead** | @kawee | ✅ Approved | 2026-07-07 |
| **Product Owner** | @kawee | ✅ Approved | 2026-07-07 |

> Note: Decision Owner has authority to approve. Other signatures advisory.

---

## 10. Changelog (Append-only)

| Date | Version | Change Type | Description | Author |
|------|---------|-------------|-------------|--------|
| 2026-07-07 | 1.0 | Initial | Micro-ADR 002 created (Principle 1, Option A) | AI Agent (Hermes) |

> ⚠️ This document is IMMUTABLE after creation. For changes, create a new Micro-ADR that supersedes this one.
