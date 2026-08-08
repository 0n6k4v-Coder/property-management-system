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

# --- 4. Fix directory ownership (Docker-created as root) -------------------
# Docker containers (especially frontend-test which runs as root) create
# directories owned by root on mounted volumes. Fix from inside the container
# to avoid permission denied errors when the host user tries to delete them.
echo "${BLUE}==> Fixing Docker-created root-owned directories...${RESET}"
ROOT_OWNED_DIRS=()
for dir in backend/.hypothesis backend/.pytest_cache backend/htmlcov backend/test-reports \
           frontend/test-results frontend/playwright-report frontend/e2e-results \
           frontend/coverage frontend/blob-report; do
    if [ -d "$dir" ]; then
        # Check if any file inside is owned by root (uid 0)
        if find "$dir" -user root 2>/dev/null | head -1 | grep -q .; then
            ROOT_OWNED_DIRS+=("$dir")
        fi
    fi
done

if [ "${#ROOT_OWNED_DIRS[@]}" -gt 0 ]; then
    echo "${YELLOW}  Found ${#ROOT_OWNED_DIRS[@]} root-owned directory(ies).${RESET}"
    # Try fixing from inside the test container first (handles Docker uid mapping)
    if docker compose -f docker-compose.test.yml ps 2>/dev/null | grep -q "Up"; then
        docker compose -f docker-compose.test.yml exec -T backend-test \
            sh -c "chown -R 1000:1000 /app/.hypothesis /app/.pytest_cache /app/htmlcov 2>/dev/null" 2>/dev/null || true
        docker compose -f docker-compose.test.yml exec -T frontend-test \
            sh -c "chown -R 1000:1000 /app/test-results /app/coverage /app/playwright-report /app/e2e-results 2>/dev/null" 2>/dev/null || true
        echo "${GREEN}  Fixed ownership from inside containers.${RESET}"
    fi
    # Host-side fallback: try chown with current user
    CURRENT_USER="$(id -u):$(id -g)"
    for dir in "${ROOT_OWNED_DIRS[@]}"; do
        chown -R "$CURRENT_USER" "$dir" 2>/dev/null || \
            sudo chown -R "$CURRENT_USER" "$dir" 2>/dev/null || \
            echo "${YELLOW}  Could not chown $dir (may need sudo).${RESET}" >&2
    done
else
    echo "${GREEN}  No root-owned directories found.${RESET}"
fi

# --- 5. Make test artifacts writable -----------------------------------------
echo "${BLUE}==> Making test artifacts writable...${RESET}"
for dir in backend/.hypothesis backend/.pytest_cache backend/htmlcov backend/test-reports \
           frontend/test-results frontend/playwright-report frontend/e2e-results \
           frontend/coverage frontend/blob-report; do
    if [ -d "$dir" ]; then
        chmod -R u+w "$dir" 2>/dev/null || \
            sudo chmod -R u+w "$dir" 2>/dev/null || true
    fi
done

echo
echo "${GREEN}✅ Permissions fixed!${RESET}"
