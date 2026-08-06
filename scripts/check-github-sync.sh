#!/bin/bash
# check-github-sync.sh - ตรวจสอบว่า local และ remote sync กัน
set -e

echo "🔍 Checking GitHub sync..."

# 1. ตรวจสอบ unpushed commits
UNPUSHED=$(git log origin/master..HEAD --oneline 2>/dev/null | wc -l)

if [ "$UNPUSHED" -gt 0 ]; then
    echo "❌ Found $UNPUSHED unpushed commits:"
    git log origin/master..HEAD --oneline
    echo ""
    echo "💡 Run: git push origin master"
    exit 1
else
    echo "✅ Local and remote are in sync"
fi

# 2. ตรวจสอบว่า remote เข้าถึงได้
if git ls-remote --exit-code origin master > /dev/null 2>&1; then
    echo "✅ Remote 'origin/master' is accessible"
else
    echo "❌ Cannot access remote 'origin/master'"
    exit 1
fi

echo ""
echo "✅ GitHub sync check passed"