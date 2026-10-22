# SpanQC Payment System Threat Model

**Document:** `docs/payment/PAYMENT_THREAT_MODEL.md`  
**Date:** 2026-10-17  
**Framework:** STRIDE-based Security Threat Model for SpanQC Billing

---

## Threat Matrix & Mitigation Defenses

| Threat ID | Threat Category | Attack Vector | SpanQC Defense & Invariant | Verification Status |
| :--- | :--- | :--- | :--- | :---: |
| **THREAT-01** | **Tampering** | Attacker tampers with price/currency/checks in client order request. | Client submits only `planId`. Server-owned catalog (`catalog.ts`) supplies authoritative minor-unit price. | **PASS** (Tested in `tests/payment-system.test.ts`) |
| **THREAT-02** | **Elevation** | Non-admin user (Reviewer or Engineer) calls order creation API. | RBAC permission check enforces `billing:manage` (ADMIN only); Reviewers/Engineers get HTTP 403. | **PASS** (Tested via RBAC assertions) |
| **THREAT-03** | **Spoofing** | Attacker passes another organization's `tenantId` in request body. | All client-supplied tenant headers/bodies ignored. Tenant ID derived exclusively from verified session. | **PASS** (Tested in IDOR suites) |
| **THREAT-04** | **Tampering** | Attacker forges checkout return signature to fake payment. | Backend verifies HMAC-SHA256 signature against `RAZORPAY_KEY_SECRET` using `timingSafeEqual`. Failed signature stores FAILED payment and blocks entitlement. | **PASS** (Tested in `VERIFY-01`) |
| **THREAT-05** | **Replay** | Attacker replays valid checkout callback or webhook event. | Idempotency checks and `providerEventId` unique constraint reject replays; returns `alreadyVerified` or `ALREADY_PROCESSED` without double crediting. | **PASS** (Tested in `VERIFY-03`, `WEBHOOK-02`) |
| **THREAT-06** | **Tampering** | Attacker sends webhook with altered JSON payload. | Raw unparsed body captured (`request.text()`); HMAC-SHA256 signature verified against `RAZORPAY_WEBHOOK_SECRET`. Invalid signature rejected with HTTP 401. | **PASS** (Tested in `WEBHOOK-01`) |
| **THREAT-07** | **Denial of Service** | Concurrent requests racing to claim quotas or double credit. | Interactive transactions (`db.$transaction`) serialize updates and check status atomically. | **PASS** (Tested in Quota & Bridge suites) |
| **THREAT-08** | **Information Disclosure** | Secret keys leaked in client-side bundles or errors. | Secret keys reside in server-only modules (`razorpay.ts`); client receives only `checkoutPayload` with public `keyId`. No secrets in logs or git. | **PASS** (Verified by audit script `SEC-01` to `SEC-03`) |
| **THREAT-09** | **Configuration Drift** | Accidental live charges during development/testing. | `BILLING_STATUS` defaults to `NOT_LIVE`. Hard gate blocks order creation unless explicitly set to `TEST` or `LIVE`. | **PASS** (Tested in `BILLING-01`) |
