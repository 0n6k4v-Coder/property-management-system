#!/usr/bin/env bash
# Run a Playwright E2E spec (or the full suite) the way SELF_CRITIC.md says to,
# so nobody has to re-derive R6/R7/R10/R12/R14/R16 by hand every session:
#   - uses docker-compose.test.yml (fully isolated test stack, no dev dependency)
#   - migration check before the first reset of a session (R7)
#   - reset-e2e-db before every run, not just the first one (R6/R14)
#   - refuse to run if another session's frontend-test-run-* container is up (R10)
#   - stream long runs to a log file instead of piping through `tail` (R12/R16)
#
# Usage:
#   ./scripts/verify-e2e.sh -g "CONT-05"     # filtered run (use this while iterating)
#   ./scripts/verify-e2e.sh                  # full suite (reserve for final confirm)

set -euo pipefail
cd "$(dirname "$0")/.."

COMPOSE="docker compose -f docker-compose.test.yml"
LOG="/tmp/verify-e2e-$$.log"

echo "==> Checking for another session's frontend-test container (R10)"
if docker ps --format '{{.Names}}' | grep -q 'frontend-test-run-'; then
	echo "!! frontend-test-run-* is already up — another session may be mid-run."
	echo "!! Refusing to reset/run. Wait for it to finish, then retry." >&2
	exit 1
fi

echo "==> Starting test stack (backend + db + redis + minio)"
$COMPOSE up -d backend

echo "==> Applying migrations (R7 — reset without this silently no-ops on an empty schema)"
$COMPOSE exec -T backend alembic upgrade head

echo "==> Resetting E2E fixture data (R6/R14 — every run, not just the first)"
$COMPOSE exec -T backend python -m scripts.seed_e2e --reset

echo "==> Running Playwright (streaming full output to $LOG — R12/R16, no tail truncation)"
mkdir -p frontend/playwright-report frontend/e2e-results
set +e
$COMPOSE run --rm frontend-test npx playwright test --reporter=line "$@" \
	> >(tee "$LOG") 2>&1
STATUS=$?
set -e

echo "==> Cleaning up test stack"
$COMPOSE down -v

echo "==> Full output saved at $LOG"
exit $STATUS
