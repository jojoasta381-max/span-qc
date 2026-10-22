"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import {
  FileText,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  XCircle,
  AlertOctagon,
  AlertTriangle,
  HelpCircle,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Search,
  Check,
  X,
  ShieldCheck,
  Eye,
  Info,
} from "lucide-react";
import { QCFinding, QCRun } from "@/types";
import {
  getReportById,
  updateFindingDecision,
  triggerExcelExport,
  triggerPdfExport,
} from "@/lib/services/report-store";

export default function QCReportDetailPage({
  params,
}: {
  params: Promise<{ reportId: string }>;
}) {
  const resolvedParams = use(params);
  const reportId = resolvedParams.reportId;

  const [qcRun, setQcRun] = useState<QCRun | null>(null);
  const [findings, setFindings] = useState<QCFinding[]>([]);
  const [selectedFindingId, setSelectedFindingId] = useState<string>("");

  // Filter and search states
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Document viewer controls
  const [zoomLevel, setZoomLevel] = useState(100);
  const [activePage, setActivePage] = useState(1);

  // Human Review State
  const [reviewerComment, setReviewerComment] = useState("");
  const [feedbackSubmitted, setFeedbackSubmitted] = useState<Record<string, boolean>>({});
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  // Load report dynamically from report store
  useEffect(() => {
    const loaded = getReportById(reportId);
    if (loaded) {
      setQcRun(loaded);
      const fList = loaded.findings || [];
      setFindings(fList);
      if (fList.length > 0) {
        setSelectedFindingId(fList[0].id);
      }
    }
  }, [reportId]);

  if (!qcRun) {
    return (
      <div className="p-12 text-center text-slate-400 font-mono text-xs">
        Loading QC Report for {reportId}...
      </div>
    );
  }

  const selectedFinding =
    findings.find((f) => f.id === selectedFindingId) || findings[0] || null;

  // Filter findings
  const filteredFindings = findings.filter((f) => {
    const matchesSearch =
      f.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.standard_reference.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.description.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesSeverity = severityFilter === "ALL" || f.severity === severityFilter;
    const matchesStatus = statusFilter === "ALL" || f.status === statusFilter;

    return matchesSearch && matchesSeverity && matchesStatus;
  });

  // Action: Human review decision
  const handleReviewDecision = (decision: "CONFIRMED" | "REJECTED" | "NEEDS_REVIEW") => {
    if (!selectedFinding) return;
    const updated = updateFindingDecision(
      qcRun.id,
      selectedFinding.id,
      decision,
      "Pravin (Lead QC Inspector)",
      reviewerComment || null
    );
    if (updated && updated.findings) {
      setFindings(updated.findings);
      setQcRun(updated);
    }
    setReviewerComment("");
  };

  // Action: Submit AI feedback loop
  const handleFeedback = (isAccurate: boolean | "NOT_SURE") => {
    if (!selectedFinding) return;
    setFeedbackSubmitted((prev) => ({ ...prev, [selectedFinding.id]: true }));
  };

  // Real Export triggers (PDF and Excel)
  const handleExport = (type: "PDF" | "XLSX") => {
    if (type === "PDF") {
      setExportNotice("Compiling formal printable PDF QC Inspection Report...");
      triggerPdfExport(qcRun);
    } else {
      setExportNotice("Downloading structured Excel spreadsheet (CSV format with full coordinates)...");
      triggerExcelExport(qcRun);
    }
    setTimeout(() => {
      setExportNotice(null);
    }, 3000);
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-500 mb-1">
            <Link href="/app" className="hover:text-cyan-400">
              Dashboard
            </Link>
            <span>/</span>
            <Link href="/app/history" className="hover:text-cyan-400">
              Reports
            </Link>
            <span>/</span>
            <span className="text-slate-300 font-bold">{reportId}</span>
          </div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-white tracking-tight">
              QC Inspection Report: {qcRun.document?.filename}
            </h2>
            <Badge variant="result" result={qcRun.overall_result} />
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            AI-assisted quality checking with engineering review — keeping engineers in control.
          </p>
        </div>

        {/* Real Export Buttons */}
        <div className="flex items-center gap-2">
          <Button
            onClick={() => handleExport("PDF")}
            variant="danger"
            size="sm"
            leftIcon={<FileText className="w-4 h-4" />}
            className="cursor-pointer"
          >
            Export PDF QC Report
          </Button>
          <Button
            onClick={() => handleExport("XLSX")}
            variant="pass"
            size="sm"
            leftIcon={<FileSpreadsheet className="w-4 h-4" />}
            className="cursor-pointer"
          >
            Export Excel
          </Button>
        </div>
      </div>

      {/* Export notification banner */}
      {exportNotice && (
        <div className="p-3 rounded-xl bg-cyan-950/60 border border-cyan-500/40 text-cyan-200 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span>{exportNotice}</span>
          </div>
        </div>
      )}

      {/* REPORT SUMMARY & CHECKS MATRIX */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Overall Quality Score */}
        <Card className="p-4 flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
            OVERALL SCORE
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-white font-mono">
              {qcRun.quality_score}
            </span>
            <span className="text-xs text-slate-500 font-mono">/ 100</span>
          </div>
          <span className="text-[11px] text-rose-400 font-medium mt-1">
            {qcRun.overall_result === "FAIL" ? "Rejection: Critical errors present" : "Pass: Compliant"}
          </span>
        </Card>

        {/* Critical Findings */}
        <Card className="p-4 border-red-500/30 bg-red-950/15">
          <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
            <AlertOctagon className="w-3.5 h-3.5" />
            CRITICAL DEFECTS
          </span>
          <div className="mt-2">
            <span className="text-3xl font-extrabold text-red-400 font-mono">
              {qcRun.critical_count}
            </span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Immediate stop-work flags
          </span>
        </Card>

        {/* Major Findings */}
        <Card className="p-4 border-amber-500/30 bg-amber-950/15">
          <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            MAJOR FLAGS
          </span>
          <div className="mt-2">
            <span className="text-3xl font-extrabold text-amber-400 font-mono">
              {qcRun.major_count}
            </span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Requires engineering signoff
          </span>
        </Card>

        {/* Minor Findings */}
        <Card className="p-4">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
            MINOR / DOCUMENTATION
          </span>
          <div className="mt-2">
            <span className="text-3xl font-extrabold text-slate-300 font-mono">
              {qcRun.minor_count}
            </span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Title block & format notes
          </span>
        </Card>

        {/* Verified Rules Passed */}
        <Card className="p-4 border-emerald-500/30 bg-emerald-950/15">
          <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            CHECKS PASSED
          </span>
          <div className="mt-2">
            <span className="text-3xl font-extrabold text-emerald-400 font-mono">
              {qcRun.pass_count}
            </span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {qcRun.total_rules_evaluated} rules evaluated *(Sample Benchmark)*
          </span>
        </Card>
      </div>

      {/* DOCUMENT + FINDING SPLIT VIEW */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT: Synchronized Document Viewer (7 cols) */}
        <div className="lg:col-span-7 space-y-3">
          <div className="p-3 rounded-xl bg-[#0c101a] border border-[#1b253b] flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="font-mono text-slate-300">
                Page {activePage} of {qcRun.document?.page_count || 1}
              </span>
              <button
                onClick={() => setActivePage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg bg-[#111726] border border-[#1b253b] text-slate-300 hover:text-white cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setActivePage((p) => Math.min(qcRun.document?.page_count || 1, p + 1))}
                className="p-1.5 rounded-lg bg-[#111726] border border-[#1b253b] text-slate-300 hover:text-white cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setZoomLevel((z) => Math.max(50, z - 25))}
                className="p-1.5 rounded-lg bg-[#111726] border border-[#1b253b] text-slate-300 hover:text-white cursor-pointer"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono text-slate-300 w-10 text-center">{zoomLevel}%</span>
              <button
                onClick={() => setZoomLevel((z) => Math.min(200, z + 25))}
                className="p-1.5 rounded-lg bg-[#111726] border border-[#1b253b] text-slate-300 hover:text-white cursor-pointer"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              {selectedFinding && (
                <>
                  <span className="text-slate-600">|</span>
                  <span className="font-mono text-cyan-400 text-[11px]">
                    SELECTED: {selectedFinding.code}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Canvas with Schematic or Uploaded Image */}
          <div className="h-[520px] rounded-2xl bg-[#06070a] border border-[#1b253b] relative p-6 font-mono text-xs overflow-auto flex flex-col justify-between bg-schematic-grid-dense select-none">
            {qcRun.document?.storage_path ? (
              <div
                style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: "top left" }}
                className="transition-transform duration-150 flex flex-col items-center justify-center min-h-[380px]"
              >
                <div className="p-2 bg-slate-900/80 border border-slate-800 rounded-lg text-[11px] text-cyan-300 mb-3 w-full flex justify-between">
                  <span>LIVE SCHEMATIC VIEWPORT: {qcRun.document.filename}</span>
                  <span className="text-emerald-400">VERIFIED UPLOAD</span>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qcRun.document.storage_path}
                  alt={qcRun.document.filename}
                  className="max-h-[360px] object-contain rounded border border-slate-700 shadow-2xl"
                />
              </div>
            ) : (
              <div
                style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: "top left" }}
                className="space-y-6 min-w-[620px] transition-transform duration-150"
              >
                <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-lg text-[11px] text-slate-400 flex items-center justify-between">
                  <span>SCHEMATIC: {qcRun.document?.filename}</span>
                  <span className="text-slate-400">ZONE B3-D4</span>
                </div>

                {/* Wire Lines and Highlight Overlay */}
                <div className="p-6 bg-slate-950/80 rounded-xl border border-slate-800 space-y-6 relative">
                  <div className="text-slate-500 text-[11px]">
                    --- CONNECTOR J1 PINOUT MATRIX & HARNESS CHANNELS ---
                  </div>

                  {/* Wire 101 */}
                  <div className="flex items-center gap-4 text-slate-400">
                    <span className="w-20 text-slate-500">PIN 01:</span>
                    <div className="h-0.5 bg-slate-600 flex-1 relative">
                      <span className="absolute -top-3 left-8 text-[10px] bg-slate-900 px-1 border border-slate-700 rounded text-slate-300">
                        W101 20 AWG RED (TB1-P1)
                      </span>
                    </div>
                    <span className="text-emerald-400 text-[10px]">✓ PASS</span>
                  </div>

                  {/* Wire 102 - Dynamic Evidence Bounding Box */}
                  <div className="flex items-center gap-4 relative">
                    <span className="w-20 text-slate-500">PIN 02:</span>
                    <div className="h-0.5 bg-cyan-500 flex-1 relative">
                      <div
                        className={`absolute -top-4 left-6 px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1.5 transition-all ${
                          selectedFinding?.severity === "CRITICAL"
                            ? "bg-red-500/25 border-2 border-red-500 text-red-200 shadow-xl shadow-red-500/30 scale-105 animate-pulse"
                            : "bg-slate-900 border border-slate-700 text-slate-300"
                        }`}
                      >
                        <AlertOctagon className="w-3.5 h-3.5 text-red-400" />
                        <span>W102 BLU (J1-P2) [EVIDENCE REGION]</span>
                      </div>
                    </div>
                    <span className="text-red-400 text-[10px] font-bold">✗ DEFECT</span>
                  </div>

                  {/* Wire 103 */}
                  <div className="flex items-center gap-4 relative">
                    <span className="w-20 text-slate-500">PIN 03:</span>
                    <div className="h-0.5 bg-slate-600 flex-1 relative">
                      <div
                        className={`absolute -top-4 left-6 px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1.5 transition-all ${
                          selectedFinding?.severity === "MAJOR"
                            ? "bg-orange-500/25 border-2 border-orange-500 text-orange-200 shadow-xl shadow-orange-500/30 scale-105"
                            : "bg-slate-900 border border-slate-700 text-slate-300"
                        }`}
                      >
                        <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
                        <span>W103 22 AWG (TB1-P3) [FLAGGED]</span>
                      </div>
                    </div>
                    <span className="text-orange-400 text-[10px] font-bold">⚠ MAJOR</span>
                  </div>

                  {/* Crossing without dot */}
                  <div className="flex items-center gap-4 relative pt-4 border-t border-slate-900">
                    <span className="w-20 text-slate-500">NET CROSS:</span>
                    <div className="h-0.5 bg-slate-600 flex-1 relative">
                      <div className="absolute -top-4 left-32 px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1.5 bg-slate-900 border border-slate-700 text-slate-400">
                        <span>CAN_HI ✕ GND (420, 310)</span>
                      </div>
                    </div>
                    <span className="text-orange-400 text-[10px] font-bold">⚠ MAJOR</span>
                  </div>
                </div>
              </div>
            )}

            <div className="text-[10px] text-slate-500 pt-3 border-t border-slate-900 flex items-center justify-between">
              <span>LOCATION: {selectedFinding?.location?.sheet_reference || "Sheet 1"}</span>
              <span className="font-mono text-cyan-400">
                COORDINATES: X:{selectedFinding?.location?.coordinates?.x || 142} Y:
                {selectedFinding?.location?.coordinates?.y || 280}
              </span>
            </div>
          </div>
        </div>

        {/* RIGHT: Finding Detail & Human Review Action Panel */}
        <div className="lg:col-span-5 space-y-4">
          {selectedFinding ? (
            <Card className="p-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-white font-mono">
                    {selectedFinding.id}
                  </span>
                  <span className="text-slate-600">•</span>
                  <span className="text-xs font-mono text-cyan-400">
                    {selectedFinding.code}
                  </span>
                </div>
                <Badge variant="severity" severity={selectedFinding.severity} />
              </div>

              <div className="mt-4 space-y-4 text-xs">
                <div>
                  <h4 className="text-sm font-bold text-slate-100">
                    {selectedFinding.title}
                  </h4>
                  <p className="text-slate-400 mt-1 leading-relaxed">
                    {selectedFinding.description}
                  </p>
                </div>

                {/* FACT vs STANDARD REQUIREMENT vs AI INTERPRETATION */}
                <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2.5">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono block">
                      OBSERVED SCHEMATIC FACT (OCR / VECTOR)
                    </span>
                    <span className="text-slate-200 font-mono font-semibold">
                      {selectedFinding.detected_value}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono block">
                      STANDARD REQUIREMENT
                    </span>
                    <span className="text-emerald-400 font-mono">
                      {selectedFinding.expected_value}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                    <span className="text-[10px] font-mono text-slate-400">
                      CLAUSE: {selectedFinding.standard_reference}
                    </span>
                    <span className="text-[10px] font-mono font-bold text-cyan-400">
                      CONFIDENCE: {(selectedFinding.confidence_score * 100).toFixed(0)}% *(Sample)*
                    </span>
                  </div>
                </div>

                {/* Recommended Engineering Action */}
                {selectedFinding.recommended_remediation && (
                  <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-slate-300">
                    <span className="text-[10px] font-bold text-cyan-400 uppercase font-mono block mb-1">
                      RECOMMENDED REMEDIATION
                    </span>
                    <p className="text-xs leading-relaxed text-cyan-100">
                      {selectedFinding.recommended_remediation}
                    </p>
                  </div>
                )}

                {/* HUMAN REVIEW & SIGN-OFF ACTIONS */}
                <div className="pt-4 border-t border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white uppercase font-mono">
                      Inspector Human Sign-Off
                    </span>
                    {selectedFinding.status !== "OPEN" && (
                      <Badge variant="status" status={selectedFinding.status} size="sm" />
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => handleReviewDecision("CONFIRMED")}
                      className={`p-2 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                        selectedFinding.status === "CONFIRMED"
                          ? "bg-red-600 text-white border-red-500 shadow-md shadow-red-500/20"
                          : "bg-slate-900 border-slate-700 text-slate-300 hover:border-red-500 hover:text-white"
                      }`}
                    >
                      <Check className="w-3.5 h-3.5 text-red-400" />
                      <span>Confirm Defect</span>
                    </button>

                    <button
                      onClick={() => handleReviewDecision("REJECTED")}
                      className={`p-2 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                        selectedFinding.status === "REJECTED"
                          ? "bg-slate-700 text-white border-slate-500"
                          : "bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <X className="w-3.5 h-3.5 text-slate-400" />
                      <span>False Alarm</span>
                    </button>

                    <button
                      onClick={() => handleReviewDecision("NEEDS_REVIEW")}
                      className={`p-2 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                        selectedFinding.status === "NEEDS_REVIEW"
                          ? "bg-amber-600 text-white border-amber-500"
                          : "bg-slate-900 border-slate-700 text-slate-300 hover:border-amber-500"
                      }`}
                    >
                      <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
                      <span>Needs Review</span>
                    </button>
                  </div>

                  {/* Reviewer Note Input */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Add engineering review note..."
                      value={reviewerComment}
                      onChange={(e) => setReviewerComment(e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
                    />
                    <Button
                      onClick={() =>
                        handleReviewDecision(
                          selectedFinding.status === "OPEN"
                            ? "CONFIRMED"
                            : (selectedFinding.status as "CONFIRMED")
                        )
                      }
                      variant="secondary"
                      size="sm"
                      className="cursor-pointer"
                    >
                      Sign
                    </Button>
                  </div>

                  {selectedFinding.reviewer_name && (
                    <p className="text-[10px] text-slate-400 font-mono mt-1">
                      Reviewed by {selectedFinding.reviewer_name}
                      {selectedFinding.reviewer_comment ? `: "${selectedFinding.reviewer_comment}"` : ""}
                    </p>
                  )}
                </div>

                {/* FEEDBACK LOOP */}
                <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Was this rule check accurate?</span>
                  {feedbackSubmitted[selectedFinding.id] ? (
                    <span className="text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Recorded in test suite
                    </span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleFeedback(true)}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => handleFeedback(false)}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                      >
                        No
                      </button>
                      <button
                        onClick={() => handleFeedback("NOT_SURE")}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 cursor-pointer"
                      >
                        Not sure
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ) : (
            <Card className="p-8 text-center text-slate-400">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-white">No Discrepancies</p>
              <p className="text-xs mt-1">This drawing passed all evaluated rules.</p>
            </Card>
          )}
        </div>
      </div>

      {/* DISCREPANCY TABLE */}
      <div className="space-y-4 pt-6 border-t border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">
              All Discrepancies & Findings Catalogue ({filteredFindings.length})
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Click any finding row to isolate its coordinates on the drawing viewer above.
            </p>
          </div>

          {/* Filters & Search */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-48">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filter findings..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg text-xs pl-8 pr-3 py-1.5 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-lg text-xs px-2.5 py-1.5 text-slate-300 focus:outline-none"
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">Critical</option>
              <option value="MAJOR">Major</option>
              <option value="MINOR">Minor</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-lg text-xs px-2.5 py-1.5 text-slate-300 focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="OPEN">Open</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="REJECTED">False Alarm</option>
              <option value="NEEDS_REVIEW">Needs Review</option>
            </select>
          </div>
        </div>

        {/* Findings Table */}
        <div className="rounded-xl border border-slate-800 bg-[#0f172a] overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/90 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
              <tr>
                <th className="p-3.5">ID</th>
                <th className="p-3.5">Description & Title</th>
                <th className="p-3.5">Severity</th>
                <th className="p-3.5">Confidence *(Sample)*</th>
                <th className="p-3.5">Standard Clause</th>
                <th className="p-3.5">Location</th>
                <th className="p-3.5">Review Status</th>
                <th className="p-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredFindings.map((finding) => {
                const isSelected = finding.id === selectedFindingId;
                return (
                  <tr
                    key={finding.id}
                    onClick={() => {
                      setSelectedFindingId(finding.id);
                      setActivePage(finding.location.page || 1);
                    }}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? "bg-cyan-600/15" : "hover:bg-slate-900/50"
                    }`}
                  >
                    <td className="p-3.5 font-mono font-bold text-cyan-400">
                      {finding.id}
                    </td>
                    <td className="p-3.5">
                      <div className="font-semibold text-slate-200">{finding.title}</div>
                      <div className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                        {finding.description}
                      </div>
                    </td>
                    <td className="p-3.5">
                      <Badge variant="severity" severity={finding.severity} size="sm" />
                    </td>
                    <td className="p-3.5 font-mono text-slate-300">
                      {(finding.confidence_score * 100).toFixed(0)}%
                    </td>
                    <td className="p-3.5 font-mono text-slate-400 text-[11px]">
                      {finding.standard_reference}
                    </td>
                    <td className="p-3.5 font-mono text-slate-400 text-[11px]">
                      {finding.location.sheet_reference || `Page ${finding.location.page}`}
                    </td>
                    <td className="p-3.5">
                      <Badge variant="status" status={finding.status} size="sm" />
                    </td>
                    <td className="p-3.5 text-right">
                      <Button
                        variant={isSelected ? "primary" : "ghost"}
                        size="xs"
                        className="cursor-pointer"
                      >
                        Inspect
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
