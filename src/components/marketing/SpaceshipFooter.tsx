"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Send, CheckCircle2, ShieldCheck, Award, Lock, ExternalLink, Cpu } from "lucide-react";

export function SpaceshipFooter() {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      setSubscribed(true);
    }
  };

  return (
    <footer className="relative w-full bg-[#06080e] text-[#a9b8d3] border-t border-white/10 selection:bg-[#2f8cff]/30">
      {/* 1. Spaceship-Inspired Subscription Universe Banner */}
      <div className="w-full border-b border-white/5 bg-[#0a0d18]/75 backdrop-blur-md py-12 px-6 sm:px-8 lg:px-12">
        <div className="max-w-[1360px] mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="max-w-xl text-center md:text-left">
            <h3 className="text-2xl sm:text-3xl font-bold text-[#eaf1ff] tracking-tight mb-2 flex items-center justify-center md:justify-start gap-2.5">
              <span>Join the SpanQC universe</span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#2f8cff]/20 text-[#2f8cff] border border-[#2f8cff]/30">
                AI + Wiring QC
              </span>
            </h3>
            <p className="text-sm text-[#7f93b8] leading-relaxed">
              Subscribe to keep up with IPC/WHMA-A-620 standard updates, automated schematic QC algorithms,
              and industrial electrical verification releases.
            </p>
          </div>

          {/* Pill Search / Input Box */}
          <div className="w-full md:w-auto min-w-[320px] max-w-md">
            {!subscribed ? (
              <form onSubmit={handleSubscribe} className="relative flex items-center">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email here"
                  required
                  className="w-full h-12 pl-5 pr-14 rounded-full bg-[#0c101e] border border-white/15 text-sm text-[#eaf1ff] placeholder-[#5a6a88] focus:outline-none focus:border-[#2f8cff] focus:ring-2 focus:ring-[#2f8cff]/30 transition-all shadow-[0_4px_20px_rgba(0,0,0,0.4)]"
                />
                <button
                  type="submit"
                  aria-label="Subscribe to newsletter"
                  className="absolute right-1.5 w-9 h-9 rounded-full bg-[#2f8cff] hover:bg-[#4ba0ff] text-[#05101f] flex items-center justify-center transition-transform hover:scale-105 active:scale-95 cursor-pointer shadow-[0_2px_10px_rgba(47,140,255,0.4)]"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            ) : (
              <div className="flex items-center gap-2.5 px-5 py-3 rounded-full bg-[#1ed6a0]/15 border border-[#1ed6a0]/30 text-xs font-semibold text-[#1ed6a0]">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>You are in! Welcome to the SpanQC verification universe.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Multi-Column Directory Grid (Exact Spaceship 6-Column Layout) */}
      <div className="max-w-[1360px] mx-auto px-6 sm:px-8 lg:px-12 py-16">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 sm:gap-10">
          {/* Column 1: Wiring QC Tools */}
          <div className="flex flex-col gap-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#eaf1ff] mb-1">
              Wiring QC
            </h4>
            <Link href="/app/check" className="text-xs text-[#7f93b8] hover:text-[#eaf1ff] transition-colors">
              Schematic AI Scanner
            </Link>
            <Link href="/app/check" className="text-xs text-[#7f93b8] hover:text-[#eaf1ff] transition-colors">
              Netlist Extractor
            </Link>
            <Link href="/app/check" className="text-xs text-[#7f93b8] hover:text-[#eaf1ff] transition-colors">
              Terminal Block Mapper
            </Link>
            <Link href="/app/check" className="text-xs text-[#7f93b8] hover:text-[#eaf1ff] transition-colors">
              Wire Gauge vs Breaker
            </Link>
            <Link href="/app/check" className="text-xs text-[#7f93b8] hover:text-[#eaf1ff] transition-colors">
              Sub-Millimeter Boxes
            </Link>
            <Link href="/app/history" className="text-xs text-[#7f93b8] hover:text-[#eaf1ff] transition-colors">
              PDF & Excel Exporter
            </Link>
          </div>

          {/* Column 2: Standards Manuals */}
          <div className="flex flex-col gap-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#eaf1ff] mb-1">
              Standards
            </h4>
            <span className="text-xs text-[#7f93b8] hover:text-[#eaf1ff] transition-colors cursor-pointer">
              IPC/WHMA-A-620 Class 3
            </span>
            <span className="text-xs text-[#7f93b8] hover:text-[#eaf1ff] transition-colors cursor-pointer">
              UL 508A Industrial Panels
            </span>
            <span className="text-xs text-[#7f93b8] hover:text-[#eaf1ff] transition-colors cursor-pointer">
              ISO 9001 Process Control
            </span>
            <span className="text-xs text-[#7f93b8] hover:text-[#eaf1ff] transition-colors cursor-pointer">
              NFPA 79 Industrial Rules
            </span>
            <span className="text-xs text-[#7f93b8] hover:text-[#eaf1ff] transition-colors cursor-pointer">
              AS9100 Aerospace Harness
            </span>
            <span className="text-xs text-[#7f93b8] hover:text-[#eaf1ff] transition-colors cursor-pointer">
              EN 50155 Rail Transit
            </span>
          </div>

          {/* Column 3: Solutions */}
          <div className="flex flex-col gap-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#eaf1ff] mb-1">
              Solutions
            </h4>
            <span className="text-xs text-[#7f93b8] hover:text-[#eaf1ff] transition-colors cursor-pointer">
              Aerospace Wire Harness
            </span>
            <span className="text-xs text-[#7f93b8] hover:text-[#eaf1ff] transition-colors cursor-pointer">
              Automotive EV Cabinets
            </span>
            <span className="text-xs text-[#7f93b8] hover:text-[#eaf1ff] transition-colors cursor-pointer">
              Industrial Switchboards
            </span>
            <span className="text-xs text-[#7f93b8] hover:text-[#eaf1ff] transition-colors cursor-pointer">
              Medical Device Cabling
            </span>
            <span className="text-xs text-[#7f93b8] hover:text-[#eaf1ff] transition-colors cursor-pointer">
              Rail & Locomotive Systems
            </span>
            <span className="text-xs text-[#7f93b8] hover:text-[#eaf1ff] transition-colors cursor-pointer">
              Robotics & Automation
            </span>
          </div>

          {/* Column 4: Trust & Security */}
          <div className="flex flex-col gap-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#eaf1ff] mb-1">
              Why SpanQC
            </h4>
            <span className="text-xs text-[#7f93b8] hover:text-[#eaf1ff] transition-colors cursor-pointer">
              Zero Data Retention
            </span>
            <span className="text-xs text-[#7f93b8] hover:text-[#eaf1ff] transition-colors cursor-pointer">
              Air-Gapped OCR Engine
            </span>
            <span className="text-xs text-[#7f93b8] hover:text-[#eaf1ff] transition-colors cursor-pointer">
              SOC 2 Type II Certified
            </span>
            <span className="text-xs text-[#7f93b8] hover:text-[#eaf1ff] transition-colors cursor-pointer">
              SHA-256 Audit Signatures
            </span>
            <span className="text-xs text-[#7f93b8] hover:text-[#eaf1ff] transition-colors cursor-pointer">
              Human Reviewer Sign-off
            </span>
            <span className="text-xs text-[#7f93b8] hover:text-[#eaf1ff] transition-colors cursor-pointer">
              Role-Based Access (RBAC)
            </span>
          </div>

          {/* Column 5: Company & Docs */}
          <div className="flex flex-col gap-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#eaf1ff] mb-1">
              About SpanQC
            </h4>
            <span className="text-xs text-[#7f93b8] hover:text-[#eaf1ff] transition-colors cursor-pointer">
              About Us
            </span>
            <span className="text-xs text-[#7f93b8] hover:text-[#eaf1ff] transition-colors cursor-pointer">
              Engineering Blog
            </span>
            <span className="text-xs text-[#7f93b8] hover:text-[#eaf1ff] transition-colors cursor-pointer">
              Documentation & API
            </span>
            <span className="text-xs text-[#7f93b8] hover:text-[#eaf1ff] transition-colors cursor-pointer">
              System Status (99.98%)
            </span>
            <span className="text-xs text-[#7f93b8] hover:text-[#eaf1ff] transition-colors cursor-pointer">
              Changelog & Releases
            </span>
            <span className="text-xs text-[#7f93b8] hover:text-[#eaf1ff] transition-colors cursor-pointer">
              Verification Sandbox
            </span>
          </div>

          {/* Column 6: Customer Service */}
          <div className="flex flex-col gap-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#eaf1ff] mb-1">
              Customer Service
            </h4>
            <span className="text-xs text-[#7f93b8] hover:text-[#eaf1ff] transition-colors cursor-pointer">
              Contact Engineering
            </span>
            <span className="text-xs text-[#7f93b8] hover:text-[#eaf1ff] transition-colors cursor-pointer">
              Book Production Pilot
            </span>
            <span className="text-xs text-[#7f93b8] hover:text-[#eaf1ff] transition-colors cursor-pointer">
              Knowledge Base
            </span>
            <span className="text-xs text-[#7f93b8] hover:text-[#eaf1ff] transition-colors cursor-pointer">
              Report Schematic Anomaly
            </span>
            <span className="text-xs text-[#7f93b8] hover:text-[#eaf1ff] transition-colors cursor-pointer">
              Request CAD Connector
            </span>
            <span className="text-xs text-[#7f93b8] hover:text-[#eaf1ff] transition-colors cursor-pointer">
              Security Disclosure
            </span>
          </div>
        </div>
      </div>

      {/* 3. Bottom Trust, Payment Options & Certifications Bar (Direct Spaceship Clone) */}
      <div className="w-full border-t border-white/5 bg-[#05070c] py-8 px-6 sm:px-8 lg:px-12">
        <div className="max-w-[1360px] mx-auto flex flex-col lg:flex-row items-center justify-between gap-8">
          {/* Payment Options Strip */}
          <div className="flex flex-col gap-2 text-center lg:text-left">
            <span className="text-xs font-bold uppercase tracking-wider text-[#eaf1ff]">
              Payment Options
            </span>
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2">
              <span className="px-2.5 py-1 rounded bg-white/10 text-[11px] font-bold text-white tracking-wider">
                VISA
              </span>
              <span className="px-2.5 py-1 rounded bg-white/10 text-[11px] font-bold text-white tracking-wider">
                MASTERCARD
              </span>
              <span className="px-2.5 py-1 rounded bg-white/10 text-[11px] font-bold text-white tracking-wider">
                RUPAY
              </span>
              <span className="px-2.5 py-1 rounded bg-white/10 text-[11px] font-bold text-white tracking-wider">
                AMEX
              </span>
              <span className="px-2.5 py-1 rounded bg-[#2f8cff]/20 text-[11px] font-bold text-[#2f8cff] tracking-wider border border-[#2f8cff]/40">
                UPI (GPAY / PHONEPE)
              </span>
              <span className="px-2.5 py-1 rounded bg-white/10 text-[11px] font-bold text-white tracking-wider">
                NETBANKING
              </span>
              <span className="px-2.5 py-1 rounded bg-[#00f0ff]/20 text-[11px] font-bold text-[#00f0ff] tracking-wider border border-[#00f0ff]/40">
                RAZORPAY
              </span>
            </div>
            <p className="text-[11px] text-[#7f93b8] mt-0.5">
              We protect and encrypt your schematic and billing data. 256-bit TLS Zero-Knowledge Vault.
            </p>
          </div>

          {/* Certified By Strip */}
          <div className="flex flex-col gap-2 text-center lg:text-left max-w-sm">
            <span className="text-xs font-bold uppercase tracking-wider text-[#eaf1ff]">
              Certified By
            </span>
            <div className="flex items-center justify-center lg:justify-start gap-3">
              <div className="w-8 h-8 rounded-full bg-[#1ed6a0]/20 border border-[#1ed6a0]/40 flex items-center justify-center text-[#1ed6a0] shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <p className="text-[11px] text-[#a9b8d3] leading-snug">
                Certified QC Engine - Compliant with IPC/WHMA-A-620 Class 3 & UL 508A standards. Serving industrial harness builders since 2024.
              </p>
            </div>
          </div>

          {/* Security & Product Badges */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            {/* Sectigo/SSL Style Badge */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0c1322] border border-[#1ed6a0]/30 text-[#1ed6a0] text-[11px] font-semibold">
              <Lock className="w-3.5 h-3.5" />
              <span>SECURED BY 256-BIT TLS</span>
            </div>

            {/* Product Hunt / Industry Award Badge */}
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-[#0c1322] border border-white/10 text-[#eaf1ff] text-[11px] font-semibold shadow-sm">
              <Award className="w-3.5 h-3.5 text-[#f5b73b]" />
              <span>#1 Electrical Diagram QC</span>
            </div>
          </div>
        </div>

        {/* Copyright & Legal Sub-footer */}
        <div className="max-w-[1360px] mx-auto mt-8 pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-[#5a6a88]">
          <p>© 2026 SpanQC Inc. All rights reserved. Precision Automated Wiring Diagram Quality Control.</p>
          <div className="flex items-center gap-5">
            <span className="hover:text-[#a9b8d3] transition-colors cursor-pointer">Privacy Policy</span>
            <span className="hover:text-[#a9b8d3] transition-colors cursor-pointer">Terms & Conditions</span>
            <span className="hover:text-[#a9b8d3] transition-colors cursor-pointer">ISO 9001 Compliance</span>
            <span className="hover:text-[#a9b8d3] transition-colors cursor-pointer">Cookies Preferences</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
