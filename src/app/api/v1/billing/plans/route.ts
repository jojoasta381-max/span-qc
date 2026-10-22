import { NextResponse } from "next/server";
import { getPublicPlanList, getBillingStatus, isBillingEnabled } from "@/lib/server/billing/catalog";

export const dynamic = "force-dynamic";

export async function GET() {
  const plans = getPublicPlanList();
  const billingStatus = getBillingStatus();
  const isEnabled = isBillingEnabled();

  return NextResponse.json({
    billing_status: billingStatus,
    is_billing_enabled: isEnabled,
    currency: "INR",
    plans,
  });
}
