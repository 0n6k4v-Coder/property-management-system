#!/bin/bash
# =============================================================================
# File: backend/scripts/init-minio-buckets.sh
# Purpose: Initialize MinIO buckets with policies, versioning, and lifecycle rules
# 2026 Best Practices: Idempotent mc commands, JSON output for CI, bucket policies per use case
# =============================================================================

set -euo pipefail

# Configuration (override via environment)
MINIO_ALIAS="${MINIO_ALIAS:-myminio}"
MINIO_ENDPOINT="${MINIO_ENDPOINT:-http://minio:9000}"
MINIO_ROOT_USER="${MINIO_ROOT_USER:-minioadmin}"
MINIO_ROOT_PASSWORD="${MINIO_ROOT_PASSWORD:-minioadmin}"

# Bucket definitions (name, access policy, versioning, lifecycle)
declare -A BUCKETS=(
    # Public read for presigned URLs (file uploads from frontend)
    ["uploads"]="public"
    # Private for sensitive documents (ID card backups, audit trails)
    ["documents"]="private"
    # Versioned for compliance (payment slips, contracts)
    ["compliance"]="private-versioned"
)

# Lifecycle rules for test environments (auto-delete after N days)
TEST_RETENTION_DAYS="${TEST_RETENTION_DAYS:-7}"

# =============================================================================
# Helper Functions (2026: Structured logging, error handling)
# =============================================================================

log_info() { echo "[INFO] $(date -u +"%Y-%m-%dT%H:%M:%SZ") $*"; }
log_error() { echo "[ERROR] $(date -u +"%Y-%m-%dT%H:%M:%SZ") $*" >&2; }
log_success() { echo "[SUCCESS] $(date -u +"%Y-%m-%dT%H:%M:%SZ") $*"; }

# Wait for MinIO to be ready (2026: Use mc ready with retry)
wait_for_minio() {
    local max_retries=30
    local retry_count=0
    
    log_info "Waiting for MinIO at ${MINIO_ENDPOINT}..."
    
    while [[ $retry_count -lt $max_retries ]]; do
        if mc alias set "$MINIO_ALIAS" "$MINIO_ENDPOINT" "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" --api S3v4 &>/dev/null; then
            if mc ready "$MINIO_ALIAS" --json &>/dev/null; then
                log_success "MinIO is ready"
                return 0
            fi
        fi
        retry_count=$((retry_count + 1))
        sleep 1
    done
    
    log_error "MinIO failed to become ready after ${max_retries} attempts"
    return 1
}

# Create bucket with policy and versioning (idempotent)
create_bucket() {
    local bucket_name="$1"
    local policy="$2"
    local versioning="${3:-off}"
    
    # Create bucket if not exists (idempotent)
    if ! mc ls "${MINIO_ALIAS}/${bucket_name}" &>/dev/null; then
        log_info "Creating bucket: ${bucket_name}"
        mc mb --ignore-existing "${MINIO_ALIAS}/${bucket_name}" --json
    else
        log_info "Bucket already exists: ${bucket_name}"
    fi
    
    # Set access policy
    log_info "Setting ${policy} policy for ${bucket_name}"
    mc anonymous set "${policy}" "${MINIO_ALIAS}/${bucket_name}" --json
    
    # Enable versioning if requested (SDD §4.5.2 compliance)
    if [[ "$versioning" == "on" ]]; then
        log_info "Enabling versioning for ${bucket_name}"
        mc version enable "${MINIO_ALIAS}/${bucket_name}" --json
    fi
    
    # Set lifecycle rule for test environments (auto-cleanup)
    if [[ "${TEST_ENV:-false}" == "true" ]] && [[ "$TEST_RETENTION_DAYS" -gt 0 ]]; then
        log_info "Setting lifecycle rule: delete after ${TEST_RETENTION_DAYS} days for ${bucket_name}"
        mc ilm add "${MINIO_ALIAS}/${bucket_name}" \
            --expire-days "$TEST_RETENTION_DAYS" \
            --tags "env=test" \
            --json
    fi
}

# =============================================================================
# Main Execution
# =============================================================================

main() {
    log_info "Starting MinIO initialization..."
    
    # Wait for MinIO to be ready
    wait_for_minio
    
    # Create each bucket with its configuration
    for bucket_name in "${!BUCKETS[@]}"; do
        policy="${BUCKETS[$bucket_name]}"
        versioning="off"
        
        # Parse policy string for versioning flag
        if [[ "$policy" == *"-versioned" ]]; then
            policy="${policy%-versioned}"
            versioning="on"
        fi
        
        create_bucket "$bucket_name" "$policy" "$versioning"
    done
    
    # List buckets for verification (JSON output for CI parsing)
    log_info "Final bucket list:"
    mc ls --json "$MINIO_ALIAS"
    
    log_success "MinIO initialization complete"
}

# Run main function
main "$@"