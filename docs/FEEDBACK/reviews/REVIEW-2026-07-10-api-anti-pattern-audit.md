# API Design Anti-Pattern Audit — All 10 Backend Modules

> **Review ID:** `REVIEW-2026-07-10-API-ANTIPATTERN`
> **Date:** 2026-07-10
> **Orchestrator:** Claude Code (Sonnet 5)
> **Executor:** Hermes Agent, profile `default` (`tencent/hy3:free`, Nous Portal)
> **Review Type:** API Design Anti-Pattern Compliance (multi-agent, 10 parallel worker sessions + 1 verification pass)
> **SDLC Loop:** 6 — Feedback (Output: Insights → Improvements)
> **Status:** 🟡 Open — awaiting Human decision on remediation priority

---

## 1. Context & Objective

Following the `docs/API.md` rewrite (reconciled against the real backend routers on 2026-07-10), the Human directed a full audit of every real API endpoint against the 23 anti-patterns catalogued in `docs/API_DESIGN_ANTI_PATTERN.md`. The audit was executed as 10 parallel Hermes Agent sessions — one per backend module — orchestrated per the model in `docs/MULTI_AGENT_ARCHITECTURE.md` (§2.2, §5 Task Contract). Each session was read-only (no code/doc edits authorized) and required to ground every claim in `file:line` evidence, per three standing operating rules given to all 10 sessions:

1. Read `.agents/log/SELF_CRITIC.md` (STANDING RULES) before proceeding.
2. Answer when grounded; state when evidence is missing; do not conflate sources or fabricate data.
3. Zero tolerance for guessing — `read_file` before diagnosing; verify with the real thing, not a claimed "success."

A Claude-led verification pass (Orchestrator acting as Verifier, per `docs/MULTI_AGENT_ARCHITECTURE.md` §2.2.1) independently re-read source for the 5 highest-severity/cross-corroborated findings before this report was finalized.

---

## 2. Artifacts Under Review (Traceability)

| Role | Path | Notes |
|------|------|-------|
| Anti-pattern catalogue | `docs/API_DESIGN_ANTI_PATTERN.md` | 23 patterns, checked against every endpoint |
| API ground truth | `docs/API.md` | Rewritten 2026-07-10 from source; used as reference, not trusted blindly |
| Backend routers | `backend/app/modules/*/routers/*_router.py` | All 9 module routers + `backend/app/health.py` |
| Cross-cutting middleware | `backend/app/middleware/{security,auth,cors,logging}.py`, `backend/app/main.py`, `backend/app/shared/deps.py` | Rate limiting, CORS, auth, observability, error handling |
| Pre-flight log | `.agents/log/SELF_CRITIC.md` | Required reading for each session; compliance was mixed (see §6) |
| Raw session outputs | `/tmp/.../scratchpad/hermes-audit/out-*.md` (session-local, not repo-tracked) | One file per module; not persisted to the repo |

---

## 3. Assessment Summary

| Module | Endpoints | Anti-patterns found | Severity |
|---|---|---|---|
| Health | 1 | #9 (hardcoded version) | Low |
| Auth | 5 | #5, #23, #6, #7, #17, #3, #11, #9, #12, #1 | **High** |
| Property & Rooms | 5 | #5 (+ cross-cutting) | **High** |
| Tenant | 2 | #5, #1, #7, #20 | **High** |
| Billing | 6 | (see out-billing.md; cross-cutting #6/#9 + payment-method enum mismatch) | Medium |
| Contract | 7 | #5, #3, #13, #1, #17, #20 | **High** |
| Maintenance | 5 | #3, #5, #6, #9, #17, #1, #23 | **High** |
| Dashboard | 3 | #5, #7, #3, #6, #13, #17, #20, #11 | **High** |
| Notification | 3 | #5, #3, #15, #13, #6, #1, #9, #10 | **High** |
| Admin | 2 | #6 (cross-cutting), #9 (cross-cutting) — cleanest module | Low |

**Overall:** 6 of 8 non-admin, non-health modules (Auth, Property, Tenant, Contract, Maintenance, Dashboard, Notification — actually 7 of 8) independently converged on the same root defect: **no property-scope authorization enforcement anywhere in the API.** This is the single highest-confidence, highest-severity finding of the audit.

---

## 4. Cross-Cutting Findings (multi-session corroborated)

### 4.1 🔴 Anti-pattern #5 — No property-scope authorization (7/8 modules independently confirmed)
- **Modules affected:** Auth, Property, Tenant, Contract, Maintenance, Dashboard, Notification. Not applicable to Admin (role-gated) or Health (intentionally public).
- **Root cause:** `backend/app/shared/deps.py:16-54` (`get_current_user`) only decodes/validates the JWT and returns claims — it never checks `property_scopes` against the resource being accessed. `backend/app/middleware/auth.py`'s `AuthHeaderMiddleware` explicitly only validates header *format*, not scope. `AUTH-005` ("Insufficient property scope") is defined but never raised anywhere in the codebase. The `property_scopes` DB relationship is commented out in `models.py`.
- **Impact:** Any authenticated user (any valid JWT) can read/write data — tenants, contracts, maintenance requests, dashboard financials, notification history — for **any property**, not just their own.
- **Sharpest concrete instance:** `notification_service.py`'s `get_history()` checks `if property_id:` **before** `user_id`, so `GET /notifications/history?property_id=<victim>` returns another property's full notification history to any authenticated caller.
- **Verification status:** ✅ Independently re-confirmed by Orchestrator directly against `deps.py`, `middleware/auth.py`, and `notification_service.py`.

### 4.2 🟠 Anti-pattern #23 — CORS misconfiguration (double registration + invalid wildcard/credentials combo)
- **Modules affected:** Auth, Admin, Maintenance flagged this; applies app-wide.
- **Evidence:** `backend/app/main.py:144-146` calls `register_security_middleware(app)` (which internally invokes `security.py`'s `setup_cors_middleware(app)` — sets `allow_origins=["*"]` + `allow_credentials=True` when `DEBUG=True`, the default) **and then separately** calls `setup_cors_middleware(app, settings)` from `cors.py`. That second function's signature is `setup_cors_middleware(app, allowed_origins: list[str] | None = None)` — `settings` (a Pydantic `Settings` object, not a list) binds positionally to `allowed_origins`. Two full `CORSMiddleware` instances end up stacked, one fed a mistyped argument.
- **Verification status:** ✅ Independently re-confirmed by Orchestrator by reading `main.py`, `security.py`, and `cors.py` directly.

### 4.3 🟡 Anti-pattern #6 — Rate limiting is global and non-differentiated (confirmed by all 10 sessions)
- One in-memory limiter, 10,000 requests/60s per client IP, applied uniformly to every route except `/health`. No per-endpoint limits (contradicts `AGENTS.md`'s claim of "100 req/min/IP on auth endpoints" — Auth session caught this doc/code mismatch specifically). No `X-RateLimit-*`/`Retry-After` headers ever emitted despite being advertised in CORS `expose_headers`.

### 4.4 🟡 Anti-pattern #17 — Observability middleware defined but never wired in
- `backend/app/middleware/logging.py` defines `LoggingMiddleware` (sets `X-Request-ID`, structured per-request logs) but `main.py` never imports or registers it — confirmed via grep (only a structlog startup-config comment matches "logging" in `main.py`). No request correlation ID or per-route metrics exist anywhere in the running app.
- **Verification status:** ✅ Independently re-confirmed by Orchestrator.

### 4.5 🟠 Concrete reproducible bug — `GET /dashboard/revenue` crashes to an uncaught 500
- `dashboard_router.py:54-60` types `start_date`/`end_date` as plain `str | None` and parses them with unguarded `date.fromisoformat(...)`. A malformed date (e.g. `2026-13-40`) raises an uncaught `ValueError`, which is not caught by the app's only custom handler (`APIError` only) — it falls through to FastAPI's default 500.
- **Verification status:** ✅ Independently re-confirmed by Orchestrator by reading the handler source directly.

---

## 5. Module-Specific Findings (not cross-cutting)

| Module | Finding | Anti-pattern |
|---|---|---|
| Health | `version="1.0.0"` hardcoded, ignores real `APP_VERSION` from config | #9 |
| Tenant | `search_by` query param accepts any string; invalid values silently fall back to name-search instead of rejecting (dedicated `TENANT-009` error code exists but is never raised) | #7 |
| Contract | `GET /contracts/active` and `GET /contracts/leases/{room_id}/history` are fully unbounded (no pagination); `renew`/`extend` have no idempotency key | #13, #1 |
| Maintenance | Validation errors (`{"detail":[...]}`) vs. domain errors (`{"error":{...}}`) use two incompatible envelopes | #3 |
| Dashboard | `OccupancyResponse.data` is an untyped `dict`, diverging from the typed-wrapper convention used by `/summary` | #11 |
| Notification | `POST /notifications/test` is fail-silent — a failed send still returns `201`; send is synchronous in the request path (no 202 + async) | #3, #15 |
| Billing (pre-existing, confirmed in `docs/API.md` rewrite) | `RecordPaymentRequest.method` pattern accepts `wallet` (not a real `PaymentMethod` enum value) and rejects `promptpay` (a valid enum value) | #7 / #12 |
| Admin (pre-existing, confirmed in `docs/API.md` rewrite) | `GET /admin/config` has no corresponding `PUT`/`PATCH` — `UpdateSystemConfigRequest` schema exists but is dead code | #18 (doc/contract completeness) |

---

## 6. Process Notes (Multi-Agent Execution)

### 6.1 Verification pass (Orchestrator acting as Verifier)
Per `docs/MULTI_AGENT_ARCHITECTURE.md` §2.2.1, a Verifier should not be the same instance as the Worker being checked. Claude (Orchestrator) independently re-read source for the 5 highest-severity findings (§4.1–4.5) rather than trusting Hermes's citations at face value. **All 5 checked out exactly as reported** — no fabrication or hallucination detected in the substantive audit findings across any of the 10 sessions.

### 6.2 Pre-flight compliance (`.agents/log/SELF_CRITIC.md` read requirement)
Only 3 of 10 sessions (Health, Auth, Notification) explicitly confirmed reading the file. 2 of 10 (Tenant, Maintenance) explicitly reported being unable to find it (likely a working-directory issue on the Orchestrator's side, not a fabrication — both stated the gap honestly instead of pretending compliance). The remaining 5 never mentioned it either way — compliance for those is **unverified, not confirmed**.

### 6.3 Self-critique follow-up — technical failure, not a findings issue
A follow-up round asked all 10 sessions (via `hermes -z ... --resume <original_session_id>`) to self-critique their own audit work. **`--resume` failed to attach to the original sessions** — each invocation silently created a brand-new session instead (confirmed via `hermes sessions list`: the "resumed" session IDs did not match the originals). All 10 responses correctly — and honestly — reported "this is the first message of this session, no task has occurred yet," then defaulted to producing a generic meta-analysis of an unrelated, older `SELF_CRITIC.md` archive (2026-07-07 E2E test sessions) instead of critiquing the actual audit work. This is a tooling/orchestration failure on the Orchestrator's side, not a Worker defect, and is **not** part of the substantive API findings above.

### 6.4 Unauthorized file write (side effect of §6.3)
One session (Dashboard), during the failed self-critique round, appended a new "R17" pre-flight rule and a "SESSION META" entry to `.agents/log/SELF_CRITIC.md` without being asked to. Verified via `git diff` as a clean append (not an overwrite — consistent with that file's own R8/R9 standing rules), left uncommitted/unstaged. **Disposition pending Human decision** — trivially revertible via `git checkout -- .agents/log/SELF_CRITIC.md` if unwanted.

### 6.5 Cost / resource usage
All 10 audit sessions completed successfully (0 failures) on the free-tier `tencent/hy3:free` model — $0 cost, ~3.04M tokens across 57 API calls. A separate, unrelated Hermes session was found running concurrently on the same Nous Portal account/profile for a different project (`sf404-social-media-for-film-enthusiastic`) during this audit — noted as a shared-rate-limit risk, not a defect in this audit's results.

---

## 7. Recommendation

The property-scope authorization gap (§4.1) is the audit's single highest-confidence, highest-severity finding — corroborated independently by 7 of 10 sessions and directly re-verified against source. It should be prioritized for remediation before anything else in this list. The CORS misconfiguration (§4.2) is the second priority, since it affects every request in `DEBUG` mode (the default). The remaining cross-cutting gaps (rate limiting, observability) and module-specific issues are lower urgency but should be tracked.

**Suggested next step:** file a scoped fix task (Task Contract per `docs/MULTI_AGENT_ARCHITECTURE.md` §5) for the property-scope authorization gap, given it is security-relevant and therefore warrants Human sign-off on the approach before dispatching to a Worker.

---

**Status:** 🟡 Open — awaiting Human decision on remediation priority and disposition of the unauthorized `SELF_CRITIC.md` edit (§6.4).

---

## 8. Resolution — Auth Module Redesign (2026-07-10)

The 10 Auth-module anti-pattern findings from §3 / §4 / §5 have been remediated in code (implementation task, same date). Findings **#5, #23, #6, #7, #17, #3, #11, #12, #1 are now FIXED** in the backend. **#9 (API versioning policy) remains a deliberate platform-wide gap** and was *not* fixed by this task (it is documented as such in `docs/API.md`).

| # | Finding | Status | Where fixed |
|---|---------|--------|-------------|
| #5 | No property-scope authorization | ✅ Fixed | `backend/app/shared/deps.py` (`require_property_scope()`) enforced on `POST /api/v1/auth/invite`; real `property_scopes` claim populated from the new `user_property_scopes` table |
| #23 | CORS double-registered, wildcard+credentials | ✅ Fixed | `backend/app/main.py` registers CORS exactly once via `setup_cors_middleware()` with an explicit origin allowlist; `security.py` no longer registers CORS |
| #6 | Rate limiting global/ineffective | ✅ Fixed | `backend/app/middleware/rate_limit.py` — dedicated 10 req/min/IP login limiter, separate from the global limiter, emitting real `X-RateLimit-*` + `Retry-After` headers |
| #7 | `/refresh` accepts unvalidated raw dict | ✅ Fixed | `backend/app/modules/auth/schemas.py` (`RefreshRequest`, `strict=True, extra="forbid"`) used by `POST /api/v1/auth/refresh` |
| #17 | Request-ID/logging never wired | ✅ Fixed | `LoggingMiddleware` registered in `backend/app/main.py`; every response carries `X-Request-ID` |
| #3 | Validation errors bypass the error envelope | ✅ Fixed | `RequestValidationError` handler in `backend/app/main.py` returns the unified `{"error": {"code": "VAL-001", ...}}` shape |
| #11 | `/invite`, `/refresh` return partial/ad-hoc payloads | ✅ Fixed | Typed `InviteResponse` schema + `/refresh` returns the full `TokenResponse` (rotated refresh token + user) |
| #12 | `/invite` schema silently non-strict | ✅ Fixed | `InviteRequest` is `strict=True, extra="forbid"` with an explicit `field_validator` for UUID coercion rather than relaxing module-wide strictness |
| #1 | No idempotency on `/register`, `/invite` | ✅ Fixed | `backend/app/shared/idempotency.py` + `idempotency_keys` table (migration `019`); `Idempotency-Key` header honored on both endpoints |
| #9 | No versioning/deprecation mechanism | ⏸️ Deliberate gap | Not fixed — platform-wide; documented as a known gap in `docs/API.md`. Out of scope for this Auth task |

**Supporting migration:** `backend/alembic/versions/019_add_user_property_scopes_and_idempotency.py` adds the `user_property_scopes` table + `property_role` enum and the `idempotency_keys` table.

**Verification:** `pytest -m unit tests/modules/auth/` — 27 passed (covers property-scope enforcement, idempotency replay, refresh-token rotation, and the unified validation error envelope). Note: this run was executed Docker-free against the host interpreter; integration tests and the live migration (`alembic upgrade head`) require Docker/a live Postgres and were **not** run.

**Caveat:** the other modules flagged for #5 (Property, Tenant, Contract, Maintenance, Dashboard, Notification) are **not** addressed by this Auth task — the `require_property_scope()` dependency is now available for them to adopt, but each still needs its own remediation.
