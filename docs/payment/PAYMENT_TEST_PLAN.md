# SpanQC Payment System Test Plan

**Document:** `docs/payment/PAYMENT_TEST_PLAN.md`  
**Date:** 2026-10-17  
**Scope:** Automated & manual test strategy for SpanQC payment and entitlement flows.

---

## 1. Test Levels & Execution Matrix

| Test Suite | Purpose | Execution Command | Result |
| :--- | :--- | :--- | :---: |
| **Payment Security & Adversarial** | Signature forgery, price tampering, replay defense, webhook deduplication, and fail-closed checks. | `DATABASE_URL="file:./test.db" npx tsx --test tests/payment-system.test.ts` | **12 / 12 PASS** |
| **Core Auth & Multi-Tenant** | Session verification, proxy enforcement, cross-tenant isolation, and RBAC. | `DATABASE_URL="file:./test.db" npm test` | **101 / 101 PASS** |
| **QC Job Bridge & Concurrency** | Idempotency, quota reservations, atomic decrements, and worker crash recovery. | `DATABASE_URL="file:./test.db" npx tsx tests/qc-job-bridge.test.ts` | **79 / 79 PASS** |
| **TypeScript Compilation** | Strict typecheck, interface conformity, and import integrity. | `npm run typecheck` | **0 errors** |
| **Deterministic Audit Runner** | Automated scan for secrets, configuration defaults, and full test matrix. | `./scripts/audit_payment_system.sh` | **11 / 11 PASS** |

---

## 2. Test Case Specifications (Payment Suite)

1. `[PLAN-01]`: Confirms server-owned prices are represented as minor unit integers (paise).
2. `[PLAN-02]`: Asserts unrecognized plan IDs are rejected with null.
3. `[PLAN-03]`: Asserts Enterprise custom quote tier cannot be bought through self-serve checkout.
4. `[BILLING-01]`: Fails closed: asserts `BILLING_STATUS=NOT_LIVE` blocks order creation with HTTP 403.
5. `[ORDER-01]`: Verifies order creation in `PROVIDER_PENDING` with expected minor-unit amount.
6. `[ORDER-02]`: Proves idempotency: identical `tenantId + idempotencyKey` returns existing order without creating new records.
7. `[VERIFY-01]`: Forged or altered signature fails verification, creates `FAILED` payment record, and does NOT grant quota.
8. `[VERIFY-02]`: Proves IDOR protection: Tenant B cannot verify Tenant A's order.
9. `[VERIFY-03]`: Valid signature marks order `PAID`, records `CAPTURED` payment, and increments quota exactly once. Replay returns `alreadyVerified` without incrementing quota twice.
10. `[WEBHOOK-01]`: Unsigned or signature-tampered webhook rejected with HTTP 401 without state changes.
11. `[WEBHOOK-02]`: Valid webhook delivery credits quota. Duplicate webhook delivery returns `ALREADY_PROCESSED` and prevents double crediting.
12. `[RECONCILE-01]`: Dry-run reconciliation inspects stale pending orders without mutating database state.
