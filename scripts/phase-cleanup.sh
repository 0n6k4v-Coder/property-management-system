#!/usr/bin/env bash
# phase-cleanup.sh — Multi-level cleanup between development phases
#
# Usage:
#   ./scripts/phase-cleanup.sh [quick|session|phase|project]
#
# Levels:
#   quick    — Remove test artifacts only (fastest, ~10s)
#   session  — Remove test artifacts + stop Docker (default, ~30s)
#   phase    — Full reset: artifacts + Docker + volumes + images (~2 min)
#   project  — Nuclear: everything including project-specific Docker resources
#
set -euo pipefail
cd "$(dirname "$0")/.."

# --- colors ------------------------------------------------------------------
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

LEVEL=${1:-"session"}

echo "${BLUE}🧹 Phase Cleanup — Level: ${BOLD}${LEVEL}${RESET}"
echo ""

case "$LEVEL" in
    quick)
        echo "${YELLOW}→ Quick Clean: Test Artifacts Only${RESET}"
        ./scripts/clean-test-artifacts.sh
        ;;

    session)
        echo "${YELLOW}→ Session Clean: Artifacts + Stop Docker${RESET}"
        ./scripts/clean-test-artifacts.sh
        echo ""
        echo "${YELLOW}→ Stopping all project Docker stacks...${RESET}"
        # Stop both dev and test stacks if running
        docker compose -f docker-compose.dev.yml down 2>/dev/null || true
        docker compose -f docker-compose.test.yml down 2>/dev/null || true
        echo "${GREEN}  Docker stacks stopped.${RESET}"
        ;;

    phase)
        echo "${YELLOW}→ Phase Clean: Full Reset${RESET}"
        ./scripts/clean-test-artifacts.sh
        echo ""
        echo "${YELLOW}→ Full Docker cleanup...${RESET}"
        ./scripts/docker-clean.sh --all 2>/dev/null || true
        echo ""
        echo "${YELLOW}→ Pruning Docker resources...${RESET}"
        docker volume prune -f
        docker image prune -af --filter "until=168h"  # Keep last 7 days
        docker system prune -f --filter "until=168h"
        ;;

    project)
        echo "${RED}${BOLD}⚠️  WARNING: Project Clean (Nuclear Option)${RESET}"
        echo "${RED}This will remove ALL project-specific Docker resources.${RESET}"
        read -p "Continue? [y/N] " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            ./scripts/clean-test-artifacts.sh
            ./scripts/docker-clean.sh --all 2>/dev/null || true
            docker volume ls -q | grep pms | xargs -r docker volume rm
            docker images --format "{{.Repository}}:{{.Tag}}" | grep pms | xargs -r docker rmi -f
            docker system prune -af --volumes
        else
            echo "${YELLOW}Cancelled.${RESET}"
            exit 0
        fi
        ;;

    *)
        echo "${RED}❌ Unknown level: $LEVEL${RESET}"
        echo "Usage: $0 [quick|session|phase|project]"
        exit 1
        ;;
esac

echo ""
echo "${GREEN}✅ Cleanup complete!${RESET}"
git status --short 2>/dev/null || true
