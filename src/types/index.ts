/**
 * SpanQC Core Type Definitions
 * Strict TypeScript types aligned with backend data schemas and domain entities.
 * No `any` allowed.
 */

// ==========================================
// Authentication & Organization
// ==========================================

export type UserRole = "ADMIN" | "ENGINEER" | "REVIEWER";

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  is_google_auth_enabled?: boolean;
  has_google_linked?: boolean;
  created_at: string;
  organization_id?: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  tier?: "PAY_PER_CHECK" | "SUBSCRIPTION" | "ENTERPRISE";
  max_monthly_checks?: number;
  used_monthly_checks?: number;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface AuthState {
  user: User | null;
  organization: Organization | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface OrgMember {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  joined_at: string;
  last_active?: string;
}

// ==========================================
// Projects
// ==========================================

export interface Project {
  id: string;
  organization_id: string;
  name: string;
  description?: string | null;
  customer?: string | null;
  standard?: string | null;
  created_at: string;
  document_count?: number;
  report_count?: number;
  status?: "ACTIVE" | "ARCHIVED";
}

// ==========================================
// Documents & Ingestion
// ==========================================

export type DocumentStatus = 
  | "PENDING_UPLOAD"
  | "UPLOADED"
  | "VALIDATING"
  | "VALIDATED"
  | "PROCESSING"
  | "PROCESSED"
  | "FAILED";

export interface DocumentEntity {
  id: string;
  organization_id: string;
  project_id: string;
  filename: string;
  file_size_bytes: number;
  mime_type: string;
  sha256_hash?: string;
  page_count: number;
  status: DocumentStatus;
  storage_path?: string;
  created_at: string;
  updated_at?: string;
}

export interface ProcessingJob {
  id: string;
  document_id: string;
  status: "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";
  stage: 
    | "INITIALIZING"
    | "RASTERIZING"
    | "OCR_ANALYSIS"
    | "NETLIST_EXTRACTION"
    | "COMPLIANCE_RUNNING"
    | "GENERATING_REPORT"
    | "DONE";
  progress_pct: number;
  error_message?: string | null;
  created_at: string;
  updated_at: string;
}

// ==========================================
// QC Runs & Findings
// ==========================================

export type QCStatus = 
  | "QUEUED"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export type FindingSeverity = "CRITICAL" | "MAJOR" | "MINOR" | "WARNING" | "INFO";

export type FindingStatus = "OPEN" | "CONFIRMED" | "REJECTED" | "NEEDS_REVIEW" | "RESOLVED";

export interface BoundingBox {
  page_number: number;
  x_min: number; // Normalized 0-1000 or absolute coordinate
  y_min: number;
  x_max: number;
  y_max: number;
  label?: string;
}

export interface QCFinding {
  id: string;
  qc_run_id: string;
  code: string; // e.g. "D-001", "IPC-620-E4"
  rule_id: string;
  rule_name: string;
  standard_reference: string; // e.g. "IPC/WHMA-A-620 §4.2.1"
  severity: FindingSeverity;
  confidence_score: number; // 0.0 - 1.0
  title: string;
  description: string;
  expected_value: string;
  detected_value: string;
  location: {
    page: number;
    sheet_reference?: string;
    coordinates?: { x: number; y: number; width?: number; height?: number };
    net_id?: string;
    component_ref?: string;
  };
  bounding_boxes?: BoundingBox[];
  status: FindingStatus;
  human_decision?: "CONFIRMED" | "REJECTED" | "NEEDS_REVIEW" | null;
  reviewer_name?: string | null;
  reviewer_comment?: string | null;
  reviewed_at?: string | null;
  recommended_remediation?: string;
  is_ai_interpretation: boolean;
  created_at: string;
}

export interface QCRun {
  id: string;
  organization_id: string;
  document_id: string;
  project_id: string;
  standard: string;
  standard_version?: string;
  status: QCStatus;
  current_stage?: string;
  progress_percent?: number;
  overall_result: "PASS" | "FAIL" | "PENDING";
  quality_score: number; // 0 - 100
  total_rules_evaluated: number;
  total_discrepancies: number;
  critical_count: number;
  major_count: number;
  minor_count: number;
  pass_count: number;
  started_at: string;
  completed_at?: string | null;
  document?: DocumentEntity;
  project?: Project;
  findings?: QCFinding[];
}

export interface QCReportSummary {
  qc_run_id: string;
  document_id: string;
  document_name: string;
  project_name: string;
  standard: string;
  date: string;
  overall_result: "PASS" | "FAIL";
  quality_score: number;
  checks_executed: number;
  checks_passed: number;
  checks_failed: number;
  checks_na: number;
  critical_findings: number;
  major_findings: number;
  minor_findings: number;
  average_confidence: number;
  reviewer_summary?: {
    total_reviewed: number;
    confirmed_defects: number;
    false_positives: number;
  };
}

// ==========================================
// Standards
// ==========================================

export interface StandardRule {
  id: string;
  code: string;
  section: string;
  title: string;
  description: string;
  severity: FindingSeverity;
  category: "WIRE_GAUGE" | "TERMINATION" | "CLEARANCE" | "COLOR_CODE" | "ROUTING" | "LABELING" | "RETENTION";
  is_automated: boolean;
}

export interface StandardDefinition {
  id: string;
  code: string;
  name: string;
  version: string;
  status: "ACTIVE" | "SUPERSEDED" | "DRAFT";
  category: "AEROSPACE" | "INDUSTRIAL_AUTOMATION" | "AUTOMOTIVE" | "CUSTOM_SOP";
  rule_count: number;
  description: string;
  last_updated: string;
  rules?: StandardRule[];
}

// ==========================================
// Billing & Quota
// ==========================================

export interface BillingPlan {
  id: string;
  name: string;
  tier: "PAY_PER_CHECK" | "SUBSCRIPTION" | "ENTERPRISE";
  price_inr: number;
  price_usd: number;
  interval: "per_check" | "monthly" | "yearly";
  checks_included: number;
  features: string[];
  popular?: boolean;
}

export interface UsageQuota {
  checks_used: number;
  checks_limit: number;
  checks_remaining: number;
  percent_used: number;
  cycle_start: string;
  cycle_end: string;
  status: "NORMAL" | "WARNING" | "CRITICAL" | "EXCEEDED";
}

export interface Invoice {
  id: string;
  invoice_number: string;
  amount: number;
  currency: string;
  status: "PAID" | "PENDING" | "FAILED";
  date: string;
  pdf_url?: string;
}

// ==========================================
// Audit Logs & Feedback
// ==========================================

export interface AuditEvent {
  id: string;
  organization_id: string;
  user_email: string;
  user_name: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details: string;
  timestamp: string;
  ip_address?: string;
}

export interface FeedbackSubmission {
  finding_id: string;
  is_accurate: boolean | "NOT_SURE";
  feedback_category?: "INCORRECT_BOUNDS" | "WRONG_STANDARD_INTERPRETATION" | "FALSE_ALARM" | "OTHER";
  comments?: string;
}
