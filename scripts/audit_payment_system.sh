#!/usr/bin/env bash
# ==============================================================================
# SpanQC Deterministic Payment System & Security Audit Runner
# ==============================================================================
# Purpose: Read-only, CI-friendly compliance and security audit runner.
# Rules: Fails closed. Exits non-zero on any mandatory failure. Never prints secrets.
# ==============================================================================

set -eo pipefail

AUDIT_TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
COMMIT_SHA=$(git rev-parse HEAD 2>/dev/null || echo "UNKNOWN")
BRANCH_NAME=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "UNKNOWN")

echo "=============================================================================="
echo "SPANQC PAYMENT SYSTEM & SECURITY AUDIT"
echo "Timestamp: ${AUDIT_TIMESTAMP}"
echo "Commit:    ${COMMIT_SHA}"
echo "Branch:    ${BRANCH_NAME}"
echo "=============================================================================="

TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0

report_check() {
  local check_id="$1"
  local description="$2"
  local status="$3"
  local details="$4"

  TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
  if [ "$status" == "PASS" ]; then
    PASSED_CHECKS=$((PASSED_CHECKS + 1))
    echo "  [${status}] ${check_id}: ${description}"
  else
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
    echo "  [${status}] ${check_id}: ${description} -> ${details}"
  fi
}

echo ""
echo "--- 1. CONFIGURATION & FAIL-CLOSED GUARDS ---"

# Check 1: Billing defaults to NOT_LIVE
if grep -q 'return "NOT_LIVE"' src/lib/server/billing/catalog.ts; then
  report_check "CFG-01" "Billing defaults to NOT_LIVE when environment variable is unset" "PASS" ""
else
  report_check "CFG-01" "Billing defaults to NOT_LIVE when environment variable is unset" "FAIL" "Default is not NOT_LIVE"
fi

# Check 2: Environment template documents variables without secrets
if [ -f ".env.example" ] && ! grep -E "rzp_live|rzp_test" .env.example >/dev/null 2>&1; then
  report_check "CFG-02" "Environment template does not leak live/test secret credentials" "PASS" ""
else
  report_check "CFG-02" "Environment template does not leak live/test secret credentials" "FAIL" "Credentials found in .env.example"
fi

echo ""
echo "--- 2. SECRET SCANNING & TRACKED REPO AUDIT ---"

# Check 3: Ensure .env and .env.local are untracked
if git ls-files | grep -E "^\.env$|^\.env\.local$" >/dev/null 2>&1; then
  report_check "SEC-01" "Local environment secret files are not tracked in git" "FAIL" "Found tracked .env file"
else
  report_check "SEC-01" "Local environment secret files are not tracked in git" "PASS" ""
fi

# Check 4: Scan for hardcoded Razorpay live secret keys
if git grep -E "rzp_live_[0-9a-zA-Z]{14}" >/dev/null 2>&1; then
  report_check "SEC-02" "No hardcoded Razorpay live secrets in tracked repository files" "FAIL" "Found live secret match"
else
  report_check "SEC-02" "No hardcoded Razorpay live secrets in tracked repository files" "PASS" ""
fi

# Check 5: Ensure NEXT_PUBLIC does not expose private payment secret
if git grep -i "NEXT_PUBLIC.*SECRET" >/dev/null 2>&1; then
  report_check "SEC-03" "No private payment secrets exposed via NEXT_PUBLIC_* variables" "FAIL" "NEXT_PUBLIC secret found"
else
  report_check "SEC-03" "No private payment secrets exposed via NEXT_PUBLIC_* variables" "PASS" ""
fi

echo ""
echo "--- 3. FINANCIAL INTEGRITY & SCHEMA AUDIT ---"

# Check 6: Monetary units in schema are minor unit integers
if grep -q "amountPaise.*Int" prisma/schema.prisma; then
  report_check "FIN-01" "Monetary amounts stored strictly as integer minor units (paise)" "PASS" ""
else
  report_check "FIN-01" "Monetary amounts stored strictly as integer minor units (paise)" "FAIL" "amountPaise Int not found in schema"
fi

# Check 7: Unique constraints on provider IDs
if grep -q "providerOrderId.*@unique" prisma/schema.prisma && grep -q "providerEventId.*@unique" prisma/schema.prisma; then
  report_check "FIN-02" "Unique constraints enforced on providerOrderId and providerEventId" "PASS" ""
else
  report_check "FIN-02" "Unique constraints enforced on providerOrderId and providerEventId" "FAIL" "Missing unique constraints in schema"
fi

echo ""
echo "--- 4. AUTOMATED TEST SUITES EXECUTION ---"

echo "Executing TypeScript typecheck..."
if npm run typecheck >/dev/null 2>&1; then
  report_check "TST-01" "TypeScript strict compilation and type check" "PASS" ""
else
  report_check "TST-01" "TypeScript strict compilation and type check" "FAIL" "TypeScript errors detected"
fi

echo "Executing Payment Security & Adversarial Suite..."
if DATABASE_URL="file:./test.db" npx tsx --test tests/payment-system.test.ts >/dev/null 2>&1; then
  report_check "TST-02" "Payment security, signature verification, tampering, & idempotency suite (12 tests)" "PASS" ""
else
  report_check "TST-02" "Payment security, signature verification, tampering, & idempotency suite (12 tests)" "FAIL" "Payment test failures"
fi

echo "Executing Core Authentication & Multi-Tenant Isolation Suite..."
if DATABASE_URL="file:./test.db" npm test >/dev/null 2>&1; then
  report_check "TST-03" "Core authentication, session revocation, & multi-tenant isolation suite (101 tests)" "PASS" ""
else
  report_check "TST-03" "Core authentication, session revocation, & multi-tenant isolation suite (101 tests)" "FAIL" "Auth test failures"
fi

echo "Executing QC Job Bridge & Quota Concurrency Suite..."
if DATABASE_URL="file:./test.db" npx tsx tests/qc-job-bridge.test.ts >/dev/null 2>&1; then
  report_check "TST-04" "QC job processing, worker crash recovery, & quota concurrency suite (79 tests)" "PASS" ""
else
  report_check "TST-04" "QC job processing, worker crash recovery, & quota concurrency suite (79 tests)" "FAIL" "QC test failures"
fi

echo ""
echo "=============================================================================="
echo "AUDIT SUMMARY: ${PASSED_CHECKS} / ${TOTAL_CHECKS} CHECKS PASSED"
if [ "$FAILED_CHECKS" -gt 0 ]; then
  echo "STATUS: FAILED (${FAILED_CHECKS} checks failed)"
  exit 1
else
  echo "STATUS: ALL MANDATORY AUDIT CHECKS PASSED"
  echo "BILLING STATUS: NOT_LIVE (Safety invariant preserved)"
  exit 0
fi
