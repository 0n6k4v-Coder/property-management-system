#!/bin/bash
# check-code-patterns.sh - ตรวจสอบ current_user parameter naming
set -euo pipefail

cd backend

echo "🔍 Checking code patterns..."

ISSUES=0
for router_file in $(find app/modules -name "*_router.py" 2>/dev/null || echo ""); do
    # หา functions ที่มี current_user parameter
    # ตรวจสอบว่า parameter ที่ใช้จริงไม่มี underscore prefix
    if ! python3 - "$router_file" << 'EOF'; then
import re
import sys

router_file = sys.argv[1]
with open(router_file, 'r') as f:
    content = f.read()

issues = []
# หา async def functions ที่มี current_user parameter (parameter name รวม underscore)
# ใช้ regex ที่เจาะจง parameter name มากขึ้น: capture parameter ก่อน colon
pattern = r'async def (\w+)\([^)]*?(_?current_user)\s*:'
for match in re.finditer(pattern, content):
    func_name = match.group(1)
    param_name = match.group(2)
    has_underscore = param_name.startswith('_')
    
    # หา function body จริง (หลังจาก signature จบที่ '):' หรือ ') ->')
    func_start = match.end()
    # ข้าม signature ที่เหลือ จนกว่าจะเจอ '):' หรือ ') ->' แล้วขึ้นบรรทัดใหม่
    return_type_pos = content.find(') ->', func_start)
    final_paren_pos = content.find('):', func_start)
    
    if return_type_pos != -1 and (final_paren_pos == -1 or return_type_pos < final_paren_pos):
        sig_end = return_type_pos + 2  # after ') ->'
    elif final_paren_pos != -1:
        sig_end = final_paren_pos + 1  # after '):'
    else:
        sig_end = func_start
    
    # หาบรรทัดใหม่ถัดไปหลัง signature
    body_start = content.find('\n', sig_end)
    if body_start != -1:
        func_body = content[body_start:body_start + 2000]
    else:
        func_body = content[sig_end:sig_end + 2000]
    
    # ตรวจสอบว่าใช้ current_user ใน body (parameter name จริงที่ใช้ใน body)
    # ใช้ word boundary เพื่อไม่ให้จับคู่ substring เช่น 'logs' ใน 'current_user'
    actual_param = param_name.lstrip('_')
    # Pattern: variable name ต้องมี word boundary (ไม่ใช่ส่วนของคำอื่น)
    # เช็ค: 'current_user[' 'current_user.' 'current_user,' 'current_user)' ' current_user ' 
    # และไม่ให้ match 'logs' หรือ 'current_users' เป็นต้น
    uses_current_user = bool(re.search(
        rf'(?<![a-zA-Z0-9_]){re.escape(actual_param)}(?![a-zA-Z0-9_])', 
        func_body
    ))
    
    if uses_current_user and has_underscore:
        issues.append(f'{func_name}: Uses {actual_param} but has underscore prefix')
    elif not uses_current_user and not has_underscore:
        issues.append(f'{func_name}: Unused but no underscore prefix')

if issues:
    for issue in issues:
        print(f'❌ {router_file}:{issue}')
    sys.exit(1)
EOF
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