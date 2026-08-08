#!/usr/bin/env bash
# run-quality-gates.sh — Run all 16 quality gates with unified reporting
#
# Usage:
#   ./scripts/run-quality-gates.sh              # Run all 16 gates
#   ./scripts/run-quality-gates.sh --gates "^[123]$"  # Run gates matching regex (e.g. 1-3 only)
#   ./scripts/run-quality-gates.sh --fail-fast  # Stop on first failure
#
set -euo pipefail
cd "$(dirname "$0")/.."

# --- colors ------------------------------------------------------------------
if [ -t 1 ]; then
    RED=$'\033[31m'
    GREEN=$'\033[32m'
    YELLOW=$'\033[33m'
    BLUE=$'\033[34m'
    BOLD=$'\033[1m'
    RESET=$'\033[0m'
else
    RED= GREEN= YELLOW= BLUE= BOLD= RESET=
fi

TOTAL_GATES=16
GATES_PASSED=0
GATES_FAILED=0
GATES_SKIPPED=0
FAILED_GATES=()
GATE_REGEX=""
FAIL_FAST=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --gates)
            GATE_REGEX="$2"
            shift 2
            ;;
        --fail-fast)
            FAIL_FAST=true
            shift
            ;;
        *)
            echo "${RED}❌ Unknown option: $1${RESET}"
            echo "Usage: $0 [--gates <regex>] [--fail-fast]"
            exit 1
            ;;
    esac
done

echo "${BLUE}🎯 Running ${TOTAL_GATES} Quality Gates${RESET}"
if [[ -n "$GATE_REGEX" ]]; then
    echo "${YELLOW}  Filter: gates matching /${GATE_REGEX}/${RESET}"
fi
if [[ "$FAIL_FAST" == "true" ]]; then
    echo "${YELLOW}  Mode: FAIL-FAST (stop on first failure)${RESET}"
fi
echo ""

# Gate runner function
run_gate() {
    local gate_num=$1
    local gate_name=$2
    local command=$3

    # Skip if regex filter doesn't match
    if [[ -n "$GATE_REGEX" ]] && ! [[ "$gate_num" =~ $GATE_REGEX ]]; then
        return 0
    fi

    echo "═══════════════════════════════════════════"
    echo "${BLUE}Gate ${gate_num}: ${gate_name}${RESET}"
    echo "═══════════════════════════════════════════"

    if eval "$command"; then
        echo "${GREEN}✅ PASS${RESET}"
        GATES_PASSED=$((GATES_PASSED + 1))
    else
        echo "${RED}❌ FAIL${RESET}"
        GATES_FAILED=$((GATES_FAILED + 1))
        FAILED_GATES+=("Gate ${gate_num}: ${gate_name}")

        if [[ "$FAIL_FAST" == "true" ]]; then
            echo "${RED}⛔ Stopping (--fail-fast enabled)${RESET}"
            return 1
        fi
    fi
    echo ""
}

# Gate 1: Smoke Test
run_gate 1 "Smoke Test" "./scripts/smoke-test.sh" || exit 1

# Gate 2: Dev Health Check
run_gate 2 "Dev Health" "./scripts/dev-healthcheck.sh" || exit 1

# Gate 3: Dev Stack Check
run_gate 3 "Dev Stack" "./scripts/check-dev-stack.sh" || exit 1

# Gate 4: Seed Data
run_gate 4 "Seed Data" "./scripts/seed-dev-data.sh" || exit 1

# Gate 5: Permissions
run_gate 5 "Permissions" "./scripts/fix-permissions.sh" || exit 1

# Gate 6: Backend Unit Tests
run_gate 6 "Backend Tests" "make test-unit" || exit 1

# Gate 7: Backend Lint
run_gate 7 "Backend Lint" "make lint" || exit 1

# Gate 8: Backend Typecheck
run_gate 8 "Backend Typecheck" "make typecheck" || exit 1

# Gate 9: Frontend Verification (tests + typecheck + lint)
run_gate 9 "Frontend Verify" "./scripts/verify-frontend.sh" || exit 1

# Gate 10: Frontend Unit Tests
run_gate 10 "Frontend Tests" "make test-frontend" || exit 1

# Gate 11: Frontend Lint
run_gate 11 "Frontend Lint" "make lint-frontend" || exit 1

# Gate 12: No Suppression
run_gate 12 "No Suppression" "./scripts/check-suppression.sh" || exit 1

# Gate 13: Test Fixtures
run_gate 13 "Test Fixtures" "./scripts/check-test-fixtures.sh" || exit 1

# Gate 14: Code Patterns
run_gate 14 "Code Patterns" "./scripts/check-code-patterns.sh" || exit 1

# Gate 15: GitHub Sync
run_gate 15 "GitHub Sync" "./scripts/check-github-sync.sh" || exit 1

# Gate 16: Fullstack E2E (FINAL CRITICAL GATE)
run_gate 16 "Fullstack E2E" "make test-e2e" || exit 1

# Summary
TOTAL_RUN=$((GATES_PASSED + GATES_FAILED))
echo "╔═══════════════════════════════════════════╗"
echo "║         Quality Gates Summary             ║"
echo "╠═══════════════════════════════════════════╣"
printf "║  Passed:  %-30s║\n" "${GATES_PASSED}/${TOTAL_RUN}"
printf "║  Failed:  %-30s║\n" "${GATES_FAILED}/${TOTAL_RUN}"
printf "║  Skipped: %-30s║\n" "${GATES_SKIPPED}"
if [[ $TOTAL_RUN -gt 0 ]]; then
    printf "║  Rate:    %-30s║\n" "$((GATES_PASSED * 100 / TOTAL_RUN))%"
fi
echo "╚═══════════════════════════════════════════╝"

if [[ $GATES_FAILED -gt 0 ]]; then
    echo ""
    echo "${RED}${BOLD}Failed Gates:${RESET}"
    for gate in "${FAILED_GATES[@]}"; do
        echo "  ❌ $gate"
    done
    echo ""
    echo "${RED}❌ NOT READY TO DEPLOY${RESET}"
    exit 1
else
    echo ""
    echo "${GREEN}${BOLD}✅ DEPLOY READY — All gates passed!${RESET}"
    exit 0
fi
