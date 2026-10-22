import { NextResponse } from "next/server";
import { extractRequestAuth, validateDBSession } from "@/lib/server/auth/session";
import { validateOrigin } from "@/lib/server/auth/csrf";
import { hasPermission } from "@/lib/server/auth/rbac";
import { createBillingOrder, OrderServiceError } from "@/lib/server/billing/order-service";

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

  // 2. CSRF Guard: Validate Origin/Referer on cookie-authenticated mutating requests
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

  // 3. RBAC: Only ADMINs with "billing:manage" can initiate orders
  if (!hasPermission(session.user.role, "billing:manage")) {
    return NextResponse.json(
      { detail: "Forbidden: Only organization administrators can manage billing and initiate purchases." },
      { status: 403 }
    );
  }

  // 4. Derive tenant identity exclusively from session (prevent tenant spoofing)
  const tenantId = session.tenantId;
  const userId = session.user.id;

  try {
    const body = await request.json().catch(() => ({}));
    const planId = typeof body.planId === "string" ? body.planId.trim() : "";
    if (!planId) {
      return NextResponse.json(
        { detail: "Plan ID is required." },
        { status: 400 }
      );
    }

    const idempotencyKey =
      request.headers.get("idempotency-key") ||
      (typeof body.idempotencyKey === "string" ? body.idempotencyKey.trim() : undefined);

    const result = await createBillingOrder({
      tenantId,
      userId,
      planId,
      idempotencyKey,
    });

    return NextResponse.json(
      {
        order: {
          id: result.order.id,
          plan_id: result.order.planId,
          amount_paise: result.order.amountPaise,
          amount_inr: Math.round(result.order.amountPaise / 100),
          currency: result.order.currency,
          checks_included: result.order.checksIncluded,
          status: result.order.status,
          provider_order_id: result.order.providerOrderId,
          is_duplicate: result.isDuplicate,
        },
        checkout: result.checkoutPayload,
      },
      { status: result.isDuplicate ? 200 : 201 }
    );
  } catch (err) {
    if (err instanceof OrderServiceError) {
      return NextResponse.json(
        { detail: err.message },
        { status: err.statusCode }
      );
    }
    console.error("[BILLING_ORDER_CREATE_ERROR]", err);
    return NextResponse.json(
      { detail: "Failed to create billing order." },
      { status: 500 }
    );
  }
}
