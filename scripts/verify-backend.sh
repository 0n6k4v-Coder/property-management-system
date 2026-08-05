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

# 4. Test Fixture Validation
echo "🔍 Checking test fixtures..."
if docker compose -f docker-compose.dev.yml exec -T backend python -c "
import sys
from pathlib import Path

security_tests = list(Path('tests/modules').glob('**/test_*_security.py'))
issues = []

for test_file in security_tests:
    content = test_file.read_text()
    if 'class TestAuthenticationRequired' in content:
        if 'remove_auth_override' not in content:
            issues.append(f'{test_file}: Missing remove_auth_override fixture')
        if 'dependency_overrides.pop(get_current_user' not in content:
            issues.append(f'{test_file}: Missing dependency_overrides.pop')

if issues:
    print('❌ Test fixture issues found:')
    for issue in issues:
        print(f'  - {issue}')
    sys.exit(1)
else:
    print('✅ All test fixtures correct')
"; then
    pass "test fixture validation"
else
    fail "test fixture validation failed"
    OVERALL_STATUS=1
fi

echo ""

# 5. Parameter Naming Check
echo "🔍 Checking parameter naming..."
if docker compose -f docker-compose.dev.yml exec -T backend python -c "
import sys
import re
from pathlib import Path

routers = list(Path('app/modules').glob('**/routers/*_router.py'))
issues = []

for router_file in routers:
    content = router_file.read_text()
    pattern = r'async def (\w+)\([^)]*(_?current_user)[^)]*\)'
    
    for match in re.finditer(pattern, content):
        func_name = match.group(1)
        param_name = match.group(2)
        has_underscore = param_name.startswith('_')
        
        func_start = match.end()
        func_body = content[func_start:func_start + 2000]
        uses_current_user = 'current_user[' in func_body or 'current_user.' in func_body
        
        if uses_current_user and has_underscore:
            issues.append(f'{router_file}:{func_name}: Uses current_user but has underscore')
        elif not uses_current_user and not has_underscore:
            issues.append(f'{router_file}:{func_name}: Unused but no underscore')

if issues:
    print('❌ Parameter naming issues:')
    for issue in issues:
        print(f'  - {issue}')
    sys.exit(1)
else:
    print('✅ Parameter naming consistent')
"; then
    pass "parameter naming check"
else
    fail "parameter naming check failed"
    OVERALL_STATUS=1
fi

echo ""

# 6. Suppression Check
echo "🔍 Checking suppression lines..."
SUPPRESSION_COUNT=$(docker compose -f docker-compose.dev.yml exec -T backend grep -r "type: ignore\|noqa\|eslint-disable" app/ --include="*.py" 2>/dev/null | wc -l)
if [ "$SUPPRESSION_COUNT" -gt 0 ]; then
    echo "❌ Found $SUPPRESSION_COUNT suppression lines"
    docker compose -f docker-compose.dev.yml exec -T backend grep -r "type: ignore\|noqa\|eslint-disable" app/ --include="*.py"
    fail "suppression check failed"
    OVERALL_STATUS=1
else
    pass "suppression check"
fi

echo ""

if [ "$OVERALL_STATUS" -eq 0 ]; then
    pass "All checks passed"
else
    fail "One or more checks failed"
fi

exit $OVERALL_STATUS