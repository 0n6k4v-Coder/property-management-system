# File: frontend/docs/02-design/SDD/02-screen-specs/01-login.md
# SCR-LOGIN: Authentication Screen

| Attribute | Detail |
|-----------|--------|
| **Route** | `/login` |
| **Layout** | Centered card, max-width 400px, mobile responsive |
| **UI Elements** | `EmailInput`, `PasswordInput`, `ShowPasswordToggle`, `LoginButton`, `ForgotPasswordLink`, `InviteLinkHint` |
| **State Mapping** | `idle` → `validating` → `submitting` → `success (redirect)` / `error` |
| **API Dependency** | `POST /auth/login` (Backend §3.3) |
| **Error Handling** | 401 → `error.auth.AUTH-001`, 429 → `Retry-After` countdown, Network fail → offline banner |
| **Accessibility** | `aria-label` ชัดเจน, auto-focus email, keyboard nav, contrast ≥ 4.5:1 |