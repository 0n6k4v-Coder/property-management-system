#!/usr/bin/env bash
# Smoke test the running dev stack. No args.
#
# Three checks against the live containers:
#   (a) backend health endpoint  -> {"status":"ok"}
#   (b) frontend dev server      -> <!doctype html>
#   (c) auth login               -> access_token in JSON response
#
# Usage:
#   ./scripts/smoke-test.sh
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
    RED= GREEN= YELLOW= BLUE= BOLD= RESET=
fi

BACKEND_URL="http://localhost:8000"
FRONTEND_URL="http://localhost:5173"

# Admin credentials — match the seeded admin user used in dev/E2E fixtures.
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@example.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-Admin123!}"

PASS=0
FAIL=0

# report PASS / FAIL line for a check
report() {
    local name="$1" status="$2" detail="${3:-}"
    if [ "$status" = "PASS" ]; then
        printf "  ${GREEN}%s${RESET}  %s" "PASS" "$name"
        [ -n "$detail" ] && printf "  ${GREEN}%s${RESET}" "$detail"
        printf "\n"
        PASS=$((PASS + 1))
    else
        printf "  ${RED}%s${RESET}  %s" "FAIL" "$name"
        [ -n "$detail" ] && printf "  ${RED}%s${RESET}" "$detail"
        printf "\n"
        FAIL=$((FAIL + 1))
    fi
}

echo "${BLUE}${BOLD}==> Smoke test${RESET}"
echo "    backend:  $BACKEND_URL"
echo "    frontend: $FRONTEND_URL"
echo

# ---------------------------------------------------------------------------
# (a) Backend health
# ---------------------------------------------------------------------------
echo "${BOLD}[1/3] Backend /health${RESET}"
RESP=$(curl -sf --max-time 5 "$BACKEND_URL/health" 2>/dev/null || true)
if [ -n "$RESP" ] && echo "$RESP" | grep -q '"status":"ok"'; then
    report "backend /health" PASS
else
    report "backend /health" FAIL "(got: ${RESP:-<empty>})"
fi

# ---------------------------------------------------------------------------
# (b) Frontend dev server
# ---------------------------------------------------------------------------
echo "${BOLD}[2/3] Frontend dev server${RESET}"
RESP=$(curl -sf --max-time 5 "$FRONTEND_URL/" 2>/dev/null || true)
if [ -n "$RESP" ] && echo "$RESP" | head -c 200 | grep -qi '<!doctype html>'; then
    report "frontend index" PASS
else
    report "frontend index" FAIL "(got: ${RESP:+$(echo "$RESP" | head -c 80)...}${RESP:-<empty>})"
fi

# ---------------------------------------------------------------------------
# (c) Auth login
# ---------------------------------------------------------------------------
echo "${BOLD}[3/3] Auth login${RESET}"
RESP=$(curl -sf --max-time 5 -X POST "$BACKEND_URL/api/v1/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" 2>/dev/null || true)
if [ -n "$RESP" ] && echo "$RESP" | grep -q '"access_token"'; then
    report "auth login" PASS
else
    report "auth login" FAIL "(got: ${RESP:+$(echo "$RESP" | head -c 80)...}${RESP:-<empty>})"
fi

# ---------------------------------------------------------------------------
# summary
# ---------------------------------------------------------------------------
echo
TOTAL=$((PASS + FAIL))
printf "${BOLD}==> Summary:${RESET} %d/%d passed" "$PASS" "$TOTAL"
if [ "$FAIL" -eq 0 ]; then
    printf "  ${GREEN}%s${RESET}\n" "ALL GREEN"
else
    printf "  ${RED}%d failed${RESET}\n" "$FAIL"
fi

exit $((FAIL > 0 ? 1 : 0))
