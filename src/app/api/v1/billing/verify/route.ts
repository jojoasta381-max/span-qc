import { NextResponse } from "next/server";
import { extractRequestAuth, validateDBSession } from "@/lib/server/auth/session";
import { validateOrigin } from "@/lib/server/auth/csrf";
import { hasPermission } from "@/lib/server/auth/rbac";
import { verifyPaymentAndGrantEntitlement, OrderServiceError } from "@/lib/server/billing/order-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  // 1. Authenticate server-side
  const auth = extractRequestAuth(request);
  if (!auth.token) {
    return NextResponse.json(
      { detail: "Authentication required." },
      { status: 401 }
    );
  }

  // 2. CSRF Guard
  if (auth.authType === "cookie" && !validateOrigin(request)) {
    return NextResponse.json(
      { detail: "Cross-origin request blocked." },
      { status: 403 }
    );
  }

  const session = await validateDBSession(auth.token);
  if (!session) {
    return NextResponse.json(
      { detail: "Authentication required." },
      { status: 401 }
    );
  }

  // 3. RBAC: Only ADMINs with "billing:manage" can verify and credit orders
  if (!hasPermission(session.user.role, "billing:manage")) {
    return NextResponse.json(
      { detail: "Forbidden: Only organization administrators can verify billing transactions." },
      { status: 403 }
    );
  }

  const tenantId = session.tenantId;

  try {
    const body = await request.json().catch(() => ({}));
    const { orderId, providerPaymentId, providerOrderId, signature, paymentMethod } = body;

    if (!orderId || !providerPaymentId || !providerOrderId || !signature) {
      return NextResponse.json(
        { detail: "Missing required payment verification parameters (orderId, providerPaymentId, providerOrderId, signature)." },
        { status: 400 }
      );
    }

    const result = await verifyPaymentAndGrantEntitlement({
      tenantId,
      orderId: String(orderId).trim(),
      providerPaymentId: String(providerPaymentId).trim(),
      providerOrderId: String(providerOrderId).trim(),
      signature: String(signature).trim(),
      paymentMethod: typeof paymentMethod === "string" ? paymentMethod.trim() : undefined,
    });

    return NextResponse.json({
      success: result.success,
      already_verified: result.alreadyVerified,
      checks_granted: result.checksGranted,
      new_quota_total: result.newQuotaTotal,
      message: result.message,
    });
  } catch (err) {
    if (err instanceof OrderServiceError) {
      return NextResponse.json(
        { detail: err.message },
        { status: err.statusCode }
      );
    }
    console.error("[BILLING_VERIFY_ERROR]", err);
    return NextResponse.json(
      { detail: "Failed to verify payment." },
      { status: 500 }
    );
  }
}
