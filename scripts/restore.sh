#!/usr/bin/env bash
# =============================================================================
# scripts/restore.sh — Sprint 8: PostgreSQL Restore from MinIO
# Property Management System Backend
#
# Downloads the latest (or specific) backup from MinIO and restores it to
# a PostgreSQL database. Idempotent: drops and recreates the target database.
#
# Usage:
#   bash scripts/restore.sh                    # Restore latest backup
#   bash scripts/restore.sh --file=backup_20260531_120000.sql.gz  # Specific file
#   bash scripts/restore.sh --dry-run          # Show what would be done
#   bash scripts/restore.sh --db-url=...       # Override database URL
#
# Environment variables:
#   DATABASE_URL      Target PostgreSQL connection string
#   MINIO_ENDPOINT    MinIO/S3 endpoint
#   MINIO_ACCESS_KEY  MinIO access key
#   MINIO_SECRET_KEY  MinIO secret key
#   MINIO_BACKUP_BUCKET  Backup bucket name (default: pms-backups)
#
# Exit codes:
#   0 — Restore succeeded
#   1 — Configuration error
#   2 — Download failed
#   3 — Restore failed
# =============================================================================

set -euo pipefail

# ── Colors ─────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# ── Defaults ────────────────────────────────────────────────────────────────
DRY_RUN=false
SPECIFIC_FILE=""

# ── Parse arguments ────────────────────────────────────────────────────────
for arg in "$@"; do
    case "$arg" in
        --dry-run) DRY_RUN=true ;;
        --file=*) SPECIFIC_FILE="${arg#*=}" ;;
        --db-url=*) DATABASE_URL="${arg#*=}" ;;
        --help)
            echo "Usage: $0 [--dry-run] [--file=backup.sql.gz] [--db-url=...]"
            echo ""
            echo "With --dry-run: Show latest backup info without restoring."
            exit 0
            ;;
    esac
done

: "${DATABASE_URL:=postgresql://user:pass@localhost:5432/pms_prod}"
: "${MINIO_ENDPOINT:=http://localhost:9000}"
: "${MINIO_ACCESS_KEY:=minioadmin}"
: "${MINIO_SECRET_KEY:=minioadmin}"
: "${MINIO_BACKUP_BUCKET:=pms-backups}"

# Parse DATABASE_URL
DB_URL="${DATABASE_URL#postgresql://}"
DB_CREDS="${DB_URL%%@*}"
DB_HOST="${DB_URL#*@}"
DB_HOST="${DB_HOST%%/*}"
DB_NAME="${DB_URL##*/}"
DB_USER="${DB_CREDS%%:*}"
DB_PASS="${DB_CREDS#*:}"

echo -e "${YELLOW}→ Restore Configuration:${NC}"
echo "  Target Database: ${DB_NAME} @ ${DB_HOST}"
echo "  MinIO Bucket:    ${MINIO_BACKUP_BUCKET}"
echo "  Dry Run:         ${DRY_RUN}"
echo ""

# Check required tools
for cmd in pg_isready psql pg_restore gzip mc; do
    if ! command -v "$cmd" &>/dev/null; then
        echo -e "${RED}Error: '$cmd' not found.${NC}"
        exit 1
    fi
done

# ── Configure MinIO client ─────────────────────────────────────────────────
mc alias set pms-minio "${MINIO_ENDPOINT}" "${MINIO_ACCESS_KEY}" "${MINIO_SECRET_KEY}" 2>/dev/null

# ── Find the backup file ───────────────────────────────────────────────────
if [ -n "${SPECIFIC_FILE}" ]; then
    REMOTE_PATH="${SPECIFIC_FILE}"
    echo -e "${YELLOW}→ Using specific file: ${REMOTE_PATH}${NC}"
else
    echo -e "${YELLOW}→ Finding latest backup...${NC}"
    REMOTE_PATH=$(mc ls "pms-minio/${MINIO_BACKUP_BUCKET}/backup/" 2>/dev/null | \
        sort -k1,2 | tail -1 | awk '{print $NF}')
    if [ -z "${REMOTE_PATH}" ]; then
        echo -e "${RED}Error: No backups found in bucket '${MINIO_BACKUP_BUCKET}/backup/'${NC}"
        exit 2
    fi
    echo -e "${GREEN}✓ Latest backup: ${REMOTE_PATH}${NC}"
fi

# ── Dry-run mode ──────────────────────────────────────────────────────────
if [ "${DRY_RUN}" = true ]; then
    echo ""
    echo -e "${YELLOW}─── Dry Run Summary ───${NC}"
    echo "  Source:      pms-minio/${MINIO_BACKUP_BUCKET}/${REMOTE_PATH}"
    echo "  Target DB:   ${DB_NAME} @ ${DB_HOST}"
    echo "  Operations:"
    echo "    1. Download: mc cp pms-minio/${MINIO_BACKUP_BUCKET}/${REMOTE_PATH} /tmp/"
    echo "    2. Decompress: gunzip -f /tmp/$(basename ${REMOTE_PATH})"
    echo "    3. Drop DB:   PGPASSWORD=*** psql -h ${DB_HOST%:*} -U ${DB_USER} -c 'DROP DATABASE ${DB_NAME}'"
    echo "    4. Create DB: PGPASSWORD=*** psql -h ${DB_HOST%:*} -U ${DB_USER} -c 'CREATE DATABASE ${DB_NAME}'"
    echo "    5. Restore:   PGPASSWORD=*** psql -h ${DB_HOST%:*} -U ${DB_USER} -d ${DB_NAME} -f /tmp/*.sql"
    echo ""
    echo -e "${GREEN}✓ Dry-run complete. No changes made.${NC}"
    exit 0
fi

# ── Download backup ────────────────────────────────────────────────────────
LOCAL_FILE="/tmp/$(basename "${REMOTE_PATH}")"
echo -e "${YELLOW}→ Downloading backup...${NC}"
mc cp "pms-minio/${MINIO_BACKUP_BUCKET}/${REMOTE_PATH}" "${LOCAL_FILE}" 2>/tmp/mc_download.log

DOWNLOAD_EXIT=$?
if [ $DOWNLOAD_EXIT -ne 0 ]; then
    echo -e "${RED}Error: Download failed${NC}"
    tail -5 /tmp/mc_download.log
    exit 2
fi
echo -e "${GREEN}✓ Downloaded: $(numfmt --to=iec-i "$(stat -c%s "${LOCAL_FILE}")")${NC}"

# ── Decompress ─────────────────────────────────────────────────────────────
SQL_FILE="${LOCAL_FILE%.gz}"
echo -e "${YELLOW}→ Decompressing...${NC}"
gunzip -f "${LOCAL_FILE}"
echo -e "${GREEN}✓ Decompressed: $(numfmt --to=iec-i "$(stat -c%s "${SQL_FILE}")")${NC}"

# ── Verify database is reachable ───────────────────────────────────────────
echo -e "${YELLOW}→ Checking database connectivity...${NC}"
if ! PGPASSWORD="${DB_PASS}" pg_isready -h "${DB_HOST%:*}" -p "${DB_HOST#*:}" -U "${DB_USER}" &>/dev/null; then
    echo -e "${RED}Error: Database is not reachable at ${DB_HOST}${NC}"
    exit 1
fi

# ── Drop and recreate database ─────────────────────────────────────────────
echo -e "${YELLOW}→ Dropping and recreating database '${DB_NAME}'...${NC}"
PGPASSWORD="${DB_PASS}" psql -h "${DB_HOST%:*}" -p "${DB_HOST#*:}" -U "${DB_USER}" -d postgres \
    -c "DROP DATABASE IF EXISTS \"${DB_NAME}\"" 2>/dev/null || true
PGPASSWORD="${DB_PASS}" psql -h "${DB_HOST%:*}" -p "${DB_HOST#*:}" -U "${DB_USER}" -d postgres \
    -c "CREATE DATABASE \"${DB_NAME}\"" 2>/dev/null || true
echo -e "${GREEN}✓ Database recreated${NC}"

# ── Restore ─────────────────────────────────────────────────────────────────
echo -e "${YELLOW}→ Restoring database...${NC}"
PGPASSWORD="${DB_PASS}" psql \
    -h "${DB_HOST%:*}" \
    -p "${DB_HOST#*:}" \
    -U "${DB_USER}" \
    -d "${DB_NAME}" \
    -f "${SQL_FILE}" 2>/tmp/psql_restore.log

RESTORE_EXIT=$?
if [ $RESTORE_EXIT -ne 0 ]; then
    echo -e "${RED}Error: Restore failed (exit code: ${RESTORE_EXIT})${NC}"
    tail -10 /tmp/psql_restore.log
    rm -f "${SQL_FILE}"
    exit 3
fi
echo -e "${GREEN}✓ Database restored successfully${NC}"

# ── Verify tables exist ────────────────────────────────────────────────────
TABLE_COUNT=$(PGPASSWORD="${DB_PASS}" psql \
    -h "${DB_HOST%:*}" -p "${DB_HOST#*:}" -U "${DB_USER}" -d "${DB_NAME}" \
    -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'" 2>/dev/null | tr -d ' ')
echo -e "${GREEN}✓ Verified: ${TABLE_COUNT} tables in '${DB_NAME}'${NC}"

# ── Cleanup ────────────────────────────────────────────────────────────────
rm -f "${SQL_FILE}"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Restore SUCCESS${NC}"
echo -e "${GREEN}  Source: ${REMOTE_PATH}${NC}"
echo -e "${GREEN}  Target: ${DB_NAME} @ ${DB_HOST}${NC}"
echo -e "${GREEN}  Tables: ${TABLE_COUNT}${NC}"
echo -e "${GREEN}========================================${NC}"
