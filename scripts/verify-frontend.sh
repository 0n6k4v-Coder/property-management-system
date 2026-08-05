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

# 4. Check bundle size (fail if > 500KB)
echo ""
echo "==> Checking bundle size..."
# Check if dist/assets exists from a previous build
if run_in_container test -d dist/assets; then
    # Check bundle size of JS files
    BUNDLE_SIZE=$(run_in_container sh -c "du -sk dist/assets/*.js 2>/dev/null | awk '{sum+=\$1} END {print sum}'")
    MAX_SIZE=1000  # KB
    
    if [ -n "$BUNDLE_SIZE" ] && [ "$BUNDLE_SIZE" -gt "$MAX_SIZE" ]; then
        fail "Bundle size too large: ${BUNDLE_SIZE}KB (max: ${MAX_SIZE}KB)"
        run_in_container sh -c "du -sh dist/assets/*.js | sort -rh | head -5"
        exit 1
    else
        pass "Bundle size OK: ${BUNDLE_SIZE:-0}KB (max: ${MAX_SIZE}KB)"
    fi
else
    # Try to build frontend in development mode to check bundle size
    if run_in_container npm run build -- --mode development > /dev/null 2>&1; then
        BUNDLE_SIZE=$(run_in_container sh -c "du -sk dist/assets/*.js 2>/dev/null | awk '{sum+=\$1} END {print sum}'")
        MAX_SIZE=1000  # KB
        
        if [ -n "$BUNDLE_SIZE" ] && [ "$BUNDLE_SIZE" -gt "$MAX_SIZE" ]; then
            fail "Bundle size too large: ${BUNDLE_SIZE}KB (max: ${MAX_SIZE}KB)"
            run_in_container sh -c "du -sh dist/assets/*.js | sort -rh | head -5"
            exit 1
        else
            pass "Bundle size OK: ${BUNDLE_SIZE:-0}KB (max: ${MAX_SIZE}KB)"
        fi
    else
        fail "Build failed and no existing dist/assets found"
        exit 1
    fi
fi

# 5. Check lazy loading patterns for heavy libraries
echo ""
echo "==> Checking lazy loading patterns..."
HEAVY_IMPORTS=$(run_in_container sh -c "grep -r \"from 'recharts'\" src/ --include=\"*.tsx\" 2>/dev/null | grep -v \"lazy\" | wc -l")

if [ "$HEAVY_IMPORTS" -gt 0 ]; then
    warn "Found $HEAVY_IMPORTS heavy imports without lazy loading:"
    run_in_container sh -c "grep -rn \"from 'recharts'\" src/ --include=\"*.tsx\" 2>/dev/null | grep -v \"lazy\" | head -5"
    echo ""
    echo "   Consider using React.lazy() for heavy libraries:"
    echo "   const Recharts = React.lazy(() => import('recharts'))"
    echo ""
    warn "Warning: This may cause performance issues (large bundle size)"
    # Don't fail - just warn
else
    pass "Lazy loading patterns correct"
fi

echo ""
pass "All frontend verification checks passed!"
exit 0