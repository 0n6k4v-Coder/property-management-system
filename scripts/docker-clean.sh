#!/usr/bin/env bash
# docker-clean.sh — Complete Docker cleanup for Property Management System
# Usage: ./scripts/docker-clean.sh [--all] [--dry-run]
#   --all     : Also prune builder cache and unused images (not just project resources)
#   --dry-run : Show what would be removed without actually removing

set -euo pipefail

PROJECT_NAME="pms-dev"
COMPOSE_FILE="docker-compose.dev.yml"
COMPOSE_PROD_FILE="docker-compose.prod.yml"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

DRY_RUN=false
PRUNE_ALL=false

for arg in "$@"; do
    case $arg in
        --dry-run) DRY_RUN=true ;;
        --all) PRUNE_ALL=true ;;
    esac
done

run() {
    if [[ "$DRY_RUN" == "true" ]]; then
        echo -e "${YELLOW}[DRY-RUN]${NC} $*"
    else
        eval "$*"
    fi
}

echo -e "${GREEN}=== Docker Cleanup for Property Management System ===${NC}"
echo "Project: $PROJECT_NAME"
echo "Mode: $([ "$DRY_RUN" == "true" ] && echo 'DRY-RUN' || echo 'EXECUTE')"
echo ""

# 1. Down all services (dev + prod profiles)
echo -e "${GREEN}1. Stopping and removing containers...${NC}"
run "docker compose -f $COMPOSE_FILE --profile dev down -v --remove-orphans 2>/dev/null || true"
run "docker compose -f $COMPOSE_FILE --profile test down -v --remove-orphans 2>/dev/null || true"
run "docker compose -f $COMPOSE_PROD_FILE down -v --remove-orphans 2>/dev/null || true"

# 2. Remove any remaining containers with project label
echo -e "${GREEN}2. Removing leftover containers...${NC}"
run "docker ps -a --filter 'label=com.docker.compose.project=$PROJECT_NAME' --format '{{.ID}}' | xargs -r docker rm -f 2>/dev/null || true"

# 3. Remove project volumes
echo -e "${GREEN}3. Removing project volumes...${NC}"
run "docker volume ls --filter 'label=com.docker.compose.project=$PROJECT_NAME' --format '{{.Name}}' | xargs -r docker volume rm -f 2>/dev/null || true"

# Also remove known volume names (in case labels missing)
for vol in \
    ${PROJECT_NAME}_postgres-data \
    ${PROJECT_NAME}_redis-data \
    ${PROJECT_NAME}_minio-data \
    ${PROJECT_NAME}_backend-pytest-cache \
    ${PROJECT_NAME}_backend-coverage \
    ${PROJECT_NAME}_frontend-node-modules \
    ${PROJECT_NAME}_frontend-coverage; do
    run "docker volume rm -f $vol 2>/dev/null || true"
done

# 4. Remove project network
echo -e "${GREEN}4. Removing project network...${NC}"
run "docker network rm ${PROJECT_NAME}-network 2>/dev/null || true"

# 5. Remove project images (built from Dockerfile)
echo -e "${GREEN}5. Removing project images...${NC}"
run "docker images --filter 'reference=*/pms-dev*' --format '{{.ID}}' | xargs -r docker rmi -f 2>/dev/null || true"
run "docker images --filter 'reference=*/property-management*' --format '{{.ID}}' | xargs -r docker rmi -f 2>/dev/null || true"

# 6. Optional: Full system prune
if [[ "$PRUNE_ALL" == "true" ]]; then
    echo -e "${GREEN}6. Full Docker system prune (builder cache, unused images, networks)...${NC}"
    run "docker system prune -af --volumes --filter 'until=24h' 2>/dev/null || true"
    run "docker builder prune -af 2>/dev/null || true"
else
    echo -e "${GREEN}6. Skipping full system prune (use --all to enable)${NC}"
fi

echo ""
echo -e "${GREEN}=== Cleanup Complete ===${NC}"