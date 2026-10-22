/**
 * Authoritative Server-Side Plan Catalog & Billing Policy for SpanQC
 * 
 * Rules:
 * - All monetary amounts are integers in minor units (INR paise).
 * - Billing status defaults to NOT_LIVE.
 * - Client-supplied prices, currencies, and checks are strictly rejected.
 */

export interface ServerPlan {
  id: "starter" | "production" | "enterprise";
  name: string;
  tagline: string;
  amountPaise: number; // Integer in minor units (paise)
  currency: "INR";
  interval: "month" | "year";
  checksIncluded: number;
  overageRatePaise: number;
  isSelfServe: boolean;
  features: string[];
}

export const SERVER_PLAN_CATALOG: Record<string, ServerPlan> = {
  starter: {
    id: "starter",
    name: "Starter Engineering",
    tagline: "For small design teams & prototyping consultants",
    amountPaise: 999900, // ₹9,999.00
    currency: "INR",
    interval: "month",
    checksIncluded: 35,
    overageRatePaise: 28000, // ₹280.00
    isSelfServe: true,
    features: [
      "35 diagram checks included monthly",
      "Full IPC/WHMA-A-620 rules verification",
      "Interactive discrepancy split-screen viewer",
      "Sub-millimeter coordinate bounding overlays",
      "Standard PDF & Excel (.xlsx) QC reports",
      "Email engineering support (24h SLA)",
      "₹280 / additional check overage",
    ],
  },
  production: {
    id: "production",
    name: "Production Line",
    tagline: "For EMS manufacturers & wire harness production lines",
    amountPaise: 2499900, // ₹24,999.00
    currency: "INR",
    interval: "month",
    checksIncluded: 120,
    overageRatePaise: 20000, // ₹200.00
    isSelfServe: true,
    features: [
      "120 diagram checks included monthly",
      "Complete IPC-620 + UL 508A rule packages",
      "Coordinate bounding box evidence overlay",
      "Human sign-off & reviewer audit trails",
      "Multi-sheet Excel & PDF QC reports with hash verification",
      "Multi-seat team workspace (Admin, Engineer, Reviewer)",
      "Priority engineering support (4-hour SLA)",
      "₹200 / additional check overage",
    ],
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise Multi-Plant",
    tagline: "For aerospace contractors, automotive OEMs & defense orgs",
    amountPaise: 7500000, // ₹75,000.00 (base quote reference)
    currency: "INR",
    interval: "month",
    checksIncluded: 500,
    overageRatePaise: 15000, // ₹150.00
    isSelfServe: false, // Requires sales contact
    features: [
      "500+ diagram checks (custom volume quota)",
      "Custom proprietary SOP & manufacturing rule digitization",
      "Dedicated AWS VPC or On-Premise container deployment",
      "Zero model training on customer drawings",
      "Role-Based Access Control (Admin, Engineer, Reviewer)",
      "Dedicated Technical Account Manager & custom SLA",
      "Custom ERP/PLM webhooks & automated ingestion",
    ],
  },
};

export type BillingStatus = "NOT_LIVE" | "TEST" | "LIVE";

/**
 * Returns current server billing status.
 * Fails closed: defaults to NOT_LIVE if unset or unrecognized.
 */
export function getBillingStatus(): BillingStatus {
  const envStatus = process.env.BILLING_STATUS?.toUpperCase().trim();
  if (envStatus === "LIVE") return "LIVE";
  if (envStatus === "TEST") return "TEST";
  return "NOT_LIVE";
}

export function isBillingLive(): boolean {
  return getBillingStatus() === "LIVE";
}

export function isBillingTestMode(): boolean {
  return getBillingStatus() === "TEST";
}

export function isBillingEnabled(): boolean {
  return isBillingLive() || isBillingTestMode();
}

/**
 * Look up plan by ID. Returns null if invalid or not found.
 */
export function getPlan(planId: string): ServerPlan | null {
  if (!planId || typeof planId !== "string") return null;
  const clean = planId.toLowerCase().trim();
  return SERVER_PLAN_CATALOG[clean] || null;
}

/**
 * Returns self-serve plans safe for client display.
 */
export function getPublicPlanList() {
  return Object.values(SERVER_PLAN_CATALOG).map((plan) => ({
    id: plan.id,
    name: plan.name,
    tagline: plan.tagline,
    amountPaise: plan.amountPaise,
    amountINR: Math.round(plan.amountPaise / 100),
    currency: plan.currency,
    interval: plan.interval,
    checksIncluded: plan.checksIncluded,
    overageRateINR: Math.round(plan.overageRatePaise / 100),
    isSelfServe: plan.isSelfServe,
    features: plan.features,
  }));
}
