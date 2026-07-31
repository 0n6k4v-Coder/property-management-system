#!/usr/bin/env bash
# scripts/ci-local.sh — Full local CI cycle
# Runs: make dev → wait for backend /health → verify-backend.sh → verify-frontend.sh → make dev-down
# Backgrounds the dev process, captures PID, kills on exit.

set -euo pipefail

# Colors
RED=$'\033[31m'
GREEN=$'\033[32m'
YELLOW=$'\033[33m'
BLUE=$'\033[34m'
BOLD=$'\033[1m'
RESET=$'\033[0m'

# Project root
cd "$(dirname "$0")/.."

BACKEND_URL="http://localhost:8000"
HEALTH_ENDPOINT="${BACKEND_URL}/health"
HEALTH_MAX_ATTEMPTS=30
HEALTH_SLEEP_SECONDS=3
DEV_STARTED=""

# Cleanup function - runs on EXIT (success or failure)
cleanup() {
    local exit_code=$?
    if [[ -n "${DEV_STARTED}" ]]; then
        echo -e "\n${YELLOW}${BOLD}[CI]${RESET} Stopping dev environment..."
        make dev-down 2>/dev/null || true
        echo -e "${GREEN}${BOLD}[CI]${RESET} Dev environment stopped"
    fi
    exit $exit_code
}
trap cleanup EXIT INT TERM

# Helper functions
info()  { echo -e "${BLUE}${BOLD}[CI]${RESET} $*"; }
ok()    { echo -e "${GREEN}${BOLD}[CI]${RESET} $*"; }
warn()  { echo -e "${YELLOW}${BOLD}[CI]${RESET} $*"; }
fail()  { echo -e "${RED}${BOLD}[CI]${RESET} $*"; exit 1; }

# Check health endpoint
wait_for_backend_healthy() {
    info "Waiting for backend to become healthy at ${HEALTH_ENDPOINT}..."
    local attempt=1
    while (( attempt <= HEALTH_MAX_ATTEMPTS )); do
        if curl -sf --max-time 5 "${HEALTH_ENDPOINT}" >/dev/null 2>&1; then
            local resp
            resp=$(curl -sf --max-time 5 "${HEALTH_ENDPOINT}" 2>/dev/null || echo "")
            if echo "${resp}" | grep -q '"status":"ok"'; then
                ok "Backend healthy (attempt ${attempt}/${HEALTH_MAX_ATTEMPTS})"
                return 0
            fi
        fi
        echo -n "."
        sleep "${HEALTH_SLEEP_SECONDS}"
        ((attempt++))
    done
    echo ""
    fail "Backend failed to become healthy after ${HEALTH_MAX_ATTEMPTS} attempts (${HEALTH_SLEEP_SECONDS}s each = ~$((HEALTH_MAX_ATTEMPTS * HEALTH_SLEEP_SECONDS))s)"
}

# Run a verify script with error handling
run_verify() {
    local script_name="$1"
    local script_path="scripts/${script_name}"

    if [[ ! -f "${script_path}" ]]; then
        fail "Verify script not found: ${script_path}"
    fi

    if [[ ! -x "${script_path}" ]]; then
        info "Making ${script_name} executable..."
        chmod +x "${script_path}"
    fi

    info "Running ${script_name}..."
    if "${script_path}"; then
        ok "${script_name} passed"
    else
        fail "${script_name} failed"
    fi
}

# ---- Main CI Cycle ----

info "Starting local CI cycle..."

# 1. Ensure clean state - stop any existing dev stack
info "Ensuring clean dev stack state..."
docker compose -f docker-compose.dev.yml --project-name pms-dev --profile dev down -v 2>/dev/null || true

# 2. Start dev stack (detached, build + up)
info "Starting dev stack (detached, build + up)..."
docker compose -f docker-compose.dev.yml --project-name pms-dev --profile dev up -d --build
DEV_STARTED=1

# 3. Wait for backend healthy
wait_for_backend_healthy

# 4. Run database migrations
info "Applying database migrations..."
make db-migrate

# 5. Seed admin user + E2E fixtures
info "Seeding admin user + E2E fixtures..."
./scripts/seed-dev-data.sh || warn "Seed completed with warnings (may be idempotent)"

# 6. Run backend verification
run_verify "verify-backend.sh"

# 7. Run frontend verification
run_verify "verify-frontend.sh"

# 8. All verification passed - tear down will happen via trap
ok "All verification checks passed!"
info "Tearing down dev environment..."

# Explicit cleanup (trap will also run on exit)
make dev-down

ok "Local CI cycle completed successfully!"
exit 0