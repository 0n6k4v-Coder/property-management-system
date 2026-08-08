#!/usr/bin/env bash
# run-e2e-subset.sh — Run specific E2E test subsets
#
# Usage:
#   ./scripts/run-e2e-subset.sh [subset] [workers] [retries]
#
# Subsets:
#   auth       — Authentication tests (auth-flow.spec.ts)
#   billing    — Billing/invoice tests (invoice-payment.spec.ts)
#   tenant     — Tenant tests (tenant-flow.spec.ts)
#   property   — Property tests (property-flow.spec.ts)
#   dashboard  — Dashboard tests (dashboard.spec.ts)
#   all        — All E2E tests (default)
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

SUBSET=${1:-"all"}
WORKERS=${2:-2}
RETRIES=${3:-2}

# Validate subset BEFORE setup (avoid wasted environment spin-up)
case "$SUBSET" in
    auth)        SPECS="e2e/specs/auth-flow.spec.ts" ;;
    billing|invoice) SPECS="e2e/specs/invoice-payment.spec.ts" ;;
    tenant)      SPECS="e2e/specs/tenant-flow.spec.ts" ;;
    property)    SPECS="e2e/specs/property-flow.spec.ts" ;;
    dashboard)   SPECS="e2e/specs/dashboard.spec.ts" ;;
    all)         SPECS="e2e/specs/*.spec.ts" ;;
    -h|--help)
        echo "Usage: $0 [subset] [workers] [retries]"
        echo "  Subsets: auth, billing, tenant, property, dashboard, all (default: all)"
        echo "  Workers: default 2"
        echo "  Retries: default 2"
        exit 0
        ;;
    *)
        echo "${RED}❌ Unknown subset: ${SUBSET}${RESET}"
        echo "Available: auth, billing, tenant, property, dashboard, all"
        exit 1
        ;;
esac

echo "${BLUE}🎭 Running E2E subset: ${BOLD}${SUBSET}${RESET}"
echo "   Workers: ${WORKERS}, Retries: ${RETRIES}"
echo ""

# Setup environment (uses Phase 1 script)
echo "${YELLOW}→ Setting up E2E environment...${RESET}"
./scripts/setup-e2e.sh

echo "${YELLOW}→ Running: ${SPECS}${RESET}"

# Run tests via docker-compose test stack (uses frontend-test service)
set +e
docker compose -f docker-compose.test.yml run --rm \
    -e PLAYWRIGHT_OUTPUT_DIR=/app/test-results/playwright \
    frontend-test \
    npx playwright test ${SPECS} \
    --reporter=list \
    --workers=${WORKERS} \
    --retries=${RETRIES} \
    --timeout=120000 \
    --project=chromium 2>&1
TEST_EXIT=$?
set -e

# Cleanup (uses Phase 1 scripts)
echo ""
echo "${YELLOW}→ Cleaning up...${RESET}"
docker compose -f docker-compose.test.yml down -v 2>/dev/null || true
./scripts/clean-test-artifacts.sh

if [[ $TEST_EXIT -eq 0 ]]; then
    echo ""
    echo "${GREEN}✅ E2E subset '${SUBSET}' passed!${RESET}"
    exit 0
else
    echo ""
    echo "${RED}❌ E2E subset '${SUBSET}' failed (exit code: ${TEST_EXIT})${RESET}"
    exit $TEST_EXIT
fi
