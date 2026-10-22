"use client";

import React, { useState, useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Layers,
  FileCheck,
  ShieldCheck,
  Zap,
  Activity,
  ArrowRight,
  Maximize2,
  Sparkles,
  ExternalLink,
  Info,
} from "lucide-react";

interface DetectionCardData {
  id: string;
  type: "critical" | "warning" | "passed" | "ocr";
  title: string;
  location: string;
  coordinates: string;
  ruleStandard: string;
  severityLabel: string;
  description: string;
  confidence: number;
  terminalDetails?: {
    pin: string;
    signal: string;
    specGauge: string;
    actualGauge: string;
    status: "pass" | "fail" | "warn";
  }[];
}

const DETECTIONS_DATA: DetectionCardData[] = [
  {
    id: "det-1",
    type: "critical",
    title: "Conductor Gauge vs Overcurrent Mismatch",
    location: "TB-02 ➔ MTR-01 Feed (Motor Branch Circuit)",
    coordinates: "X: 524.2, Y: 310.8 (Bounding Box: 84×32mm)",
    ruleStandard: "UL 508A Table 28.1 & NFPA 79 § 12.5",
    severityLabel: "Critical Discrepancy",
    confidence: 99.8,
    description:
      "Detected 16 AWG conductor terminated to 40A Motor Starter. UL 508A Table 28.1 mandates minimum 8 AWG for 40A continuous full-load current (FLC). High risk of thermal runaway before breaker trip.",
    terminalDetails: [
      { pin: "TB-02:1", signal: "PHASE-U", specGauge: "8 AWG", actualGauge: "16 AWG", status: "fail" },
      { pin: "TB-02:2", signal: "PHASE-V", specGauge: "8 AWG", actualGauge: "16 AWG", status: "fail" },
      { pin: "TB-02:3", signal: "PHASE-W", specGauge: "8 AWG", actualGauge: "16 AWG", status: "fail" },
    ],
  },
  {
    id: "det-2",
    type: "warning",
    title: "Creepage & Clearance Violation (Class 3)",
    location: "TB-01 Pin 4 (Neutral) ➔ Frame Ground",
    coordinates: "X: 412.0, Y: 188.5 (Bounding Box: 46×28mm)",
    ruleStandard: "IPC/WHMA-A-620D § 13.4.2",
    severityLabel: "Class 3 Warning",
    confidence: 98.4,
    description:
      "Physical terminal spacing measured at 1.82mm. IPC/WHMA-A-620D Class 3 (Aerospace & High-Reliability) requires minimum 2.50mm air clearance for uninsulated bus bars at 480V RMS.",
    terminalDetails: [
      { pin: "TB-01:4", signal: "NEUTRAL", specGauge: "2.50mm Clear", actualGauge: "1.82mm", status: "warn" },
      { pin: "TB-01:PE", signal: "CHASSIS-GND", specGauge: "Continuous", actualGauge: "Verified", status: "pass" },
    ],
  },
  {
    id: "det-3",
    type: "ocr",
    title: "OCR Schematic Netlist & Pinout Mapping",
    location: "Main Distribution Block TB-01",
    coordinates: "X: 280.4, Y: 140.0 (Sub-millimeter OCR)",
    ruleStandard: "Schematic Netlist OCR v4.2",
    severityLabel: "Live Optical Trace",
    confidence: 99.4,
    description:
      "Optical character recognition extracted 48 connection tags from raster drawing. Cross-referenced against master electrical BOM. Identified 1 floating orphan label [W104-AUX].",
    terminalDetails: [
      { pin: "TB-01:1", signal: "L1 (480V BLK)", specGauge: "12 AWG", actualGauge: "12 AWG", status: "pass" },
      { pin: "TB-01:2", signal: "L2 (480V RED)", specGauge: "12 AWG", actualGauge: "12 AWG", status: "pass" },
      { pin: "TB-01:3", signal: "L3 (480V BLU)", specGauge: "12 AWG", actualGauge: "12 AWG", status: "pass" },
      { pin: "TB-01:N", signal: "NEUT (WHT)", specGauge: "10 AWG", actualGauge: "10 AWG", status: "pass" },
    ],
  },
  {
    id: "det-4",
    type: "passed",
    title: "Chassis Ground Bonding & PE Continuity",
    location: "PE Busbar ➔ Motor Frame MTR-01",
    coordinates: "X: 620.1, Y: 440.2 (Bounding Box: 60×20mm)",
    ruleStandard: "NFPA 79 § 8.2 & IEC 60204-1",
    severityLabel: "Standards Verified",
    confidence: 99.9,
    description:
      "Protective Earth (PE) Green/Yellow grounding loop verified intact from supply terminal TB-01 to motor casing. Conductor sizing conforms to NFPA 79 Table 8.2.8 minimums.",
    terminalDetails: [
      { pin: "MTR-PE", signal: "GND-LOOP", specGauge: "10 AWG GNY", actualGauge: "10 AWG GNY", status: "pass" },
    ],
  },
];

export function ParallaxQCCards() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedFilter, setSelectedFilter] = useState<"all" | "critical" | "warning" | "passed">("all");
  const [activeCardId, setActiveCardId] = useState<string>("det-1");

  // Track scroll inside this large interactive section for parallax floating movement
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  });

  // Parallax translation transforms: different speeds for staggered floating cards
  const yCol1 = useTransform(scrollYProgress, [0, 1], [60, -80]);
  const yCol2 = useTransform(scrollYProgress, [0, 1], [-40, 70]);
  const floatingBadgeY = useTransform(scrollYProgress, [0, 1], [80, -100]);
  const floatingBadgeRotate = useTransform(scrollYProgress, [0, 1], [-4, 6]);

  const filteredCards = DETECTIONS_DATA.filter((card) => {
    if (selectedFilter === "all") return true;
    if (selectedFilter === "critical") return card.type === "critical";
    if (selectedFilter === "warning") return card.type === "warning";
    if (selectedFilter === "passed") return card.type === "passed" || card.type === "ocr";
    return true;
  });

  return (
    <section
      ref={containerRef}
      className="relative w-full py-28 md:py-36 bg-gradient-to-b from-[#050a17] via-[#080e22] to-[#050a17] text-[#eaf1ff] overflow-hidden"
      id="qc-detections"
    >
      {/* Background Schematic Neon Grid Lines & Ambient Glow */}
      <div className="absolute inset-0 bg-schematic-grid opacity-35 pointer-events-none" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[700px] bg-[radial-gradient(circle,rgba(0,240,255,0.08)_0%,rgba(0,102,255,0.03)_50%,transparent_70%)] pointer-events-none blur-3xl" />
      <div className="absolute bottom-10 right-10 w-[450px] h-[450px] bg-[radial-gradient(circle,rgba(255,77,79,0.06)_0%,transparent_70%)] pointer-events-none blur-2xl" />

      {/* Floating Parallax Live Inspection Pill (Atmospheric foreground element) */}
      <motion.div
        style={{ y: floatingBadgeY, rotate: floatingBadgeRotate }}
        className="hidden lg:flex absolute top-20 right-[8%] z-20 items-center gap-3 px-4 py-2 bg-[rgba(10,22,44,0.75)] border border-[rgba(0,240,255,0.4)] rounded-full backdrop-blur-xl shadow-[0_10px_35px_rgba(0,240,255,0.25)] pointer-events-none"
      >
        <span className="w-2.5 h-2.5 rounded-full bg-[#00f0ff] animate-ping" />
        <span className="text-xs font-semibold tracking-wider text-[#00f0ff] uppercase">
          Live Parallax QC Scanner Active
        </span>
        <span className="text-[11px] px-2 py-0.5 rounded bg-white/10 text-white font-mono">
          ±0.15mm Precision
        </span>
      </motion.div>

      {/* Floating Parallax Discrepancy Alert Tag on the left */}
      <motion.div
        style={{ y: yCol2 }}
        className="hidden xl:flex absolute top-1/3 left-[4%] z-20 items-center gap-2.5 px-4 py-2 bg-[rgba(30,12,20,0.75)] border border-[rgba(255,77,79,0.45)] rounded-full backdrop-blur-xl shadow-[0_10px_30px_rgba(255,77,79,0.25)] pointer-events-none"
      >
        <AlertTriangle className="w-4 h-4 text-[#ff4d4f]" />
        <span className="text-xs font-semibold tracking-wide text-[#ff4d4f]">
          6 Discrepancies Localized in TB-01 & TB-02
        </span>
      </motion.div>

      <div className="relative z-10 max-w-[1360px] mx-auto px-6 sm:px-8 lg:px-12">
        {/* Section Header: Expanded & Prominent */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[rgba(0,240,255,0.1)] border border-[rgba(0,240,255,0.3)] mb-4">
            <Sparkles className="w-3.5 h-3.5 text-[#00f0ff]" />
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#00f0ff]">
              Automated Wiring QC Detections
            </span>
          </div>

          <h2 className="text-[clamp(32px,4vw,54px)] font-bold tracking-tight text-[#eaf1ff] leading-[1.12] mb-5">
            Real-Time Discrepancy Detection & Sub-Millimeter Bounding
          </h2>

          <p className="text-[17px] leading-relaxed text-[#a9b8d3]">
            Instead of manual highlighter redlining, SpanQC isolates terminal blocks, traces pinout continuity,
            cross-references wire gauges against breaker loads, and flags IPC/WHMA-A-620 compliance deviations.
          </p>

          {/* Interactive Filter Pills */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 mt-8">
            <button
              type="button"
              onClick={() => setSelectedFilter("all")}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                selectedFilter === "all"
                  ? "bg-[#2f8cff] text-[#05101f] shadow-[0_0_20px_rgba(47,140,255,0.5)]"
                  : "bg-white/5 text-[#a9b8d3] hover:bg-white/10 hover:text-white border border-white/10"
              }`}
            >
              All Detections (4)
            </button>
            <button
              type="button"
              onClick={() => setSelectedFilter("critical")}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedFilter === "critical"
                  ? "bg-[#ff4d4f] text-white shadow-[0_0_20px_rgba(255,77,79,0.5)]"
                  : "bg-white/5 text-[#a9b8d3] hover:bg-white/10 hover:text-white border border-white/10"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-[#ff4d4f]" />
              Critical Errors (1)
            </button>
            <button
              type="button"
              onClick={() => setSelectedFilter("warning")}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedFilter === "warning"
                  ? "bg-[#f5b73b] text-[#1c1202] shadow-[0_0_20px_rgba(245,183,59,0.5)]"
                  : "bg-white/5 text-[#a9b8d3] hover:bg-white/10 hover:text-white border border-white/10"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-[#f5b73b]" />
              Standard Warnings (1)
            </button>
            <button
              type="button"
              onClick={() => setSelectedFilter("passed")}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedFilter === "passed"
                  ? "bg-[#1ed6a0] text-[#031c12] shadow-[0_0_20px_rgba(30,214,160,0.5)]"
                  : "bg-white/5 text-[#a9b8d3] hover:bg-white/10 hover:text-white border border-white/10"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-[#1ed6a0]" />
              Verified & OCR (2)
            </button>
          </div>
        </div>

        {/* Parallax Moving Grid Container */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Column 1 (Left 7 Cols): Parallax Floating Detection Cards */}
          <motion.div style={{ y: yCol1 }} className="lg:col-span-7 flex flex-col gap-6">
            {filteredCards.map((card) => {
              const isSelected = activeCardId === card.id;
              const isCritical = card.type === "critical";
              const isWarning = card.type === "warning";
              const isPassed = card.type === "passed";

              return (
                <div
                  key={card.id}
                  onClick={() => setActiveCardId(card.id)}
                  className={`relative p-6 sm:p-7 rounded-2xl cursor-pointer transition-all duration-300 ${
                    isSelected
                      ? "bg-[#0b1428]/85 border-2 shadow-[0_12px_45px_rgba(0,0,0,0.65)] scale-[1.01]"
                      : "bg-[#0a1224]/75 border hover:bg-[#0d1830]/85 hover:scale-[1.005]"
                  } ${
                    isCritical
                      ? isSelected
                        ? "border-[#ff4d4f] shadow-[0_0_30px_rgba(255,77,79,0.3)]"
                        : "border-[rgba(255,77,79,0.35)]"
                      : isWarning
                      ? isSelected
                        ? "border-[#f5b73b] shadow-[0_0_30px_rgba(245,183,59,0.3)]"
                        : "border-[rgba(245,183,59,0.35)]"
                      : isSelected
                      ? "border-[#00f0ff] shadow-[0_0_30px_rgba(0,240,255,0.3)]"
                      : "border-[rgba(80,130,220,0.25)]"
                  }`}
                >
                  {/* Card Header Status Row */}
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2">
                      {isCritical && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold bg-[rgba(255,77,79,0.15)] text-[#ff4d4f] border border-[#ff4d4f]/40">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          {card.severityLabel}
                        </span>
                      )}
                      {isWarning && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold bg-[rgba(245,183,59,0.15)] text-[#f5b73b] border border-[#f5b73b]/40">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          {card.severityLabel}
                        </span>
                      )}
                      {isPassed && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold bg-[rgba(30,214,160,0.15)] text-[#1ed6a0] border border-[#1ed6a0]/40">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {card.severityLabel}
                        </span>
                      )}
                      {card.type === "ocr" && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold bg-[rgba(0,240,255,0.15)] text-[#00f0ff] border border-[#00f0ff]/40">
                          <Cpu className="w-3.5 h-3.5" />
                          {card.severityLabel}
                        </span>
                      )}
                      <span className="text-xs font-mono text-[#7f93b8]">{card.coordinates}</span>
                    </div>

                    <div className="flex items-center gap-1 text-xs font-mono text-[#a9b8d3]">
                      <Activity className="w-3.5 h-3.5 text-[#00f0ff]" />
                      <span>{card.confidence}% conf</span>
                    </div>
                  </div>

                  {/* Title & Standard Rule */}
                  <h3 className="text-lg sm:text-xl font-bold text-[#eaf1ff] mb-2">{card.title}</h3>
                  <div className="text-xs font-medium text-[#7f93b8] mb-3">
                    Standard: <span className="text-[#a9b8d3]">{card.ruleStandard}</span> • Target:{" "}
                    <span className="text-[#00f0ff]">{card.location}</span>
                  </div>

                  <p className="text-sm text-[#a9b8d3] leading-relaxed mb-4">{card.description}</p>

                  {/* Terminal Pin Breakdown Chips */}
                  {card.terminalDetails && (
                    <div className="p-3.5 rounded-xl bg-[#060b17] border border-white/5 flex flex-col gap-2">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-[#7f93b8] uppercase tracking-wider px-1">
                        <span>Terminal Pin</span>
                        <span>Designation</span>
                        <span>Required</span>
                        <span>Detected</span>
                        <span>State</span>
                      </div>
                      <div className="divide-y divide-white/5 text-xs font-mono">
                        {card.terminalDetails.map((td, idx) => (
                          <div key={idx} className="flex items-center justify-between py-1.5 px-1">
                            <span className="text-[#eaf1ff] font-semibold">{td.pin}</span>
                            <span className="text-[#7f93b8]">{td.signal}</span>
                            <span className="text-[#a9b8d3]">{td.specGauge}</span>
                            <span
                              className={`font-semibold ${
                                td.status === "fail"
                                  ? "text-[#ff4d4f]"
                                  : td.status === "warn"
                                  ? "text-[#f5b73b]"
                                  : "text-[#1ed6a0]"
                              }`}
                            >
                              {td.actualGauge}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                td.status === "fail"
                                  ? "bg-[#ff4d4f]/20 text-[#ff4d4f]"
                                  : td.status === "warn"
                                  ? "bg-[#f5b73b]/20 text-[#f5b73b]"
                                  : "bg-[#1ed6a0]/20 text-[#1ed6a0]"
                              }`}
                            >
                              {td.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Interactive Footer */}
                  <div className="mt-4 flex items-center justify-between pt-3 border-t border-white/5 text-xs text-[#7f93b8]">
                    <span className="flex items-center gap-1.5 hover:text-[#00f0ff] transition-colors">
                      <Info className="w-3.5 h-3.5" />
                      Click to highlight coordinate on schematic
                    </span>
                    <span className="text-[#2f8cff] font-semibold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                      Inspect Rule Trace →
                    </span>
                  </div>
                </div>
              );
            })}
          </motion.div>

          {/* Column 2 (Right 5 Cols): Parallax High-Detail Live Diagnostic HUD */}
          <motion.div style={{ y: yCol2 }} className="lg:col-span-5 flex flex-col gap-6 sticky top-28">
            {/* Live Diagram Schematic HUD Card */}
            <div className="p-7 rounded-2xl bg-[#091124]/75 backdrop-blur-xl border border-[rgba(0,240,255,0.35)] shadow-[0_16px_50px_rgba(0,0,0,0.6)] relative overflow-hidden">
              <div className="absolute top-0 right-0 w-36 h-36 bg-[radial-gradient(circle,rgba(0,240,255,0.15)_0%,transparent_70%)] pointer-events-none" />

              <div className="flex items-center justify-between mb-5 pb-4 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#1ed6a0] animate-pulse" />
                  <span className="text-xs font-bold uppercase tracking-wider text-[#eaf1ff]">
                    QC Verification Engine HUD
                  </span>
                </div>
                <span className="px-2.5 py-1 rounded bg-[#00f0ff]/10 text-[#00f0ff] text-xs font-mono">
                  ACTIVE SCHEMATIC
                </span>
              </div>

              {/* Real-time Metrics Gauge */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="p-3.5 rounded-xl bg-[#050a17] border border-white/5 text-center">
                  <div className="text-2xl font-bold text-[#1ed6a0] font-mono">94%</div>
                  <div className="text-[11px] text-[#7f93b8] font-medium uppercase mt-0.5">Compliant</div>
                </div>
                <div className="p-3.5 rounded-xl bg-[#050a17] border border-white/5 text-center">
                  <div className="text-2xl font-bold text-[#f5b73b] font-mono">4%</div>
                  <div className="text-[11px] text-[#7f93b8] font-medium uppercase mt-0.5">Warnings</div>
                </div>
                <div className="p-3.5 rounded-xl bg-[#050a17] border border-white/5 text-center">
                  <div className="text-2xl font-bold text-[#ff4d4f] font-mono">2%</div>
                  <div className="text-[11px] text-[#7f93b8] font-medium uppercase mt-0.5">Errors</div>
                </div>
              </div>

              {/* Active Schematic Wire Harness Map Graphic */}
              <div className="relative p-5 rounded-xl bg-[#040813] border border-[rgba(0,240,255,0.2)] mb-5 overflow-hidden">
                <div className="text-[10px] font-mono text-[#00f0ff] uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>VECTOR SCHEMATIC RUN: SPAN-HARNESS-2026</span>
                  <span>ZOOM: 140%</span>
                </div>

                {/* SVG Wiring Schematic Preview */}
                <div className="w-full h-44 bg-[#02050c] rounded-lg border border-white/5 relative flex items-center justify-center p-3">
                  <svg className="w-full h-full" viewBox="0 0 320 140" fill="none" xmlns="http://www.w3.org/2000/svg">
                    {/* Bus lines */}
                    <path d="M 20 30 L 100 30 L 100 70 L 180 70" stroke="#00f0ff" strokeWidth="2" strokeDasharray="3 3" />
                    <path d="M 20 60 L 120 60 L 120 100 L 220 100" stroke="#2f8cff" strokeWidth="2" />
                    <path d="M 20 90 L 140 90 L 140 50 L 260 50" stroke="#ff4d4f" strokeWidth="2.5" />
                    <path d="M 20 120 L 300 120" stroke="#1ed6a0" strokeWidth="1.5" />

                    {/* Terminal Block 1 */}
                    <rect x="15" y="15" width="40" height="110" rx="4" fill="#0b162c" stroke="#2f8cff" strokeWidth="1.5" />
                    <text x="35" y="75" fill="#eaf1ff" fontSize="9" fontWeight="bold" textAnchor="middle" transform="rotate(-90 35 75)">TB-01</text>

                    {/* Terminal Block 2 */}
                    <rect x="250" y="30" width="40" height="85" rx="4" fill="#0b162c" stroke="#ff4d4f" strokeWidth="1.5" />
                    <text x="270" y="75" fill="#eaf1ff" fontSize="9" fontWeight="bold" textAnchor="middle" transform="rotate(-90 270 75)">TB-02</text>

                    {/* Animated Red Warning Beacon on TB-02 pin 1 */}
                    <circle cx="250" cy="50" r="8" fill="#ff4d4f" fillOpacity="0.3" className="animate-ping" />
                    <circle cx="250" cy="50" r="4" fill="#ff4d4f" />

                    {/* Green Pass Check on TB-01 PE */}
                    <circle cx="55" cy="120" r="3" fill="#1ed6a0" />
                  </svg>

                  {/* Bounding Box Flag Overlaid */}
                  <div className="absolute top-8 right-6 bg-[#ff4d4f] text-[#050a17] text-[10px] font-bold px-2 py-0.5 rounded shadow-[0_0_12px_#ff4d4f] flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    16 AWG on 40A Breaker
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-[#7f93b8] mt-3">
                  <span>Pinout: 142 Verified</span>
                  <span>Discrepancies: 6 Flagged</span>
                  <span className="text-[#1ed6a0]">Ready for Sign-off</span>
                </div>
              </div>

              {/* Cryptographic SHA-256 Stamp */}
              <div className="p-4 rounded-xl bg-[#060c1c] border border-white/10 flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs font-semibold text-[#eaf1ff]">
                  <span className="flex items-center gap-1.5 text-[#00f0ff]">
                    <ShieldCheck className="w-4 h-4" />
                    Cryptographic Audit Signature
                  </span>
                  <span className="text-[10px] font-mono text-[#7f93b8]">ISO 9001:2015</span>
                </div>
                <div className="text-[11px] font-mono text-[#a9b8d3] break-all bg-black/40 p-2 rounded border border-white/5">
                  SHA256: 8a4f9b2c3e1047fa8c71d09e5b31e9a22f4d6c7b8a1c9e0f3d4a5b6c7d8e9f01
                </div>
                <div className="flex items-center justify-between text-[11px] text-[#7f93b8] mt-1">
                  <span>Signer: Lead QC Engineer</span>
                  <span className="text-[#00f0ff] cursor-pointer hover:underline">Download Audit PDF ➔</span>
                </div>
              </div>
            </div>

            {/* Quick Feature Callouts */}
            <div className="p-5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#2f8cff]/20 border border-[#2f8cff]/30 flex items-center justify-center text-[#2f8cff]">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-[#eaf1ff]">Multi-Sheet Hierarchy</h4>
                  <p className="text-xs text-[#7f93b8]">Cross-page netlist continuity across 50+ sheets.</p>
                </div>
              </div>
              <span className="text-xs font-bold text-[#00f0ff] uppercase tracking-wider">Active</span>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
