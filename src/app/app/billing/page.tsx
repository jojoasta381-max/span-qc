"use client";

import React, { useState } from "react";
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
import { CreditCard, Download, CheckCircle2, ShieldCheck, ArrowRight, Clock } from "lucide-react";
import { INITIAL_QUOTA } from "@/lib/data/sample-data";

export default function BillingPage() {
  const quota = INITIAL_QUOTA;
  const [cancelNotice, setCancelNotice] = useState(false);

  const invoices = [
    { id: "INV-2026-009", date: "Oct 01, 2026", amount: "₹24,999", status: "PAID", checks: "120 Checks" },
    { id: "INV-2026-008", date: "Sep 01, 2026", amount: "₹24,999", status: "PAID", checks: "120 Checks" },
    { id: "INV-2026-007", date: "Aug 01, 2026", amount: "₹24,999", status: "PAID", checks: "120 Checks" },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1b253b] pb-5">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Subscription & Billing
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage your organization plan, payment methods, and historical tax invoices.
          </p>
        </div>

        <Link href="/pricing">
          <Button variant="outline" size="sm">
            Compare All Plans
          </Button>
        </Link>
      </div>

      {/* Current Plan Overview Card */}
      <div className="p-7 rounded-3xl bg-[#0c101a] border border-[#1b253b] shadow-2xl shadow-black/40">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-[#1b253b]">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider">
                CURRENT ACTIVE PLAN
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold">
                ACTIVE
              </span>
            </div>
            <h3 className="text-2xl font-extrabold text-white tracking-tight">Production Line Subscription</h3>
            <p className="text-xs text-slate-400 mt-1">
              120 diagram checks per month • Full IPC/WHMA-A-620 & UL 508A rule packages
            </p>
          </div>

          <div className="text-right">
            <div className="flex items-baseline gap-1 justify-end font-mono">
              <span className="text-3xl font-extrabold text-white">₹24,999</span>
              <span className="text-xs text-slate-400">/ month</span>
            </div>
            <span className="text-[11px] text-slate-500 font-mono block mt-1">
              Next billing date: Nov 01, 2026
            </span>
          </div>
        </div>

        {/* Quota in plan */}
        <div className="py-5 grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs">
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-mono">CHECKS INCLUDED</span>
            <span className="text-slate-200 font-semibold font-mono text-sm">120 Checks / Month</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-mono">CHECKS USED</span>
            <span className="text-cyan-400 font-semibold font-mono text-sm">38 Used (82 Remaining)</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-mono">OVERAGE RATE</span>
            <span className="text-slate-200 font-semibold font-mono text-sm">₹200 / Additional Check</span>
          </div>
        </div>

        <div className="pt-5 border-t border-[#1b253b] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <CreditCard className="w-4 h-4 text-cyan-400" />
            <span>MasterCard ending in 4242 (Expires 08/29)</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="xs">
              Update Card
            </Button>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setCancelNotice(true)}
              className="text-rose-400 hover:text-rose-300"
            >
              Cancel Subscription
            </Button>
          </div>
        </div>

        {cancelNotice && (
          <div className="mt-4 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
            Cancellation Notice: Your subscription will remain active until the end of your billing cycle on Oct 31, 2026.
          </div>
        )}
      </div>

      {/* Invoices Table */}
      <div>
        <h3 className="text-base font-bold text-white mb-3 tracking-tight">Invoice History</h3>
        <TableContainer>
          <Table>
            <TableHead>
              <tr>
                <TableHeader>Invoice ID</TableHeader>
                <TableHeader>Date</TableHeader>
                <TableHeader>Included Quota</TableHeader>
                <TableHeader>Amount</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader>Receipt</TableHeader>
              </tr>
            </TableHead>
            <TableBody>
              {invoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-mono text-cyan-400 font-bold">{inv.id}</TableCell>
                  <TableCell className="text-slate-300">{inv.date}</TableCell>
                  <TableCell className="font-mono text-slate-400">{inv.checks}</TableCell>
                  <TableCell className="font-mono text-white font-bold">{inv.amount}</TableCell>
                  <TableCell>
                    <Badge variant="result" result="PASS" size="xs">
                      {inv.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <button
                      className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Download PDF Invoice"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </div>
    </div>
  );
}
