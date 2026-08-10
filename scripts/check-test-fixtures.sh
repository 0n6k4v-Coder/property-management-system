#!/bin/bash
# check-test-fixtures.sh - ตรวจสอบว่า security tests มี auth override cleanup
set -euo pipefail

cd backend

echo "🔍 Checking test fixtures..."

ISSUES=0
for test_file in $(find tests/modules -name "test_*_security.py" 2>/dev/null); do
    # ตรวจสอบว่ามี TestAuthenticationRequired class
    if grep -q "class TestAuthenticationRequired" "$test_file"; then
        # ตรวจสอบว่ามี remove_auth_override fixture
        if ! grep -q "remove_auth_override" "$test_file"; then
            echo "❌ $test_file: Missing remove_auth_override fixture"
            ISSUES=$((ISSUES + 1))
        fi
        # ตรวจสอบว่ามีการ pop dependency override
        if ! grep -q "dependency_overrides.pop(get_current_user" "$test_file"; then
            echo "❌ $test_file: Missing dependency_overrides.pop"
            ISSUES=$((ISSUES + 1))
        fi
    fi
done

if [ "$ISSUES" -gt 0 ]; then
    echo ""
    echo "❌ Found $ISSUES test fixture issues"
    echo ""
    echo "💡 Fix by adding to TestAuthenticationRequired class:"
    echo "   @pytest.fixture(autouse=True)"
    echo "   def remove_auth_override(self, app):"
    echo "       from app.shared.deps import get_current_user"
    echo "       app.dependency_overrides.pop(get_current_user, None)"
    exit 1
else
    echo "✅ All test fixtures correct"
fi