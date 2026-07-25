#!/usr/bin/env bash
# Interactive git commit and push with conventional commits
# Usage: ./scripts/git-commit-push.sh

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Conventional commit types
TYPES=("feat" "fix" "docs" "refactor" "chore" "style" "test" "build" "ci" "perf" "revert")
SCOPES=("" "api" "ui" "db" "auth" "ui-components" "api-routes" "db-schema" "auth-flow" "deploy" "ci-cd" "deps" "config" "types" "hooks" "utils" "tests" "docs" "ci" "deploy" "perf" "refactor" "feat" "fix" "docs" "style" "test" "build" "ci" "perf" "revert")

echo -e "${CYAN}======================================"
echo -e "  Interactive Git Commit & Push"
echo -e "  Conventional Commits"
echo -e "======================================${NC}"
echo

# Show git diff --stat
echo -e "${BLUE}Git diff --stat:${NC}"
git diff --stat
echo

# Check if there are staged changes
if git diff --cached --quiet; then
    echo -e "${YELLOW}No staged changes. Staging all changes...${NC}"
    git add -A
    echo -e "${GREEN}Staged all changes.${NC}"
    echo
    git diff --cached --stat
    echo
fi

# Prompt for commit type
echo -e "${CYAN}Select commit type:${NC}"
select TYPE in "${TYPES[@]}"; do
    if [[ -n "$TYPE" ]]; then
        echo -e "${GREEN}Selected: ${TYPE}${NC}"
        break
    else
        echo -e "${RED}Invalid selection. Please try again.${NC}"
    fi
done
echo

# Prompt for scope (optional)
echo -e "${CYAN}Enter scope (optional, press Enter to skip):${NC}"
echo -e "${YELLOW}Common scopes: api, ui, db, auth, ui-components, api-routes, db-schema, auth-flow, deploy, ci-cd, deps, config, types, hooks, utils, tests, docs, ci, deploy, perf, refactor, feat, fix, docs, style, test, build, ci, perf, revert${NC}"
read -p "Scope: " SCOPE
SCOPE=${SCOPE:-}
if [[ -n "$SCOPE" ]]; then
    SCOPE="($SCOPE)"
    echo -e "${GREEN}Scope: ${SCOPE}${NC}"
else
    echo -e "${YELLOW}No scope provided.${NC}"
fi
echo

# Prompt for commit message
echo -e "${CYAN}Enter commit message (imperative mood, e.g., 'add user authentication'):${NC}"
read -p "Message: " MESSAGE
if [[ -z "$MESSAGE" ]]; then
    echo -e "${RED}Commit message cannot be empty. Exiting.${NC}"
    exit 1
fi
echo -e "${GREEN}Message: ${MESSAGE}${NC}"
echo

# Build conventional commit message
COMMIT_MSG="${TYPE}${SCOPE}: ${MESSAGE}"

# Get git config user for co-authored-by
GIT_USER=$(git config user.name)
GIT_EMAIL=$(git config user.email)
CO_AUTHORED_BY="Co-authored-by: ${GIT_USER} <${GIT_EMAIL}>"

# Show final commit message
echo -e "${CYAN}======================================"
echo -e "  Final Commit Message:"
echo -e "======================================${NC}"
echo -e "${GREEN}${COMMIT_MSG}${NC}"
echo -e "${YELLOW}${CO_AUTHORED_BY}${NC}"
echo

# Confirm commit
read -p "Proceed with commit and push? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Commit cancelled.${NC}"
    exit 0
fi

# Commit with co-authored-by trailer
echo -e "${BLUE}Committing...${NC}"
git commit -m "${COMMIT_MSG}" -m "${CO_AUTHORED_BY}"

# Push to origin HEAD
echo -e "${BLUE}Pushing to origin HEAD...${NC}"
git push origin HEAD

echo -e "${GREEN}======================================"
echo -e "  Commit and push completed successfully!"
echo -e "======================================${NC}"