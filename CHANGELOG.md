# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-08-31

### 🚀 Added
- **Backend Architecture:** FastAPI 0.115+ (Python 3.14+) backend with 9 core modules: `auth`, `property`, `tenant`, `billing`, `contract`, `maintenance`, `dashboard`, `notification`, and `admin`.
- **Frontend SPA:** React 19 + TypeScript 6.0 (Strict Mode) + Vite 8 single page application with PWA offline caching and IndexedDB background mutation queues.
- **Security:** Argon2id password hashing compliant with OWASP 2026 standards, Fernet symmetric encryption for tenant national IDs, and JWT authentication with 15-minute access token expiry.
- **Property Hierarchy:** 4-tier structural modeling supporting Properties, Buildings, Floors, and Rooms with active status state machine (`available`, `occupied`, `maintenance`, `reserved`).
- **Utility & Billing:** Tiered electricity and water meter reading management, automated monthly invoice calculation, and dual offline/online synchronization.
- **Contract Management:** Lease agreement lifecycle linking rooms to tenants, with automated room status cascades on creation and termination.
- **Maintenance Ticketing:** Multi-priority maintenance ticketing with room association and SLA tracking.
- **DevOps & Production Packaging:** Multi-stage Docker images (`python:3.14-slim-bookworm` and `nginx:1.27-alpine`), `docker-compose.prod.yml` with security hardening, and backup/restore scripts (`scripts/backup.sh`, `scripts/restore.sh`).

### 🛠️ Fixed & Hardened
- **Preflight Fixes:** Resolved production preflight blockers in commit `a9b2644` (Nginx Alpine user creation, `vite-env.d.ts` build inclusions, isolated test constants, PostgreSQL data path alignment).
- **Test State Isolation:** Isolated test-owned mutable states to achieve 100% deterministic test passes across backend, frontend unit tests (955/955), and E2E suites (116 passed / 32 skipped / 0 failed).
- **Accessibility:** Unified native accessible dialogs and single-instance responsive navigation dropdowns.
- **Documentation:** Full reconciliation of roadmap, index, and architecture documentation (`P1-W06`).

[1.0.0]: https://github.com/0n6k4v-Coder/property-management-system/releases/tag/v1.0.0
