#!/usr/bin/env bash
# scripts/check-dev-stack.sh
# Check all dev containers status for Property Management System
# Usage: ./scripts/check-dev-stack.sh
# Exit: 0 if all healthy/running, 1 otherwise

set -euo pipefail

COMPOSE_FILE="docker-compose.dev.yml"
PROFILE="dev"
PROJECT_NAME="pms-dev"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Expected services from docker-compose.dev.yml
EXPECTED_SERVICES=("backend" "db" "redis" "minio" "frontend")

# Expected health status for each service
declare -A EXPECTED_HEALTH=(
    ["backend"]="healthy"
    ["db"]="healthy"
    ["redis"]="healthy"
    ["minio"]="healthy"
    ["frontend"]="running"
)

# Expected ports
declare -A EXPECTED_PORTS=(
    ["backend"]="8000"
    ["frontend"]="5173"
    ["db"]="5432"
    ["redis"]="6379"
    ["minio"]="9000,9001"
)

print_header() {
    printf "${BLUE}%s${NC}\n" "$1"
}

print_success() {
    printf "${GREEN}%s${NC}\n" "$1"
}

print_warning() {
    printf "${YELLOW}%s${NC}\n" "$1"
}

print_error() {
    printf "${RED}%s${NC}\n" "$1"
}

# Check dependencies
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed or not in PATH"
    exit 1
fi

if ! docker compose version &> /dev/null; then
    print_error "Docker Compose v2 is not available"
    exit 1
fi

if ! command -v jq &> /dev/null; then
    print_error "jq is required for JSON parsing (apt install jq / brew install jq)"
    exit 1
fi

if [[ ! -f "$COMPOSE_FILE" ]]; then
    print_error "Compose file $COMPOSE_FILE not found in $(pwd)"
    exit 1
fi

print_header "=== Property Management System - Dev Stack Status ==="
print_header "Project: $PROJECT_NAME | Profile: $PROFILE | Compose: $COMPOSE_FILE"
echo ""

# Get all containers from docker compose
CONTAINERS_JSON=$(docker compose -f "$COMPOSE_FILE" --profile "$PROFILE" ps --format json 2>/dev/null)

# Build a lookup map of service -> container info
declare -A SERVICE_STATE
declare -A SERVICE_HEALTH
declare -A SERVICE_PORTS
declare -A SERVICE_FOUND

if [[ -n "$CONTAINERS_JSON" ]]; then
    while IFS= read -r container_json; do
        if [[ -z "$container_json" ]]; then
            continue
        fi
        
        SERVICE=$(echo "$container_json" | jq -r '.Service // "unknown"')
        STATE=$(echo "$container_json" | jq -r '.State // "unknown"')
        HEALTH=$(echo "$container_json" | jq -r '.Health // "none"')
        
        PORT_DISPLAY=$(echo "$container_json" | jq -r '.Publishers // [] | map("\(.PublishedPort):\(.TargetPort)/\(.Protocol)") | join(", ")')
        if [[ -z "$PORT_DISPLAY" ]] || [[ "$PORT_DISPLAY" == "null" ]]; then
            PORT_DISPLAY="none"
        fi
        
        SERVICE_STATE["$SERVICE"]="$STATE"
        SERVICE_HEALTH["$SERVICE"]="$HEALTH"
        SERVICE_PORTS["$SERVICE"]="$PORT_DISPLAY"
        SERVICE_FOUND["$SERVICE"]=1
    done <<< "$CONTAINERS_JSON"
fi

# Print table header
printf "%-12s | %-12s | %-10s | %-25s\n" "SERVICE" "STATUS" "HEALTH" "PORTS"
printf "%-12s-+-%-12s-+-%-10s-+-%-25s\n" "------------" "------------" "----------" "-------------------------"

ALL_HEALTHY=1

# Check each expected service
for service in "${EXPECTED_SERVICES[@]}"; do
    if [[ -z "${SERVICE_FOUND[$service]:-}" ]]; then
        # Service not running
        STATUS="not running"
        HEALTH="N/A"
        PORTS="${EXPECTED_PORTS[$service]}"
        printf "%-12s | ${RED}%-12s${NC} | %-10s | %-25s\n" "$service" "$STATUS" "$HEALTH" "$PORTS"
        ALL_HEALTHY=0
        continue
    fi
    
    STATE="${SERVICE_STATE[$service]}"
    HEALTH="${SERVICE_HEALTH[$service]}"
    PORTS="${SERVICE_PORTS[$service]}"
    
    # Normalize status
    case "${STATE,,}" in
        "running") STATUS="running" ;;
        "exited") STATUS="exited" ;;
        "created") STATUS="created" ;;
        "restarting") STATUS="restarting" ;;
        "paused") STATUS="paused" ;;
        *) STATUS="${STATE:-unknown}" ;;
    esac
    
    # Normalize health
    case "${HEALTH,,}" in
        "healthy") HEALTH="healthy" ;;
        "unhealthy") HEALTH="unhealthy" ;;
        "starting") HEALTH="starting" ;;
        "none"|"") HEALTH="none" ;;
        *) HEALTH="${HEALTH:-unknown}" ;;
    esac
    
    # Check if service is healthy
    expected_health="${EXPECTED_HEALTH[$service]}"
    is_healthy=0
    
    if [[ "$STATUS" == "running" ]]; then
        if [[ "$expected_health" == "running" && "$HEALTH" == "none" ]]; then
            # Frontend has no healthcheck, running is healthy
            is_healthy=1
        elif [[ "$expected_health" == "healthy" && "$HEALTH" == "healthy" ]]; then
            is_healthy=1
        fi
    fi
    
    # Color output based on health
    if [[ $is_healthy -eq 1 ]]; then
        printf "%-12s | ${GREEN}%-12s${NC} | ${GREEN}%-10s${NC} | %-25s\n" "$service" "$STATUS" "$HEALTH" "$PORTS"
    else
        printf "%-12s | ${RED}%-12s${NC} | ${RED}%-10s${NC} | %-25s\n" "$service" "$STATUS" "$HEALTH" "$PORTS"
        ALL_HEALTHY=0
    fi
done

echo ""
print_header "=== Summary ==="

if [[ $ALL_HEALTHY -eq 1 ]]; then
    print_success "All dev stack services are healthy/running ✓"
    exit 0
else
    print_error "Some services are not healthy ✗"
    echo ""
    print_header "Quick actions:"
    echo "  Start dev stack:    docker compose -f $COMPOSE_FILE --profile $PROFILE up -d"
    echo "  View logs:          docker compose -f $COMPOSE_FILE --profile $PROFILE logs -f <service>"
    echo "  Restart service:    docker compose -f $COMPOSE_FILE --profile $PROFILE restart <service>"
    echo "  Stop all:           docker compose -f $COMPOSE_FILE down"
    exit 1
fi