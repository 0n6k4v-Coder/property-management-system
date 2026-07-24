#!/usr/bin/env bash
# Fix file permissions: find all files with mode 600 (-rw-------) and change
# them to 644 (-rw-r--r--). Sub-agents (write_file etc.) tend to create files
# with 600, which then can't be read inside Docker containers running as a
# different uid. Run this whenever a sub-agent has touched source files.
#
# Usage:
#   ./scripts/fix-permissions.sh                  # default: frontend/src/ backend/app/
#   ./scripts/fix-permissions.sh path/to/dir ...   # scan specific paths

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

# --- targets ----------------------------------------------------------------
if [ "$#" -gt 0 ]; then
    TARGETS=("$@")
else
    TARGETS=("frontend/src/" "backend/app/")
fi

# validate targets exist before scanning
MISSING=()
for t in "${TARGETS[@]}"; do
    if [ ! -e "$t" ]; then
        MISSING+=("$t")
    fi
done
if [ "${#MISSING[@]}" -gt 0 ]; then
    echo "${RED}!! target path(s) not found:${RESET}" >&2
    for m in "${MISSING[@]}"; do
        echo "     - $m" >&2
    done
    exit 1
fi

echo "${BLUE}==> Scanning for mode-600 files (-rw-------)${RESET}"
for t in "${TARGETS[@]}"; do
    echo "     - $t"
done
echo

# --- count before -----------------------------------------------------------
BEFORE=0
for t in "${TARGETS[@]}"; do
    # count without failing under set -e when find returns nothing
    n=$(find "$t" -type f -perm 600 2>/dev/null | wc -l || true)
    BEFORE=$((BEFORE + n))
done

echo "${BOLD}Before:${RESET} ${YELLOW}${BEFORE}${RESET} file(s) with mode 600"

if [ "$BEFORE" -eq 0 ]; then
    echo "${GREEN}==> Nothing to fix. All good.${RESET}"
    exit 0
fi

# --- fix --------------------------------------------------------------------
echo "${BLUE}==> Fixing: chmod 644 (-rw-r--r--)${RESET}"
for t in "${TARGETS[@]}"; do
    find "$t" -type f -perm 600 -exec chmod 644 {} + 2>/dev/null || true
done

# --- count after ------------------------------------------------------------
AFTER=0
for t in "${TARGETS[@]}"; do
    n=$(find "$t" -type f -perm 600 2>/dev/null | wc -l || true)
    AFTER=$((AFTER + n))
done

FIXED=$((BEFORE - AFTER))
echo
echo "${BOLD}After:${RESET}  ${YELLOW}${AFTER}${RESET} file(s) still mode 600"
echo "${GREEN}==> Fixed ${FIXED} of ${BEFORE} file(s).${RESET}"

if [ "$AFTER" -gt 0 ]; then
    echo "${YELLOW}!! ${AFTER} file(s) could not be changed (check ownership/permissions).${RESET}" >&2
    exit 1
fi
