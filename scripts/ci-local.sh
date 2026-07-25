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
DEV_PID=""

# Cleanup function - runs on EXIT (success or failure)
cleanup() {
    local exit_code=$?
    if [[ -n "${DEV_PID}" ]] && kill -0 "${DEV_PID}" 2>/dev/null; then
        echo -e "\n${YELLOW}${BOLD}[CI]${RESET} Stopping dev environment (PID: ${DEV_PID})..."
        make dev-down 2>/dev/null || true
        kill "${DEV_PID}" 2>/dev/null || true
        wait "${DEV_PID}" 2>/dev/null || true
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

# 1. Start dev environment in background
info "Starting dev environment (make dev) in background..."
make dev &
DEV_PID=$!
info "Dev process started with PID: ${DEV_PID}"

# 2. Wait for backend healthy
wait_for_backend_healthy

# 3. Run backend verification
run_verify "verify-backend.sh"

# 4. Run frontend verification
run_verify "verify-frontend.sh"

# 5. All verification passed - tear down will happen via trap
ok "All verification checks passed!"
info "Tearing down dev environment..."

# Explicit cleanup (trap will also run on exit)
make dev-down
DEV_PID=""

ok "Local CI cycle completed successfully!"
exit 0