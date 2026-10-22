/**
 * Billing Order & Entitlement Management Service for SpanQC
 * 
 * Rules:
 * - Server owns prices and entitlements; client tampering is strictly rejected.
 * - Tenant identity is derived exclusively from authenticated session.
 * - Idempotent order creation and atomic state transitions inside db.$transaction.
 * - Access is granted ONLY after cryptographic signature verification and database persistence.
 */

import { db } from "@/lib/server/db";
import { getPlan, isBillingEnabled, isBillingTestMode } from "./catalog";
import {
  createRazorpayOrder,
  verifyCheckoutSignature,
  getRazorpayCredentials,
  PaymentSecurityError,
} from "./razorpay";

export interface CreateOrderInput {
  tenantId: string;
  userId: string;
  planId: string;
  idempotencyKey?: string;
}

export interface VerifyPaymentInput {
  tenantId: string;
  orderId: string;
  providerPaymentId: string;
  providerOrderId: string;
  signature: string;
  paymentMethod?: string;
}

export class OrderServiceError extends Error {
  constructor(message: string, public statusCode: number = 400) {
    super(message);
    this.name = "OrderServiceError";
  }
}

/**
 * Creates an internal order and corresponding Razorpay provider order.
 * Strictly verifies plan existence and idempotency.
 */
export async function createBillingOrder(input: CreateOrderInput) {
  const { tenantId, userId, planId, idempotencyKey } = input;

  if (!isBillingEnabled()) {
    throw new OrderServiceError(
      "Billing is currently disabled (NOT_LIVE). No charges can be initiated.",
      403
    );
  }

  // 1. Authoritative plan lookup
  const plan = getPlan(planId);
  if (!plan) {
    throw new OrderServiceError(`Invalid or unrecognized plan: "${planId}".`, 400);
  }
  if (!plan.isSelfServe) {
    throw new OrderServiceError(
      `Plan "${plan.name}" requires custom enterprise agreement. Contact engineering sales.`,
      400
    );
  }

  // 2. Validate tenant & user status
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, status: true, name: true },
  });
  if (!tenant || tenant.status !== "ACTIVE") {
    throw new OrderServiceError("Tenant organization is inactive or not found.", 403);
  }

  const cleanIdempotencyKey =
    idempotencyKey && typeof idempotencyKey === "string" && idempotencyKey.trim().length > 0
      ? idempotencyKey.trim().slice(0, 128)
      : null;

  // 3. Check for existing idempotent order
  if (cleanIdempotencyKey) {
    const existing = await db.order.findUnique({
      where: {
        tenantId_idempotencyKey: {
          tenantId,
          idempotencyKey: cleanIdempotencyKey,
        },
      },
    });

    if (existing) {
      const { keyId } = getRazorpayCredentials();
      return {
        order: existing,
        isDuplicate: true,
        checkoutPayload: {
          key: keyId || "rzp_test_key",
          amount: existing.amountPaise,
          currency: existing.currency,
          name: "SpanQC Quality Control",
          description: `${plan.name} (${existing.checksIncluded} checks)`,
          order_id: existing.providerOrderId,
          prefill: {},
          theme: { color: "#06b6d4" },
        },
      };
    }
  }

  // 4. Create internal order record in CREATED state
  const internalOrder = await db.order.create({
    data: {
      tenantId,
      userId,
      planId: plan.id,
      amountPaise: plan.amountPaise,
      currency: plan.currency,
      checksIncluded: plan.checksIncluded,
      idempotencyKey: cleanIdempotencyKey,
      status: "CREATED",
      metadata: JSON.stringify({
        planName: plan.name,
        initiatedAt: new Date().toISOString(),
      }),
    },
  });

  // 5. Create provider order via Razorpay adapter
  let providerOrder;
  try {
    providerOrder = await createRazorpayOrder({
      amountPaise: plan.amountPaise,
      currency: plan.currency,
      receipt: `rcpt_${internalOrder.id.slice(0, 20)}`,
      notes: {
        tenantId,
        orderId: internalOrder.id,
        planId: plan.id,
      },
    });
  } catch (err) {
    await db.order.update({
      where: { id: internalOrder.id },
      data: { status: "FAILED" },
    });
    throw err;
  }

  // 6. Update internal order with provider ID and transition to PROVIDER_PENDING
  const updatedOrder = await db.order.update({
    where: { id: internalOrder.id },
    data: {
      providerOrderId: providerOrder.providerOrderId,
      status: "PROVIDER_PENDING",
    },
  });

  const { keyId } = getRazorpayCredentials();

  return {
    order: updatedOrder,
    isDuplicate: false,
    checkoutPayload: {
      key: keyId || "rzp_test_key",
      amount: updatedOrder.amountPaise,
      currency: updatedOrder.currency,
      name: "SpanQC Quality Control",
      description: `${plan.name} (${updatedOrder.checksIncluded} checks)`,
      order_id: updatedOrder.providerOrderId,
      prefill: {},
      theme: { color: "#06b6d4" },
    },
  };
}

/**
 * Cryptographically verifies Razorpay checkout return and atomically grants entitlements.
 */
export async function verifyPaymentAndGrantEntitlement(input: VerifyPaymentInput) {
  const {
    tenantId,
    orderId,
    providerPaymentId,
    providerOrderId,
    signature,
    paymentMethod = "card",
  } = input;

  // 1. Fetch order and verify tenant ownership
  const order = await db.order.findFirst({
    where: { id: orderId, tenantId },
    include: { tenant: true },
  });

  if (!order) {
    throw new OrderServiceError("Order not found or access denied for this tenant.", 404);
  }

  if (order.status === "PAID") {
    // Already verified and granted
    return {
      success: true,
      alreadyVerified: true,
      order,
      message: "Order was already verified and entitlements granted.",
    };
  }

  if (order.providerOrderId !== providerOrderId) {
    throw new OrderServiceError("Provider order ID mismatch. Potential tampering detected.", 400);
  }

  // 2. Cryptographic signature verification
  const isValidSignature = verifyCheckoutSignature({
    providerOrderId,
    providerPaymentId,
    signature,
  });

  if (!isValidSignature) {
    try {
      await db.payment.create({
        data: {
          orderId: order.id,
          tenantId,
          providerPaymentId,
          amountPaise: order.amountPaise,
          currency: order.currency,
          status: "FAILED",
          errorMessage: "Cryptographic signature verification failed.",
        },
      });
    } catch {
      // Ignore unique constraint if providerPaymentId already recorded
    }

    throw new OrderServiceError(
      "Payment verification failed: invalid signature. Entitlement was NOT granted.",
      400
    );
  }

  // 3. Atomically record payment, transition order, and grant entitlement
  const result = await db.$transaction(async (tx) => {
    // Record Payment
    const payment = await tx.payment.create({
      data: {
        orderId: order.id,
        tenantId,
        providerPaymentId,
        amountPaise: order.amountPaise,
        currency: order.currency,
        status: "CAPTURED",
        paymentMethod,
        capturedAt: new Date(),
      },
    });

    // Transition Order to PAID
    const paidOrder = await tx.order.update({
      where: { id: order.id },
      data: {
        status: "PAID",
      },
    });

    // Record Entitlement Ledger
    const entitlement = await tx.entitlementLedger.create({
      data: {
        tenantId,
        orderId: order.id,
        creditQuantity: order.checksIncluded,
        reason: "PLAN_PURCHASE",
        effectiveFrom: new Date(),
      },
    });

    // Update Tenant checkQuota and plan
    const updatedTenant = await tx.tenant.update({
      where: { id: tenantId },
      data: {
        plan: order.planId.toUpperCase(),
        checkQuota: { increment: order.checksIncluded },
      },
    });

    return {
      payment,
      paidOrder,
      entitlement,
      updatedTenant,
    };
  });

  return {
    success: true,
    alreadyVerified: false,
    order: result.paidOrder,
    payment: result.payment,
    checksGranted: order.checksIncluded,
    newQuotaTotal: result.updatedTenant.checkQuota,
    message: `Payment verified. ${order.checksIncluded} checks successfully credited to organization.`,
  };
}
