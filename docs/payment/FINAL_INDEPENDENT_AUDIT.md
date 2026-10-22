# SpanQC Payment System — Independent Final Audit Report

**Audit Date:** 2026-10-17  
**Auditor:** Antigravity Autonomous Security & Architecture Auditor  
**Repository:** `Adhavan07/Spanqc`  
**Current Branch:** `main`  
**Commit SHA:** `0e55fb1a741f84398d02d3d5f52ed3e1b8277f25` (with pending uncommitted Phase 1–13 deliverables)  
**Worktree Status:** Clean diffs; untracked docs and test suites preserved  
**Active Billing Status:** **`NOT_LIVE`** (Strict fail-closed enforcement active)

---

## 1. Executive Verdict

### **VERDICT: CONDITIONAL PASS**

* **Pilot Eligibility:** **Eligible for controlled Test-Mode pilot** using Razorpay test credentials (`rzp_test_*`).
* **Live Commercial Charges:** **STRICTLY BLOCKED / NO-GO FOR REAL PRODUCTION CHARGES.**
* **Condition Summary:**
  1. Business owner must confirm commercial plan quotas (₹9,999 for 35 checks vs 50 checks; ₹24,999 for 120 checks vs 350 checks).
  2. Database provider migration from SQLite to PostgreSQL/Neon must be validated under PostgreSQL locking semantics before production launch.
  3. Live Razorpay API credentials and production webhook endpoint must be provisioned in AWS Secrets Manager and signed off by a human administrator.

---

## 2. Verified Implementation Inventory

Every claimed component was independently verified against actual source code and test execution:

| Feature / Subsystem | Source Location | Implementation Details & Evidence | Verification Status |
| :--- | :--- | :--- | :---: |
| **Server Plan Catalog** | `src/lib/server/billing/catalog.ts` | Authoritative plan definitions with minor-unit integer pricing (paise). Client cannot submit arbitrary prices or check quotas. | **PASS** |
| **Fail-Closed Gate** | `src/lib/server/billing/catalog.ts` L73-90 | `getBillingStatus()` defaults to `"NOT_LIVE"`. Order creation throws HTTP 403 when billing is disabled. Tested in `[BILLING-01]`. | **PASS** |
| **Order Creation & Idempotency** | `src/lib/server/billing/order-service.ts` L46-160 | Unique compound index `@@unique([tenantId, idempotencyKey])`. Duplicate order submissions return existing order without creating rows. Tested in `[ORDER-02]`. | **PASS** |
| **Razorpay Adapter** | `src/lib/server/billing/razorpay.ts` L40-90 | Hosted / tokenized checkout (zero card credentials stored). Key prefixes strictly validated (`rzp_test_` vs `rzp_live_`). | **PASS** |
| **Checkout Signature Verification** | `src/lib/server/billing/razorpay.ts` L96-126 | Constant-time HMAC-SHA256 signature verification (`crypto.timingSafeEqual`) on `order_id + "\|" + payment_id`. Tested in `[VERIFY-01]`, `[VERIFY-03]`. | **PASS** |
| **Raw-Body Webhook Verification** | `src/app/api/v1/webhooks/razorpay/route.ts` | Captures verbatim raw body via `await request.text()` before JSON parsing; verifies `x-razorpay-signature`. Tested in `[WEBHOOK-01]`. | **PASS** |
| **Durable Webhook Inbox** | `src/lib/server/billing/webhook-service.ts` | Stores events in `WebhookInbox` with unique `providerEventId`. Replayed deliveries return `ALREADY_PROCESSED` without double crediting. Tested in `[WEBHOOK-02]`. | **PASS** |
| **Atomic State & Ledgering** | `src/lib/server/billing/order-service.ts` L223-268 | `db.$transaction` atomically records `Payment`, marks `Order` as `PAID`, writes `EntitlementLedger`, and increments `Tenant.checkQuota`. | **PASS** |
| **API Authentication & RBAC** | `src/app/api/v1/billing/*/route.ts` | Session verification via `extractRequestAuth()`; CSRF origin checks on cookies; RBAC enforces `billing:manage` (ADMIN only). | **PASS** |
| **Tenant Isolation (IDOR)** | `src/app/api/v1/billing/*/route.ts` | Tenant scope derived strictly from `session.tenantId`. Tenant A cannot verify or access Tenant B orders. Tested in `[VERIFY-02]`. | **PASS** |
| **Clean Billing UI** | `src/app/app/billing/page.tsx` | All hardcoded fake invoices (`INV-2026-009`) and fake cards (`4242`) removed. Uses live API `/api/v1/billing/summary` with disabled warning banner. | **PASS** |
| **Payment Reconciliation** | `src/lib/server/billing/reconciliation.ts` | Dry-run audit finds stale pending orders without mutating database state. Tested in `[RECONCILE-01]`. | **PASS** |
| **Automated Audit Script** | `scripts/audit_payment_system.sh` | Deterministic, read-only CI script passing 11/11 automated checks. | **PASS** |

---

## 3. Findings Ranked by Severity

### Critical: None
No critical vulnerabilities, remote code execution, SQL injections, or plaintext secret leaks were identified.

---

### High Severity

#### Finding H-01: Commercial Plan Quota & Pricing Discrepancy
* **Location:** `src/lib/server/billing/catalog.ts` vs Earlier Discussion Proposal
* **Description:** The current repository implementation contains:
  * Starter: **₹9,999 / 35 checks** (Overage: ₹280)
  * Production: **₹24,999 / 120 checks** (Overage: ₹200)
  * Enterprise: **₹75,000+ / 500 checks** (Overage: ₹150)
  Whereas the earlier proposal outlined:
  * Starter: **₹9,999 / 50 checks**
  * Production: **₹24,999 / 350 checks**
  * Enterprise: **₹75,000+ / 1,500+ checks**
* **Impact:** Inconsistent commercial terms could lead to customer disputes or unexpected margins.
* **Remediation:** Requires formal business-owner sign-off before production release.

#### Finding H-02: Database Engine Runtime Mismatch (SQLite vs PostgreSQL/Neon)
* **Location:** `prisma/schema.prisma` (`datasource db { provider = "sqlite" }`)
* **Description:** The application currently runs SQLite in development and testing (`dev.db`, `test.db`). Production deployment targets PostgreSQL/Neon on AWS. SQLite lacks PostgreSQL row-level locking (`SELECT FOR UPDATE`), strict schema migrations, and concurrent connection scaling.
* **Impact:** PostgreSQL migration and high-concurrency locking behavior remain unverified on real PostgreSQL infrastructure.
* **Remediation:** Create a dedicated PostgreSQL staging instance, run `prisma migrate dev`, and test under multi-process concurrent load.

---

### Medium Severity

#### Finding M-01: Row-Level `UsageLedger` Not Connected to QC Job Pipeline
* **Location:** `src/lib/server/qc/job-bridge.ts`
* **Description:** While `UsageLedger` was added to `prisma/schema.prisma`, `job-bridge.ts` continues to track usage exclusively via the atomic integer counter `Tenant.quotaUsed` (`quotaUsed: { increment: 1 }`). It does not insert individual historical rows into `UsageLedger` on each check.
* **Impact:** Aggregate quota is safely enforced, but itemized check-by-check consumption ledgering is not persisted.
* **Remediation:** In Phase 7 polish, add `tx.usageLedger.create()` inside `createQCJob()` transaction.

#### Finding M-02: Razorpay Recurring Subscriptions API Omitted
* **Location:** `src/lib/server/billing/order-service.ts`
* **Description:** The current billing implementation models monthly plans as prepaid checkout orders rather than automated recurring card mandates via Razorpay Subscriptions API (`/v1/subscriptions`).
* **Impact:** Customers must manually renew or repurchase monthly check quotas.
* **Remediation:** If recurring auto-debit is required, integrate Razorpay Subscriptions API and mandate registration.

---

### Low Severity

#### Finding L-01: Automated Refunds API Not Implemented
* **Location:** `src/lib/server/billing/order-service.ts`
* **Description:** There is no self-serve customer refund endpoint.
* **Impact:** Minor. B2B SaaS platforms typically handle refunds manually via operator review.
* **Remediation:** Follow the operational runbook in `docs/payment/PAYMENT_RUNBOOK.md` to issue refunds via Razorpay Dashboard.

---

## 4. Discrepancy Analysis

### 1. Commercial Pricing Discrepancy
| Plan Tier | Implemented in Code | Earlier Discussed Proposal | Discrepancy Note |
| :--- | :--- | :--- | :--- |
| **Starter** | ₹9,999 / 35 checks (₹285.6/chk) | ₹9,999 / 50 checks (₹199.9/chk) | Implemented is more conservative. |
| **Production** | ₹24,999 / 120 checks (₹208.3/chk) | ₹24,999 / 350 checks (₹71.4/chk) | **Significant variance** (120 vs 350). |
| **Enterprise** | ₹75,000 / 500 checks | ₹75,000 / 1,500+ checks | Custom quote tier. |

*Recommendation:* Do not alter the code silently. Require business owner confirmation.

### 2. Database Discrepancy
* **Configured Provider:** `sqlite` (in `prisma/schema.prisma`)
* **Local Databases:** `prisma/dev.db` (462 KB), `prisma/test.db` (290 KB)
* **Migrations:** Only `0_init` exists in `prisma/migrations/`. Billing models were synced using `prisma db push`.
* *Status:* PostgreSQL migration behavior is **`NOT_VERIFIED`** in this environment.

### 3. Test Count Reconciliation
* The claimed "203 checks" in documentation represents:
  * **12** tests in `tests/payment-system.test.ts`
  * **101** assertions in `tests/auth-security.test.ts`
  * **79** assertions in `tests/qc-job-bridge.test.ts`
  * **11** static & security checks in `scripts/audit_payment_system.sh`
  * **Total:** $12 + 101 + 79 + 11 = 203$ verified automated checks.

---

## 5. Adversarial Security Verification Results

Executed against disposable `test.db` with isolated test credentials:

```bash
DATABASE_URL="file:./test.db" npx tsx --test tests/payment-system.test.ts
```

| Check ID | Adversarial Test Scenario | Result | Evidence |
| :--- | :--- | :---: | :--- |
| **[PLAN-01]** | Price integrity: integer paise enforcement | **PASS** | Starter = 999900 paise; float amounts rejected. |
| **[PLAN-02]** | Unknown plan ID injection | **PASS** | Returns `null`; order creation fails. |
| **[PLAN-03]** | Self-serve tampering on Enterprise tier | **PASS** | Rejected with `OrderServiceError: requires enterprise agreement`. |
| **[BILLING-01]** | Fail-closed: order creation when `BILLING_STATUS=NOT_LIVE` | **PASS** | Throws HTTP 403 Forbidden. |
| **[ORDER-01]** | Creation of valid internal order in `PROVIDER_PENDING` | **PASS** | Persists order with server price snapshot. |
| **[ORDER-02]** | Concurrent / duplicate submission with idempotency key | **PASS** | Returns existing order without duplicate DB rows. |
| **[VERIFY-01]** | Forged / altered checkout return signature | **PASS** | Rejected with HTTP 400; persists `FAILED` payment; quota untouched. |
| **[VERIFY-02]** | Cross-tenant verification attack (IDOR) | **PASS** | Blocked with HTTP 404 (Tenant B cannot access Tenant A order). |
| **[VERIFY-03]** | Legitimate signature & replay attack | **PASS** | Grants 35 checks exactly once; replay returns `alreadyVerified`. |
| **[WEBHOOK-01]**| Forged webhook signature | **PASS** | Rejected with HTTP 401 without DB state changes. |
| **[WEBHOOK-02]**| Webhook idempotency & duplicate delivery | **PASS** | Ingests into `WebhookInbox`; duplicate returns `ALREADY_PROCESSED`. |
| **[RECONCILE-01]**| Reconciliation dry-run | **PASS** | Audits stale orders without mutating records. |

---

## 6. Execution Evidence & Commands

```bash
# 1. TypeScript Strict Compilation
npm run typecheck
# Output: Found 0 errors (Exit Code: 0)

# 2. Next.js Production Build
npm run build
# Output: Compiled successfully, all dynamic/static routes generated (Exit Code: 0)

# 3. Core Auth & Multi-Tenant Security Suite
DATABASE_URL="file:./test.db" npm test
# Output: 101 PASSED, 0 FAILED (Exit Code: 0)

# 4. QC Job Engine & Concurrency Suite
DATABASE_URL="file:./test.db" npx tsx tests/qc-job-bridge.test.ts
# Output: 79 PASSED, 0 FAILED (Exit Code: 0)

# 5. Deterministic Audit Runner Script
./scripts/audit_payment_system.sh
# Output: 11 / 11 CHECKS PASSED (Exit Code: 0)
```

---

## 7. Staging & Deployment Status

* **Cloud Infrastructure Status:** Staging AWS resources (ECS, ALB, ECR, S3) were completely decommissioned and deleted during the prior session upon user request.
* **Staging Verification:** **`NOT_APPLICABLE`** (No remote staging environment currently provisioned).
* **Secret Leakage:** Clean. Git index confirmed zero tracked `.env` files, no hardcoded live keys (`rzp_live_*`), and no secrets exposed via `NEXT_PUBLIC_*`.

---

## 8. Prioritized Remediation Plan

1. **[Priority 1 - High] Business Owner Plan Sign-Off:**
   Confirm whether Production plan should grant 120 checks (implemented) or 350 checks (earlier proposal).
2. **[Priority 2 - High] PostgreSQL Migration Validation:**
   Prior to AWS deployment, spin up a PostgreSQL instance, generate formal Prisma migration SQL files (`npx prisma migrate dev`), and test transaction concurrency.
3. **[Priority 3 - Medium] Itemized Usage Ledger:**
   Hook `UsageLedger` table directly into `createQCJob()` in `src/lib/server/qc/job-bridge.ts`.
4. **[Priority 4 - Medium] AWS Secrets Manager Provisioning:**
   When ready for live deployment, provision `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` in AWS Secrets Manager.

---

## 9. Final Release Gate Table

| Gate Criterion | Status | Evidence / Command | Owner |
| :--- | :---: | :--- | :--- |
| **Zero Critical Security Findings** | **PASS** | 12/12 payment tests passed; STRIDE mitigations verified. | Security |
| **Authoritative Plan Catalog** | **PASS** | `src/lib/server/billing/catalog.ts` (minor unit integers). | Engineering |
| **Fail-Closed Default** | **PASS** | `BILLING_STATUS=NOT_LIVE` enforced in application logic. | Engineering |
| **Cryptographic Signatures** | **PASS** | Constant-time HMAC-SHA256 verification on checkout and webhooks. | Engineering |
| **Idempotency & Replay Defense** | **PASS** | Unique compound indexes and durable `WebhookInbox`. | Engineering |
| **Atomic Entitlement Grants** | **PASS** | Interactive `db.$transaction` boundaries tested. | Engineering |
| **Clean UI / Zero Fake Invoices** | **PASS** | `src/app/app/billing/page.tsx` renders live API state. | Frontend |
| **Pricing Plan Confirmation** | `BLOCKED` | Discrepancy between 120 vs 350 checks requires human sign-off. | **Business Owner** |
| **PostgreSQL Migration Testing** | `NOT_VERIFIED`| Local environment uses SQLite (`provider = 'sqlite'`). | **DevOps / Database** |
| **Production AWS Credentials** | `BLOCKED` | Live credentials must be configured in AWS Secrets Manager. | **DevOps / Lead** |
| **Production Webhook Registration** | `NOT_VERIFIED`| Requires live domain HTTPS endpoint registered in Razorpay. | **Operations** |
| **Human Activation Sign-Off** | `PENDING` | Billing must remain `NOT_LIVE` until owner sign-off. | **Product Owner** |
