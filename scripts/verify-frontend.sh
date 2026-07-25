#!/usr/bin/env bash
# Frontend verification script: runs test + typecheck + lint inside the frontend container.
# Runs inside docker exec pms-dev-frontend-1. Exits on any failure.

set -euo pipefail

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}PASS${NC} $1"; }
fail() { echo -e "${RED}FAIL${NC} $1"; }
warn() { echo -e "${YELLOW}WARN${NC} $1"; }

CONTAINER="pms-dev-frontend-1"
WORKDIR="/app"

echo "==> Verifying frontend inside container: $CONTAINER"
echo "==> Working directory: $WORKDIR"
echo ""

# Check container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
    fail "Container $CONTAINER is not running"
    exit 1
fi
pass "Container $CONTAINER is running"

# Helper to run commands in container
run_in_container() {
    docker exec -w "$WORKDIR" "$CONTAINER" "$@"
}

# 1. Run tests
echo ""
echo "==> Running npm test..."
if run_in_container npm run test; then
    pass "npm test passed"
else
    fail "npm test failed"
    exit 1
fi

# 2. Run typecheck (tsc --noEmit)
echo ""
echo "==> Running npx tsc --noEmit..."
if run_in_container npx tsc --noEmit; then
    pass "TypeScript typecheck passed"
else
    fail "TypeScript typecheck failed"
    exit 1
fi

# 3. Run eslint with memory limit on src/ (fail on errors only, warnings allowed)
echo ""
echo "==> Running eslint with memory limit on src/..."
# Increase Node memory limit for eslint
if run_in_container node --max-old-space-size=4096 ./node_modules/.bin/eslint src; then
    pass "ESLint passed"
else
    fail "ESLint failed"
    exit 1
fi

echo ""
pass "All frontend verification checks passed!"
exit 0