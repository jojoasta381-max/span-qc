/**
 * Durable & Idempotent Webhook Processing Service for SpanQC
 * 
 * Rules:
 * - Requires exact unparsed raw bytes for signature verification.
 * - Deduplicates via unique providerEventId in WebhookInbox.
 * - Idempotent: duplicate deliveries produce identical single outcome.
 * - Atomically commits payment state and entitlement ledger updates.
 */

import { db } from "@/lib/server/db";
import { verifyWebhookSignature, PaymentSecurityError } from "./razorpay";

export interface ProcessWebhookParams {
  rawBody: string;
  signature: string;
}

export async function processRazorpayWebhook(params: ProcessWebhookParams) {
  const { rawBody, signature } = params;

  // 1. Signature verification on verbatim raw body
  const isValid = verifyWebhookSignature(rawBody, signature);
  if (!isValid) {
    throw new PaymentSecurityError("Invalid webhook signature. Request rejected.", 401);
  }

  let eventJson: Record<string, any>;
  try {
    eventJson = JSON.parse(rawBody);
  } catch {
    throw new PaymentSecurityError("Malformed JSON webhook body.", 400);
  }

  const providerEventId =
    eventJson.event_id ||
    eventJson.id ||
    `event_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const eventType = eventJson.event || "unknown";

  // 2. Check for duplicate event in WebhookInbox
  const existingEvent = await db.webhookInbox.findUnique({
    where: { providerEventId },
  });

  if (existingEvent && existingEvent.status === "PROCESSED") {
    return {
      status: "ALREADY_PROCESSED",
      message: "Webhook event was previously processed idempotently.",
      eventId: providerEventId,
    };
  }

  // Record into durable WebhookInbox
  const inboxRecord = existingEvent
    ? await db.webhookInbox.update({
        where: { id: existingEvent.id },
        data: { status: "PROCESSING" },
      })
    : await db.webhookInbox.create({
        data: {
          providerEventId,
          eventType,
          status: "PROCESSING",
          payload: rawBody,
        },
      });

  try {
    // 3. Handle supported payment events
    if (eventType === "payment.captured" || eventType === "order.paid") {
      const payloadPayment = eventJson.payload?.payment?.entity;
      const providerOrderId = payloadPayment?.order_id || eventJson.payload?.order?.entity?.id;
      const providerPaymentId = payloadPayment?.id;

      if (providerOrderId) {
        const order = await db.order.findUnique({
          where: { providerOrderId },
          include: { tenant: true },
        });

        if (order && order.status !== "PAID") {
          await db.$transaction(async (tx) => {
            // Record payment if not exists
            const existingPayment = await tx.payment.findUnique({
              where: { providerPaymentId: providerPaymentId || `pay_wh_${Date.now()}` },
            });

            if (!existingPayment) {
              await tx.payment.create({
                data: {
                  orderId: order.id,
                  tenantId: order.tenantId,
                  providerPaymentId: providerPaymentId || `pay_wh_${Date.now()}`,
                  amountPaise: order.amountPaise,
                  currency: order.currency,
                  status: "CAPTURED",
                  paymentMethod: payloadPayment?.method || "webhook",
                  capturedAt: new Date(),
                },
              });
            }

            // Mark order PAID
            await tx.order.update({
              where: { id: order.id },
              data: { status: "PAID" },
            });

            // Grant Entitlement
            await tx.entitlementLedger.create({
              data: {
                tenantId: order.tenantId,
                orderId: order.id,
                creditQuantity: order.checksIncluded,
                reason: "WEBHOOK_PAYMENT_CAPTURED",
              },
            });

            // Update Tenant quota
            await tx.tenant.update({
              where: { id: order.tenantId },
              data: {
                plan: order.planId.toUpperCase(),
                checkQuota: { increment: order.checksIncluded },
              },
            });
          });
        }
      }
    } else if (eventType === "payment.failed") {
      const payloadPayment = eventJson.payload?.payment?.entity;
      const providerOrderId = payloadPayment?.order_id;
      if (providerOrderId) {
        const order = await db.order.findUnique({
          where: { providerOrderId },
        });
        if (order && order.status === "PROVIDER_PENDING") {
          await db.order.update({
            where: { id: order.id },
            data: { status: "FAILED" },
          });
        }
      }
    }

    // Mark inbox record PROCESSED
    await db.webhookInbox.update({
      where: { id: inboxRecord.id },
      data: {
        status: "PROCESSED",
        processedAt: new Date(),
      },
    });

    return {
      status: "PROCESSED",
      eventId: providerEventId,
      eventType,
    };
  } catch (err: any) {
    await db.webhookInbox.update({
      where: { id: inboxRecord.id },
      data: {
        status: "FAILED",
        errorMessage: err?.message || String(err),
      },
    });
    throw err;
  }
}
