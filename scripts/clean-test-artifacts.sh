#!/usr/bin/env bash
# clean-test-artifacts.sh — Clean test artifacts with Docker permission handling
#
# Removes test artifacts from both host and containers. Handles root-owned
# files created by Docker (especially when containers run as root).
# Also cleans stray files left by test runs.
#
# Usage:
#   ./scripts/clean-test-artifacts.sh
#
set -euo pipefail
cd "$(dirname "$0")/.."

# --- colors -----------------------------------------------------------------
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

TEST_COMPOSE="docker-compose.test.yml"

echo "${BLUE}🧹 Cleaning test artifacts...${RESET}"

# --- 1. Clean inside containers (avoids permission issues) ------------------
echo "${YELLOW}→ Cleaning inside containers...${RESET}"
if docker compose -f docker-compose.test.yml ps 2>/dev/null | grep -q "Up"; then
    # backend service (real API) — clean its cache dirs from inside
    docker compose -f "${TEST_COMPOSE}" exec -T backend \
        sh -c "rm -rf /app/.hypothesis /app/.pytest_cache /app/htmlcov" 2>/dev/null || true
    # frontend-test runs as root; clean its artifacts from inside
    docker compose -f "${TEST_COMPOSE}" exec -T frontend-test \
        sh -c "rm -rf /app/test-results /app/coverage /app/playwright-report /app/e2e-results" 2>/dev/null || true
    echo "${GREEN}  Container-side cleanup done.${RESET}"
else
    echo "${YELLOW}  Test stack not running — skipping container cleanup.${RESET}"
fi

# --- 2. Fix permissions on root-owned files (Docker creates as root) --------
echo "${YELLOW}→ Fixing permissions on root-owned directories...${RESET}"
# Docker-created directories may be owned by root; make them writable first
for dir in backend/.hypothesis backend/.pytest_cache backend/htmlcov backend/test-reports \
           frontend/test-results frontend/playwright-report frontend/e2e-results \
           frontend/coverage frontend/blob-report; do
    if [ -d "$dir" ]; then
        chmod -R u+w "$dir" 2>/dev/null || true
    fi
done

# --- 3. Clean host-side backend artifacts -----------------------------------
echo "${YELLOW}→ Cleaning host-side backend artifacts...${RESET}"
find backend -maxdepth 4 -name ".hypothesis" -type d -exec rm -rf {} + 2>/dev/null || true
find backend -maxdepth 4 -name ".pytest_cache" -type d -exec rm -rf {} + 2>/dev/null || true
find backend -maxdepth 4 -name "htmlcov" -type d -exec rm -rf {} + 2>/dev/null || true
find backend -maxdepth 4 -name "coverage.xml" -type f -delete 2>/dev/null || true
find backend -maxdepth 4 -name ".coverage" -type f -delete 2>/dev/null || true
find backend -maxdepth 4 -name "test-reports" -type d -exec rm -rf {} + 2>/dev/null || true

# --- 4. Clean host-side frontend artifacts ----------------------------------
echo "${YELLOW}→ Cleaning host-side frontend artifacts...${RESET}"
rm -rf frontend/test-results frontend/playwright-report frontend/e2e-results
rm -rf frontend/coverage frontend/blob-report
rm -f frontend/coverage-final.json 2>/dev/null || true

# --- 5. Clean stray files at project root -----------------------------------
echo "${YELLOW}→ Cleaning stray files...${RESET}"
rm -f test_output.txt pytest_output.txt playwright_output.txt 2>/dev/null || true
rm -f .coverage 2>/dev/null || true

# --- 6. Clean __pycache__ directories ---------------------------------------
echo "${YELLOW}→ Cleaning __pycache__ directories...${RESET}"
find backend -maxdepth 5 -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true
find frontend -maxdepth 5 -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true
find . -maxdepth 2 -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true

echo
echo "${GREEN}✅ Test artifacts cleaned!${RESET}"
echo
echo "${BOLD}Git status:${RESET}"
git status --short
