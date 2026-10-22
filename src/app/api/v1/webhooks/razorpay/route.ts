import { NextResponse } from "next/server";
import { processRazorpayWebhook } from "@/lib/server/billing/webhook-service";
import { PaymentSecurityError } from "@/lib/server/billing/razorpay";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    // 1. Read exact raw unparsed body bytes
    const rawBody = await request.text();
    const signature = request.headers.get("x-razorpay-signature") || "";

    if (!signature) {
      return NextResponse.json(
        { detail: "Missing required x-razorpay-signature header." },
        { status: 401 }
      );
    }

    const result = await processRazorpayWebhook({ rawBody, signature });
    return NextResponse.json({ status: "ok", result }, { status: 200 });
  } catch (err) {
    if (err instanceof PaymentSecurityError) {
      return NextResponse.json(
        { detail: err.message },
        { status: err.statusCode }
      );
    }
    console.error("[RAZORPAY_WEBHOOK_ERROR]", err);
    return NextResponse.json(
      { detail: "Webhook processing failure." },
      { status: 500 }
    );
  }
}
