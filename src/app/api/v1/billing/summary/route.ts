import { NextResponse } from "next/server";
import { extractRequestAuth, validateDBSession } from "@/lib/server/auth/session";
import { hasPermission } from "@/lib/server/auth/rbac";
import { db } from "@/lib/server/db";
import { getBillingStatus, isBillingEnabled } from "@/lib/server/billing/catalog";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = extractRequestAuth(request);
  if (!auth.token) {
    return NextResponse.json(
      { detail: "Authentication required." },
      { status: 401 }
    );
  }

  const session = await validateDBSession(auth.token);
  if (!session) {
    return NextResponse.json(
      { detail: "Authentication required." },
      { status: 401 }
    );
  }

  // All roles (ADMIN, ENGINEER, REVIEWER) can view billing summary
  if (!hasPermission(session.user.role, "billing:view")) {
    return NextResponse.json(
      { detail: "Forbidden: Access to billing summary denied." },
      { status: 403 }
    );
  }

  const tenantId = session.tenantId;

  // Fetch real tenant info
  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      name: true,
      plan: true,
      checkQuota: true,
      quotaUsed: true,
      status: true,
    },
  });

  if (!tenant) {
    return NextResponse.json(
      { detail: "Tenant organization not found." },
      { status: 404 }
    );
  }

  // Fetch real historical orders
  const orders = await db.order.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      planId: true,
      amountPaise: true,
      currency: true,
      checksIncluded: true,
      status: true,
      providerOrderId: true,
      createdAt: true,
      payments: {
        select: {
          id: true,
          providerPaymentId: true,
          status: true,
          paymentMethod: true,
          capturedAt: true,
        },
      },
    },
  });

  const formattedOrders = orders.map((o) => ({
    id: o.id,
    plan_id: o.planId,
    amount_inr: Math.round(o.amountPaise / 100),
    currency: o.currency,
    checks_included: o.checksIncluded,
    status: o.status,
    created_at: o.createdAt.toISOString(),
    payments: o.payments.map((p) => ({
      id: p.id,
      provider_payment_id: p.providerPaymentId,
      status: p.status,
      method: p.paymentMethod,
      captured_at: p.capturedAt?.toISOString() || null,
    })),
  }));

  const checksRemaining = Math.max(0, tenant.checkQuota - tenant.quotaUsed);
  const percentUsed = tenant.checkQuota > 0 ? Math.min(100, Math.round((tenant.quotaUsed / tenant.checkQuota) * 100)) : 0;

  return NextResponse.json({
    billing_status: getBillingStatus(),
    is_billing_enabled: isBillingEnabled(),
    tenant: {
      id: tenant.id,
      name: tenant.name,
      plan: tenant.plan,
      status: tenant.status,
      check_quota: tenant.checkQuota,
      quota_used: tenant.quotaUsed,
      checks_remaining: checksRemaining,
      percent_used: percentUsed,
    },
    orders: formattedOrders,
  });
}
