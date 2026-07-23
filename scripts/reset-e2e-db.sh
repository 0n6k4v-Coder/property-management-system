#!/usr/bin/env bash
# Truncate and re-seed the fullstack E2E fixture data.
# Run this before any Playwright run against the real backend+DB
# (the test stack's backend and Playwright are separate processes,
# so there's no per-test transaction rollback like pytest gets).
#
# Usage:
#   ./scripts/reset-e2e-db.sh

set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Resetting E2E fixture data (test stack must already be running)"
docker compose -f docker-compose.test.yml exec backend python -m scripts.seed_e2e --reset
