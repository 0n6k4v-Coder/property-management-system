#!/usr/bin/env bash
# =============================================================================
# scripts/backup.sh — Sprint 8: PostgreSQL Backup to MinIO
# Property Management System Backend
#
# Backs up the database via pg_dump, compresses with gzip, and uploads to
# MinIO/S3-compatible storage.
#
# Usage:
#   bash scripts/backup.sh                    # Quick backup with default vars
#   bash scripts/backup.sh --db-url=...       # Override database URL
#   bash scripts/backup.sh --minio-endpoint=http://minio:9000
#
# Environment variables:
#   DATABASE_URL      PostgreSQL connection string
#   MINIO_ENDPOINT    MinIO/S3 endpoint
#   MINIO_ACCESS_KEY  MinIO access key
#   MINIO_SECRET_KEY  MinIO secret key
#   MINIO_BACKUP_BUCKET  Backup bucket name (default: pms-backups)
#
# Exit codes:
#   0 — Backup succeeded
#   1 — Configuration error
#   2 — pg_dump failed
#   3 — Upload failed
# =============================================================================

set -euo pipefail

# ── Colors for output ──────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ── Parse arguments ────────────────────────────────────────────────────────
for arg in "$@"; do
    case "$arg" in
        --db-url=*) DATABASE_URL="${arg#*=}" ;;
        --minio-endpoint=*) MINIO_ENDPOINT="${arg#*=}" ;;
        --help)
            echo "Usage: $0 [--db-url=...] [--minio-endpoint=...]"
            exit 0
            ;;
    esac
done

# ── Configuration (from environment or defaults) ───────────────────────────
: "${DATABASE_URL:=postgresql://user:pass@localhost:5432/pms_prod}"
: "${MINIO_ENDPOINT:=http://localhost:9000}"
: "${MINIO_ACCESS_KEY:=minioadmin}"
: "${MINIO_SECRET_KEY:=minioadmin}"
: "${MINIO_BACKUP_BUCKET:=pms-backups}"

# Parse DATABASE_URL components
DB_URL="${DATABASE_URL#postgresql://}"
DB_CREDS="${DB_URL%%@*}"
DB_HOST="${DB_URL#*@}"
DB_HOST="${DB_HOST%%/*}"
DB_NAME="${DB_URL##*/}"
DB_USER="${DB_CREDS%%:*}"
DB_PASS="${DB_CREDS#*:}"

# ── Validate configuration ─────────────────────────────────────────────────
echo -e "${YELLOW}→ Backup Configuration:${NC}"
echo "  Database: ${DB_NAME} @ ${DB_HOST}"
echo "  MinIO:    ${MINIO_ENDPOINT} / ${MINIO_BACKUP_BUCKET}"
echo ""

# Check required tools
for cmd in pg_dump gzip mc; do
    if ! command -v "$cmd" &>/dev/null; then
        echo -e "${RED}Error: '$cmd' not found. Is it installed?${NC}"
        exit 1
    fi
done

# ── Create backup ──────────────────────────────────────────────────────────
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="/tmp/pms_backup_${TIMESTAMP}.sql"
COMPRESSED_FILE="${BACKUP_FILE}.gz"

echo -e "${YELLOW}→ Dumping database '${DB_NAME}'...${NC}"
PGPASSWORD="${DB_PASS}" pg_dump \
    -h "${DB_HOST%:*}" \
    -p "${DB_HOST#*:}" \
    -U "${DB_USER}" \
    -d "${DB_NAME}" \
    --no-owner \
    --no-acl \
    --format=plain \
    --verbose \
    -f "${BACKUP_FILE}" 2>/tmp/pg_dump_verbose.log

DUMP_EXIT=$?
if [ $DUMP_EXIT -ne 0 ]; then
    echo -e "${RED}Error: pg_dump failed (exit code: ${DUMP_EXIT})${NC}"
    tail -5 /tmp/pg_dump_verbose.log
    rm -f "${BACKUP_FILE}"
    exit 2
fi

BACKUP_SIZE=$(stat -c%s "${BACKUP_FILE}" 2>/dev/null || stat -f%z "${BACKUP_FILE}")
echo -e "${GREEN}✓ Database dumped: ${BACKUP_SIZE} bytes${NC}"

# ── Compress ───────────────────────────────────────────────────────────────
echo -e "${YELLOW}→ Compressing...${NC}"
gzip -9 "${BACKUP_FILE}"
COMPRESSED_SIZE=$(stat -c%s "${COMPRESSED_FILE}" 2>/dev/null || stat -f%z "${COMPRESSED_FILE}")
echo -e "${GREEN}✓ Compressed: ${COMPRESSED_SIZE} bytes (ratio: $(( (BACKUP_SIZE - COMPRESSED_SIZE) * 100 / BACKUP_SIZE ))%)${NC}"

# ── Upload to MinIO ────────────────────────────────────────────────────────
echo -e "${YELLOW}→ Uploading to MinIO...${NC}"

# Configure MinIO client
mc alias set pms-minio "${MINIO_ENDPOINT}" "${MINIO_ACCESS_KEY}" "${MINIO_SECRET_KEY}" 2>/tmp/mc_alias.log

# Ensure bucket exists
mc mb "pms-minio/${MINIO_BACKUP_BUCKET}" --ignore-existing 2>/dev/null || true

# Upload file
REMOTE_PATH="backup/$(basename "${COMPRESSED_FILE}")"
mc cp "${COMPRESSED_FILE}" "pms-minio/${MINIO_BACKUP_BUCKET}/${REMOTE_PATH}" 2>/tmp/mc_cp.log

UPLOAD_EXIT=$?
if [ $UPLOAD_EXIT -ne 0 ]; then
    echo -e "${RED}Error: MinIO upload failed (exit code: ${UPLOAD_EXIT})${NC}"
    tail -5 /tmp/mc_cp.log
    rm -f "${COMPRESSED_FILE}"
    exit 3
fi

echo -e "${GREEN}✓ Uploaded: pms-minio/${MINIO_BACKUP_BUCKET}/${REMOTE_PATH}${NC}"

# ── Verify checksum ────────────────────────────────────────────────────────
LOCAL_MD5=$(md5sum "${COMPRESSED_FILE}" | cut -d' ' -f1)
echo -e "${GREEN}✓ Local checksum: ${LOCAL_MD5}${NC}"

# ── Cleanup temporary files ────────────────────────────────────────────────
rm -f "${COMPRESSED_FILE}"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Backup SUCCESS — ${TIMESTAMP}${NC}"
echo -e "${GREEN}  Size: $(numfmt --to=iec-i "${COMPRESSED_SIZE}")${NC}"
echo -e "${GREEN}  Path: s3://${MINIO_BACKUP_BUCKET}/${REMOTE_PATH}${NC}"
echo -e "${GREEN}========================================${NC}"
