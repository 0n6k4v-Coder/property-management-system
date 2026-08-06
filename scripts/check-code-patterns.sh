#!/bin/bash
# check-code-patterns.sh - ตรวจสอบ current_user parameter naming
set -e

cd backend

echo "🔍 Checking code patterns..."

ISSUES=0
for router_file in $(find app/modules -name "*_router.py" 2>/dev/null); do
    # หา functions ที่มี current_user parameter
    # ตรวจสอบว่า parameter ที่ใช้จริงไม่มี underscore prefix
    python3 - "$router_file" << 'EOF'
import re
import sys

router_file = sys.argv[1]
with open(router_file, 'r') as f:
    content = f.read()

issues = []
# หา async def functions ที่มี current_user parameter
pattern = r'async def (\w+)\([^)]*(_?current_user)[^)]*\)'
for match in re.finditer(pattern, content):
    func_name = match.group(1)
    param_name = match.group(2)
    has_underscore = param_name.startswith('_')
    
    # หา function body (ประมาณ 2000 chars หลัง signature)
    func_start = match.end()
    func_body = content[func_start:func_start + 2000]
    
    # ตรวจสอบว่าใช้ current_user ใน body
    uses_current_user = 'current_user[' in func_body or 'current_user.' in func_body or 'current_user,' in func_body
    
    if uses_current_user and has_underscore:
        issues.append(f'{func_name}: Uses current_user but has underscore prefix')
    elif not uses_current_user and not has_underscore:
        issues.append(f'{func_name}: Unused but no underscore prefix')

if issues:
    for issue in issues:
        print(f'❌ {router_file}:{issue}')
    sys.exit(1)
EOF
    
    if [ $? -ne 0 ]; then
        ISSUES=$((ISSUES + 1))
    fi
done

if [ "$ISSUES" -gt 0 ]; then
    echo ""
    echo "❌ Found $ISSUES files with parameter naming issues"
    exit 1
else
    echo "✅ All parameter naming conventions correct"
fi