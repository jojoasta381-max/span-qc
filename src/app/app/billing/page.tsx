"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import {
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
} from "@/components/ui/Table";
import {
  CreditCard,
  Download,
  ShieldAlert,
  ArrowRight,
  Clock,
  Sparkles,
  RefreshCw,
  FileCheck2,
} from "lucide-react";
import { RazorpayCheckoutModal } from "@/components/billing/RazorpayCheckoutModal";

interface BillingSummary {
  billing_status: "NOT_LIVE" | "TEST" | "LIVE";
  is_billing_enabled: boolean;
  tenant: {
    id: string;
    name: string;
    plan: string;
    status: string;
    check_quota: number;
    quota_used: number;
    checks_remaining: number;
    percent_used: number;
  };
  orders: Array<{
    id: string;
    plan_id: string;
    amount_inr: number;
    currency: string;
    checks_included: number;
    status: string;
    created_at: string;
    payments: Array<{
      id: string;
      provider_payment_id: string | null;
      status: string;
      method: string | null;
      captured_at: string | null;
    }>;
  }>;
}

export default function BillingPage() {
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchSummary = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/billing/summary");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Failed to load billing summary.");
      }
      const data = await res.json();
      setSummary(data);
    } catch (err: any) {
      setError(err.message || "Failed to load billing details.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  return (
    <div className="space-y-6 pb-12 text-slate-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1b253b] pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-xl font-bold text-white tracking-tight">
              Subscription & Entitlements
            </h2>
            {summary && (
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase ${
                  summary.billing_status === "LIVE"
                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                    : summary.billing_status === "TEST"
                    ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30"
                    : "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                }`}
              >
                Mode: {summary.billing_status}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage organization QC diagram check quotas, plan entitlements, and authoritative ledger records.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchSummary}
            disabled={isLoading}
            className="border-slate-800 hover:bg-slate-900"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsModalOpen(true)}
            className="bg-cyan-500 hover:bg-cyan-400 text-black font-semibold"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            Upgrade Plan / Buy Checks
          </Button>
        </div>
      </div>

      {/* Disabled / Mode Alert */}
      {summary && summary.billing_status === "NOT_LIVE" && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 shrink-0 text-amber-400" />
            <div>
              <p className="font-semibold text-amber-200">Billing Environment is NOT_LIVE</p>
              <p className="text-[11px] text-amber-400/80 mt-0.5">
                Real customer charges are strictly disabled during development and audit. Only administrators can test checkout flows.
              </p>
            </div>
          </div>
          <Link href="/pricing" className="text-xs font-mono underline hover:text-amber-100 shrink-0">
            View Public Plans
          </Link>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5">
          <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Current Plan Overview Card */}
      {summary?.tenant && (
        <div className="p-7 rounded-3xl bg-[#0c101a] border border-[#1b253b] shadow-2xl shadow-black/40">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-[#1b253b]">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider">
                  ACTIVE ORGANIZATION PLAN
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold">
                  {summary.tenant.status}
                </span>
              </div>
              <h3 className="text-2xl font-extrabold text-white tracking-tight">
                {summary.tenant.plan === "PRODUCTION"
                  ? "Production Line Tier"
                  : summary.tenant.plan === "STARTER"
                  ? "Starter Engineering Tier"
                  : `${summary.tenant.plan} Tier`}
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Organization: <strong className="text-slate-300">{summary.tenant.name}</strong> • Authoritative server quota
              </p>
            </div>

            <div className="text-right">
              <div className="flex items-baseline gap-1 justify-end font-mono">
                <span className="text-3xl font-extrabold text-white">
                  {summary.tenant.plan === "STARTER" ? "₹9,999" : "₹24,999"}
                </span>
                <span className="text-xs text-slate-400">/ month</span>
              </div>
              <span className="text-[11px] text-slate-500 font-mono block mt-1">
                Active Quota: {summary.tenant.check_quota} Total Diagram Checks
              </span>
            </div>
          </div>

          {/* Quota in plan */}
          <div className="py-5 grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs">
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-mono">CHECKS ALLOCATED</span>
              <span className="text-slate-200 font-semibold font-mono text-sm">
                {summary.tenant.check_quota} Checks
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-mono">CHECKS CONSUMED</span>
              <span className="text-cyan-400 font-semibold font-mono text-sm">
                {summary.tenant.quota_used} Used ({summary.tenant.checks_remaining} Remaining)
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-mono">QUOTA UTILIZATION</span>
              <span className="text-slate-200 font-semibold font-mono text-sm">
                {summary.tenant.percent_used}% Consumed
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Historical Orders & Invoices Table */}
      <div className="rounded-3xl bg-[#0c101a] border border-[#1b253b] p-6 shadow-2xl shadow-black/40">
        <div className="flex items-center justify-between pb-4 border-b border-[#1b253b] mb-4">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
              Order & Transaction History
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Cryptographically verified billing order receipts and payment records.
            </p>
          </div>
        </div>

        {summary?.orders && summary.orders.length > 0 ? (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>Order ID</TableHeader>
                  <TableHeader>Date</TableHeader>
                  <TableHeader>Plan</TableHeader>
                  <TableHeader>Amount</TableHeader>
                  <TableHeader>Checks</TableHeader>
                  <TableHeader>Status</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {summary.orders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono text-xs text-cyan-400">
                      {order.id.slice(0, 18)}...
                    </TableCell>
                    <TableCell className="text-xs text-slate-400 font-mono">
                      {new Date(order.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-xs text-slate-200 capitalize">
                      {order.plan_id}
                    </TableCell>
                    <TableCell className="text-xs font-mono font-semibold text-white">
                      ₹{order.amount_inr.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-xs text-slate-300 font-mono">
                      +{order.checks_included} Checks
                    </TableCell>
                    <TableCell>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase ${
                          order.status === "PAID"
                            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                            : order.status === "FAILED"
                            ? "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                            : "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30"
                        }`}
                      >
                        {order.status}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <div className="py-12 text-center text-slate-500 text-xs">
            <FileCheck2 className="w-8 h-8 mx-auto mb-2 text-slate-600" />
            <p className="font-medium text-slate-400">No Historical Billing Transactions</p>
            <p className="text-[11px] text-slate-500 mt-1">
              When your organization upgrades plans or purchases additional checks, verified receipts appear here.
            </p>
          </div>
        )}
      </div>

      {/* Checkout Modal */}
      <RazorpayCheckoutModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          setIsModalOpen(false);
          fetchSummary();
        }}
        billingStatus={summary?.billing_status || "NOT_LIVE"}
        isBillingEnabled={summary?.is_billing_enabled || false}
      />
    </div>
  );
}
