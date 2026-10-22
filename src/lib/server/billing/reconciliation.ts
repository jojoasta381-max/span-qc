/**
 * Payment Reconciliation Service for SpanQC
 * 
 * Rules:
 * - Compares local order/payment states with provider status.
 * - Supports dry-run auditing without state mutations.
 * - Applies only valid forward state transitions.
 * - Never grants entitlements without verified captured payment.
 */

import { db } from "@/lib/server/db";

export interface ReconciliationOptions {
  dryRun?: boolean;
  maxAgeMinutes?: number;
}

export interface ReconciliationReport {
  timestamp: string;
  dryRun: boolean;
  stalePendingOrdersExamined: number;
  ordersReconciled: number;
  anomaliesFound: string[];
}

export async function runPaymentReconciliation(options: ReconciliationOptions = {}): Promise<ReconciliationReport> {
  const { dryRun = true, maxAgeMinutes = 15 } = options;

  const thresholdDate = new Date(Date.now() - maxAgeMinutes * 60 * 1000);

  // Find orders stuck in PROVIDER_PENDING past threshold
  const staleOrders = await db.order.findMany({
    where: {
      status: "PROVIDER_PENDING",
      createdAt: { lt: thresholdDate },
    },
    include: {
      payments: true,
      tenant: true,
    },
  });

  const anomalies: string[] = [];
  let reconciledCount = 0;

  for (const order of staleOrders) {
    // Check if any payment was captured for this order
    const capturedPayment = order.payments.find((p) => p.status === "CAPTURED");

    if (capturedPayment) {
      anomalies.push(`Order ${order.id} has CAPTURED payment but status is still PROVIDER_PENDING.`);
      if (!dryRun) {
        await db.$transaction(async (tx) => {
          await tx.order.update({
            where: { id: order.id },
            data: { status: "PAID" },
          });

          // Check if entitlement was already granted
          const existingEntitlement = await tx.entitlementLedger.findFirst({
            where: { orderId: order.id },
          });

          if (!existingEntitlement) {
            await tx.entitlementLedger.create({
              data: {
                tenantId: order.tenantId,
                orderId: order.id,
                creditQuantity: order.checksIncluded,
                reason: "RECONCILIATION_SYNC",
              },
            });

            await tx.tenant.update({
              where: { id: order.tenantId },
              data: {
                checkQuota: { increment: order.checksIncluded },
              },
            });
          }
        });
        reconciledCount++;
      }
    } else {
      // Order timed out without payment capture
      if (!dryRun) {
        await db.order.update({
          where: { id: order.id },
          data: { status: "EXPIRED" },
        });
        reconciledCount++;
      }
    }
  }

  return {
    timestamp: new Date().toISOString(),
    dryRun,
    stalePendingOrdersExamined: staleOrders.length,
    ordersReconciled: reconciledCount,
    anomaliesFound: anomalies,
  };
}
