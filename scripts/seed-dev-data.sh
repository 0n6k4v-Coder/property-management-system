#!/usr/bin/env bash
# Seed development data: admin user + deterministic E2E fixtures
# Idempotent — safe to run multiple times.
# Usage: ./scripts/seed-dev-data.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKEND_DIR="${PROJECT_ROOT}/backend"

echo "🌱 Seeding dev data (admin + E2E fixtures)..."

echo "▶ Running seed_admin..."
docker exec pms-dev-backend-1 python -m scripts.seed_admin

echo "▶ Running seed_e2e --reset..."
docker exec pms-dev-backend-1 python -m scripts.seed_e2e --reset

echo "✅ Dev data seeded successfully."