# File: frontend/docs/02-design/SDD/02-screen-specs/02-register.md
# SCR-REGISTER: Invite Registration Screen

| Attribute | Detail |
|-----------|--------|
| **Route** | `/auth/register?token=...` |
| **Layout** | Same as Login, with invite context banner |
| **UI Elements** | `FullNameInput`, `PhoneInput`, `PasswordInput`, `ConfirmPasswordInput`, `RegisterButton` |
| **State Mapping** | `validating-token` → `idle` → `submitting` → `success (redirect /login)` / `error` |
| **API Dependency** | `POST /auth/invite/accept` (Backend §3.3) |
| **Validation** | Token expiry check, password strength, phone uniqueness |
| **Accessibility** | Same as SCR-LOGIN + announce invite status via `aria-live` |