#!/usr/bin/env bash
# =============================================================================
# scripts/init-minio-buckets.sh — Sprint 8: Production MinIO Bucket Setup
# Property Management System Backend
#
# Pre-creates required S3 buckets on MinIO startup.
# Runs as docker-entrypoint-initdb.d hook.
# =============================================================================

set -euo pipefail

# Wait for MinIO to be ready
sleep 5

# Configure mc alias
mc alias set pms-minio http://localhost:9000 "${MINIO_ROOT_USER:-minioadmin}" "${MINIO_SECRET_KEY:-minioadmin}"

# Create required buckets
for bucket in "pms-documents" "pms-backups" "pms-receipts"; do
    if mc ls "pms-minio/${bucket}" &>/dev/null 2>&1; then
        echo "✓ Bucket '${bucket}' already exists"
    else
        mc mb "pms-minio/${bucket}"
        echo "✓ Created bucket: ${bucket}"
    fi
done

# Set bucket policies
mc anonymous set download pms-minio/pms-documents 2>/dev/null || true

echo "✓ MinIO initialization complete"