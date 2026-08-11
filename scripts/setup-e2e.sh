#!/usr/bin/env bash
# setup-e2e.sh — Automated E2E environment setup
#
# Starts the test stack, waits for backend health, resets the database,
# applies migrations, and seeds E2E fixture data. Must be run before
# Playwright E2E tests.
#
# Usage:
#   ./scripts/setup-e2e.sh
#
# Prerequisites:
#   - Docker daemon running
#   - docker-compose.test.yml present
#   - Alembic migrations available in backend/
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

echo "${BLUE}🚀 Setting up E2E environment...${RESET}"

# --- 1. Start test stack ----------------------------------------------------
echo "${YELLOW}→ [1/5] Starting test stack...${RESET}"

# Start only the services we need (backend, db, redis, minio)
# frontend-test is ephemeral (run --rm), so no need to pre-start it
docker compose -f "${TEST_COMPOSE}" up -d backend db redis minio 2>&1

# --- 2. Wait for backend healthy (max 90s) ----------------------------------
echo "${YELLOW}→ [2/5] Waiting for backend to become healthy...${RESET}"

BACKEND_HEALTHY=false
for i in $(seq 1 90); do
    if docker compose -f "${TEST_COMPOSE}" ps --services --filter "status=running" | grep -q "^backend$"; then
        if docker compose -f "${TEST_COMPOSE}" exec -T backend \
            curl -sf http://localhost:8000/health >/dev/null 2>&1; then
            BACKEND_HEALTHY=true
            echo "${GREEN}  Backend is healthy (after ${i}s)${RESET}"
            break
        fi
    fi
    if [ "$i" -eq 90 ]; then
        echo "${RED}  ❌ Backend failed to become healthy within 90s${RESET}"
        echo "${RED}  Check logs: docker compose -f ${TEST_COMPOSE} logs backend${RESET}"
        exit 1
    fi
    sleep 1
done

if [ "$BACKEND_HEALTHY" != "true" ]; then
    echo "${RED}❌ Backend is not healthy. Aborting.${RESET}"
    exit 1
fi

# --- 3. Force clean DB state (handles tmpfs issues) -------------------------
echo "${YELLOW}→ [3/5] Resetting database...${RESET}"
# The test DB uses tmpfs which is wiped on container restart, but if the
# container is still running, we need to drop+recreate the database manually
# to eliminate stale connections and dirty state between runs.
docker compose -f "${TEST_COMPOSE}" exec -T db \
  psql -U postgres -c "
    SELECT pg_terminate_backend(pid) FROM pg_stat_activity
    WHERE datname = 'pms_test' AND pid <> pg_backend_pid();
    DROP DATABASE IF EXISTS pms_test;
    CREATE DATABASE pms_test;
  " 2>/dev/null || echo "DB reset skipped (may not exist yet)"

# --- 4. Apply migrations ----------------------------------------------------
echo "${YELLOW}→ [4/5] Applying migrations...${RESET}"
docker compose -f "${TEST_COMPOSE}" exec -T backend alembic upgrade head 2>&1

# Count migrations applied
MIGRATION_COUNT=$(docker compose -f "${TEST_COMPOSE}" exec -T backend \
    alembic current 2>/dev/null | head -1 | grep -o '[0-9]*' || echo "unknown")
echo "${GREEN}  Migrations applied (current: ${MIGRATION_COUNT})${RESET}"

# --- 5. Seed E2E data -------------------------------------------------------
echo "${YELLOW}→ [5/5] Seeding E2E fixture data...${RESET}"
docker compose -f "${TEST_COMPOSE}" exec -T backend \
    python -m scripts.seed_e2e --reset 2>&1

echo
echo "${GREEN}✅ E2E environment ready!${RESET}"
echo "${BOLD}Next steps:${RESET}"
echo "  Run E2E tests: make test-e2e"
echo "  Or manually:   docker compose -f ${TEST_COMPOSE} run --rm frontend-test npx playwright test"
