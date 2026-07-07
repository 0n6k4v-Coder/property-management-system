# Sprint 10: Login Page UX Principles 1–3 (Native CSS)

**Decision(s):** [`../DECISIONS/002-login-dark-mode-color-scheme.md`](../DECISIONS/002-login-dark-mode-color-scheme.md), [`../DECISIONS/003-login-physics-easing.md`](../DECISIONS/003-login-physics-easing.md), [`../DECISIONS/004-login-view-transitions.md`](../DECISIONS/004-login-view-transitions.md)
**Features to Build:** Login Page (`frontend/src/features/auth/LoginPage.tsx`), AuthLayout, Input, AuthContext, index.html, index.css
**Duration:** 2026-07-07 to 2026-07-21 (2 weeks recommended)
**Sprint Goal:** Make Login Page fully meet UX Principles 1 (Respect User Preferences), 2 (Natural Interactions), and 3 (Guided Navigation) using Native CSS only with Progressive Enhancement fallbacks — no JavaScript libraries added.

---

## 🎯 Sprint Goal

Implement the 3 accepted Micro-ADRs (002/003/004) so the Login Page achieves full compliance with UX Principles 1, 2, and 3 via Native CSS (`color-scheme` + `light-dark()`, `linear()` spring easing, View Transitions API) with CSS-lite fallbacks per Browser Support Policy (ข).

---

## 📋 Sprint Backlog (Implementation Plan + Sprint Backlog)

| ID | Task | Decision Ref | Owner | Status | Criteria |
|----|------|--------------|-------|--------|----------|
| S10.1 | Add `<meta name="color-scheme" content="light dark">` + `<meta name="text-scale" content="scale">` to index.html | 002 | @kawee | 🟡 Ready | Both meta tags present in `<head>` |
| S10.2 | Add `color-scheme: light dark;` to `:root` in index.css | 002 | @kawee | 🟡 Ready | `:root { color-scheme: light dark; }` present |
| S10.3 | Rewrite surface-*/primary-* tokens as `light-dark(raw-light, raw-dark)` pairs (keep raw values) | 002 | @kawee | 🟡 Ready | All tokens use light-dark() with raw-value fallback |
| S10.4 | Define `--spring-easing: linear(...)` spring stops in `:root` | 003 | @kawee | 🟡 Ready | `--spring-easing` defined, duration included |
| S10.5 | Apply spring easing to Button (loading/idle) + error alert with `ease-out` fallback declared first | 003 | @kawee | 🟡 Ready | Transition uses spring; fallback ease-out precedes it |
| S10.6 | Add `@media (prefers-reduced-motion: reduce) { transition: none; }` | 003 | @kawee | 🟡 Ready | Motion disabled under reduced-motion |
| S10.7 | Navigate login→dashboard with `navigate('/', { replace: true, viewTransition: true })` in AuthContext.login | 004 | @kawee | 🟡 Ready | Navigation uses RR v7 `viewTransition: true`; no manual `document.startViewTransition` |
| S10.8 | Logout via `navigateWithTransition('/login', true)` (uses `viewTransition: true`); rely on RR built-in fallback | 004 | @kawee | 🟡 Ready | No `react-doctor/no-document-start-view-transition` warning |
| S10.9 | Route focus to new heading via target page (React Router a11y) | 004 | @kawee | 🟡 Ready | Focus routed post-transition (a11y) |
| S10.10 | Add `::view-transition-old/new(root)` fade in index.css | 004 | @kawee | 🟡 Ready | VT fade defined; no duplicate view-transition-name |
| S10.11 | Validate a11y (axe-core) + visual dark/light + motion | 002/003/004 | @kawee | ⏳ Pending | axe-core: 0 violations; renders in OS Dark Mode |
| **Gate** | **Sprint Review: Proceed to next?** | 002/003/004 | @kawee | ⏳ Pending | Yes/No/Modify |

> **Status Legend:** 🟡 Ready | ⏳ Pending | ✅ Done | ❌ Blocked | 🔄 In Progress

---

## 🎯 Exit Criteria (From Decisions)

- [ ] `<meta name="color-scheme" content="light dark">` present in index.html
- [ ] `<meta name="text-scale" content="scale">` present in index.html
- [ ] `:root { color-scheme: light dark; }` in index.css
- [ ] All surface-*/primary-* tokens use `light-dark()` with raw-value fallbacks
- [ ] `--spring-easing` defined; Button + error alert use spring with `ease-out` fallback first
- [ ] No bounce applied to `opacity`; `prefers-reduced-motion: reduce` disables transition
- [ ] Navigation uses React Router v7 `viewTransition: true`; feature-detect fallback present (RR built-in)
- [ ] Focus routed to new heading (both paths); `::view-transition-old/new(root)` fade defined
- [ ] axe-core: 0 violations
- [ ] **Decision Gate:** Proceed to next phase? Yes/No/Modify

---

## 📊 Success Metrics

| Metric | Target | Measurement | Current |
|--------|--------|-------------|---------|
| Principle 1 (Respect User Preferences) | Fully Met | OS Dark Mode renders, meta present | Not Met → Target Met |
| Principle 2 (Natural Interactions) | Fully Met | Spring easing on interactions | Partial → Target Met |
| Principle 3 (Guided Navigation) | Fully Met | VT on login→dashboard | Partial → Target Met |
| a11y violations | 0 | axe-core | TBD |
| JS bundle delta | 0 | No new dependency | 0 |

---

## 🚫 Out of Scope

| Feature/Task | Reason | Next Sprint |
|--------------|--------|-------------|
| User-toggle theme switch (JS state) | Out of Principle 1 scope (auto-adapt only) | Sprint 11+ |
| Cross-document view transitions | SPA only this sprint | Sprint 11+ |
| Other routes beyond login flow | Scope limited to Login Page | Sprint 11+ |

---

## ⚠️ Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Safari < 17.5 sees light-only (light-dark) | Med | Low | Degrades to first value (safe fallback) |
| Bounce on opacity flicker | Low | Low | Apply spring to transform/scale only |
| Duplicate `view-transition-name` breaks transition | Low | Low | Ensure ≤1 per name; cleanup after finished |
| Contrast regression after token rewrite | Low | Med | Validate contrast ≥ 4.5:1 in a11y test |

---

## 🛑 Stop Conditions

| Condition | Action |
|-----------|--------|
| a11y regression (axe-core > 0 violations) | STOP → Fix → Re-validate |
| Transition error in target browsers | REVIEW → Rollback to v1.0 `document.startViewTransition` or plain navigate |

---

## 📝 Notes for Hermes (or Implementer)

> **For AI Agent / Implementer:**
> 1. Follow Browser Support Policy (ข) — Progressive Enhancement, CSS-lite fallback, NO JS library.
> 2. Respect MANDATORY items from modern-web-guidance guides (dark-mode / physics-based-easing / same-document-transitions).
> 3. Do NOT touch business logic; only styling + navigation wrapper.
> 4. After code: run a11y + visual check; update Micro-ADR Validation status.
>
> **Stop Condition:** a11y regression → STOP → Report to Human.

---

## 📊 Sprint Metrics (Track Daily)

| Metric | Target | Current |
|--------|--------|---------|
| Tasks Completed | 11/11 | 0/11 |
| Principles Fully Met | 3/3 | 0/3 |
| a11y violations | 0 | TBD |
| Cycle Time (per task) | < 1 day | TBD |

---

## ✅ Definition of Done (Per Task)

- [ ] Code implemented per Micro-ADR
- [ ] CSS-lite fallback present (no JS lib)
- [ ] a11y validated (axe-core 0)
- [ ] Evidence captured (screenshots dark/light, motion)
- [ ] Micro-ADR Validation status updated
- [ ] Documentation updated

---

## 📅 Timeline

| Week | Focus |
|------|-------|
| Week 1 (Jul 7-13) | S10.1–S10.6 (Principle 1 + 2: tokens, meta, spring) |
| Week 2 (Jul 14-21) | S10.7–S10.11 (Principle 3: VT + validate + gate) |

---

## 📝 Changelog

| Date | Version | Change | By |
|------|---------|--------|-----|
| 2026-07-07 | 1.0 | Initial Sprint 10 Plan from Decisions 002/003/004 | @hermes-agent |

---

## 📋 Next Steps

1. **Approve Sprint 10** → Human confirms scope
2. **Execute S10.1–S10.6** → Principle 1 + 2 implementation
3. **Execute S10.7–S10.10** → Principle 3 implementation
4. **Execute S10.11** → Validate a11y + visual
5. **Gate Review** → Decide next sprint / phase

---

## ✅ Sprint Approval

| Role | Name | Signature | Date |
|------|------|-----------|------|
| **Sprint Owner** | @kawee | ✅ Approved | 2026-07-07 |
| **Decision Owner** | @kawee | ✅ Approved | 2026-07-07 |

---

## 📋 References

- **Decision 002:** [`../DECISIONS/002-login-dark-mode-color-scheme.md`](../DECISIONS/002-login-dark-mode-color-scheme.md)
- **Decision 003:** [`../DECISIONS/003-login-physics-easing.md`](../DECISIONS/003-login-physics-easing.md)
- **Decision 004:** [`../DECISIONS/004-login-view-transitions.md`](../DECISIONS/004-login-view-transitions.md)
- **DLC Reference:** [`../DLC.md`](../DLC.md)
- **DLC Phase:** Implement (Sprint = Cadence, not Phase)
- **Source Principles:** Google I/O 2026 "5 Core UX Principles" (modern-web-guidance skill)

---

> **Reminder:** This is a living document. Update status daily. Update metrics per commit. The best sprint is the one that delivers value and learns fast.
