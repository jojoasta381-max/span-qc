import { randomUUID } from "node:crypto";
import { db } from "../db";
import { storeDocument, retrieveDocument } from "../storage/document-store";
import { validateUploadFile, DocumentValidationError } from "./validator";
import type { QCJobStatus, QCOverallOutcome, QCReport } from "./types";

export class QuotaExceededError extends Error {
  public statusCode = 402;
  constructor(message = "Monthly QC check quota exceeded. Please upgrade your plan.") {
    super(message);
    this.name = "QuotaExceededError";
  }
}

export class JobBridgeError extends Error {
  public statusCode: number;
  constructor(message: string, statusCode = 500) {
    super(message);
    this.name = "JobBridgeError";
    this.statusCode = statusCode;
  }
}

const DEFAULT_PYTHON_SERVICE_URL = "http://127.0.0.1:8000";
const ANALYSIS_TIMEOUT_MS = Number(process.env.SPANQC_ANALYSIS_TIMEOUT_MS) || 90_000;

/**
 * Returns strictly validated Python QC service URL, blocking arbitrary user-controlled endpoints (SSRF).
 */
export function getPythonServiceUrl(): string {
  const configured = process.env.SPANQC_PYTHON_SERVICE_URL || DEFAULT_PYTHON_SERVICE_URL;
  try {
    const parsed = new URL(configured);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("Invalid protocol for Python QC service.");
    }
    // Disallow loopback redirection attacks or credentials in URL
    if (parsed.username || parsed.password) {
      throw new Error("User credentials in service URL are forbidden.");
    }
    return configured.replace(/\/+$/, "");
  } catch (err) {
    console.error("[QC_CONFIG_ERROR] Invalid SPANQC_PYTHON_SERVICE_URL:", err);
    return DEFAULT_PYTHON_SERVICE_URL;
  }
}

export interface CreateJobInput {
  tenantId: string;
  projectId: string;
  userId: string;
  fileBuffer: Buffer;
  originalFilename?: string;
  standard?: string;
  expectedNetlistJson?: string | null;
  specificationIsComplete?: boolean | null;
  extractionIsVerified?: boolean | null;
  scopeDescription?: string | null;
  idempotencyKey?: string | null;
  autoDispatch?: boolean;
}

/**
 * Reconciles/refunds a tenant's quota reservation exactly once.
 * Atomic and idempotent: returns true if refunded, false if already refunded.
 */
export async function reconcileQuotaOnce(jobId: string, tenantId: string): Promise<boolean> {
  return await db.$transaction(async (tx) => {
    const currentJob = await tx.qCJob.findUnique({
      where: { id: jobId },
      select: { quotaRefunded: true, tenantId: true },
    });

    if (!currentJob || currentJob.quotaRefunded) {
      return false; // Already refunded or nonexistent
    }

    await tx.qCJob.update({
      where: { id: jobId },
      data: { quotaRefunded: true },
    });

    await tx.tenant.update({
      where: { id: tenantId },
      data: { quotaUsed: { decrement: 1 } },
    });

    console.log(`[QC_QUOTA_RECONCILED] Restored quota check for tenant ${tenantId} (Job: ${jobId}).`);
    return true;
  });
}

/**
 * Atomically validates quota, stores document privately, and persists QCJob record.
 * Handles idempotency to prevent duplicate jobs and double charging.
 */
export async function createQCJob(input: CreateJobInput) {
  const {
    tenantId,
    projectId,
    userId,
    fileBuffer,
    originalFilename,
    standard = "IPC/WHMA-A-620D",
    expectedNetlistJson,
    specificationIsComplete,
    extractionIsVerified,
    scopeDescription,
    idempotencyKey,
  } = input;

  // 1. Content-based file validation (magic bytes, SHA-256, size limits)
  const validation = validateUploadFile(fileBuffer, originalFilename);

  // 2. Normalize idempotency key
  const cleanIdempotencyKey =
    idempotencyKey && typeof idempotencyKey === "string" && idempotencyKey.trim().length > 0
      ? idempotencyKey.trim().slice(0, 128)
      : null;

  // 3. Atomically check idempotency and reserve quota inside Prisma transaction
  let result;
  try {
    result = await db.$transaction(async (tx) => {
      // Idempotency check: if job exists for this tenant with identical idempotencyKey, return existing job
      if (cleanIdempotencyKey) {
        const existing = await tx.qCJob.findUnique({
          where: {
            tenantId_idempotencyKey: {
              tenantId,
              idempotencyKey: cleanIdempotencyKey,
            },
          },
        });
        if (existing) {
          return {
            job: existing,
            isDuplicate: true,
            quotaReserved: false,
          };
        }
      }

      // Tenant check and atomic quota validation
      const tenant = await tx.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true, status: true, checkQuota: true, quotaUsed: true },
      });

      if (!tenant || tenant.status !== "ACTIVE") {
        throw new JobBridgeError("Tenant organization is inactive or not found.", 403);
      }

      if (tenant.quotaUsed >= tenant.checkQuota) {
        throw new QuotaExceededError(
          `Monthly QC check quota exceeded (${tenant.quotaUsed}/${tenant.checkQuota} checks used).`
        );
      }

      // Project ownership validation
      const project = await tx.project.findFirst({
        where: { id: projectId, tenantId },
        select: { id: true, status: true },
      });

      if (!project || project.status !== "ACTIVE") {
        throw new JobBridgeError("Project not found or inactive within tenant organization.", 404);
      }

      // Atomically increment quotaUsed
      await tx.tenant.update({
        where: { id: tenantId },
        data: {
          quotaUsed: { increment: 1 },
        },
      });

      // Store file in private tenant storage
      const storageRes = await storeDocument(tenantId, validation.sha256, fileBuffer);

      // Create durable QCJob record
      const job = await tx.qCJob.create({
        data: {
          tenantId,
          projectId,
          userId,
          idempotencyKey: cleanIdempotencyKey,
          documentName: validation.sanitizedFilename,
          documentSha256: validation.sha256,
          storageKey: storageRes.storageKey,
          standard,
          expectedNetlistJson: expectedNetlistJson || null,
          specificationIsComplete: specificationIsComplete ?? null,
          extractionIsVerified: extractionIsVerified ?? null,
          scopeDescription: scopeDescription || null,
          status: "QUEUED",
        },
      });

      return {
        job,
        isDuplicate: false,
        quotaReserved: true,
      };
    });
  } catch (err: any) {
    // If a concurrent sub-millisecond race condition violated the unique constraint,
    // fetch the winning job and return it cleanly without overspending quota
    if (err?.code === "P2002" && cleanIdempotencyKey) {
      const existing = await db.qCJob.findUnique({
        where: {
          tenantId_idempotencyKey: {
            tenantId,
            idempotencyKey: cleanIdempotencyKey,
          },
        },
      });
      if (existing) {
        return {
          job: existing,
          isDuplicate: true,
          quotaReserved: false,
        };
      }
    }
    throw err;
  }

  // If a new job was created, launch background processing
  const shouldDispatch =
    input.autoDispatch !== undefined
      ? input.autoDispatch
      : process.env.SPANQC_DISABLE_AUTO_DISPATCH !== "true";

  if (!result.isDuplicate && shouldDispatch) {
    processQCJob(result.job.id).catch((err) => {
      console.error(`[QC_WORKER_DISPATCH_ERROR] Job ${result.job.id}:`, err);
    });
  }

  return result;
}

/**
 * Validates Python QCReport response against schema and security invariants.
 */
export function validateAndSanitizeReport(
  rawJson: unknown,
  expectedSha256: string
): QCReport {
  if (!rawJson || typeof rawJson !== "object") {
    throw new Error("Analysis service returned invalid non-object response.");
  }

  const obj = rawJson as Record<string, unknown>;

  if (typeof obj.report_id !== "string" || !obj.report_id) {
    throw new Error("Missing or invalid report_id in analysis result.");
  }
  if (typeof obj.sha256_hash !== "string") {
    throw new Error("Missing sha256_hash in analysis result.");
  }
  if (obj.sha256_hash.toLowerCase() !== expectedSha256.toLowerCase()) {
    throw new Error("Document hash mismatch between stored document and analysis report.");
  }

  const outcome = String(obj.overall_outcome);
  if (!["PASS", "FAIL", "REVIEW"].includes(outcome)) {
    throw new Error(`Invalid overall_outcome: ${outcome}`);
  }

  if (!Array.isArray(obj.rule_findings)) {
    throw new Error("Missing or invalid rule_findings array.");
  }

  const totalPageCount = Number(obj.total_page_count) || 1;
  const processedPageCount = Number(obj.processed_page_count) || 0;
  const failedPageCount = Number(obj.failed_page_count) || 0;
  const unprocessedPages = Array.isArray(obj.unprocessed_page_numbers)
    ? (obj.unprocessed_page_numbers as number[])
    : [];
  const failedPages = Array.isArray(obj.failed_page_numbers)
    ? (obj.failed_page_numbers as number[])
    : [];

  let finalOutcome = outcome as QCOverallOutcome;

  // Enforce coverage invariant: partial processing or failed pages MUST NEVER produce PASS
  if (
    finalOutcome === "PASS" &&
    (failedPageCount > 0 ||
      failedPages.length > 0 ||
      unprocessedPages.length > 0 ||
      processedPageCount < totalPageCount)
  ) {
    console.warn("[QC_COVERAGE_GUARD] Blocking unsupported PASS outcome due to partial page coverage.");
    finalOutcome = "REVIEW";
  }

  // Enforce defect precedence invariant: FAIL > REVIEW > PASS
  const findings = obj.rule_findings as any[];
  const hasFailFinding = findings.some(
    (f) => f && (f.outcome === "FAIL" || f.severity === "CRITICAL")
  );
  const hasReviewFinding = findings.some(
    (f) => f && (f.outcome === "REVIEW" || f.human_review_required === true)
  );

  if (hasFailFinding && finalOutcome !== "FAIL") {
    console.warn("[QC_PRECEDENCE_GUARD] Overriding outcome to FAIL due to presence of FAIL rule findings.");
    finalOutcome = "FAIL";
  } else if (hasReviewFinding && finalOutcome === "PASS") {
    console.warn("[QC_PRECEDENCE_GUARD] Overriding outcome to REVIEW due to presence of REVIEW rule findings.");
    finalOutcome = "REVIEW";
  }

  return {
    report_id: String(obj.report_id),
    document_name: String(obj.document_name || "document.pdf"),
    sha256_hash: String(obj.sha256_hash),
    standard: String(obj.standard || "IPC/WHMA-A-620D"),
    created_at: String(obj.created_at || new Date().toISOString()),
    model_used: String(obj.model_used || "unknown"),
    overall_outcome: finalOutcome,
    specification_is_complete: Boolean(obj.specification_is_complete),
    extraction_is_verified: Boolean(obj.extraction_is_verified),
    trusted_verification: obj.trusted_verification,
    scope_description: obj.scope_description ? String(obj.scope_description) : null,
    rule_findings: findings,
    candidate_observations: Array.isArray(obj.candidate_observations)
      ? (obj.candidate_observations as any)
      : [],
    pages_rendered: Array.isArray(obj.pages_rendered) ? (obj.pages_rendered as string[]) : [],
    total_page_count: totalPageCount,
    processed_page_count: processedPageCount,
    failed_page_count: failedPageCount,
    unprocessed_page_numbers: unprocessedPages,
    failed_page_numbers: failedPages,
    is_experimental: true,
    disclaimer: String(
      obj.disclaimer ||
        "EXPERIMENTAL PROOF OF CONCEPT: Results are candidate AI extractions validated by deterministic rules."
    ),
  };
}

/**
 * Atomically claims a job from QUEUED state with an opaque claimToken and timestamp.
 * Returns claim details if claimed, or null if already claimed/nonexistent.
 */
export async function claimJob(
  jobId: string,
  customClaimToken?: string
): Promise<{ claimToken: string; claimedAt: Date } | null> {
  const claimToken = customClaimToken || randomUUID();
  const now = new Date();

  const claim = await db.qCJob.updateMany({
    where: {
      id: jobId,
      status: "QUEUED",
    },
    data: {
      status: "PROCESSING",
      claimToken,
      claimedAt: now,
      retryCount: { increment: 1 },
      updatedAt: now,
    },
  });

  if (claim.count === 0) {
    return null;
  }

  return { claimToken, claimedAt: now };
}

/**
 * Reclaims stale PROCESSING jobs that have exceeded the heartbeat/inactivity threshold.
 * If retries remain, re-queues them. If retries are exhausted, marks them as FAILED and reconciles quota.
 */
export async function reclaimStaleJobs(staleThresholdMs = 120_000): Promise<{
  reclaimedCount: number;
  exhaustedCount: number;
}> {
  const cutoff = new Date(Date.now() - staleThresholdMs);
  const staleJobs = await db.qCJob.findMany({
    where: {
      status: "PROCESSING",
      claimedAt: { lt: cutoff },
    },
  });

  let reclaimedCount = 0;
  let exhaustedCount = 0;

  for (const job of staleJobs) {
    if (job.retryCount < job.maxRetries) {
      const updated = await db.qCJob.updateMany({
        where: {
          id: job.id,
          status: "PROCESSING",
          claimToken: job.claimToken,
        },
        data: {
          status: "QUEUED",
          claimToken: null,
          claimedAt: null,
          errorMessage: `Worker stalled; recovered and re-queued (attempt ${job.retryCount}/${job.maxRetries}).`,
          updatedAt: new Date(),
        },
      });
      if (updated.count > 0) reclaimedCount++;
    } else {
      const updated = await db.qCJob.updateMany({
        where: {
          id: job.id,
          status: "PROCESSING",
          claimToken: job.claimToken,
        },
        data: {
          status: "FAILED",
          overallOutcome: null,
          errorMessage: `Worker execution timed out; retry attempts exhausted (${job.retryCount}/${job.maxRetries}).`,
          updatedAt: new Date(),
        },
      });
      if (updated.count > 0) {
        exhaustedCount++;
        await reconcileQuotaOnce(job.id, job.tenantId).catch(console.error);
      }
    }
  }

  return { reclaimedCount, exhaustedCount };
}

/**
 * Processes up to `maxBatch` jobs currently in QUEUED status in FIFO order.
 * Uses atomic claiming (claimJob) so multiple workers or concurrent dispatches never collide.
 */
export async function processPendingQueuedJobs(maxBatch = 5): Promise<number> {
  const queuedJobs = await db.qCJob.findMany({
    where: { status: "QUEUED" },
    orderBy: { createdAt: "asc" },
    take: maxBatch,
    select: { id: true },
  });

  let processedCount = 0;
  for (const job of queuedJobs) {
    try {
      await processQCJob(job.id);
      processedCount++;
    } catch (err) {
      console.error(`[QC_QUEUE_PROCESSOR_ERROR] Failed processing job ${job.id}:`, err);
    }
  }

  return processedCount;
}

/**
 * Executes a single QC job against the Python QC analysis service.
 * Handles timeouts, crashes, schema validation, optimistic claim token checks,
 * and exactly-once quota reconciliation on fatal failure.
 */
export async function processQCJob(jobId: string, customClaimToken?: string): Promise<void> {
  // 1. Claim job atomically: QUEUED -> PROCESSING with unique claimToken
  const claim = await claimJob(jobId, customClaimToken);
  if (!claim) {
    return; // Already claimed or not in QUEUED status
  }

  const { claimToken } = claim;

  const job = await db.qCJob.findUnique({
    where: { id: jobId },
  });

  if (!job) return;

  const pythonServiceUrl = getPythonServiceUrl();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ANALYSIS_TIMEOUT_MS);

  // Active worker heartbeat: periodically updates claimedAt while inference is in flight
  // to prevent legitimate long-running jobs from being prematurely reclaimed as stale
  const heartbeatInterval = setInterval(async () => {
    try {
      await db.qCJob.updateMany({
        where: { id: jobId, claimToken, status: "PROCESSING" },
        data: { claimedAt: new Date() },
      });
    } catch {
      // Ignore transient errors during heartbeat update
    }
  }, 30_000);

  try {
    // 2. Read file from private tenant storage
    const documentBuffer = await retrieveDocument(job.tenantId, job.storageKey);

    // 3. Prepare multipart request
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(documentBuffer)]);
    formData.append("file", blob, job.documentName);
    formData.append("standard", job.standard);

    if (job.expectedNetlistJson) {
      formData.append("expected_netlist_json", job.expectedNetlistJson);
    }
    if (job.specificationIsComplete !== null) {
      formData.append("specification_is_complete", String(job.specificationIsComplete));
    }
    if (job.extractionIsVerified !== null) {
      formData.append("extraction_is_verified", String(job.extractionIsVerified));
    }
    if (job.scopeDescription) {
      formData.append("scope_description", job.scopeDescription);
    }

    // 4. Prepare internal service authentication headers
    const internalSecret = process.env.SPANQC_INTERNAL_SERVICE_SECRET;
    const isEnforced =
      process.env.NODE_ENV === "production" ||
      process.env.SPANQC_ENFORCE_SERVICE_SECRET === "true";

    if (!internalSecret && isEnforced) {
      clearTimeout(timeoutId);
      throw new Error(
        "Missing required SPANQC_INTERNAL_SERVICE_SECRET: internal service authentication is enforced."
      );
    }

    const headers: Record<string, string> = {};
    if (internalSecret) {
      headers["Authorization"] = `Bearer ${internalSecret}`;
      headers["X-SpanQC-Internal-Key"] = internalSecret;
    }

    // 5. Invoke Python service with bounded timeout
    const response = await fetch(`${pythonServiceUrl}/api/v1/analyze`, {
      method: "POST",
      headers,
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      let parsedDetail = `HTTP ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        parsedDetail = errorJson.detail?.message || errorJson.detail || parsedDetail;
      } catch {
        parsedDetail = errorText.slice(0, 200) || parsedDetail;
      }
      throw new Error(`Python QC service error (${response.status}): ${parsedDetail}`);
    }

    const rawReport = await response.json();

    // 5. Validate schema and enforce coverage/precedence invariants
    const sanitizedReport = validateAndSanitizeReport(rawReport, job.documentSha256);

    // 6. Map to durable job status: REVIEW_REQUIRED vs COMPLETED
    const finalJobStatus: QCJobStatus =
      sanitizedReport.overall_outcome === "REVIEW" ? "REVIEW_REQUIRED" : "COMPLETED";

    // 7. Optimistically persist result: ONLY if claimToken still matches!
    const persistResult = await db.qCJob.updateMany({
      where: {
        id: jobId,
        status: "PROCESSING",
        claimToken, // Protect against stale workers overwriting reclaimed jobs
      },
      data: {
        status: finalJobStatus,
        overallOutcome: sanitizedReport.overall_outcome,
        totalPageCount: sanitizedReport.total_page_count,
        processedPageCount: sanitizedReport.processed_page_count,
        failedPageCount: sanitizedReport.failed_page_count,
        unprocessedPages: JSON.stringify(sanitizedReport.unprocessed_page_numbers),
        failedPages: JSON.stringify(sanitizedReport.failed_page_numbers),
        resultReportJson: JSON.stringify(sanitizedReport),
        errorMessage: null,
        updatedAt: new Date(),
      },
    });

    if (persistResult.count === 0) {
      console.warn(
        `[QC_STALE_WORKER] Worker ${claimToken} was superseded for job ${jobId}. Discarding stale completion.`
      );
    }
  } catch (err: any) {
    clearTimeout(timeoutId);
    console.error(`[QC_EXECUTION_FAILURE] Job ${jobId} failed:`, err?.message || err);

    const errorMessage =
      err?.name === "AbortError"
        ? `Analysis timed out after ${ANALYSIS_TIMEOUT_MS / 1000} seconds.`
        : String(err?.message || "Internal analysis engine failure.");

    // Update job to FAILED state only if claimToken still matches
    const failUpdate = await db.qCJob.updateMany({
      where: {
        id: jobId,
        status: "PROCESSING",
        claimToken,
      },
      data: {
        status: "FAILED",
        overallOutcome: null,
        errorMessage: errorMessage.slice(0, 500),
        updatedAt: new Date(),
      },
    });

    if (failUpdate.count > 0) {
      // Reconcile quota exactly once
      await reconcileQuotaOnce(jobId, job.tenantId).catch((refundErr) => {
        console.error(`[QC_QUOTA_RECONCILE_ERROR] Failed to reconcile quota for job ${jobId}:`, refundErr);
      });
    } else {
      console.warn(
        `[QC_STALE_WORKER] Stale failure for worker ${claimToken} ignored on job ${jobId}.`
      );
    }
  } finally {
    clearTimeout(timeoutId);
    clearInterval(heartbeatInterval);
  }
}
