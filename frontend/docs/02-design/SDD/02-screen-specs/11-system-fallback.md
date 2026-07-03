# File: frontend/docs/02-design/SDD/02-screen-specs/11-system-fallback.md
# SCR-404 & SCR-500: System Fallback Pages

| Attribute | SCR-404 | SCR-500 |
|-----------|---------|---------|
| **Route** | `*` (catch-all) | `/error` (error boundary) |
| **Layout** | Centered message + back button | Centered error + retry button + contact link |
| **UI Elements** | `NotFoundMessage`, `BackToDashboardButton` | `ErrorMessage`, `RetryButton`, `SupportContactLink` |
| **State Mapping** | Static (no async) | Static + optional retry logic |
| **API Dependency** | None | None |
| **Accessibility** | `role="alert"` for 404, `aria-live="assertive"` for 500 |