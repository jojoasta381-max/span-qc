# SpanQC Payment System Audit (Phase 0)

**Date:** 2026-10-17  
**Commit SHA:** `0e55fb1a741f84398d02d3d5f52ed3e1b8277f25`  
**Current Branch:** `main`  
**Worktree Status:** Clean (Untracked: `.agents/`, `openspec/` from CLI tooling)  
**Billing Mode:** `NOT_LIVE` (All live billing disabled; no payment credentials configured)

---

## 1. Executive Summary

A comprehensive read-only audit of the SpanQC repository was conducted in accordance with `PAYMENT_SYSTEM_DESIGN_SKILL.md` (Phase 0).

**Primary Findings:**
1. **Billing is currently `NOT_LIVE`:** There are zero payment endpoints (`/api/v1/billing/*`), zero provider SDKs (`razorpay`), and no payment credentials in the repository.
2. **Fabricated UI in `BillingPage` (Critical):** `src/app/app/billing/page.tsx` displays hardcoded simulated invoices (`INV-2026-009`), mock credit card records (`MasterCard ending in 4242`), and static active subscription status without any backend integration. This directly violates Rule 5 ("No fake payment paths") and must be replaced with server-driven contracts.
3. **Authoritative Quota Enforcement Pattern Exists:** The existing QC job execution pipeline (`src/lib/server/qc/job-bridge.ts`) implements atomic transactions (`db.$transaction`), idempotency deduplication (`tenantId_idempotencyKey`), and quota deduction/reconciliation. This established architectural pattern will be reused for payment orders, webhook deduplication, and entitlement ledgers.
4. **Database Stack:** Currently uses SQLite via Prisma (`@prisma/client: ^6.19.3`, `prisma/schema.prisma`). Target production migration to PostgreSQL/Neon is required before live multi-tenant concurrency.

---

## 2. Inventory of Current Implementation

| Component / Subsystem | Status | Location / Reference | Notes |
| :--- | :--- | :--- | :--- |
| **Provider SDK (`razorpay`)** | Missing | `package.json` | Not installed. Need `@types/razorpay` and `razorpay` in Phase 3. |
| **Payment Database Models** | Missing | `prisma/schema.prisma` | Only `Tenant`, `User`, `Session`, `Project`, `QCJob`, `QCJobReview` exist. No `Order`, `Payment`, `Subscription`, `WebhookInbox`, `EntitlementLedger`, or `UsageLedger`. |
| **Quota Model** | Partial | `prisma/schema.prisma` L19-20 | Simple integer counters `checkQuota` and `quotaUsed` on `Tenant`. No granular period-based ledger. |
| **Pricing Catalog** | Partial (Client-only) | `src/lib/data/pricing-tiers.ts` | Static TypeScript array (`VALIDATED_PRICING_TIERS`). No server-owned, authenticated catalog API. |
| **Billing UI** | Unsafe / Fake | `src/app/app/billing/page.tsx` L24-28 | Fabricated invoices (`INV-2026-009`), static card (`4242`), unverified active status. |
| **Pricing UI** | Implemented | `src/app/pricing/page.tsx` | Informational marketing comparison table. |
| **Checkout Endpoints** | Missing | `src/app/api/` | No checkout order generation or signature verification routes exist. |
| **Webhook Endpoints** | Missing | `src/app/api/` | No `/api/v1/webhooks/razorpay` endpoint exists. |
| **RBAC for Billing** | Missing | `src/lib/server/auth/rbac.ts` | Permissions exist for `projects`, `team`, `qc`. No `billing:manage` or `billing:view`. |
| **Environment Configuration** | Missing | `.env.example` | Missing documentation for `BILLING_STATUS`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`. |
| **QC Job Concurrency Guards**| Implemented | `src/lib/server/qc/job-bridge.ts` L121-176 | Atomic `db.$transaction` prevents quota overspending. |

---

## 3. Mandatory Evidence & Architecture Questions

### Q1: Can a browser callback grant access without backend verification?
* **Evidence:** `src/app/app/billing/page.tsx` L20-30; `src/app/api/`
* **Finding:** Currently, there is no payment verification route. The UI displays static fake access. Under the planned architecture, browser callbacks will be treated strictly as requests to re-fetch verified server state; access will only be granted upon cryptographically verified order/payment transitions.

### Q2: Are amount, currency, plan, and tenant controlled by the client?
* **Evidence:** `src/lib/data/pricing-tiers.ts`; `src/app/app/billing/page.tsx`
* **Finding:** Currently, prices only exist in a client data file. In Phase 1 and 3, a server-authoritative catalog (`src/lib/server/billing/catalog.ts`) will define minor-unit integer amounts (paise), currency (`INR`), and quota limits. The client will only pass `planId`, and tenant identity will be derived strictly from `session.tenantId`.

### Q3: Are checkout and webhook signatures verified correctly with server-only secrets?
* **Evidence:** `src/app/api/v1/auth/session.ts` L40-60 (shows HMAC pattern)
* **Finding:** Payment signature verification is not yet implemented. However, `session.ts` demonstrates constant-time verification patterns (`crypto.createHmac("sha256", secret)`). In Phase 3 and 6, this exact pattern will be applied to Razorpay checkout signatures (`order_id + "|" + payment_id`) and webhook headers (`x-razorpay-signature`).

### Q4: Is the exact raw webhook body used where required?
* **Evidence:** `src/app/api/v1/qc/jobs/route.ts`
* **Finding:** No webhook route exists yet. In Next.js App Router, `await request.text()` must be captured before any JSON deserialization to ensure the raw payload string matches the HMAC signature.

### Q5: Are duplicate, concurrent, or out-of-order events safe?
* **Evidence:** `src/lib/server/qc/job-bridge.ts` L126-142
* **Finding:** Not implemented for payments. The QC engine uses compound uniqueness (`tenantId_idempotencyKey`). In Phase 2, a durable `WebhookInbox` model with `providerEventId` unique constraints will be introduced to reject duplicates and manage processing states (`RECEIVED`, `PROCESSING`, `PROCESSED`).

### Q6: Are provider IDs and event IDs uniquely constrained?
* **Evidence:** `prisma/schema.prisma`
* **Finding:** Currently, no payment tables exist. Unique indexes must be defined in Phase 2 on `providerOrderId`, `providerPaymentId`, and `providerEventId`.

### Q7: Can concurrent requests overspend quotas or grant credits twice?
* **Evidence:** `tests/qc-job-bridge.test.ts` L73-77 (79 tests pass)
* **Finding:** For QC analysis, concurrent requests are safely serialized inside Prisma transactions and overspend is blocked. For payments, an `EntitlementLedger` and `UsageLedger` must be implemented in Phase 2/7 to prevent duplicate grants.

### Q8: Are payment state and entitlement updates atomic where required?
* **Evidence:** `prisma/schema.prisma`
* **Finding:** Not yet implemented. When implemented in Phase 3, payment state transitions and entitlement credit adjustments will execute within a single Prisma interactive transaction (`db.$transaction`).

### Q9: Is there reconciliation for missed webhooks or provider timeouts?
* **Evidence:** Repository search
* **Finding:** No reconciliation engine exists. A scheduled/operator-triggered reconciliation service (`src/lib/server/billing/reconciliation.ts`) is required in Phase 8.

### Q10: Can test and live credentials or endpoints be mixed?
* **Evidence:** `.env.example`
* **Finding:** Currently, no payment keys exist. When added, keys must be validated with prefix enforcement: `rzp_test_*` when `BILLING_STATUS=NOT_LIVE`, and live keys strictly restricted to production deployment environments.

### Q11: Are secrets in source, bundles, logs, errors, build args, or reports?
* **Evidence:** `git status --ignored`, `.gitignore`
* **Finding:** Clean. `.env`, `.env.local`, and build caches are properly ignored. No live or test Razorpay keys were found in tracked files.

### Q12: Are refunds, renewals, cancellation, and chargebacks handled or out of scope?
* **Evidence:** `src/lib/data/pricing-tiers.ts`
* **Finding:** Out of scope for initial MVP. Initial release will focus on prepaid credit packages / fixed subscriptions in Razorpay test mode. Refunds and automated chargebacks will be handled via operator runbook initially.

### Q13: Are migrations safe and billing disabled by default?
* **Evidence:** `package.json`, `.env.example`
* **Finding:** Current database is SQLite (`file:./dev.db`). `BILLING_STATUS` will default to `NOT_LIVE`.

### Q14: Does payment logic preserve existing QC behavior?
* **Evidence:** `tests/qc-job-bridge.test.ts`, `tests/auth-security.test.ts`
* **Finding:** Yes. The deterministic QC engine, review workflow, and PDF/Excel generation will continue to consume quota from the verified tenant balance without alterations to analysis rules.

---

## 4. Severity-Ranked Findings

| ID | Severity | Finding Description | Remediation Plan |
| :--- | :--- | :--- | :--- |
| **SEC-01** | **High** | **Fabricated Data in Billing UI:** `src/app/app/billing/page.tsx` renders fake invoices and card data, violating Rule 5. | Remove hardcoded tables in Phase 9; replace with server-backed `/api/v1/billing/invoices` or informative empty/disabled state. |
| **SEC-02** | **Medium** | **Client-Side Pricing Truth:** `pricing-tiers.ts` contains prices only in frontend code. | Create authoritative server-side plan catalog (`src/lib/server/billing/catalog.ts`) in Phase 1 with minor-unit integer pricing. |
| **SEC-03** | **Medium** | **Missing Billing RBAC:** `src/lib/server/auth/rbac.ts` lacks permissions for billing management. | Add `billing:view` and `billing:manage` (ADMIN only) in Phase 1. |
| **SEC-04** | **Low** | **Database Provider Mismatch:** Skill references PostgreSQL/Neon, while local development currently uses SQLite. | Support safe schema definitions compatible with both SQLite and PostgreSQL. |

---

## 5. Verification Commands & Test Evidence

The existing test suites were executed to verify baseline stability prior to any billing changes:

```bash
# 1. Auth & Multi-Tenant Security Suite
DATABASE_URL="file:./test.db" npm test
# Output: 101 PASSED, 0 FAILED (Exit Code: 0)

# 2. QC Job Bridge & Quota Concurrency Suite
DATABASE_URL="file:./test.db" npx tsx tests/qc-job-bridge.test.ts
# Output: 79 PASSED, 0 FAILED (Exit Code: 0)

# 3. TypeScript Typecheck
npm run typecheck
# Output: Found 0 errors (Exit Code: 0)
```

---

## 6. Proposed Phase Implementation Roadmap

* **Phase 1: Approve Billing Contract & Server Catalog**
  * Define server catalog (`src/lib/server/billing/catalog.ts`) with INR paise pricing.
  * Enforce `BILLING_STATUS=NOT_LIVE` feature flag.
  * Update RBAC permissions in `src/lib/server/auth/rbac.ts`.
* **Phase 2: Database Models & Migration**
  * Introduce Prisma models: `Order`, `Payment`, `WebhookInbox`, `EntitlementLedger`.
* **Phase 3: Domain Logic & Razorpay Provider Adapter**
  * Implement `RazorpayAdapter` (isolated, test-mode).
  * Server-side signature verification and idempotency handling.
* **Phase 4: API Contracts & Authorization**
  * Implement `/api/v1/billing/plans`, `/api/v1/billing/orders`, `/api/v1/billing/verify`.
* **Phase 5: Razorpay Hosted Checkout (Test Mode)**
  * Frontend integration with Razorpay Checkout modal (test keys only).
* **Phase 6: Durable Webhook Inbox & Processing**
  * Raw-body signature verification route (`/api/v1/webhooks/razorpay`).
* **Phase 7: Entitlement & Usage Ledger Integration**
  * Link payment capture to `Tenant.checkQuota` via atomic ledger.
* **Phase 8: Reconciliation & Runbook**
* **Phase 9: Frontend UX Cleanup**
  * Purge fake invoices; replace with real billing state.
* **Phase 10: Security Audit & Automated CI Runner**
* **Phase 11-13: Observability, Staging, & Release Review**

---

## 7. Gate 0 Review Table

| Criterion | Status | Evidence / Verification | Blocker |
| :--- | :--- | :--- | :--- |
| **Read-Only Audit Completed** | **PASS** | Repository thoroughly audited; 0 application files modified. | None |
| **Worktree State Recorded** | **PASS** | Commit `0e55fb1a741f84398d02d3d5f52ed3e1b8277f25`, branch `main`. | None |
| **Billing Remains NOT_LIVE** | **PASS** | No payment routes or live credentials exist. | None |
| **Zero Secret Exposure** | **PASS** | `.env` and `.env.local` untracked; no keys in source code. | None |
| **Existing QC Pipeline Protected** | **PASS** | 101 auth tests and 79 QC engine tests pass cleanly. | None |
| **User Plan Approval** | **PENDING** | Awaiting user review and approval before starting Phase 1. | Awaiting User Approval |
