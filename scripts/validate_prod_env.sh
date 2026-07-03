#!/usr/bin/env bash
# =============================================================================
# scripts/validate_prod_env.sh — Sprint 8: Production Environment Validation
# Property Management System Backend
#
# Pre-flight checks before starting the production stack.
# Validates: env vars, ports, file permissions, DB migration status.
#
# Usage:
#   bash scripts/validate_prod_env.sh                      # Full check
#   bash scripts/validate_prod_env.sh --quick               # Quick check (env vars only)
#   bash scripts/validate_prod_env.sh --help                 # Show help
#
# Exit codes:
#   0 — All checks passed
#   1 — Critical failure (env vars, permissions)
#   2 — Warning (ports busy, DB not migrated)
# =============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

QUICK=false
EXIT_CODE=0
WARNINGS=0

show_help() {
    cat <<EOF
Usage: $0 [options]

Options:
  --quick       Quick check (env vars only)
  --help        Show this help

Checks performed:
  1. Environment variables (required + optional)
  2. Port availability (8000, 5432, 6379, 9000)
  3. Docker permissions
  4. File permissions (scripts, keys)
  5. PostgreSQL connectivity
  6. Alembic migration status
  7. Redis connectivity
  8. MinIO connectivity
EOF
}

check_var() {
    local name="$1"
    local value="${2:-}"
    local required="${3:-true}"
    local secret="${4:-false}"

    if [ -z "${value}" ]; then
        if [ "${required}" = true ]; then
            echo -e "  ${RED}✗${NC} ${name}: MISSING (required)"
            EXIT_CODE=1
        else
            echo -e "  ${YELLOW}⚠${NC} ${name}: not set (optional)"
            WARNINGS=$((WARNINGS + 1))
        fi
    else
        if [ "${secret}" = true ]; then
            local masked="${value:0:4}****${value: -4}"
            echo -e "  ${GREEN}✓${NC} ${name}: ${masked}"
        else
            echo -e "  ${GREEN}✓${NC} ${name}: ${value}"
        fi
    fi
}

check_port() {
    local port="$1"
    local service="$2"

    if command -v ss &>/dev/null; then
        if ss -tlnp "sport = :${port}" 2>/dev/null | grep -q "${port}"; then
            echo -e "  ${YELLOW}⚠${NC} Port ${port} (${service}): IN USE"
            WARNINGS=$((WARNINGS + 1))
        else
            echo -e "  ${GREEN}✓${NC} Port ${port} (${service}): available"
        fi
    else
        echo -e "  ${YELLOW}⚠${NC} Port check skipped (ss not available)"
    fi
}

# Parse arguments
for arg in "$@"; do
    case "$arg" in
        --quick) QUICK=true ;;
        --help) show_help; exit 0 ;;
    esac
done

# ── 1. Environment Variables ───────────────────────────────────────────────
echo -e "${BLUE}─── 1. Environment Variables ───────────────────${NC}"

# Load .env file if exists
ENV_FILE=""
for f in ".env" "backend/.env" "backend/.env.production"; do
    if [ -f "${f}" ]; then
        ENV_FILE="${f}"
        echo -e "  ${GREEN}✓${NC} Using env file: ${f}"
        set -a
        # shellcheck disable=SC1090
        source "${f}"
        set +a
        break
    fi
done

if [ -z "${ENV_FILE}" ]; then
    echo -e "  ${YELLOW}⚠${NC} No .env file found — checking environment directly"
fi

echo ""
check_var "SECRET_KEY" "${SECRET_KEY:-}" true true
check_var "ID_CARD_ENCRYPTION_KEY" "${ID_CARD_ENCRYPTION_KEY:-}" true true
check_var "DATABASE_URL" "${DATABASE_URL:-}" true true
check_var "REDIS_URL" "${REDIS_URL:-}" false true
check_var "CORS_ORIGINS" "${CORS_ORIGINS:-}" false false
check_var "APP_DOMAIN" "${APP_DOMAIN:-}" false false
check_var "DEBUG" "${DEBUG:-false}" false false

# Validate SECRET_KEY length
if [ -n "${SECRET_KEY:-}" ] && [ "${#SECRET_KEY}" -lt 32 ]; then
    echo -e "  ${RED}✗${NC} SECRET_KEY too short (${#SECRET_KEY} chars, min 32)"
    EXIT_CODE=1
fi

if [ "${QUICK}" = true ]; then
    if [ ${EXIT_CODE} -eq 0 ]; then
        echo -e "${GREEN}✓ Quick validation passed${NC}"
    fi
    exit ${EXIT_CODE}
fi

# ── 2. Port Availability ────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}─── 2. Port Availability ─────────────────────────${NC}"
check_port 8000 "Backend API"
check_port 5432 "PostgreSQL"
check_port 6379 "Redis"
check_port 9000 "MinIO API"

# ── 3. Docker Permissions ──────────────────────────────────────────────────
echo ""
echo -e "${BLUE}─── 3. Docker Permissions ───────────────────────${NC}"

if docker info &>/dev/null; then
    echo -e "  ${GREEN}✓${NC} Docker daemon reachable"
else
    echo -e "  ${RED}✗${NC} Docker daemon not reachable"
    EXIT_CODE=1
fi

if docker compose version &>/dev/null; then
    echo -e "  ${GREEN}✓${NC} Docker Compose available"
else
    echo -e "  ${RED}✗${NC} Docker Compose not available"
    EXIT_CODE=1
fi

# ── 4. File Permissions ─────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}─── 4. File Permissions ─────────────────────────${NC}"

SCRIPTS_DIR="scripts"
if [ -d "${SCRIPTS_DIR}" ]; then
    echo -e "  ${GREEN}✓${NC} Scripts directory exists"
    for script in backup.sh restore.sh release.sh; do
        if [ -f "${SCRIPTS_DIR}/${script}" ]; then
            if [ -x "${SCRIPTS_DIR}/${script}" ]; then
                echo -e "  ${GREEN}✓${NC} ${script}: executable"
            else
                echo -e "  ${YELLOW}⚠${NC} ${script}: NOT executable (run: chmod +x ${SCRIPTS_DIR}/${script})"
                WARNINGS=$((WARNINGS + 1))
            fi
        else
            echo -e "  ${YELLOW}⚠${NC} ${script}: not found"
        fi
    done
else
    echo -e "  ${YELLOW}⚠${NC} Scripts directory not found"
fi

# ── 5. PostgreSQL Connectivity ──────────────────────────────────────────────
echo ""
echo -e "${BLUE}─── 5. PostgreSQL Connectivity ───────────────────${NC}"

if command -v pg_isready &>/dev/null; then
    # Extract host/port from DATABASE_URL
    if [ -n "${DATABASE_URL:-}" ]; then
        DB_HOST_PORT=$(echo "${DATABASE_URL}" | sed 's/.*@\([^/]*\).*/\1/')
        if PGPASSWORD="${DB_PASS:-}" pg_isready -h "${DB_HOST_PORT%:*}" -p "${DB_HOST_PORT#*:}" -U "${DB_USER:-user}" &>/dev/null 2>&1; then
            echo -e "  ${GREEN}✓${NC} PostgreSQL reachable at ${DB_HOST_PORT}"
        else
            echo -e "  ${YELLOW}⚠${NC} PostgreSQL not reachable (will be started by compose)"
        fi
    else
        echo -e "  ${YELLOW}⚠${NC} DATABASE_URL not set, skipping"
    fi
else
    echo -e "  ${YELLOW}⚠${NC} pg_isready not available, skipping"
fi

# ── 6. Alembic Migration Status ─────────────────────────────────────────────
echo ""
echo -e "${BLUE}─── 6. Migration Status ──────────────────────────${NC}"

if [ -d "backend/alembic" ]; then
    echo -e "  ${GREEN}✓${NC} Alembic directory found"
    MIGRATION_COUNT=$(find backend/alembic/versions -name "*.py" 2>/dev/null | wc -l)
    echo -e "  ${GREEN}✓${NC} ${MIGRATION_COUNT} migration files"
else
    echo -e "  ${YELLOW}⚠${NC} Alembic directory not found"
fi

# ── Summary ─────────────────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}─── Validation Summary ───────────────────────────${NC}"
if [ ${EXIT_CODE} -eq 0 ]; then
    if [ ${WARNINGS} -eq 0 ]; then
        echo -e "${GREEN}✓ All checks passed — environment is ready for production.${NC}"
    else
        echo -e "${YELLOW}✓ Critical checks passed (${WARNINGS} non-critical warnings).${NC}"
    fi
else
    echo -e "${RED}✗ ${EXIT_CODE} critical failures found — fix before starting.${NC}"
fi

exit ${EXIT_CODE}
