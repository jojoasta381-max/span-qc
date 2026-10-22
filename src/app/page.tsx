"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MarketingNav } from "@/components/layout/MarketingNav";
import { MarketingFooter } from "@/components/layout/MarketingFooter";
import { CursorSpotlightCard } from "@/components/ui/CursorSpotlight";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  Rocket,
  Search,
  ArrowRight,
  Cpu,
  Layers,
  ShieldCheck,
  CheckCircle2,
  AlertOctagon,
  AlertTriangle,
  FileText,
  FileSpreadsheet,
  Download,
  Sparkles,
  Eye,
  Check,
  Box,
  Terminal,
  Grid,
  Zap,
  Sliders,
  Database,
  Lock,
  Play,
  FileUp,
  Activity,
  CheckCheck,
  ChevronRight,
  RotateCw,
} from "lucide-react";

export default function HomePage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeDemoTab, setActiveDemoTab] = useState<"wh402" | "mcc" | "tb200">("wh402");
  const [activeLaunchpadApp, setActiveLaunchpadApp] = useState<string>("ingestion");
  const [activeStoryStep, setActiveStoryStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  const demoCases = {
    wh402: {
      title: "Commercial Avionics Harness WH-402",
      standard: "IPC/WHMA-A-620D Class 3",
      checks: 156,
      discrepancies: 6,
      critical: 2,
      major: 3,
      status: "FAIL" as const,
      findings: [
        { code: "D-001", title: "Missing wire gauge on run W102", sev: "CRITICAL" as const, loc: "Page 1, Zone B3" },
        { code: "D-002", title: "Conductor color abbreviation omitted", sev: "MAJOR" as const, loc: "Page 1, Zone C2" },
        { code: "D-003", title: "Net crossing lacks junction dot symbol", sev: "MAJOR" as const, loc: "Page 1, Zone D4" },
      ],
    },
    mcc: {
      title: "Industrial Control Panel MCC-VFD-01",
      standard: "UL 508A 3rd Edition",
      checks: 88,
      discrepancies: 4,
      critical: 1,
      major: 2,
      status: "FAIL" as const,
      findings: [
        { code: "D-101", title: "SCCR rating mismatch on feeder branch", sev: "CRITICAL" as const, loc: "Page 2, 480V Bus" },
        { code: "D-102", title: "DC grounding color code violation", sev: "MAJOR" as const, loc: "Page 3, Terminal TB4" },
      ],
    },
    tb200: {
      title: "Compliant Relay Terminal Interface TB-200",
      standard: "IPC/WHMA-A-620D Class 2",
      checks: 64,
      discrepancies: 0,
      critical: 0,
      major: 0,
      status: "PASS" as const,
      findings: [],
    },
  };

  const currentCase = demoCases[activeDemoTab];

  const launchpadApps = [
    {
      id: "ingestion",
      name: "Schematic Ingestion",
      tagline: "High-DPI PDF & CAD Vector Parser",
      icon: Box,
      color: "text-cyan-400",
      bg: "bg-cyan-500/10 border-cyan-500/30",
      stats: "1200 DPI Vector Rasterizer",
      desc: "Accepts complex multi-page PDF schematics, parses raster diagrams, and creates cryptographic SHA-256 non-repudiation hashes.",
    },
    {
      id: "ocr",
      name: "Spatial OCR",
      tagline: "Sub-Millimeter Token Anchoring",
      icon: Cpu,
      color: "text-blue-400",
      bg: "bg-blue-500/10 border-blue-500/30",
      stats: "0.2mm Bounding Precision",
      desc: "Extracts wire tags, connector callouts, pin assignments, and title block metadata, mapping every token to exact drawing coordinates.",
    },
    {
      id: "netlist",
      name: "Netlist Graph Extractor",
      tagline: "Topological Connectivity Engine",
      icon: Layers,
      color: "text-purple-400",
      bg: "bg-purple-500/10 border-purple-500/30",
      stats: "Full Signal Net Recovery",
      desc: "Reconstructs physical pin-to-pin signal nets, verifies 4-way crossings vs. solder dots, and builds electrical bill of materials.",
    },
    {
      id: "ipc",
      name: "IPC-620 Rule Pack",
      tagline: "Class 1, 2, 3 Wire Harness Audit",
      icon: ShieldCheck,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10 border-emerald-500/30",
      stats: "142 Codified Rules",
      desc: "Enforces international consensus requirements for conductor gauge ampacity, crimp barrel ranges, insulation clearances, and splice integrity.",
    },
    {
      id: "ul",
      name: "UL 508A Suite",
      tagline: "Industrial Control Panel Safety",
      icon: Zap,
      color: "text-amber-400",
      bg: "bg-amber-500/10 border-amber-500/30",
      stats: "88 Electrical Safety Rules",
      desc: "North American industrial panel compliance: short-circuit current ratings (SCCR), internal conductor color codes, and component spacings.",
    },
    {
      id: "reports",
      name: "QC Reports & Exports",
      tagline: "Formal PDF & Excel XLSX Exports",
      icon: FileSpreadsheet,
      color: "text-rose-400",
      bg: "bg-rose-500/10 border-rose-500/30",
      stats: "1-Click QC Report Download",
      desc: "Generates tamper-evident QC inspection reports and multi-sheet Excel workbooks with embedded evidence coordinates.",
    },
  ];

  const activeApp = launchpadApps.find((a) => a.id === activeLaunchpadApp) || launchpadApps[0];

  const handleQuickSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.push("/login");
  };

  const storySteps = [
    {
      step: 1,
      title: "Upload",
      tagline: "STEP 1: INGESTION & INTEGRITY",
      headline: "Multi-Page PDF & CAD Vector Ingestion",
      desc: "Schematic manuals are ingested through our high-throughput parser. The system validates file structure, checks DPI resolution, and stamps each document with a cryptographic SHA-256 non-repudiation seal.",
      metrics: "SHA-256: 9f83a21b... • 1200 DPI Vector Rasterizer",
      statusText: "✓ File Validated & Hashed",
      badgeColor: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
    },
    {
      step: 2,
      title: "Analyze",
      tagline: "STEP 2: SPATIAL DECONSTRUCTION",
      headline: "Spatial OCR & Token Coordinate Mapping",
      desc: "Computer vision and spatial OCR deconstruct every conductor callout, pinout matrix, reference designator, and revision block, pinning each token to exact sub-millimeter coordinates.",
      metrics: "0.2mm Bounding Precision • 100% Token Recovery",
      statusText: "✓ Coordinates Mapped (Sheet 1, Zone B3)",
      badgeColor: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    },
    {
      step: 3,
      title: "Validate",
      tagline: "STEP 3: DETERMINISTIC QC RULES",
      headline: "IPC/WHMA-A-620 & UL 508A Rules Running",
      desc: "Deterministic rule packs audit conductor cross-sections against ampacity tables, check terminal crimp ranges, inspect color code standards, and verify net topology crossings.",
      metrics: "142 Codified Rules Mounted • Class 3 Aerospace Rules",
      statusText: "✓ 156 Rules Executing",
      badgeColor: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    },
    {
      step: 4,
      title: "Detect",
      tagline: "STEP 4: DISCREPANCY DETECTION",
      headline: "Coordinate-Pinned Defect Isolation",
      desc: "Discrepancies illuminate on the drawing canvas with confidence scores, exact polygon bounds, and standard clause citations, strictly distinguishing observed facts from standard requirements.",
      metrics: "95% Statistical Confidence (Illustrative) • IPC-620D §4.1",
      statusText: "⚠ Discrepancy Flagged at Pin 2",
      badgeColor: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    },
    {
      step: 5,
      title: "Report",
      tagline: "STEP 5: REPORT & SIGN-OFF",
      headline: "Structured QC Report & Human Review",
      desc: "Inspect findings in synchronized split-screen, record inspector sign-off (Confirm/Reject/Review), and download tamper-evident PDF QC inspection reports and multi-sheet Excel workbooks.",
      metrics: "82% Quality Score • 1-Click PDF & Excel Export",
      statusText: "✓ QC Inspection Report Generated",
      badgeColor: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    },
  ];

  const currentStory = storySteps[activeStoryStep - 1];

  return (
    <div className="min-h-screen bg-[#06070a] text-slate-100 flex flex-col bg-cosmic-mesh">
      <MarketingNav />

      {/* SECTION 7: HERO SECTION */}
      <section className="relative overflow-hidden pt-20 pb-20 md:pt-28 md:pb-28 bg-spaceship-grid">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          {/* Eyebrow: Section 7 Requirement */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-mono font-bold tracking-wider mb-8 shadow-lg shadow-cyan-500/10">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>AI-POWERED WIRING DIAGRAM QUALITY CONTROL</span>
          </div>

          {/* Headline: Section 7 Requirement */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white max-w-4xl mx-auto leading-[1.08]">
            Turn wiring diagrams into{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-indigo-400">
              actionable QC reports.
            </span>
          </h1>

          {/* Supporting Text: Section 7 Requirement */}
          <p className="mt-6 text-base sm:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Upload a wiring diagram, run validated quality checks, identify discrepancies, and generate evidence-backed reports in minutes.
          </p>

          {/* Official Positioning Statement (Memo Requirement) */}
          <div className="mt-4 max-w-2xl mx-auto px-4 py-2 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-cyan-300 text-xs font-mono">
            “AI-assisted quality checking that helps engineering teams review wiring diagrams more efficiently — while keeping engineers in control.”
          </div>

          {/* Dual CTAs: Primary and Secondary (Section 7) */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/login">
              <button className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-sm font-mono tracking-tight shrink-0 flex items-center gap-2 shadow-xl shadow-cyan-500/25 active:scale-95 transition-all cursor-pointer">
                <span>Run a QC Check</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
            <a href="#storytelling">
              <Button variant="outline" size="lg" className="border-slate-700 hover:border-cyan-500/50 hover:text-cyan-300">
                <span>See How It Works</span>
              </Button>
            </a>
          </div>

          {/* Quick Search & Ingest Input Bar */}
          <div className="mt-8 max-w-2xl mx-auto">
            <form onSubmit={handleQuickSearch} className="spaceship-search-bar p-2 flex items-center gap-2">
              <div className="pl-3 text-slate-400">
                <Search className="w-5 h-5 text-cyan-400" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Enter drawing number or drop schematic PDF..."
                className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none px-2"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 font-bold text-xs font-mono tracking-tight shrink-0 border border-cyan-500/40 cursor-pointer"
              >
                Inspect
              </button>
            </form>
          </div>

          {/* SECTION 36: HERO VISUAL (DIAGRAM REGION -> DETECTED ISSUE -> QC FINDING) */}
          <div className="mt-14 max-w-5xl mx-auto text-left">
            <div className="rounded-2xl border border-cyan-500/30 bg-[#0a0f1d]/90 p-5 sm:p-7 shadow-2xl shadow-cyan-500/10 relative overflow-hidden backdrop-blur-md">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 text-xs font-mono">
                <div className="flex items-center gap-2.5">
                  <div className="flex gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                  </div>
                  <span className="text-slate-300 font-bold">LIVE QC VISUALIZATION PIPELINE</span>
                  <span className="text-slate-600">•</span>
                  <span className="text-cyan-400 font-mono text-[11px]">WH-402 HARNESS • SHEET 1</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span className="text-emerald-400 text-[11px] font-bold">ANALYSIS ACTIVE</span>
                </div>
              </div>

              {/* The Visual Connection Between Diagram & Finding Card */}
              <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                {/* Left: Wiring Diagram Canvas with Highlighted Defect Region */}
                <div className="lg:col-span-6 p-5 rounded-xl bg-[#06080e] border border-slate-800 font-mono text-xs relative select-none">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 mb-4 pb-2 border-b border-slate-900">
                    <span>SCHEMATIC VIEWPORT (1200 DPI)</span>
                    <span className="text-cyan-400">ZONE B3 (X: 142, Y: 280)</span>
                  </div>

                  <div className="space-y-4">
                    <div className="text-slate-400 text-[11px]">
                      [CONNECTOR J1 DEUTSCH 12-PIN]
                    </div>

                    {/* Pin 1: Valid */}
                    <div className="flex items-center gap-3">
                      <span className="text-slate-500 text-[11px] w-14">PIN 01:</span>
                      <div className="h-0.5 bg-slate-600 flex-1 relative">
                        <span className="absolute -top-3 left-4 text-[10px] bg-slate-900 px-1 border border-slate-700 rounded text-slate-300">
                          W101 20 AWG RED
                        </span>
                      </div>
                      <span className="text-emerald-400 text-[10px] font-bold">✓ PASS</span>
                    </div>

                    {/* Pin 2: Defect Highlighted with Animated Bounding Box */}
                    <div className="flex items-center gap-3 relative py-2">
                      <span className="text-slate-500 text-[11px] w-14">PIN 02:</span>
                      <div className="h-0.5 bg-cyan-500 flex-1 relative">
                        <div className="absolute -top-4 left-2 px-2.5 py-1 rounded bg-rose-500/25 border-2 border-rose-500 text-rose-200 text-[11px] font-bold shadow-lg shadow-rose-500/40 flex items-center gap-1.5 animate-pulse">
                          <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
                          <span>W102 BLU [NO GAUGE]</span>
                        </div>
                      </div>
                      <span className="text-rose-400 text-[10px] font-bold">DEFECT</span>
                    </div>

                    {/* Pin 3: Major */}
                    <div className="flex items-center gap-3">
                      <span className="text-slate-500 text-[11px] w-14">PIN 03:</span>
                      <div className="h-0.5 bg-slate-600 flex-1 relative">
                        <span className="absolute -top-3 left-4 text-[10px] bg-slate-900 px-1 border border-slate-700 rounded text-slate-400">
                          W103 22 AWG (TB1-P3)
                        </span>
                      </div>
                      <span className="text-amber-400 text-[10px] font-bold">MAJOR</span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-900 flex items-center justify-between text-[10px] text-slate-600">
                    <span>COORDINATE MAPPING: 0.2mm</span>
                    <span className="text-cyan-400">ISOLATION ACTIVE</span>
                  </div>
                </div>

                {/* Center Animated Connection Indicator (Desktop) */}
                <div className="hidden lg:flex lg:col-span-1 flex-col items-center justify-center text-cyan-400">
                  <div className="w-8 h-8 rounded-full bg-cyan-500/10 border border-cyan-500/40 flex items-center justify-center animate-pulse shadow-md shadow-cyan-500/20">
                    <ArrowRight className="w-4 h-4 text-cyan-300" />
                  </div>
                  <span className="text-[9px] font-mono text-cyan-400 uppercase mt-1 tracking-tighter">
                    BOUND
                  </span>
                </div>

                {/* Right: Finding Card (Section 36) */}
                <div className="lg:col-span-5 p-5 rounded-xl bg-[#0b101c] border border-cyan-500/40 font-mono relative shadow-xl">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <span className="text-xs font-bold text-cyan-400">FINDING D-001</span>
                    <Badge variant="severity" severity="CRITICAL" size="sm" />
                  </div>

                  <div className="mt-3 space-y-3 text-xs font-sans">
                    <div>
                      <h4 className="text-sm font-bold text-white">Missing wire gauge callout</h4>
                      <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
                        Conductor run W102 lacks specified AWG cross-section.
                      </p>
                    </div>

                    <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 font-mono text-[11px] space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">CONFIDENCE:</span>
                        <span className="text-emerald-400 font-bold">95% (Illustrative Benchmark)</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">STANDARD:</span>
                        <span className="text-cyan-300">IPC/WHMA-A-620D §4.1</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">LOCATION:</span>
                        <span className="text-slate-300">Page 1, Zone B3</span>
                      </div>
                    </div>

                    <div className="pt-2 flex items-center justify-between">
                      <Link href="/login" className="w-full">
                        <Button variant="primary" size="sm" className="w-full bg-cyan-500 text-slate-950 font-bold hover:bg-cyan-400 text-xs">
                          Inspect Evidence in Report →
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Credibility Metric Chips */}
          <div className="mt-14 pt-8 border-t border-slate-800/80 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            <CursorSpotlightCard className="p-4 text-left">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                EXECUTION SPEED
              </div>
              <div className="text-2xl font-extrabold text-white font-mono mt-1">1.4s</div>
              <div className="text-xs text-slate-400 mt-0.5">vs. 4 hours manual check</div>
            </CursorSpotlightCard>

            <CursorSpotlightCard className="p-4 text-left" spotlightColor="rgba(16, 185, 129, 0.15)">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                RULE PRECISION
              </div>
              <div className="text-2xl font-extrabold text-emerald-400 font-mono mt-1">100%</div>
              <div className="text-xs text-slate-400 mt-0.5">Gold benchmark verified</div>
            </CursorSpotlightCard>

            <CursorSpotlightCard className="p-4 text-left" spotlightColor="rgba(0, 240, 255, 0.15)">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                STANDARDS SUITE
              </div>
              <div className="text-2xl font-extrabold text-cyan-400 font-mono mt-1">IPC / UL</div>
              <div className="text-xs text-slate-400 mt-0.5">A-620D & UL 508A</div>
            </CursorSpotlightCard>

            <CursorSpotlightCard className="p-4 text-left">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                EVIDENCE TRACEABILITY
              </div>
              <div className="text-2xl font-extrabold text-white font-mono mt-1">Coordinate</div>
              <div className="text-xs text-slate-400 mt-0.5">Vector bounding boxes</div>
            </CursorSpotlightCard>
          </div>
        </div>
      </section>

      {/* SECTION 8: APPLE-STYLE PRODUCT STORYTELLING ("From drawing to decision.") */}
      <section id="storytelling" className="py-24 bg-[#080d1e] border-y border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-mono font-bold tracking-wider mb-3">
              <Activity className="w-3.5 h-3.5" />
              <span>END-TO-END QC LIFECYCLE</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
              From drawing to decision.
            </h2>
            <p className="text-sm sm:text-base text-slate-400 mt-3 leading-relaxed">
              Step through the 5 stages of our deterministic and AI-powered quality control pipeline.
            </p>
          </div>

          {/* Interactive Story Progression Track */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left: Step Selector (5 Steps) */}
            <div className="lg:col-span-5 space-y-2.5">
              {storySteps.map((s) => {
                const isActive = s.step === activeStoryStep;
                return (
                  <button
                    key={s.step}
                    onClick={() => setActiveStoryStep(s.step as 1 | 2 | 3 | 4 | 5)}
                    className={`w-full p-4 rounded-2xl border text-left transition-all cursor-pointer relative ${
                      isActive
                        ? "bg-[#11192e] border-cyan-400 shadow-xl shadow-cyan-500/15"
                        : "bg-[#0c111e] border-slate-800 hover:border-slate-700 hover:bg-[#0f1526]"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-[10px] font-mono font-bold uppercase ${isActive ? "text-cyan-400" : "text-slate-500"}`}>
                        STEP {s.step} • {s.title}
                      </span>
                      {isActive && (
                        <span className="text-[10px] font-mono font-bold text-cyan-400 px-2 py-0.5 rounded bg-cyan-500/20 border border-cyan-500/30">
                          ACTIVE STAGE
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-bold text-white">{s.headline}</h3>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">{s.desc}</p>
                  </button>
                );
              })}
            </div>

            {/* Right: Dynamic High-Fidelity Stage Preview */}
            <div className="lg:col-span-7">
              <CursorSpotlightCard className="p-6 border-cyan-500/40 bg-[#0d1426] min-h-[460px] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                    <div>
                      <span className="text-xs font-mono font-bold text-cyan-400 block">{currentStory.tagline}</span>
                      <h3 className="text-lg font-bold text-white mt-0.5">{currentStory.headline}</h3>
                    </div>
                    <span className={`text-[11px] font-mono px-2.5 py-1 rounded-full border ${currentStory.badgeColor} font-semibold`}>
                      {currentStory.statusText}
                    </span>
                  </div>

                  {/* Stage-specific Visual Experience */}
                  <div className="py-6">
                    {activeStoryStep === 1 && (
                      <div className="p-6 rounded-xl bg-slate-950 border border-slate-800 space-y-4 font-mono text-xs">
                        <div className="flex items-center gap-3">
                          <FileUp className="w-8 h-8 text-cyan-400 shrink-0" />
                          <div>
                            <div className="text-sm font-bold text-white">WH-402_Avionics_Manual_RevC.pdf</div>
                            <div className="text-slate-500 text-[11px]">4.19 MB • 8 Pages • 1200 DPI Vector</div>
                          </div>
                        </div>
                        <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-cyan-300">
                          SHA-256: 9f83a21b456cd89e1a2f3c4e5d6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a
                        </div>
                        <div className="text-emerald-400 flex items-center gap-2 text-xs">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Non-repudiation cryptographic integrity seal recorded</span>
                        </div>
                      </div>
                    )}

                    {activeStoryStep === 2 && (
                      <div className="p-6 rounded-xl bg-slate-950 border border-slate-800 space-y-3 font-mono text-xs">
                        <div className="flex items-center justify-between text-slate-500 text-[11px]">
                          <span>SPATIAL OCR TOKEN SCANNER</span>
                          <span className="text-cyan-400">ZONE B3-C4</span>
                        </div>
                        <div className="space-y-2">
                          <div className="p-2.5 rounded bg-slate-900 border border-slate-800 flex items-center justify-between">
                            <span className="text-slate-300">TOKEN: J1-P1 (TB1-P1)</span>
                            <span className="text-slate-500">X: 104, Y: 188</span>
                          </div>
                          <div className="p-2.5 rounded bg-cyan-950/40 border border-cyan-500/40 flex items-center justify-between text-cyan-300 font-bold">
                            <span>TOKEN: W102 BLU (J1-P2)</span>
                            <span>X: 142, Y: 280 [ANCHORED]</span>
                          </div>
                          <div className="p-2.5 rounded bg-slate-900 border border-slate-800 flex items-center justify-between">
                            <span className="text-slate-300">TOKEN: W103 22 AWG</span>
                            <span className="text-slate-500">X: 180, Y: 320</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {activeStoryStep === 3 && (
                      <div className="p-6 rounded-xl bg-slate-950 border border-slate-800 space-y-3 font-mono text-xs">
                        <div className="text-slate-500 text-[11px] mb-2">DETERMINISTIC RULE AUDIT MATRIX</div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between p-2 rounded bg-slate-900 text-slate-300">
                            <span>RULE-WG-001 Conductor Gauge Specification</span>
                            <span className="text-rose-400 font-bold">FAILED §4.1</span>
                          </div>
                          <div className="flex items-center justify-between p-2 rounded bg-slate-900 text-slate-300">
                            <span>RULE-CC-003 DC/AC Conductor Color Code</span>
                            <span className="text-amber-400 font-bold">WARNING §66.5</span>
                          </div>
                          <div className="flex items-center justify-between p-2 rounded bg-slate-900 text-slate-300">
                            <span>RULE-CR-004 Terminal Crimp Barrel Match</span>
                            <span className="text-emerald-400 font-bold">PASSED</span>
                          </div>
                          <div className="flex items-center justify-between p-2 rounded bg-slate-900 text-slate-300">
                            <span>RULE-RD-002 Reference Designator Uniqueness</span>
                            <span className="text-emerald-400 font-bold">PASSED</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {activeStoryStep === 4 && (
                      <div className="p-6 rounded-xl bg-slate-950 border border-slate-800 space-y-4 font-mono text-xs">
                        <div className="p-4 rounded-lg bg-rose-950/30 border border-rose-500/50 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-rose-300 font-bold">DEFECT D-001 (CRITICAL)</span>
                            <span className="text-slate-400 text-[10px]">95% CONFIDENCE (ILLUSTRATIVE)</span>
                          </div>
                          <div className="text-white font-sans text-sm font-semibold">
                            Missing wire gauge callout on conductor W102
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Observed: <span className="text-slate-200">No gauge token</span> • Expected:{" "}
                            <span className="text-emerald-400">AWG 18 min for 7.5A load</span>
                          </div>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Coordinate Anchor: Page 1, Zone B3 (Deutsch J1 Pin 2)
                        </div>
                      </div>
                    )}

                    {activeStoryStep === 5 && (
                      <div className="p-6 rounded-xl bg-slate-950 border border-slate-800 space-y-4 font-mono text-xs">
                        <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900 border border-slate-800">
                          <div>
                            <span className="text-slate-500 block text-[10px]">OVERALL QC RESULT</span>
                            <span className="text-lg font-bold text-rose-400">FAIL (78 / 100)</span>
                          </div>
                          <div className="text-right">
                            <span className="text-slate-500 block text-[10px]">TOTAL DISCREPANCIES</span>
                            <span className="text-lg font-bold text-white">6 Found</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <Link href="/login" className="flex-1">
                            <Button variant="danger" size="sm" className="w-full">
                              <FileText className="w-3.5 h-3.5 mr-1" />
                              Export PDF QC Report
                            </Button>
                          </Link>
                          <Link href="/login" className="flex-1">
                            <Button variant="pass" size="sm" className="w-full">
                              <FileSpreadsheet className="w-3.5 h-3.5 mr-1" />
                              Export Excel XLSX
                            </Button>
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-500">{currentStory.metrics}</span>
                  <button
                    onClick={() => setActiveStoryStep((prev) => (prev < 5 ? ((prev + 1) as 1 | 2 | 3 | 4 | 5) : 1))}
                    className="text-cyan-400 font-bold hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
                  >
                    <span>Next Stage</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </CursorSpotlightCard>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: Launchpad Interactive App Grid */}
      <section className="py-24 bg-[#080b13] border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-mono font-bold tracking-wider mb-3">
              <Grid className="w-3.5 h-3.5" />
              <span>THE SPANQC LAUNCHPAD™</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
              An all-in-one operating system for wiring QC.
            </h2>
            <p className="text-sm text-slate-400 mt-3 leading-relaxed">
              Launchpad unites your schematic ingestion, spatial OCR, netlist graph extraction, and verified QC report generation
              into one seamless modular workspace.
            </p>
          </div>

          {/* Launchpad Interactive App Grid */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
            {/* Left 6 Apps Tiles */}
            <div className="md:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {launchpadApps.map((app) => {
                const Icon = app.icon;
                const isSelected = app.id === activeLaunchpadApp;
                return (
                  <button
                    key={app.id}
                    onClick={() => setActiveLaunchpadApp(app.id)}
                    className={`p-4 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden group ${
                      isSelected
                        ? "bg-[#111728] border-cyan-400 shadow-xl shadow-cyan-500/15"
                        : "bg-[#0c101a] border-slate-800 hover:border-slate-700 hover:bg-[#0f1422]"
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-xl border flex items-center justify-center mb-3 ${app.bg}`}
                    >
                      <Icon className={`w-5 h-5 ${app.color}`} />
                    </div>
                    <h4 className="text-xs font-bold text-white leading-snug">{app.name}</h4>
                    <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">{app.tagline}</p>
                    {isSelected && (
                      <span className="absolute bottom-1 right-2 text-[9px] font-mono text-cyan-400 font-bold">
                        ACTIVE
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Right: Active Launchpad App Deep Dive Preview Card */}
            <div className="md:col-span-5">
              <CursorSpotlightCard className="p-6 border-cyan-500/40 bg-[#0d1322]">
                <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl border flex items-center justify-center ${activeApp.bg}`}
                    >
                      <activeApp.icon className={`w-5 h-5 ${activeApp.color}`} />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">{activeApp.name}</h3>
                      <p className="text-xs text-slate-400 font-mono">{activeApp.tagline}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                    APP RUNNING
                  </span>
                </div>

                <div className="py-5 space-y-4">
                  <p className="text-xs text-slate-300 leading-relaxed">{activeApp.desc}</p>

                  <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 font-mono text-xs">
                    <span className="text-slate-500 block text-[10px] uppercase">
                      SYSTEM CAPABILITY METRIC
                    </span>
                    <span className="text-cyan-300 font-bold mt-0.5 block">
                      {activeApp.stats}
                    </span>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                  <Link href="/login" className="w-full">
                    <Button
                      variant="primary"
                      size="sm"
                      className="w-full bg-cyan-500 text-slate-950 font-bold hover:bg-cyan-400"
                    >
                      Launch in Workspace →
                    </Button>
                  </Link>
                </div>
              </CursorSpotlightCard>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4: Interactive Discrepancy & Evidence Viewer Showcase */}
      <section className="py-20 bg-[#06070a] border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
            <div>
              <div className="text-xs font-bold font-mono text-cyan-400 uppercase tracking-wider">
                INDUSTRIAL GOLD BENCHMARK CASES
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white mt-1">
                Explore Preloaded Engineering Drawings
              </h2>
              <p className="text-sm text-slate-400 mt-1 max-w-xl">
                Inspect real avionics, motor control center, and high-voltage EV schematics verified against IPC and UL standards.
              </p>
            </div>

            {/* Test Case Selector Tabs */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800">
              <button
                onClick={() => setActiveDemoTab("wh402")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeDemoTab === "wh402"
                    ? "bg-cyan-500 text-slate-950 font-bold shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                WH-402 (Avionics)
              </button>
              <button
                onClick={() => setActiveDemoTab("mcc")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeDemoTab === "mcc"
                    ? "bg-cyan-500 text-slate-950 font-bold shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                MCC-VFD (Industrial)
              </button>
              <button
                onClick={() => setActiveDemoTab("tb200")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeDemoTab === "tb200"
                    ? "bg-cyan-500 text-slate-950 font-bold shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                TB-200 (Pass Baseline)
              </button>
            </div>
          </div>

          {/* Interactive Inspection Workspace Card */}
          <div className="rounded-2xl border border-slate-700/80 bg-[#0d121e] shadow-2xl shadow-black/80 overflow-hidden">
            <div className="px-6 py-3 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                </div>
                <span className="font-mono text-slate-300 font-medium">
                  {currentCase.title}
                </span>
                <span className="text-slate-600">|</span>
                <span className="text-[11px] font-mono text-cyan-400">
                  {currentCase.standard}
                </span>
              </div>
              <Badge variant="result" result={currentCase.status} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[460px]">
              {/* Left: Schematic Viewer Visual */}
              <div className="lg:col-span-7 p-6 bg-[#06080e] border-b lg:border-b-0 lg:border-r border-slate-800 relative flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
                    <span className="font-mono">SCHEMATIC CANVAS • SHEET 1/2</span>
                    <span className="font-mono text-cyan-400 text-[11px]">
                      COORDINATES: (X: 100-380, Y: 180-215)
                    </span>
                  </div>

                  <div className="h-64 rounded-xl bg-slate-950 border border-slate-800 relative p-4 font-mono text-xs overflow-hidden select-none bg-spaceship-grid">
                    <div className="text-slate-500 text-[10px]">
                      --- [J1 Bulkhead Deutsch 12-Pin] ---
                    </div>

                    <div className="mt-4 space-y-4">
                      {/* Wire 101 */}
                      <div className="flex items-center gap-4 text-slate-400">
                        <span className="text-[11px] text-slate-500 w-16">PIN 1:</span>
                        <div className="h-[2px] bg-slate-600 flex-1 relative">
                          <span className="absolute -top-3.5 left-8 text-[10px] text-slate-300 bg-slate-900 px-1 border border-slate-700 rounded">
                            W101 20 AWG RED (TB1-P1)
                          </span>
                        </div>
                        <span className="text-emerald-400 text-[11px]">✓ VALID</span>
                      </div>

                      {/* Wire 102 */}
                      <div className="flex items-center gap-4 relative">
                        <span className="text-[11px] text-slate-500 w-16">PIN 2:</span>
                        <div className="h-[2px] bg-cyan-500 flex-1 relative">
                          <div className="absolute -top-4 left-6 px-2 py-1 rounded bg-rose-500/25 border-2 border-rose-500 text-rose-200 text-[11px] font-bold shadow-lg shadow-rose-500/30 flex items-center gap-1.5 animate-pulse">
                            <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
                            <span>W102 BLU (J1-P2) [NO GAUGE]</span>
                          </div>
                        </div>
                        <span className="text-rose-400 text-[11px] font-bold">✗ DEFECT</span>
                      </div>

                      {/* Wire 103 */}
                      <div className="flex items-center gap-4 text-slate-400">
                        <span className="text-[11px] text-slate-500 w-16">PIN 3:</span>
                        <div className="h-[2px] bg-slate-600 flex-1 relative">
                          <span className="absolute -top-3.5 left-8 text-[10px] text-slate-300 bg-slate-900 px-1 border border-slate-700 rounded">
                            W103 22 AWG (TB1-P3) [NO COLOR]
                          </span>
                        </div>
                        <span className="text-amber-400 text-[11px]">⚠ MAJOR</span>
                      </div>
                    </div>

                    <div className="absolute bottom-2 right-2 text-[10px] text-slate-600 font-mono">
                      GRID: D-ZONE-B3 | 1200 DPI
                    </div>
                  </div>
                </div>

                <div className="mt-4 p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs">
                  <div className="flex items-center gap-2 text-slate-300 font-semibold mb-1">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Evidence-Backed Finding Trace</span>
                  </div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    The system isolates the exact raster/vector polygon containing Callout text:
                    <span className="text-slate-200 font-mono mx-1">W102 BLU (J1-P2)</span>
                    and maps it against standard IPC/WHMA-A-620 Section 4.1.
                  </p>
                </div>
              </div>

              {/* Right: QC Findings & Action Panel */}
              <div className="lg:col-span-5 p-6 flex flex-col justify-between bg-slate-900/40">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div>
                      <h4 className="text-sm font-bold text-slate-200">
                        Automated Findings
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {currentCase.checks} rules evaluated *(Sample Benchmark)* • {currentCase.discrepancies} flagged
                      </p>
                    </div>
                    <div className="text-right font-mono">
                      <span className="text-lg font-bold text-white">
                        {currentCase.status === "PASS" ? "100" : "78"}
                      </span>
                      <span className="text-xs text-slate-500">/100</span>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2.5">
                    {currentCase.findings.length > 0 ? (
                      currentCase.findings.map((f) => (
                        <div
                          key={f.code}
                          className="p-3 rounded-xl bg-[#0b0f19] border border-slate-800 hover:border-cyan-500/40 transition-colors"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-mono font-bold text-cyan-400">
                              {f.code}
                            </span>
                            <Badge variant="severity" severity={f.sev} size="sm" />
                          </div>
                          <p className="text-xs font-medium text-slate-200">{f.title}</p>
                          <p className="text-[11px] text-slate-500 font-mono mt-1">
                            Location: {f.loc}
                          </p>
                        </div>
                      ))
                    ) : (
                      <div className="py-12 text-center">
                        <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
                        <p className="text-sm font-semibold text-slate-200">
                          Zero Discrepancies Detected
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          Drawing satisfies all 64 verified IPC/WHMA-A-620 rules.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between gap-3">
                  <Link href="/login" className="flex-1">
                    <Button variant="secondary" size="sm" className="w-full">
                      <Eye className="w-3.5 h-3.5 mr-1" />
                      View Full QC Report
                    </Button>
                  </Link>
                  <Link href="/login" className="flex-1">
                    <Button variant="primary" size="sm" className="w-full bg-cyan-500 text-slate-950 font-bold hover:bg-cyan-400">
                      Run Your Drawing
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 5: Commercial Pricing Snapshot */}
      <section className="py-20 bg-[#080d1e] border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider">
              PRICING & TIERS
            </span>
            <h2 className="text-3xl font-extrabold text-white mt-1">
              Engineered for manufacturing teams.
            </h2>
            <p className="text-sm text-slate-400 mt-2">
              Transparent, quota-backed pricing without hidden charges.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {/* Starter Engineering */}
            <CursorSpotlightCard className="p-6 flex flex-col justify-between">
              <div>
                <div className="text-xs font-mono font-bold text-slate-400 uppercase">Starter Engineering</div>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-white font-mono">₹9,999</span>
                  <span className="text-xs text-slate-400">/ month</span>
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  For small design teams, engineering consultants, and prototype verification.
                </p>
                <ul className="mt-6 space-y-2.5 text-xs text-slate-300">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>35 diagram checks included monthly</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>IPC/WHMA-A-620 rules suite</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Interactive discrepancy split-screen viewer</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Structured PDF & Excel report downloads</span>
                  </li>
                </ul>
              </div>
              <div className="mt-8">
                <Link href="/pricing">
                  <Button variant="outline" size="sm" className="w-full">
                    Select Plan
                  </Button>
                </Link>
              </div>
            </CursorSpotlightCard>

            {/* Production Line Subscription */}
            <CursorSpotlightCard className="p-6 flex flex-col justify-between border-cyan-400/80 ring-1 ring-cyan-500/40 relative bg-[#0d1424]" spotlightColor="rgba(0, 240, 255, 0.25)">
              <div className="absolute -top-3 right-6 px-2.5 py-0.5 rounded-full bg-cyan-400 text-slate-950 text-[10px] font-extrabold uppercase tracking-wider">
                POPULAR
              </div>
              <div>
                <div className="text-xs font-mono font-bold text-cyan-400 uppercase">Production Line</div>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-white font-mono">₹24,999</span>
                  <span className="text-xs text-slate-400">/ month</span>
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  Built for EMS manufacturers, harness builders, and control panel lines.
                </p>
                <ul className="mt-6 space-y-2.5 text-xs text-slate-300">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>120 checks included monthly</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Full IPC-620 + UL 508A rule packages</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Sub-millimeter evidence bounding boxes</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Human sign-off audit history & Excel export</span>
                  </li>
                </ul>
              </div>
              <div className="mt-8">
                <Link href="/login">
                  <Button variant="primary" size="sm" className="w-full bg-cyan-500 text-slate-950 font-bold hover:bg-cyan-400">
                    Start Production Plan
                  </Button>
                </Link>
              </div>
            </CursorSpotlightCard>

            {/* Enterprise Multi-Plant */}
            <CursorSpotlightCard className="p-6 flex flex-col justify-between">
              <div>
                <div className="text-xs font-mono font-bold text-slate-400 uppercase">Enterprise Multi-Plant</div>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-white font-mono">₹75,000+</span>
                  <span className="text-xs text-slate-400">/ month</span>
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  For defense, aerospace, and large multi-facility manufacturing organizations.
                </p>
                <ul className="mt-6 space-y-2.5 text-xs text-slate-300">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>500+ checks or custom capacity</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Custom proprietary customer SOP rule packs</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Dedicated AWS VPC / On-Premise container</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Enterprise SLA & dedicated account manager</span>
                  </li>
                </ul>
              </div>
              <div className="mt-8">
                <Link href="/contact">
                  <Button variant="outline" size="sm" className="w-full">
                    Contact Engineering
                  </Button>
                </Link>
              </div>
            </CursorSpotlightCard>
          </div>
        </div>
      </section>

      {/* Final Call To Action */}
      <section className="py-24 bg-[#06070a] relative text-center">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-mono font-bold tracking-wider mb-6">
            <Rocket className="w-3.5 h-3.5 text-cyan-400" />
            <span>LAUNCHPAD READY</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Ready to automate wiring diagram inspection?
          </h2>
          <p className="mt-4 text-sm sm:text-base text-slate-400 max-w-xl mx-auto">
            Experience the 1.4-second automated QC check on your own drawings or try our preloaded avionics and industrial samples.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/login">
              <button className="px-6 py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-mono tracking-tight shadow-xl shadow-cyan-500/25 active:scale-95 transition-all flex items-center gap-2 cursor-pointer">
                <Rocket className="w-4 h-4" />
                <span>Launch QC Workspace</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
            <Link href="/standards">
              <Button variant="outline" size="lg">
                Explore Standards Documentation
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
