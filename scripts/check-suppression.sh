#!/bin/bash
# check-suppression.sh - ตรวจสอบว่าไม่มี type: ignore, noqa, eslint-disable
set -euo pipefail

cd backend

echo "🔍 Checking suppression lines..."

# ตรวจสอบ type: ignore และ noqa ใน Python files
SUPPRESSION_COUNT=$(grep -r "type: ignore\|noqa" app/ --include="*.py" 2>/dev/null | wc -l) || SUPPRESSION_COUNT=0

if [ "$SUPPRESSION_COUNT" -gt 0 ]; then
    echo "❌ Found $SUPPRESSION_COUNT suppression lines:"
    grep -rn "type: ignore\|noqa" app/ --include="*.py" | head -10
    echo ""
    echo "💡 Fix the underlying issue instead of suppressing"
    exit 1
else
    echo "✅ No suppression lines in backend/app/"
fi

# ตรวจสอบ eslint-disable ใน frontend (ถ้ามี)
if [ -d "../frontend/src" ]; then
    cd ../frontend
    ESLINT_COUNT=$(grep -r "eslint-disable" src/ --include="*.tsx" --include="*.ts" 2>/dev/null | wc -l) || ESLINT_COUNT=0
    if [ "$ESLINT_COUNT" -gt 0 ]; then
        echo "⚠️  Found $ESLINT_COUNT eslint-disable lines in frontend"
        grep -rn "eslint-disable" src/ --include="*.tsx" --include="*.ts" | head -5
    else
        echo "✅ No eslint-disable lines in frontend/src/"
    fi
fi

echo ""
echo "✅ Suppression check passed"