# Scripts Reference

Scripts สำหรับ automate development workflows, testing, และ deployment ของ Property Management System

## Quick Reference

### 🚀 Common Workflows
```bash
# Run all quality gates (pre-commit check)
./scripts/run-quality-gates.sh

# Run E2E tests (full suite)
make test-e2e

# Run E2E subset (auth only, fast feedback)
./scripts/run-e2e-subset.sh auth

# Quick cleanup (test artifacts only)
./scripts/phase-cleanup.sh quick

# Full cleanup (stop Docker + artifacts)
./scripts/phase-cleanup.sh session

# Full local CI cycle (dev → verify → dev-down)
./scripts/ci-local.sh

# Interactive git commit + push (conventional commits)
./scripts/git-commit-push.sh
```

---

## 📋 Script Categories

### 1. E2E Testing (4 scripts)
- `setup-e2e.sh` — Setup E2E environment (start containers, migrate, seed)
- `run-e2e-subset.sh` — Run specific E2E test subsets
- `verify-e2e.sh` — Run Playwright E2E with self-critic rules
- `reset-e2e-db.sh` — Reset E2E database fixtures

### 2. Quality Gates (7 scripts)
- `run-quality-gates.sh` — Run all 16 quality gates with unified reporting
- `smoke-test.sh` — 3-point smoke test (backend, frontend, auth)
- `dev-healthcheck.sh` — 5-point health check on dev stack
- `check-dev-stack.sh` — Check dev container status
- `verify-backend.sh` — Backend code quality (pytest, mypy, ruff)
- `verify-frontend.sh` — Frontend code quality (test, typecheck, lint)
- `ci-local.sh` — Full local CI cycle

### 3. Cleanup & Maintenance (4 scripts)
- `phase-cleanup.sh` — Multi-level cleanup (quick/session/phase/project)
- `clean-test-artifacts.sh` — Clean test artifacts from host + containers
- `docker-clean.sh` — Complete Docker resource cleanup
- `fix-permissions.sh` — Fix file permissions (600→644, root-owned dirs)

### 4. Data & Fixtures (2 scripts)
- `seed-dev-data.sh` — Seed admin user + deterministic E2E fixtures
- `check-test-fixtures.sh` — Verify security test auth override cleanup

### 5. Code Quality (3 scripts)
- `check-code-patterns.sh` — Check current_user parameter naming in routers
- `check-suppression.sh` — Check for type: ignore, noqa, eslint-disable
- `check-github-sync.sh` — Verify local + remote GitHub sync

### 6. Git & Operations (5 scripts)
- `git-commit-push.sh` — Interactive git commit + push
- `backup.sh` — PostgreSQL backup to MinIO/S3
- `restore.sh` — PostgreSQL restore from MinIO backup
- `release.sh` — Automated release pipeline
- `validate_prod_env.sh` — Production environment pre-flight checks

### 7. Infrastructure (1 script)
- `init-minio-buckets.sh` — Pre-create required S3 buckets on MinIO (auto)

---

## 📖 Detailed Documentation

### `setup-e2e.sh`
**Purpose:** Automated E2E environment setup — starts test stack, waits for backend health, resets database schema, applies migrations, and seeds E2E fixture data. Must be run before Playwright E2E tests.

**Usage:**
```bash
./scripts/setup-e2e.sh
```

**What it does:**
1. Start test stack (backend, db, redis, minio) using `docker-compose.test.yml`
2. Wait for backend `/health` endpoint (90s timeout)
3. Reset database schema (drop + recreate)
4. Apply Alembic migrations
5. Seed E2E fixture data (13 tables)

**When to use:**
- Before running E2E tests manually
- After `docker compose down -v`
- When test database is corrupted
- Called automatically by `run-e2e-subset.sh` and `verify-e2e.sh`

**Prerequisites:**
- Docker daemon running
- `docker-compose.test.yml` present
- Alembic migrations available in `backend/alembic/`

---

### `run-e2e-subset.sh`
**Purpose:** Run specific E2E test subsets for faster feedback during development

**Usage:**
```bash
./scripts/run-e2e-subset.sh [subset] [workers] [retries]
```

**Subsets:**
- `auth` — Authentication tests (`auth-flow.spec.ts`)
- `billing` — Billing/invoice tests (`invoice-payment.spec.ts`)
- `tenant` — Tenant tests (`tenant-flow.spec.ts`)
- `property` — Property tests (`property-flow.spec.ts`)
- `dashboard` — Dashboard tests (`dashboard.spec.ts`)
- `all` — All E2E tests (default, ~30 min)

**Arguments:**
- `subset` — Test subset to run (default: `all`)
- `workers` — Number of parallel workers (default: 2)
- `retries` — Number of retries per test (default: 2)

**Examples:**
```bash
# Run auth tests (fastest, ~2 min)
./scripts/run-e2e-subset.sh auth

# Run billing tests with 4 workers
./scripts/run-e2e-subset.sh billing 4

# Run all tests with 1 worker (slower but more stable)
./scripts/run-e2e-subset.sh all 1

# Run tenant tests with no retries
./scripts/run-e2e-subset.sh tenant 2 0
```

**What it does:**
1. Validate subset name
2. Setup E2E environment (calls `setup-e2e.sh`)
3. Run Playwright tests with specified workers/retries
4. Cleanup (calls `clean-test-artifacts.sh`)

---

### `verify-e2e.sh`
**Purpose:** Run Playwright E2E tests following Self-Critic rules from `SELF_CRITIC.md`

**Usage:**
```bash
./scripts/verify-e2e.sh -g "CONT-05"     # Filtered run (use while iterating)
./scripts/verify-e2e.sh                  # Full suite (reserve for final confirm)
```

**Self-Critic Rules enforced:**
- **R6:** Reset E2E database before every run (not just the first one)
- **R7:** Migration check before the first reset of a session
- **R10:** Refuse to run if another session's frontend-test container is up
- **R12:** Stream long runs to a log file instead of piping through `tail`
- **R14:** Reset E2E database before every run (repeat safety)
- **R16:** Stream long runs to log file (repeat safety)

**What it does:**
1. Check for another session's frontend-test container (R10)
2. Verify migrations are current (R7)
3. Reset E2E database (R6/R14)
4. Run Playwright with grep filter or full suite
5. Stream output to `/tmp/verify-e2e-$$.log`

**When to use:**
- Iterating on a specific test (`-g "pattern"`)
- Final full-suite confirmation before merge

---

### `reset-e2e-db.sh`
**Purpose:** Truncate and re-seed the fullstack E2E fixture data

**Usage:**
```bash
./scripts/reset-e2e-db.sh
```

**What it does:**
- Runs `python -m scripts.seed_e2e --reset` inside the test backend container
- Must be run before any Playwright run against the real backend+DB

**Note:** The test stack's backend and Playwright are separate processes, so there's no per-test transaction rollback like pytest gets.

---

### `run-quality-gates.sh`
**Purpose:** Run all 16 quality gates with unified reporting

**Usage:**
```bash
./scripts/run-quality-gates.sh                         # Run all 16 gates
./scripts/run-quality-gates.sh --gates "^[123]$"       # Run gates matching regex
./scripts/run-quality-gates.sh --fail-fast              # Stop on first failure
```

**Options:**
- `--gates <regex>` — Run only gates matching regex (e.g. `^[123]$` for gates 1-3)
- `--fail-fast` — Stop on first failure

**Examples:**
```bash
# Quick health check (gates 1-3)
./scripts/run-quality-gates.sh --gates "^[123]$"

# Backend-focused (gates 6-8)
./scripts/run-quality-gates.sh --gates "^[678]$"

# Full check with fail-fast
./scripts/run-quality-gates.sh --fail-fast
```

**Gate List:**
1. Smoke Test (`smoke-test.sh`)
2. Dev Health Check (`dev-healthcheck.sh`)
3. Dev Stack Check (`check-dev-stack.sh`)
4. Seed Data Validation (`seed-dev-data.sh`)
5. File Permissions (`fix-permissions.sh`)
6. Backend Tests (`verify-backend.sh`)
7. Backend Lint (`verify-backend.sh`)
8. Backend Typecheck (`verify-backend.sh`)
9. Frontend Tests (`verify-frontend.sh`)
10. Frontend Lint (`verify-frontend.sh`)
11. Frontend Typecheck (`verify-frontend.sh`)
12. No Suppression (`check-suppression.sh`)
13. Test Fixtures (`check-test-fixtures.sh`)
14. Code Patterns (`check-code-patterns.sh`)
15. GitHub Sync (`check-github-sync.sh`)
16. Fullstack E2E (CRITICAL — runs Playwright suite)

**Exit codes:**
- `0` — All gates passed (DEPLOY READY)
- `1` — One or more gates failed (NOT READY)

---

### `smoke-test.sh`
**Purpose:** Quick 3-point smoke test against the running dev stack

**Usage:**
```bash
./scripts/smoke-test.sh
```

**Checks:**
1. Backend health endpoint → `{"status":"ok"}`
2. Frontend dev server → `<!doctype html>`
3. Auth login → `access_token` in JSON response

**Exit code:** 0 only if all checks PASS

---

### `dev-healthcheck.sh`
**Purpose:** 5-point health check on the running dev stack containers

**Usage:**
```bash
./scripts/dev-healthcheck.sh
```

**Checks:**
1. Dev containers up — all 5 `pms-dev-*` running/healthy
2. Backend `/health` → `{"status":"ok"}`
3. Database `SELECT 1` → 1 row returned via psql
4. Auth login → `access_token` in JSON response
5. Frontend dev server → `<!doctype html>`

**Exit code:** 0 only if all checks PASS

---

### `check-dev-stack.sh`
**Purpose:** Check all dev containers status for the Property Management System

**Usage:**
```bash
./scripts/check-dev-stack.sh
```

**What it does:**
- Checks status of all services in `docker-compose.dev.yml`
- Reports which containers are running, healthy, or stopped
- Exit code 0 if all healthy/running, 1 otherwise

---

### `verify-backend.sh`
**Purpose:** Backend verification — runs tests, typecheck, and lint inside the backend container

**Usage:**
```bash
./scripts/verify-backend.sh
```

**Container:** `pms-dev-backend-1`
**Runs:** pytest, mypy, ruff check
**Exits on:** Any failure

---

### `verify-frontend.sh`
**Purpose:** Frontend verification — runs test, typecheck, and lint inside the frontend container

**Usage:**
```bash
./scripts/verify-frontend.sh
```

**Container:** `pms-dev-frontend-1`
**Runs:** vitest, jsconfig checkJs, eslint
**Exits on:** Any failure

---

### `ci-local.sh`
**Purpose:** Full local CI cycle — mirrors what a CI pipeline would do locally

**Usage:**
```bash
./scripts/ci-local.sh
```

**What it does:**
1. Start dev stack (`make dev`)
2. Wait for backend `/health` (localhost:8000)
3. Run `verify-backend.sh`
4. Run `verify-frontend.sh`
5. Stop dev stack (`make dev-down`)

**Exit code:** 0 if all steps pass, 1 on any failure

**When to use:**
- Pre-commit CI simulation
- When `make test` / `make lint` aren't available
- Local verification without GitHub Actions

---

### `phase-cleanup.sh`
**Purpose:** Multi-level cleanup between development phases

**Usage:**
```bash
./scripts/phase-cleanup.sh [level]
```

**Levels:**
- `quick` (default) — Remove test artifacts only (~10s)
- `session` — Remove artifacts + stop Docker (~30s)
- `phase` — Full reset: artifacts + Docker + volumes + images (~2 min)
- `project` — Nuclear: everything including project-specific Docker resources (interactive confirmation)

**Examples:**
```bash
# Quick cleanup after test run
./scripts/phase-cleanup.sh quick

# End of day / end of session
./scripts/phase-cleanup.sh session

# Start fresh (removes all volumes)
./scripts/phase-cleanup.sh phase

# Nuclear option (removes everything, requires confirmation)
./scripts/phase-cleanup.sh project
```

**When to use:**
- `quick`: After each E2E test run
- `session`: End of work session, before closing
- `phase`: Switching to different project or major context switch
- `project`: Starting completely fresh (WARNING: destructive — removes ALL Docker resources)

---

### `clean-test-artifacts.sh`
**Purpose:** Clean test artifacts from host and containers with Docker permission handling

**Usage:**
```bash
./scripts/clean-test-artifacts.sh
```

**What it does:**
1. Clean inside containers (if running)
2. Fix permissions on root-owned directories from Docker
3. Clean host-side backend artifacts (`.pytest_cache`, `.hypothesis`, `htmlcov`, `coverage.xml`)
4. Clean host-side frontend artifacts (`test-results/`, `coverage/`, `playwright-report/`)
5. Clean stray files (`test_output.txt`, `.last-run.json`)

**When to use:**
- After E2E test runs
- When `git status` shows untracked test files
- Before committing (to avoid committing artifacts)
- Called automatically at the end of `run-e2e-subset.sh` and `verify-e2e.sh`

**Note:** Handles root-owned files created by Docker containers (common when containers run as root)

---

### `docker-clean.sh`
**Purpose:** Complete Docker cleanup for the Property Management System

**Usage:**
```bash
./scripts/docker-clean.sh [--all] [--dry-run]
```

**Options:**
- `--all` — Also prune builder cache and unused images (not just project resources)
- `--dry-run` — Show what would be removed without actually removing

**Examples:**
```bash
# Clean stopped containers (project resources only)
./scripts/docker-clean.sh

# Dry run — see what would be removed
./scripts/docker-clean.sh --dry-run

# Clean everything (WARNING: destructive)
./scripts/docker-clean.sh --all
```

**What it does:**
- Stops and removes project containers (`pms-dev-*`)
- Removes project volumes
- With `--all`: also prunes builder cache and unused images

---

### `fix-permissions.sh`
**Purpose:** Fix file permissions and Docker-created directory ownership

**Usage:**
```bash
./scripts/fix-permissions.sh                  # default: frontend/src/ backend/app/
./scripts/fix-permissions.sh path/to/dir ...   # scan specific paths
```

**What it does:**
1. Scan for files with mode 600 (`-rw-------`)
2. Fix to 644 (`-rw-r--r--`)
3. Fix root-owned directories from Docker
4. Make test artifacts writable

**When to use:**
- When `git status` shows permission errors
- After Docker creates root-owned files
- Before `git add` if permission denied
- After sub-agent operations that create files

---

### `seed-dev-data.sh`
**Purpose:** Seed development data — admin user + deterministic E2E fixtures

**Usage:**
```bash
./scripts/seed-dev-data.sh
```

**What it does:**
1. Runs `seed_admin` inside `pms-dev-backend-1` container (creates admin user)
2. Runs `seed_e2e --reset` inside `pms-dev-backend-1` container (deterministic E2E fixtures)

**Note:** Idempotent — safe to run multiple times

---

### `check-test-fixtures.sh`
**Purpose:** Verify security tests have proper auth override cleanup

**Usage:**
```bash
./scripts/check-test-fixtures.sh
```

**What it checks:**
- For each `test_*_security.py` in `tests/modules/`:
  - Has `TestAuthenticationRequired` class
  - Has `remove_auth_override` fixture
  - Has `dependency_overrides.pop(get_current_user...)` cleanup

**When to use:**
- Part of quality gate #13
- When adding new security tests
- Before PR merge

---

### `check-code-patterns.sh`
**Purpose:** Check `current_user` parameter naming consistency in router files

**Usage:**
```bash
./scripts/check-code-patterns.sh
```

**What it checks:**
- For each `*_router.py` in `app/modules/`:
  - Parameter `current_user` should NOT have underscore prefix
  - Flags any `current_user` parameters that violate naming convention

---

### `check-suppression.sh`
**Purpose:** Check for code suppressions (type: ignore, noqa, eslint-disable)

**Usage:**
```bash
./scripts/check-suppression.sh
```

**What it checks:**
- Python files in `app/` for `type: ignore` and `noqa`
- Reports any found suppressions with line numbers
- Exits 1 if any suppression found

**When to use:**
- Part of quality gate #12
- Enforces code quality — fix the underlying issue instead of suppressing

---

### `check-github-sync.sh`
**Purpose:** Verify local and remote GitHub repositories are in sync

**Usage:**
```bash
./scripts/check-github-sync.sh
```

**What it checks:**
1. Unpushed commits (`git log origin/master..HEAD`)
2. Remote reachability

**When to use:**
- Part of quality gate #15
- Before ending work session
- Pre-commit check

---

### `git-commit-push.sh`
**Purpose:** Interactive git commit and push with conventional commits

**Usage:**
```bash
./scripts/git-commit-push.sh
```

**Features:**
- Interactive prompt for commit type (feat, fix, docs, refactor, etc.)
- Interactive prompt for scope and message
- Validates commit message format
- Runs pre-commit hooks
- Pushes to `origin master`

**Conventional commit types:**
feat, fix, docs, refactor, chore, style, test, build, ci, perf, revert

**When to use:**
- Instead of manual `git commit` + `git push`
- Ensures consistent commit message format

---

### `backup.sh`
**Purpose:** PostgreSQL database backup to MinIO/S3-compatible storage

**Usage:**
```bash
bash scripts/backup.sh                          # Quick backup with default vars
bash scripts/backup.sh --db-url=postgresql://... # Override database URL
bash scripts/backup.sh --minio-endpoint=http://minio:9000
```

**Environment variables:**
- `DATABASE_URL` — PostgreSQL connection string
- `MINIO_ENDPOINT` — MinIO/S3 endpoint
- `MINIO_ACCESS_KEY` — MinIO access key
- `MINIO_SECRET_KEY` — MinIO secret key
- `MINIO_BACKUP_BUCKET` — Backup bucket name (default: `pms-backups`)

**What it does:**
1. `pg_dump` the database
2. Compress with gzip
3. Upload to MinIO/S3
4. Verify upload integrity

---

### `restore.sh`
**Purpose:** PostgreSQL restore from MinIO backup (idempotent)

**Usage:**
```bash
bash scripts/restore.sh                                    # Restore latest backup
bash scripts/restore.sh --file=backup_20260531_120000.sql.gz  # Specific file
bash scripts/restore.sh --dry-run                          # Show what would be done
bash scripts/restore.sh --db-url=postgresql://...          # Override database URL
```

**Environment variables:**
- `DATABASE_URL` — Target PostgreSQL connection string
- `MINIO_ENDPOINT` — MinIO/S3 endpoint
- `MINIO_ACCESS_KEY` — MinIO access key
- `MINIO_SECRET_KEY` — MinIO secret key
- `MINIO_BACKUP_BUCKET` — Backup bucket name (default: `pms-backups`)

**What it does:**
1. Download latest (or specific) backup from MinIO
2. Drop and recreate target database (idempotent)
3. Restore from backup
4. Verify restore integrity

---

### `release.sh`
**Purpose:** Automated release pipeline for Property Management System v1.0.0

**Usage:**
```bash
bash scripts/release.sh                              # Full release pipeline
bash scripts/release.sh --dry-run                    # Validate without publishing
bash scripts/release.sh --version=1.0.1              # Override version
bash scripts/release.sh --registry=ghcr.io/yourorg   # Registry override
```

**Environment variables:**
- `REGISTRY` — Container registry (default: `ghcr.io/yourorg`)
- `DOCKER_TAG` — Override image tag (default: auto-generated from version)

**What it does:**
1. Validate code quality (lint + typecheck + tests)
2. Create git tag
3. Build multi-arch Docker image (linux/amd64, linux/arm64) via buildx
4. Push to registry
5. Generate `CHANGELOG.md`

**Prerequisites:**
- Docker with buildx (multi-arch support)
- Git tags synced with remote
- Registry credentials configured

**Note:** Always run with `--dry-run` first to validate without publishing!

---

### `validate_prod_env.sh`
**Purpose:** Production environment pre-flight checks before starting the prod stack

**Usage:**
```bash
bash scripts/validate_prod_env.sh           # Full check
bash scripts/validate_prod_env.sh --quick   # Quick check (env vars only)
bash scripts/validate_prod_env.sh --help    # Show help
```

**What it validates:**
- Required environment variables
- Port availability
- File permissions
- Database migration status

**Exit codes:**
- `0` — All checks passed
- `1` — Critical failure (env vars, permissions)
- `2` — Warning (ports busy, DB not migrated)

---

### `init-minio-buckets.sh`
**Purpose:** Pre-create required S3 buckets on MinIO startup

**Usage:** (runs automatically as Docker entrypoint hook in production)

**What it does:**
- Waits for MinIO to be ready
- Configures `mc` alias
- Creates required buckets:
  - `pms-documents`
  - `pms-backups`
  - `pms-receipts`

**Note:** Runs as `docker-entrypoint-initdb.d` hook — no manual invocation needed in production.

---

## 🔧 Troubleshooting

### Issue: `setup-e2e.sh` fails with "Backend failed to become healthy"

**Root cause:** Backend container is crashing or not starting properly.

**Solution:**
```bash
# Check backend logs
docker compose -f docker-compose.test.yml logs backend

# Check if port 8000 is already in use
lsof -i :8000

# Check container status
docker compose -f docker-compose.test.yml ps

# Full restart
./scripts/phase-cleanup.sh session
./scripts/setup-e2e.sh
```

---

### Issue: `clean-test-artifacts.sh` fails with "Permission denied"

**Root cause:** Root-owned files created by Docker containers.

**Solution:**
```bash
# Fix permissions first
./scripts/fix-permissions.sh

# Then clean
./scripts/clean-test-artifacts.sh

# If still fails, use sudo
sudo ./scripts/clean-test-artifacts.sh
```

---

### Issue: `run-quality-gates.sh` fails on Gate 16 (E2E)

**Root cause:** E2E tests failing due to test data, container issues, or self-critic rule violations.

**Solution:**
```bash
# Run E2E separately to see detailed errors
./scripts/verify-e2e.sh

# Check test artifacts
ls -la frontend/test-results/playwright/

# View HTML report
open frontend/playwright-report/index.html

# Check for leftover frontend-test containers (R10)
docker ps | grep frontend-test
docker rm -f <container-id>  # remove stale containers
```

---

### Issue: `run-e2e-subset.sh` fails with "no frontend-test container"

**Root cause:** Another session's `frontend-test-*` container is still running (violates R10).

**Solution:**
```bash
# Find and stop stale containers
docker ps -a | grep frontend-test
docker rm -f $(docker ps -aq -f name=frontend-test)

# Then re-run
./scripts/run-e2e-subset.sh auth
```

---

### Issue: `fix-permissions.sh` finds many 600-mode files

**Root cause:** Sub-agents (write_file, patch, etc.) create files with restrictive 600 permissions by default.

**Solution:**
```bash
# Run fix-permissions to correct
./scripts/fix-permissions.sh

# Verify
find frontend/src backend/app -type f -perm 600 | wc -l
# Should return 0
```

**Prevention:** Run `fix-permissions.sh` after any sub-agent writes files.

---

### Issue: `release.sh` fails during Docker buildx multi-arch build

**Root cause:** buildx not configured or QEMU not available for cross-platform builds.

**Solution:**
```bash
# Check buildx
docker buildx version

# Set up QEMU for multi-arch
docker run --privileged --rm tonistiigi/binfmt:latest --install all

# Create builder instance
docker buildx create --use --name multiarch-builder

# Inspect
docker buildx inspect --bootstrap

# Retry release with --dry-run first
bash scripts/release.sh --dry-run
```

---

### Issue: Rate limiting (429 errors) during tests

**Root cause:** Rate limiter not disabled in test mode.

**Solution:**
```bash
# Verify ENVIRONMENT is set to test
docker compose -f docker-compose.test.yml exec backend env | grep ENVIRONMENT
# Should show: ENVIRONMENT=test

# If not set, check docker-compose.test.yml
grep -A5 environment docker-compose.test.yml
```

---

## 📝 Makefile Integration

Many scripts are invoked through Makefile targets:

```bash
make dev                  # docker compose up -d (dev stack)
make dev-down             # docker compose down -v
make dev-restart          # dev-down + dev
make test-e2e             # Calls setup-e2e.sh → playwright → cleanup
make test-unit            # Runs backend unit tests (pytest)
make lint                 # Runs backend linters (ruff + mypy)
make lint-frontend        # Runs frontend linters (eslint)
make typecheck            # Runs backend typecheck (mypy)
make typecheck-frontend   # Runs frontend typecheck (jsconfig checkJs)
make verify-backend       # Calls verify-backend.sh
make verify-frontend      # Calls verify-frontend.sh
```

ดู `Makefile` สำหรับ targets ทั้งหมด

---

## 🎯 Best Practices

### 1. Always cleanup after E2E tests
```bash
# Good: Cleanup automatically happens
./scripts/run-e2e-subset.sh auth
# (clean-test-artifacts.sh called automatically at end)

# Good: Quick cleanup after manual runs
./scripts/verify-e2e.sh
./scripts/phase-cleanup.sh quick
```

### 2. Use phase-cleanup.sh with appropriate levels
```bash
# After each E2E test run
./scripts/phase-cleanup.sh quick

# End of work session (ALWAYS do this)
./scripts/phase-cleanup.sh session

# Start completely fresh
./scripts/phase-cleanup.sh phase
```

### 3. Run quality gates before committing
```bash
# Quick check (gates 1-3 only, ~30s)
./scripts/run-quality-gates.sh --gates "^[123]$"

# Full check before PR (all 16 gates, ~10-15 min)
./scripts/run-quality-gates.sh
```

### 4. Use E2E subsets during development
```bash
# Fast feedback (auth only, ~2 min)
./scripts/run-e2e-subset.sh auth

# Iterate on a specific test (uses verify-e2e.sh with grep)
./scripts/verify-e2e.sh -g "CONT-05"

# Full suite before merge (~30 min)
./scripts/run-e2e-subset.sh all
```

### 5. Always use --dry-run for releases
```bash
# Validate without publishing
bash scripts/release.sh --dry-run

# Only run full release after dry-run passes
bash scripts/release.sh
```

### 6. Fix permissions after sub-agent writes
```bash
# After any automated file writes
./scripts/fix-permissions.sh

# Before git add
./scripts/fix-permissions.sh && git add .
```

---

## 🔒 Script Quality Standards

All scripts in `scripts/` MUST follow these standards:

### 1. Strict Mode
Every script MUST start with:
```bash
#!/usr/bin/env bash
set -euo pipefail
```

- `-e` -> Exit on error
- `-u` -> Exit on undefined variable
- `-o pipefail` -> Exit if any command in a pipeline fails

### 2. Pipe Error Handling Pattern
**DO NOT** use:
```bash
COUNT=$(grep "pattern" . | wc -l || echo 0)  # Creates "0\n0"
COUNT=$(grep "pattern" . || true | wc -l)     # 'true' runs before wc
```

**DO** use:
```bash
COUNT=$(grep "pattern" . | wc -l) || COUNT=0  # Correct fallback
```

### 3. No Hardcoded Paths
- Use relative paths (e.g., `./scripts/`, `../frontend/`)
- Use environment variables when needed
- Never use `/home/username/...`

### 4. Verified Scripts (with strict mode)
| Script | Strict Mode | Status |
|--------|-------------|--------|
| check-code-patterns.sh | ✅ | Fixed (2026-08-08) |
| check-github-sync.sh | ✅ | Fixed (2026-08-08) |
| check-suppression.sh | ✅ | Fixed (2026-08-08) |
| check-test-fixtures.sh | ✅ | Fixed (2026-08-08) |
| setup-e2e.sh | ✅ | Verified |
| clean-test-artifacts.sh | ✅ | Verified |
| phase-cleanup.sh | ✅ | Verified |
| run-quality-gates.sh | ✅ | Verified |
| run-e2e-subset.sh | ✅ | Verified |
| fix-permissions.sh | ✅ | Verified |
| *(all other scripts)* | ✅ | Verified |

---

## 📚 Related Documentation

- `AGENTS.md` — AI agent workflows and rules (SSOT for rules)
- `INDEX.md` — Project map, quick commands, phase status
- `Makefile` — Build targets and Docker shortcuts
- `docs/ARCHITECTURE.md` — C4 diagrams, tech stack, ADRs
- `docs/REQUIREMENTS.md` — FR/NFR/BR definitions, actors
- `docs/E2E_TEST_STRATEGY.md` — E2E testing constitution
- `docs/PROMPT.md` — Prompt templates
- `docker-compose.dev.yml` — Development stack
- `docker-compose.test.yml` — E2E test stack
- `docker-compose.prod.yml` — Production stack
- `backend/docs/OPERATIONS.md` — Runbooks, backup/restore
- `backend/docs/CODE_STYLE.md` — Python coding standards

---

## 🤝 Contributing

เพิ่ม scripts ใหม่:

1. สร้าง `scripts/<script-name>.sh`
2. เพิ่ม header comment (purpose + usage + prerequisites)
3. ใช้ `set -euo pipefail` เป็นบรรทัดแรกหลัง comment header
4. ใช้ `cd "$(dirname "$0")/.."` เพื่อให้ทำงานจาก root ของ project
5. เพิ่ม color support (copy pattern จาก existing scripts)
6. Exit code 0 สำหรับสำเร็จ, 1 สำหรับผ failure
7. ทดสอบ script ที่ทำงาน
8. อัปเดท `SCRIPTS.md` (ไฟล์นี้) — ให้ complete ตาม structure
9. Update `Makefile` หากเป็น target ใหม่
10. Commit + push ผ่าน `./scripts/git-commit-push.sh`

**Conventions:**
- ใช้ชื่อไฟล์ snake_case (`.sh` extension)
- Header comment ต้องมี Purpose, Usage, และ What it does
- รองรับ `--dry-run` สำหรับ destructive operations
- อ้างอิง `self/$variable` แทน hardcoded paths เมื่อเป็นไปได้
