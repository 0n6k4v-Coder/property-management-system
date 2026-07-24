#!/usr/bin/env bash
# Verify backend files: existence, ruff, mypy, permissions, and container
# readability.
#
# Usage:
#   ./scripts/verify-backend.sh backend/app/foo.py backend/src/bar.py

set -euo pipefail
cd "$(dirname "$0")/.."

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}PASS${NC} $1"; }
fail() { echo -e "${RED}FAIL${NC} $1"; }
warn() { echo -e "${YELLOW}WARN${NC} $1"; }

# Usage check
if [ "$#" -eq 0 ]; then
	echo "Usage: $0 <file1> [file2 ...]"
	echo "  Verifies backend files: existence, ruff, mypy, permissions, container readability."
	echo "  Paths are relative to repo root (e.g. backend/app/main.py)."
	exit 1
fi

OVERALL_STATUS=0

# Translate a host path (backend/...) to the in-container path.
# The backend container mounts repo/backend -> /app, so strip the leading
# backend/ prefix.
to_container_path() {
	local p="$1"
	p="${p#./}"
	p="${p#backend/}"
	echo "$p"
}

echo "==> Verifying backend files ($#)"

for file in "$@"; do
	echo ""
	echo "-- $file"

	# (a) Check existence
	if [ ! -f "$file" ]; then
		fail "$file does not exist"
		OVERALL_STATUS=1
		continue
	fi
	pass "exists"

	cpath=$(to_container_path "$file")

	# (b) ruff check — run inside container with translated path
	echo -n "   ruff ... "
	if docker exec pms-dev-backend-1 ruff check "$cpath" --no-cache >/dev/null 2>&1; then
		echo -e "${GREEN}ok${NC}"
	else
		echo -e "${RED}failed${NC} (run 'docker exec pms-dev-backend-1 ruff check $cpath --no-cache' for details)"
		OVERALL_STATUS=1
	fi

	# (c) mypy — run inside container with translated path
	echo -n "   mypy ... "
	if docker exec pms-dev-backend-1 mypy "$cpath" --pretty >/dev/null 2>&1; then
		echo -e "${GREEN}ok${NC}"
	else
		echo -e "${RED}failed${NC} (run 'docker exec pms-dev-backend-1 mypy $cpath --pretty' for details)"
		OVERALL_STATUS=1
	fi

	# (d) Check for 600 permission
	perms=$(stat -c '%a' "$file")
	if [ "$perms" = "600" ]; then
		warn "$file has 600 permissions — may not be readable by the container"
	else
		pass "permissions $perms"
	fi

	# (e) Container readability
	echo -n "   container read ... "
	# Use `test -r` inside the container so empty-but-readable files pass.
	if docker exec pms-dev-backend-1 test -r "$cpath" 2>/dev/null; then
		echo -e "${GREEN}ok${NC}"
	else
		echo -e "${RED}failed${NC} (cannot read '$cpath' from pms-dev-backend-1)"
		OVERALL_STATUS=1
	fi
done

echo ""
echo "==> Summary"
if [ "$OVERALL_STATUS" -eq 0 ]; then
	pass "All checks passed"
else
	fail "One or more checks failed"
fi
exit $OVERALL_STATUS
