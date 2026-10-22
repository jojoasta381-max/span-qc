"use client";

import React, { useState } from "react";
import { Check, Zap, Shield, Sparkles, HelpCircle, ArrowRight, Building, ShieldCheck } from "lucide-react";
import { SERVER_PLAN_CATALOG } from "@/lib/server/billing/catalog";

interface BillingCardsSectionProps {
  onSelectPlan?: (planId: "starter" | "production" | "enterprise") => void;
  onRequestDemo?: () => void;
}

export function BillingCardsSection({ onSelectPlan, onRequestDemo }: BillingCardsSectionProps) {
  const [billingInterval, setBillingInterval] = useState<"month" | "year">("month");

  // Format pricing values from authoritative catalog
  const starter = SERVER_PLAN_CATALOG.starter;
  const production = SERVER_PLAN_CATALOG.production;

  const starterMonthly = starter.amountPaise / 100; // 9,999
  const starterAnnualMonthly = Math.round(starterMonthly * 0.8); // 7,999 (20% off)

  const prodMonthly = production.amountPaise / 100; // 24,999
  const prodAnnualMonthly = Math.round(prodMonthly * 0.8); // 19,999 (20% off)

  return (
    <section className="relative w-full py-28 md:py-36 bg-[#060811] text-[#eaf1ff] border-t border-white/5 overflow-hidden" id="pricing">
      {/* Background Lighting Elements */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[radial-gradient(ellipse_at_top,rgba(47,140,255,0.12)_0%,transparent_70%)] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[300px] bg-[radial-gradient(ellipse_at_bottom,rgba(0,240,255,0.06)_0%,transparent_70%)] pointer-events-none" />

      <div className="relative z-10 max-w-[1360px] mx-auto px-6 sm:px-8 lg:px-12">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[rgba(47,140,255,0.1)] border border-[rgba(47,140,255,0.3)] mb-4">
            <Sparkles className="w-3.5 h-3.5 text-[#2f8cff]" />
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#2f8cff]">
              Simple, Transparent Pricing
            </span>
          </div>

          <h2 className="text-[clamp(32px,4vw,52px)] font-bold tracking-tight text-[#eaf1ff] leading-[1.12] mb-5">
            Predictable Plans for Engineering & High-Mix Production
          </h2>

          <p className="text-[17px] leading-relaxed text-[#a9b8d3] mb-8">
            Choose the verification capacity tailored for your shop. All plans include automated IPC/WHMA-A-620 rule checking,
            sub-millimeter bounding overlays, and PDF/Excel export.
          </p>

          {/* Monthly / Annual Toggle */}
          <div className="inline-flex items-center p-1.5 rounded-2xl bg-[#0b1428] border border-[rgba(80,130,220,0.25)] shadow-inner">
            <button
              type="button"
              onClick={() => setBillingInterval("month")}
              className={`px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                billingInterval === "month"
                  ? "bg-[#2f8cff] text-[#05101f] shadow-[0_4px_16px_rgba(47,140,255,0.35)]"
                  : "text-[#a9b8d3] hover:text-[#eaf1ff]"
              }`}
            >
              Monthly Billing
            </button>
            <button
              type="button"
              onClick={() => setBillingInterval("year")}
              className={`px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center gap-2 ${
                billingInterval === "year"
                  ? "bg-[#2f8cff] text-[#05101f] shadow-[0_4px_16px_rgba(47,140,255,0.35)]"
                  : "text-[#a9b8d3] hover:text-[#eaf1ff]"
              }`}
            >
              <span>Annual Billing</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#1ed6a0] text-[#05101f]">
                Save 20%
              </span>
            </button>
          </div>
        </div>

        {/* 3 Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch mb-16">
          {/* Card 1: Starter Engineering */}
          <div className="relative flex flex-col justify-between p-8 rounded-3xl bg-[#091224]/75 border border-[rgba(80,130,220,0.25)] backdrop-blur-xl hover:border-[rgba(47,140,255,0.4)] transition-all duration-300 hover:shadow-[0_12px_40px_rgba(0,0,0,0.5)]">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-[#7f93b8]">
                  Design & Prototyping
                </span>
                <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-white/5 text-[#a9b8d3]">
                  Single Seat
                </span>
              </div>

              <h3 className="text-2xl font-bold text-[#eaf1ff] mb-2">{starter.name}</h3>
              <p className="text-xs text-[#a9b8d3] mb-6 leading-relaxed min-h-[36px]">{starter.tagline}</p>

              {/* Price */}
              <div className="mb-6 pb-6 border-b border-white/10">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-extrabold text-[#eaf1ff] font-mono">
                    ₹{billingInterval === "month" ? starterMonthly.toLocaleString("en-IN") : starterAnnualMonthly.toLocaleString("en-IN")}
                  </span>
                  <span className="text-sm text-[#7f93b8]">/ month</span>
                </div>
                <div className="text-xs text-[#1ed6a0] mt-1.5 flex items-center gap-1 font-mono">
                  <span>35 checks included</span>
                  <span className="text-[#7f93b8]">(~₹286 / diagram)</span>
                </div>
                {billingInterval === "year" && (
                  <div className="text-[11px] text-[#7f93b8] mt-1">
                    Billed annually (₹{(starterAnnualMonthly * 12).toLocaleString("en-IN")}/yr)
                  </div>
                )}
              </div>

              {/* Feature Checklist */}
              <div className="flex flex-col gap-3.5 mb-8">
                <span className="text-xs font-semibold text-[#eaf1ff] uppercase tracking-wider">
                  Everything included:
                </span>
                {starter.features.map((feat, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 text-xs text-[#a9b8d3]">
                    <Check className="w-4 h-4 text-[#2f8cff] shrink-0 mt-0.5" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => onSelectPlan ? onSelectPlan("starter") : onRequestDemo?.()}
              className="w-full py-3.5 px-4 rounded-xl text-sm font-semibold bg-white/10 hover:bg-white/15 text-[#eaf1ff] border border-white/15 transition-all cursor-pointer flex items-center justify-center gap-2 group"
            >
              <span>Get Started</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          {/* Card 2: Production Line (FEATURED / MOST POPULAR) */}
          <div className="relative flex flex-col justify-between p-8 rounded-3xl bg-[#0b162e]/75 border-2 border-[#00f0ff] shadow-[0_0_40px_rgba(0,240,255,0.22)] backdrop-blur-2xl scale-[1.02] md:-translate-y-2 transition-all duration-300">
            {/* Top Glow Badge */}
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-[#00f0ff] to-[#2f8cff] text-[#05101f] text-xs font-bold uppercase tracking-wider shadow-[0_0_20px_rgba(0,240,255,0.6)] flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 fill-current" />
              Most Popular for Harness Shops
            </div>

            <div>
              <div className="flex items-center justify-between mb-4 mt-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#00f0ff]">
                  High-Mix Production
                </span>
                <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/30">
                  Multi-Seat (3 Roles)
                </span>
              </div>

              <h3 className="text-2xl font-bold text-[#eaf1ff] mb-2">{production.name}</h3>
              <p className="text-xs text-[#a9b8d3] mb-6 leading-relaxed min-h-[36px]">{production.tagline}</p>

              {/* Price */}
              <div className="mb-6 pb-6 border-b border-white/15">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-extrabold text-[#00f0ff] font-mono">
                    ₹{billingInterval === "month" ? prodMonthly.toLocaleString("en-IN") : prodAnnualMonthly.toLocaleString("en-IN")}
                  </span>
                  <span className="text-sm text-[#7f93b8]">/ month</span>
                </div>
                <div className="text-xs text-[#1ed6a0] mt-1.5 flex items-center gap-1 font-mono">
                  <span>120 checks included</span>
                  <span className="text-[#00f0ff] font-bold">(~₹208 / diagram — Save 27%)</span>
                </div>
                {billingInterval === "year" && (
                  <div className="text-[11px] text-[#7f93b8] mt-1">
                    Billed annually (₹{(prodAnnualMonthly * 12).toLocaleString("en-IN")}/yr)
                  </div>
                )}
              </div>

              {/* Feature Checklist */}
              <div className="flex flex-col gap-3.5 mb-8">
                <span className="text-xs font-semibold text-[#eaf1ff] uppercase tracking-wider">
                  Includes everything in Starter, plus:
                </span>
                {production.features.map((feat, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 text-xs text-[#eaf1ff]">
                    <Check className="w-4 h-4 text-[#00f0ff] shrink-0 mt-0.5" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => onSelectPlan ? onSelectPlan("production") : onRequestDemo?.()}
              className="w-full py-3.5 px-4 rounded-xl text-sm font-semibold bg-[#2f8cff] hover:bg-[#4ba0ff] text-[#05101f] shadow-[0_4px_24px_rgba(47,140,255,0.45)] transition-all cursor-pointer flex items-center justify-center gap-2 group"
            >
              <span>Upgrade to Production</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          {/* Card 3: Enterprise Custom */}
          <div className="relative flex flex-col justify-between p-8 rounded-3xl bg-[#091224]/75 border border-[rgba(80,130,220,0.25)] backdrop-blur-xl hover:border-[rgba(47,140,255,0.4)] transition-all duration-300 hover:shadow-[0_12px_40px_rgba(0,0,0,0.5)]">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-[#7f93b8]">
                  Aerospace & Multi-Plant
                </span>
                <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-white/5 text-[#a9b8d3]">
                  Custom Quota
                </span>
              </div>

              <h3 className="text-2xl font-bold text-[#eaf1ff] mb-2">Enterprise Custom</h3>
              <p className="text-xs text-[#a9b8d3] mb-6 leading-relaxed min-h-[36px]">
                For aerospace OEMs, automotive Tier-1s, defense contractors & air-gapped secure plants.
              </p>

              {/* Price */}
              <div className="mb-6 pb-6 border-b border-white/10">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl sm:text-4xl font-extrabold text-[#eaf1ff] font-mono">Custom</span>
                  <span className="text-sm text-[#7f93b8]">/ high-volume</span>
                </div>
                <div className="text-xs text-[#00f0ff] mt-1.5 flex items-center gap-1 font-mono">
                  <span>Unlimited batch checks</span>
                  <span className="text-[#7f93b8]">(Dedicated VPC / Air-Gap)</span>
                </div>
                <div className="text-[11px] text-[#7f93b8] mt-1">Custom annual contract & SLA</div>
              </div>

              {/* Feature Checklist */}
              <div className="flex flex-col gap-3.5 mb-8">
                <span className="text-xs font-semibold text-[#eaf1ff] uppercase tracking-wider">
                  Enterprise capabilities:
                </span>
                {[
                  "Unlimited diagram checks & high-throughput batch ingestion",
                  "Air-gapped on-premise OCR engine deployment option",
                  "Custom CAD / EPLAN / Zuken netlist integrations",
                  "Dedicated electrical QC engineer review support",
                  "Custom SLAs, SOC 2 compliance & ISO 9001 audit ledger",
                  "Single Sign-On (SAML/Okta) & dedicated TAM",
                ].map((feat, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 text-xs text-[#a9b8d3]">
                    <Check className="w-4 h-4 text-[#2f8cff] shrink-0 mt-0.5" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => onRequestDemo ? onRequestDemo() : onSelectPlan?.("enterprise")}
              className="w-full py-3.5 px-4 rounded-xl text-sm font-semibold bg-white/10 hover:bg-white/15 text-[#eaf1ff] border border-white/15 transition-all cursor-pointer flex items-center justify-center gap-2 group"
            >
              <span>Contact Enterprise Sales</span>
              <Building className="w-4 h-4 group-hover:scale-110 transition-transform" />
            </button>
          </div>
        </div>

        {/* Trust Badges & Policy Bar */}
        <div className="p-6 rounded-2xl bg-[#081020]/75 backdrop-blur-xl border border-white/5 flex flex-wrap items-center justify-around gap-6 text-xs text-[#a9b8d3]">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 text-[#1ed6a0]" />
            <span>Server-Authoritative Check Quotas</span>
          </div>
          <div className="flex items-center gap-2.5">
            <Zap className="w-4 h-4 text-[#00f0ff]" />
            <span>Zero Overage Surprises</span>
          </div>
          <div className="flex items-center gap-2.5">
            <Shield className="w-4 h-4 text-[#2f8cff]" />
            <span>Air-Gapped Zero Data Retention</span>
          </div>
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-[#f5b73b]" />
            <span>Instant PDF & Excel Sign-off Reports</span>
          </div>
        </div>
      </div>
    </section>
  );
}
