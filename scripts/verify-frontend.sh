#!/usr/bin/env bash
# Verify frontend files: existence, tsc typecheck, eslint, permissions,
# and container readability.
#
# Usage:
#   ./scripts/verify-frontend.sh frontend/src/foo.ts frontend/src/bar.tsx

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
	echo "  Verifies frontend files: existence, tsc, eslint, permissions, container readability."
	echo "  Paths are relative to repo root (e.g. frontend/src/App.tsx)."
	exit 1
fi

OVERALL_STATUS=0

# Translate a host path (frontend/...) to the in-container path.
# The frontend container mounts repo/frontend -> /app, so strip the leading
# frontend/ prefix.
to_container_path() {
	local p="$1"
	# Strip optional leading ./ then frontend/ prefix
	p="${p#./}"
	p="${p#frontend/}"
	# If the user passed a path outside frontend/, fall back to relative
	echo "$p"
}

echo "==> Verifying frontend files ($#)"

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

	# (b) tsc --noEmit (run from frontend/ dir)
	echo -n "   tsc --noEmit ... "
	if (cd frontend && npx tsc --noEmit >/dev/null 2>&1); then
		echo -e "${GREEN}ok${NC}"
	else
		echo -e "${RED}failed${NC} (run 'cd frontend && npx tsc --noEmit' for details)"
		OVERALL_STATUS=1
	fi

	# (c) eslint — run from frontend/ with the file path relative to frontend/
	rel="${file#./}"
	rel="${rel#frontend/}"
	echo -n "   eslint ... "
	if (cd frontend && npx eslint "$rel" --max-warnings 0 >/dev/null 2>&1); then
		echo -e "${GREEN}ok${NC}"
	else
		echo -e "${RED}failed${NC} (run 'cd frontend && npx eslint $rel --max-warnings 0' for details)"
		OVERALL_STATUS=1
	fi

	# (d) Check for 600 permission
	perms=$(stat -c '%a' "$file")
	if [ "$perms" = "600" ]; then
		warn "$file has 600 permissions — may not be readable by the container"
	else
		pass "permissions $perms"
	fi

	# (e) Container readability — pms-dev-frontend-1 mounts frontend/ -> /app
	cpath=$(to_container_path "$file")
	echo -n "   container read ... "
	# Use `test -r` inside the container so empty-but-readable files pass.
	if docker exec pms-dev-frontend-1 test -r "$cpath" 2>/dev/null; then
		echo -e "${GREEN}ok${NC}"
	else
		echo -e "${RED}failed${NC} (cannot read '$cpath' from pms-dev-frontend-1)"
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
