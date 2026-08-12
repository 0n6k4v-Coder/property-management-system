#!/usr/bin/env bash
# Run affected E2E specs 3 times to verify Gate 16 verification
# Affected specs: settings-flow.spec.ts, tenant-flow.spec.ts
set -uo pipefail
cd "$(dirname "$0")/.."

for i in 1 2 3; do
  echo ""
  echo "=== RUN $i/3: Gate 16 Verification ==="
  START=$(date +%s)
  
  # Reset DB and run affected specs
  docker compose -f docker-compose.test.yml exec -T backend \
    python -m scripts.seed_e2e --reset 2>&1 | tail -1
  
  docker compose -f docker-compose.test.yml run --rm frontend-test \
    npx playwright test --headless e2e/specs/settings-flow.spec.ts e2e/specs/tenant-flow.spec.ts --reporter=list 2>&1 | tee "/tmp/phase2-verify-$i.txt"
  EXIT_CODE=${PIPESTATUS[0]}
  
  END=$(date +%s)
  echo "Run $i: exit=$EXIT_CODE, duration=$((END-START))s"
  
  TIMEOUT_COUNT=$(grep -ci "timeout" "/tmp/phase2-verify-$i.txt" 2>/dev/null || echo 0)
  echo "Timeout errors: $TIMEOUT_COUNT"
done

echo ""
echo "=== VERIFICATION SUMMARY ==="
for i in 1 2 3; do
  TEXT=$(cat "/tmp/phase2-verify-$i.txt" 2>/dev/null)
  PASSED=$(echo "$TEXT" | grep -oP 'passed=\K[0-9]+' 2>/dev/null || echo "unknown")
  FAILED=$(echo "$TEXT" | grep -oP 'failed=\K[0-9]+' 2>/dev/null || echo "unknown")
  echo "Run $i: passed=$PASSED, failed=$FAILED"
done

echo ""
echo "=== Timeout errors across all runs ==="
cat /tmp/phase2-verify-*.txt 2>/dev/null | grep -ci "timeout" || echo 0

echo ""
echo "=== Duration consistency ==="
for i in 1 2 3; do
  grep "Run $i:" /tmp/phase2-verify-$i.txt 2>/dev/null | tail -1 || echo "Run $i: no duration"
done
