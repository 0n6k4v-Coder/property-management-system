#!/usr/bin/env bash
# Backend verification script: runs tests, typecheck, and lint inside the backend container
# Usage: ./scripts/verify-backend.sh
# Container: pms-dev-backend-1
# Runs: pytest tests/, mypy app/, ruff check app/
# Exits on any failure

set -euo pipefail

cd "$(dirname "$0")/.."

CONTAINER="pms-dev-backend-1"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}PASS${NC} $1"; }
fail() { echo -e "${RED}FAIL${NC} $1"; }
# Check container is running
CONTAINER_ID=$(docker ps --format '{{.Names}}' | grep "pms-dev-backend-1" | head -1)
if [[ -z "${CONTAINER_ID}" ]]; then
    fail "Container pms-dev-backend-1 is not running. Start it with: docker compose -f docker-compose.dev.yml up -d backend"
    exit 1
fi

CONTAINER="${CONTAINER_ID}"

OVERALL_STATUS=0

# 1. Run pytest
echo "==> Running pytest tests/ ..."
if docker exec "$CONTAINER" pytest tests/ -v --tb=short; then
    pass "pytest tests/"
else
    fail "pytest tests/ failed"
    OVERALL_STATUS=1
fi

echo ""

# 2. Run mypy typecheck
echo "==> Running mypy app/ ..."
if docker exec "$CONTAINER" mypy app/ --pretty; then
    pass "mypy app/"
else
    fail "mypy app/ failed"
    OVERALL_STATUS=1
fi

echo ""

# 3. Run ruff lint
echo "==> Running ruff check app/ ..."
if docker exec -e RUFF_CACHE_DIR=/tmp/ruff_cache "$CONTAINER" ruff check app/; then
    pass "ruff check app/"
else
    fail "ruff check app/ failed"
    OVERALL_STATUS=1
fi

echo ""
echo "==> Summary"
if [ "$OVERALL_STATUS" -eq 0 ]; then
    pass "All checks passed"
else
    fail "One or more checks failed"
fi

exit $OVERALL_STATUS