#!/usr/bin/env bash
# Health-check the running dev stack. No args.
#
# Five checks against the live pms-dev containers:
#   (a) dev containers up   -> all 5 pms-dev-* running/healthy
#   (b) backend /health      -> {"status":"ok"}
#   (c) database SELECT 1   -> 1 row returned via psql
#   (d) auth login           -> access_token in JSON response
#   (e) frontend dev server  -> <!doctype html>
#
# Usage:
#   ./scripts/dev-healthcheck.sh
#
# Exit code is 0 only if all checks PASS.

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
    RED='' GREEN='' YELLOW='' BLUE='' BOLD='' RESET=''
fi

BACKEND_URL="http://localhost:8000"
FRONTEND_URL="http://localhost:5173"

# Dev containers expected to be up (docker compose --project-name pms-dev).
EXPECTED_CONTAINERS=(
    pms-dev-frontend-1
    pms-dev-backend-1
    pms-dev-db-1
    pms-dev-redis-1
    pms-dev-minio-1
)

# Admin credentials — match the seeded admin user used in dev/E2E fixtures.
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@example.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-Admin123!}"

# DB connection (matches docker-compose.dev.yml).
DB_CONTAINER="pms-dev-db-1"
DB_USER="user"
DB_NAME="pms_test"

PASS=0
FAIL=0
WARN=0

# report PASS / FAIL / WARN line for a check
report() {
    local name="$1" status="$2" detail="${3:-}"
    local label color
    case "$status" in
        PASS) color="$GREEN"; label="PASS" ;;
        FAIL) color="$RED";   label="FAIL" ;;
        WARN) color="$YELLOW"; label="WARN" ;;
        *)    color="$RED";   label="FAIL" ;;
    esac
    printf "  ${color}%-4s${RESET}  %s" "$label" "$name"
    [ -n "$detail" ] && printf "  ${color}%s${RESET}" "$detail"
    printf "\n"
    case "$status" in
        PASS) PASS=$((PASS + 1)) ;;
        WARN) WARN=$((WARN + 1)) ;;
        *)    FAIL=$((FAIL + 1)) ;;
    esac
}

echo "${BLUE}${BOLD}==> Dev stack health check${RESET}"
echo "    backend:  $BACKEND_URL"
echo "    frontend: $FRONTEND_URL"
echo

# ---------------------------------------------------------------------------
# (a) Dev containers running
# ---------------------------------------------------------------------------
echo "${BOLD}[1/5] Dev containers (pms-dev-*)${RESET}"
# Map of name -> status line as reported by `docker ps`.
declare -A RUNNING=()
while IFS=' ' read -r name status; do
    [ -n "$name" ] && RUNNING["$name"]="$status"
done < <(docker ps --filter "name=pms-dev-" --format '{{.Names}} {{.Status}}')

ALL_UP=1
for c in "${EXPECTED_CONTAINERS[@]}"; do
    if [ -z "${RUNNING[$c]:-}" ]; then
        report "container $c" FAIL "(missing)"
        ALL_UP=0
    else
        # "Up X minutes (healthy)" or "Up X minutes". Anything starting with
        # "Up" is acceptable; "Restarting"/"Exited" is not.
        status="${RUNNING[$c]}"
        if [[ "$status" == Up* ]]; then
            report "container $c" PASS "($status)"
        else
            report "container $c" FAIL "($status)"
            ALL_UP=0
        fi
    fi
done
if [ "$ALL_UP" -ne 1 ]; then
    report "all dev containers up" FAIL
else
    report "all dev containers up" PASS
fi
echo

# ---------------------------------------------------------------------------
# (b) Backend /health
# ---------------------------------------------------------------------------
echo "${BOLD}[2/5] Backend /health${RESET}"
RESP=$(curl -sf --max-time 5 "$BACKEND_URL/health" 2>/dev/null || true)
if [ -n "$RESP" ] && echo "$RESP" | grep -q '"status":"ok"'; then
    report "backend /health" PASS
else
    report "backend /health" FAIL "(got: ${RESP:-<empty>})"
fi
echo

# ---------------------------------------------------------------------------
# (c) Database SELECT 1
# ---------------------------------------------------------------------------
echo "${BOLD}[3/5] Database (psql SELECT 1)${RESET}"
# `docker exec` returns 0 and prints "(1 row)" on success.
PSQL_OUT=$(docker exec "$DB_CONTAINER" \
    psql -U "$DB_USER" -d "$DB_NAME" -t -c 'SELECT 1' 2>/dev/null || true)
if [ -n "$PSQL_OUT" ] && echo "$PSQL_OUT" | grep -q '1'; then
    report "database SELECT 1" PASS
else
    report "database SELECT 1" FAIL "(got: ${PSQL_OUT:-<empty>})"
fi
echo

# ---------------------------------------------------------------------------
# (d) Auth login
# ---------------------------------------------------------------------------
echo "${BOLD}[4/5] Auth login${RESET}"
RESP=$(curl -sf --max-time 5 -X POST "$BACKEND_URL/api/v1/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" 2>/dev/null || true)
if [ -n "$RESP" ] && echo "$RESP" | grep -q '"access_token"'; then
    report "auth login" PASS
else
    report "auth login" FAIL "(got: ${RESP:+$(echo "$RESP" | head -c 80)...}${RESP:-<empty>})"
fi
echo

# ---------------------------------------------------------------------------
# (e) Frontend dev server
# ---------------------------------------------------------------------------
echo "${BOLD}[5/5] Frontend dev server${RESET}"
RESP=$(curl -sf --max-time 5 "$FRONTEND_URL/" 2>/dev/null || true)
if [ -n "$RESP" ] && echo "$RESP" | head -c 200 | grep -qi '<!doctype html>'; then
    report "frontend index" PASS
else
    report "frontend index" FAIL "(got: ${RESP:+$(echo "$RESP" | head -c 80)...}${RESP:-<empty>})"
fi
echo

# ---------------------------------------------------------------------------
# summary table
# ---------------------------------------------------------------------------
TOTAL=$((PASS + FAIL + WARN))
echo "${BOLD}==> Summary${RESET}"
printf "  %-20s %s\n" "Passed:" "${GREEN}$PASS / $TOTAL${RESET}"
printf "  %-20s %s\n" "Failed:" "${RED}$FAIL${RESET}"
[ "$WARN" -gt 0 ] && printf "  %-20s %s\n" "Warnings:" "${YELLOW}$WARN${RESET}"

if [ "$FAIL" -eq 0 ] && [ "$WARN" -eq 0 ]; then
    printf "  ${BOLD}Overall:${RESET} ${GREEN}%s${RESET}\n" "ALL GREEN"
elif [ "$FAIL" -eq 0 ]; then
    printf "  ${BOLD}Overall:${RESET} ${YELLOW}%s${RESET}\n" "OK WITH WARNINGS"
else
    printf "  ${BOLD}Overall:${RESET} ${RED}%s${RESET}\n" "$FAIL CHECK(S) FAILED"
fi

exit $((FAIL > 0 ? 1 : 0))
