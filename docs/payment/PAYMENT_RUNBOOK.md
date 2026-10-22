# SpanQC Payment Operations Runbook

**Document:** `docs/payment/PAYMENT_RUNBOOK.md`  
**Date:** 2026-10-17  
**Scope:** Operator standard operating procedures for billing, provider issues, webhooks, and reconciliation.

---

## 1. Safe Identification of Operating Mode

Check active mode without printing secrets:
```bash
node -e "console.log('Mode:', process.env.BILLING_STATUS || 'NOT_LIVE')"
```
* **`NOT_LIVE`:** Self-serve checkout disabled. No charges can occur.
* **`TEST`:** Razorpay Test Mode active (`rzp_test_*`). Synthetic card/UPI transactions only.
* **`LIVE`:** Production charges active (`rzp_live_*`). Requires explicit human sign-off on Gate 13.

---

## 2. Investigating Pending Payments

When a customer reports an incomplete checkout or order stuck in `PROVIDER_PENDING`:
1. Check order status in database via Prisma Studio or safe read query:
   ```bash
   npx prisma studio
   ```
2. Inspect the `Order` record and check associated `Payment` records.
3. Compare with Razorpay Dashboard using `order.providerOrderId`.
4. If payment is `captured` in Razorpay but local state is `PROVIDER_PENDING`:
   Run the reconciliation dry-run to identify the anomaly:
   ```bash
   node -e "import('./src/lib/server/billing/reconciliation.js').then(m => m.runPaymentReconciliation({ dryRun: true }))"
   ```

---

## 3. Webhook Replay & Manual Re-Processing

If webhooks were delayed or dropped during a network outage:
1. Fetch missed events from Razorpay Dashboard > Settings > Webhooks > Past Events.
2. Filter for event `payment.captured` or `order.paid`.
3. Click "Resend".
4. The endpoint `/api/v1/webhooks/razorpay` will receive the raw body, verify the cryptographic signature against `RAZORPAY_WEBHOOK_SECRET`, and process the event into `WebhookInbox`.
5. If the event was already processed, it will safely return `ALREADY_PROCESSED` without double crediting.

---

## 4. Emergency Kill Switch: Disabling Checkout Immediately

If provider anomalies, credential leakage, or billing errors occur:
1. Set environment variable:
   ```bash
   BILLING_STATUS=NOT_LIVE
   ```
2. Restart application container.
3. `/api/v1/billing/orders` will immediately reject all new order creations with `HTTP 403 (Billing is currently disabled)`.
4. The UI will render the prominent amber banner indicating billing is disabled.

---

## 5. Credential Rotation Procedure

1. Generate new API Key Pair in Razorpay Dashboard > Settings > API Keys.
2. In AWS Secrets Manager (or local environment), update:
   * `RAZORPAY_KEY_ID`
   * `RAZORPAY_KEY_SECRET`
   * `RAZORPAY_WEBHOOK_SECRET`
3. Restart application tasks.
4. Old keys can be revoked in Razorpay after confirming new keys are active.
5. Never commit rotated keys to version control.
