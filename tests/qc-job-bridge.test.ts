import "./setup";
import { POST as createJobHandler } from "../src/app/api/v1/qc/jobs/route";
import { GET as getJobHandler } from "../src/app/api/v1/qc/jobs/[jobId]/route";
import { db } from "../src/lib/server/db";
import { runSeed } from "../prisma/seed";
import {
  createServerSession,
  SESSION_COOKIE_NAME,
} from "../src/lib/server/auth/session";
import {
  storeDocument,
  retrieveDocument,
  resolveSafeTenantPath,
  StorageSecurityError,
  StorageNotFoundError,
} from "../src/lib/server/storage/document-store";
import fs from "node:fs";
import path from "node:path";
import {
  detectDocumentFormat,
  validateUploadFile,
  DocumentValidationError,
} from "../src/lib/server/qc/validator";
import {
  validateAndSanitizeReport,
  createQCJob,
  processQCJob,
  claimJob,
  reclaimStaleJobs,
  reconcileQuotaOnce,
  QuotaExceededError,
} from "../src/lib/server/qc/job-bridge";
import type { QCReport } from "../src/lib/server/qc/types";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  FAIL: ${message}`);
    failedCount++;
    throw new Error(`Assertion failed: ${message}`);
  } else {
    console.log(`  PASS: ${message}`);
    passedCount++;
  }
}

// Genuine rasterizable 1-page PDF fixture buffer with valid %PDF-1.7 header and font stream
const VALID_PDF_BYTES = Buffer.from(
  "JVBERi0xLjcKJcK1wrYKJSBXcml0dGVuIGJ5IE11UERGIDEuMjguMgoKMSAwIG9iago8PC9UeXBlL0NhdGFsb2cvUGFnZXMgMiAwIFIvSW5mbzw8L1Byb2R1Y2VyKE11UERGIDEuMjguMik+Pj4+CmVuZG9iagoKMiAwIG9iago8PC9UeXBlL1BhZ2VzL0NvdW50IDEvS2lkc1s0IDAgUl0+PgplbmRvYmoKCjMgMCBvYmoKPDwvRm9udDw8L2hlbHYgNSAwIFI+Pj4+CmVuZG9iagoKNCAwIG9iago8PC9UeXBlL1BhZ2UvTWVkaWFCb3hbMCAwIDYwMCA0MDBdL1JvdGF0ZSAwL1Jlc291cmNlcyAzIDAgUi9QYXJlbnQgMiAwIFIvQ29udGVudHNbNiAwIFJdPj4KZW5kb2JqCgo1IDAgb2JqCjw8L1R5cGUvRm9udC9TdWJ0eXBlL1R5cGUxL0Jhc2VGb250L0hlbHZldGljYS9FbmNvZGluZy9XaW5BbnNpRW5jb2Rpbmc+PgplbmRvYmoKCjYgMCBvYmoKPDwvTGVuZ3RoIDgyPj4Kc3RyZWFtCgpxCkJUCjEgMCAwIDEgNTAgMzUwIFRtCi9oZWx2IDEyIFRmIFs8NTM3MDYxNmU1MTQzMjA1NDY1NzM3NDIwNTM2ODY1NjU3ND5dVEoKRVQKUQoKZW5kc3RyZWFtCmVuZG9iagoKeHJlZgowIDcKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDQyIDAwMDAwIG4gCjAwMDAwMDAxMjAgMDAwMDAgbiAKMDAwMDAwMDE3MiAwMDAwMCBuIAowMDAwMDAwMjEzIDAwMDAwIG4gCjAwMDAwMDAzMjAgMDAwMDAgbiAKMDAwMDAwMDQwOSAwMDAwMCBuIAoKdHJhaWxlcgo8PC9TaXplIDcvUm9vdCAxIDAgUi9JRFs8N0VDMzg3QzM4RjNCNjlDM0ExQzNCNkMyODE1QjBBMUM+PEI0MjdBRDVGMEE0OEQ2RjBGQjc0NEZFRkFCMDg0NzYxPl0+PgpzdGFydHhyZWYKNTQwCiUlRU9GCg==",
  "base64"
);

// Fake text pretending to be PDF
const FAKE_PDF_BYTES = Buffer.from("THIS IS NOT A VALID PDF FILE AT ALL", "utf8");

async function runQCBridgeTestSuite() {
  console.log("================================================================================");
  console.log("SPANQC PHASE 2: SECURE ASYNCHRONOUS QC JOB BRIDGE TEST SUITE");
  console.log("================================================================================");

  // Clean and seed dedicated test database
  await db.qCJob.deleteMany();
  await db.session.deleteMany();
  await db.project.deleteMany();
  await db.user.deleteMany();
  await db.tenant.deleteMany();
  await runSeed();

  // Create test sessions
  const spandsonsTenantId = "f8c5091c-50a3-4436-88bd-369c7c6b1727";
  const acmeTenantId = "tenant-acme-aerospace-9999";

  // Spandsons Admin (pravin)
  const pravinSession = await createServerSession(
    "bc4a8b56-47da-4de2-b4ab-da448f4163dc",
    spandsonsTenantId,
    "ADMIN",
    "pravin@spandsons.com"
  );
  const pravinCookie = `${SESSION_COOKIE_NAME}=${pravinSession.token}`;

  // Spandsons Engineer (gogulnath)
  const gogulSession = await createServerSession(
    "b82954d0-7a22-4af1-a030-74ad5c0a6f00",
    spandsonsTenantId,
    "ENGINEER",
    "gogulnath@spandsons.com"
  );
  const gogulCookie = `${SESSION_COOKIE_NAME}=${gogulSession.token}`;

  // Spandsons Reviewer (inspector)
  const inspectorSession = await createServerSession(
    "f33cd61a-e604-41a2-8756-241777740b9d",
    spandsonsTenantId,
    "REVIEWER",
    "inspector@spandsons.com"
  );
  const inspectorCookie = `${SESSION_COOKIE_NAME}=${inspectorSession.token}`;

  // Acme Admin (alice)
  const aliceSession = await createServerSession(
    "usr-alice-acme-1111",
    acmeTenantId,
    "ADMIN",
    "alice@acme-aero.com"
  );
  const aliceCookie = `${SESSION_COOKIE_NAME}=${aliceSession.token}`;

  // ----------------------------------------------------------------------------
  // Test 1: Unauthenticated job creation is rejected with HTTP 401
  // ----------------------------------------------------------------------------
  console.log("\n[TEST 1] Unauthenticated job creation is rejected");
  {
    const form = new FormData();
    form.append("projectId", "proj-777x");
    form.append("file", new Blob([VALID_PDF_BYTES], { type: "application/pdf" }), "drawing.pdf");

    const req = new Request("http://localhost:3000/api/v1/qc/jobs", {
      method: "POST",
      body: form,
    });
    const res = await createJobHandler(req);
    assert(res.status === 401, "Returns HTTP 401 Unauthorized when unauthenticated");
  }

  // ----------------------------------------------------------------------------
  // Test 2: Cross-Origin (CSRF) mutating request blocked with HTTP 403
  // ----------------------------------------------------------------------------
  console.log("\n[TEST 2] Cross-Origin CSRF requests are blocked");
  {
    const form = new FormData();
    form.append("projectId", "proj-777x");
    form.append("file", new Blob([VALID_PDF_BYTES], { type: "application/pdf" }), "drawing.pdf");

    const req = new Request("http://localhost:3000/api/v1/qc/jobs", {
      method: "POST",
      headers: {
        Cookie: gogulCookie,
        Origin: "https://malicious-attacker.com",
      },
      body: form,
    });
    const res = await createJobHandler(req);
    assert(res.status === 403, "Returns HTTP 403 Forbidden for cross-origin mutation");
  }

  // ----------------------------------------------------------------------------
  // Test 3: RBAC Enforcement: REVIEWER role cannot execute QC jobs
  // ----------------------------------------------------------------------------
  console.log("\n[TEST 3] Role-Based Access Control: Reviewers cannot create QC jobs");
  {
    const form = new FormData();
    form.append("projectId", "proj-777x");
    form.append("file", new Blob([VALID_PDF_BYTES], { type: "application/pdf" }), "drawing.pdf");

    const req = new Request("http://localhost:3000/api/v1/qc/jobs", {
      method: "POST",
      headers: { Cookie: inspectorCookie },
      body: form,
    });
    const res = await createJobHandler(req);
    assert(res.status === 403, "Returns HTTP 403 Forbidden for REVIEWER role");
    const json = await res.json();
    assert(json.detail.includes("Insufficient permissions"), "Returns descriptive RBAC rejection message");
  }

  // ----------------------------------------------------------------------------
  // Test 4: Cross-Tenant Project Access Rejected (Spandsons cannot use Acme project)
  // ----------------------------------------------------------------------------
  console.log("\n[TEST 4] Cross-tenant project access is rejected");
  {
    const form = new FormData();
    form.append("projectId", "proj-acme-satellite"); // belongs to Acme Aerospace
    form.append("file", new Blob([VALID_PDF_BYTES], { type: "application/pdf" }), "drawing.pdf");

    const req = new Request("http://localhost:3000/api/v1/qc/jobs", {
      method: "POST",
      headers: { Cookie: gogulCookie },
      body: form,
    });
    const res = await createJobHandler(req);
    assert(res.status === 404, "Returns HTTP 404 when project does not belong to caller tenant");
  }

  // ----------------------------------------------------------------------------
  // Test 5: Caller-controlled tenant headers/body cannot change ownership
  // ----------------------------------------------------------------------------
  console.log("\n[TEST 5] Caller-controlled tenant headers/body cannot change ownership");
  {
    const form = new FormData();
    form.append("projectId", "proj-777x");
    form.append("tenantId", acmeTenantId); // Spoofed tenant body
    form.append("organization_id", acmeTenantId);
    form.append("file", new Blob([VALID_PDF_BYTES], { type: "application/pdf" }), "drawing.pdf");

    const req = new Request("http://localhost:3000/api/v1/qc/jobs", {
      method: "POST",
      headers: {
        Cookie: gogulCookie,
        "x-tenant-id": acmeTenantId, // Spoofed tenant header
        "x-spanqc-disable-dispatch": "true",
      },
      body: form,
    });
    const res = await createJobHandler(req);
    assert(res.status === 201, "Job creation succeeded for authorized user");
    const json = await res.json();

    const createdJob = await db.qCJob.findUnique({ where: { id: json.job_id } });
    assert(createdJob !== null, "Job record exists in database");
    assert(
      createdJob?.tenantId === spandsonsTenantId,
      "Job tenantId is strictly Spandsons (trusted session), NOT spoofed Acme tenant"
    );
  }

  // ----------------------------------------------------------------------------
  // Test 6: Invalid, empty, and malformed uploads are rejected
  // ----------------------------------------------------------------------------
  console.log("\n[TEST 6] Invalid, empty, and malformed uploads are rejected");
  {
    // Empty file (0 bytes)
    const emptyForm = new FormData();
    emptyForm.append("projectId", "proj-777x");
    emptyForm.append("file", new Blob([], { type: "application/pdf" }), "empty.pdf");

    const emptyReq = new Request("http://localhost:3000/api/v1/qc/jobs", {
      method: "POST",
      headers: { Cookie: gogulCookie },
      body: emptyForm,
    });
    const emptyRes = await createJobHandler(emptyReq);
    assert(emptyRes.status === 400, "Empty upload rejected with HTTP 400");

    // Fake PDF (lacks %PDF- magic bytes)
    const fakeForm = new FormData();
    fakeForm.append("projectId", "proj-777x");
    fakeForm.append("file", new Blob([FAKE_PDF_BYTES], { type: "application/pdf" }), "fake.pdf");

    const fakeReq = new Request("http://localhost:3000/api/v1/qc/jobs", {
      method: "POST",
      headers: { Cookie: gogulCookie },
      body: fakeForm,
    });
    const fakeRes = await createJobHandler(fakeReq);
    assert(fakeRes.status === 400, "Fake PDF lacking magic bytes rejected with HTTP 400");
    const fakeJson = await fakeRes.json();
    assert(fakeJson.detail.includes("Magic byte inspection failed"), "Error explains magic byte rejection");

    // Oversized upload check (>25MB)
    let oversizedValidationFailed = false;
    try {
      validateUploadFile(Buffer.alloc(26 * 1024 * 1024), "huge.pdf");
    } catch (e: any) {
      if (e instanceof DocumentValidationError && e.statusCode === 413) {
        oversizedValidationFailed = true;
      }
    }
    assert(oversizedValidationFailed, "Oversized file (>25MB) rejected with HTTP 413");
  }

  // ----------------------------------------------------------------------------
  // Test 7: Private Document Storage: Path Traversal and Cross-Tenant Reads Denied
  // ----------------------------------------------------------------------------
  console.log("\n[TEST 7] Private storage adapter path traversal & isolation checks");
  {
    const dummyHash = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    // Valid save and retrieve
    const saveRes = await storeDocument(spandsonsTenantId, dummyHash, VALID_PDF_BYTES);
    assert(
      saveRes.storageKey.startsWith(`tenants/${spandsonsTenantId}/documents/`),
      "Storage key is scoped under tenant directory"
    );

    const retrieved = await retrieveDocument(spandsonsTenantId, saveRes.storageKey);
    assert(retrieved.equals(VALID_PDF_BYTES), "Retrieved document matches original bytes");

    // Path traversal attempt in storage key
    let traversalBlocked = false;
    try {
      resolveSafeTenantPath(spandsonsTenantId, `../../etc/passwd`);
    } catch (e: any) {
      if (e instanceof StorageSecurityError) traversalBlocked = true;
    }
    assert(traversalBlocked, "Path traversal with ../ is blocked by StorageSecurityError");

    // Cross-tenant storage read attempt
    let crossTenantBlocked = false;
    try {
      // Acme tries to read Spandsons' storage key
      await retrieveDocument(acmeTenantId, saveRes.storageKey);
    } catch (e: any) {
      if (e instanceof StorageSecurityError) crossTenantBlocked = true;
    }
    assert(crossTenantBlocked, "Acme tenant cannot retrieve Spandsons storage key");
  }

  // ----------------------------------------------------------------------------
  // Test 8: Idempotent Retries Prevent Duplicate Jobs and Duplicate Billing
  // ----------------------------------------------------------------------------
  console.log("\n[TEST 8] Idempotent retries prevent duplicate jobs and double charging");
  {
    const testIdempotencyKey = "unique-client-req-uuid-999888";

    // Record starting quotaUsed
    const initialTenant = await db.tenant.findUniqueOrThrow({ where: { id: spandsonsTenantId } });
    const startingQuota = initialTenant.quotaUsed;

    const form1 = new FormData();
    form1.append("projectId", "proj-777x");
    form1.append("idempotency_key", testIdempotencyKey);
    form1.append("file", new Blob([VALID_PDF_BYTES], { type: "application/pdf" }), "drawing.pdf");

    const req1 = new Request("http://localhost:3000/api/v1/qc/jobs", {
      method: "POST",
      headers: {
        Cookie: gogulCookie,
        "x-spanqc-disable-dispatch": "true",
      },
      body: form1,
    });
    const res1 = await createJobHandler(req1);
    assert(res1.status === 201, "First submission returns HTTP 201 Created");
    const json1 = await res1.json();
    assert(json1.quota_reserved === true, "First submission reserved quota");

    // Check quota after first call
    const afterFirstTenant = await db.tenant.findUniqueOrThrow({ where: { id: spandsonsTenantId } });
    assert(afterFirstTenant.quotaUsed === startingQuota + 1, "Quota incremented by 1");

    // Second submission with identical idempotency key
    const form2 = new FormData();
    form2.append("projectId", "proj-777x");
    form2.append("idempotency_key", testIdempotencyKey);
    form2.append("file", new Blob([VALID_PDF_BYTES], { type: "application/pdf" }), "drawing.pdf");

    const req2 = new Request("http://localhost:3000/api/v1/qc/jobs", {
      method: "POST",
      headers: {
        Cookie: gogulCookie,
        "x-spanqc-disable-dispatch": "true",
      },
      body: form2,
    });
    const res2 = await createJobHandler(req2);
    assert(res2.status === 200, "Second submission returns HTTP 200 OK (Idempotent return)");
    const json2 = await res2.json();
    assert(json2.job_id === json1.job_id, "Returns identical job ID");
    assert(json2.quota_reserved === false, "Does NOT charge quota again");

    // Check quota after retry
    const afterRetryTenant = await db.tenant.findUniqueOrThrow({ where: { id: spandsonsTenantId } });
    assert(
      afterRetryTenant.quotaUsed === startingQuota + 1,
      "Quota remains unchanged after retry (no double charging)"
    );
  }

  // ----------------------------------------------------------------------------
  // Test 9: Concurrent Quota Safety Prevents Overspending
  // ----------------------------------------------------------------------------
  console.log("\n[TEST 9] Concurrent quota safety prevents overspending");
  {
    // Configure Acme tenant so only 1 check remains: checkQuota = 10, quotaUsed = 9
    await db.tenant.update({
      where: { id: acmeTenantId },
      data: { checkQuota: 10, quotaUsed: 9 },
    });

    // Launch 5 concurrent job creations simultaneously
    const attempts = Array.from({ length: 5 }, (_, i) => {
      const form = new FormData();
      form.append("projectId", "proj-acme-satellite");
      form.append("idempotency_key", `concurrent-test-key-${i}`);
      form.append("file", new Blob([VALID_PDF_BYTES], { type: "application/pdf" }), `file-${i}.pdf`);

      const req = new Request("http://localhost:3000/api/v1/qc/jobs", {
        method: "POST",
        headers: {
          Cookie: aliceCookie,
          "x-spanqc-disable-dispatch": "true",
        },
        body: form,
      });
      return createJobHandler(req);
    });

    const responses = await Promise.all(attempts);
    const successCount = responses.filter((r) => r.status === 201).length;
    const quotaExceededCount = responses.filter((r) => r.status === 402).length;

    assert(successCount === 1, "Exactly 1 concurrent request succeeded");
    assert(quotaExceededCount === 4, "4 concurrent requests rejected with HTTP 402 Quota Exceeded");

    const finalTenant = await db.tenant.findUniqueOrThrow({ where: { id: acmeTenantId } });
    assert(finalTenant.quotaUsed === 10, "Quota used capped exactly at checkQuota (no overspend)");
  }

  // ----------------------------------------------------------------------------
  // Test 10: Worker Failure Handling: Service Unavailable Never Produces PASS
  // ----------------------------------------------------------------------------
  console.log("\n[TEST 10] Worker failure handling: Service unreachable never produces PASS");
  {
    // Create a job directly with bad Python service URL
    const originalEnv = process.env.SPANQC_PYTHON_SERVICE_URL;
    process.env.SPANQC_PYTHON_SERVICE_URL = "http://127.0.0.1:59999"; // Non-existent port

    const { job } = await createQCJob({
      tenantId: spandsonsTenantId,
      projectId: "proj-777x",
      userId: "b82954d0-7a22-4af1-a030-74ad5c0a6f00",
      fileBuffer: VALID_PDF_BYTES,
      originalFilename: "fail_test.pdf",
      autoDispatch: false,
    });

    // Process job
    await processQCJob(job.id);

    const updatedJob = await db.qCJob.findUniqueOrThrow({ where: { id: job.id } });
    assert(updatedJob.status === "FAILED", "Job status transitioned to FAILED");
    assert(updatedJob.overallOutcome === null, "Overall outcome is NOT PASS");
    assert(updatedJob.errorMessage !== null, "Error message recorded");

    if (originalEnv !== undefined) {
      process.env.SPANQC_PYTHON_SERVICE_URL = originalEnv;
    } else {
      delete process.env.SPANQC_PYTHON_SERVICE_URL;
    }
  }

  // ----------------------------------------------------------------------------
  // Test 10B: Worker Failure Handling: Service timeout never produces PASS
  // ----------------------------------------------------------------------------
  console.log("\n[TEST 10B] Worker failure handling: Service timeout never produces PASS");
  {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      const err = new Error("The operation was aborted");
      err.name = "AbortError";
      throw err;
    }) as any;

    try {
      const { job } = await createQCJob({
        tenantId: spandsonsTenantId,
        projectId: "proj-777x",
        userId: "b82954d0-7a22-4af1-a030-74ad5c0a6f00",
        fileBuffer: VALID_PDF_BYTES,
        originalFilename: "timeout_test.pdf",
        autoDispatch: false,
      });

      await processQCJob(job.id);

      const updatedJob = await db.qCJob.findUniqueOrThrow({ where: { id: job.id } });
      assert(updatedJob.status === "FAILED", "Job status transitioned to FAILED on timeout");
      assert(updatedJob.overallOutcome === null, "Overall outcome is NOT PASS on timeout");
      assert(updatedJob.errorMessage?.includes("timed out") === true, "Error message documents timeout");
    } finally {
      globalThis.fetch = originalFetch;
    }
  }

  // ----------------------------------------------------------------------------
  // Test 10C: Worker Failure Handling: Malformed response never produces PASS
  // ----------------------------------------------------------------------------
  console.log("\n[TEST 10C] Worker failure handling: Malformed service response never produces PASS");
  {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      return new Response("CORRUPTED NON-JSON SERVER OUTPUT", {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }) as any;

    try {
      const { job } = await createQCJob({
        tenantId: spandsonsTenantId,
        projectId: "proj-777x",
        userId: "b82954d0-7a22-4af1-a030-74ad5c0a6f00",
        fileBuffer: VALID_PDF_BYTES,
        originalFilename: "malformed_test.pdf",
        autoDispatch: false,
      });

      await processQCJob(job.id);

      const updatedJob = await db.qCJob.findUniqueOrThrow({ where: { id: job.id } });
      assert(updatedJob.status === "FAILED", "Job status transitioned to FAILED on malformed response");
      assert(updatedJob.overallOutcome === null, "Overall outcome is NOT PASS on malformed response");
    } finally {
      globalThis.fetch = originalFetch;
    }
  }

  // ----------------------------------------------------------------------------
  // Test 11: Schema & Coverage Guard: Partial processing or unverified pages block PASS
  // ----------------------------------------------------------------------------
  console.log("\n[TEST 11] Partial page processing or failed pages block PASS");
  {
    const sampleHash = "a".repeat(64);

    // Mock report that tries to claim PASS while having failed pages
    const badPassReport = {
      report_id: "rep-101",
      document_name: "test.pdf",
      sha256_hash: sampleHash,
      standard: "IPC/WHMA-A-620D",
      created_at: new Date().toISOString(),
      model_used: "gemma3:4b",
      overall_outcome: "PASS", // Inadmissible claim!
      specification_is_complete: true,
      extraction_is_verified: true,
      total_page_count: 3,
      processed_page_count: 2,
      failed_page_count: 1, // Page 3 failed!
      unprocessed_page_numbers: [],
      failed_page_numbers: [3],
      rule_findings: [],
    };

    const sanitized = validateAndSanitizeReport(badPassReport, sampleHash);
    assert(
      sanitized.overall_outcome === "REVIEW",
      "Sanitizer forced overall_outcome to REVIEW due to failed page 3"
    );
  }

  // ----------------------------------------------------------------------------
  // Test 11B: Defect Precedence: Confirmed defect produces FAIL even when coverage requires REVIEW
  // ----------------------------------------------------------------------------
  console.log("\n[TEST 11B] Deterministic defect produces FAIL even when coverage issues require REVIEW");
  {
    const sampleHash = "b".repeat(64);
    const defectWithCoverageIssue = {
      report_id: "rep-defect-1",
      document_name: "test.pdf",
      sha256_hash: sampleHash,
      standard: "IPC/WHMA-A-620D",
      created_at: new Date().toISOString(),
      model_used: "gemma3:4b",
      overall_outcome: "FAIL", // A defect was found!
      specification_is_complete: false, // Incomplete spec would normally yield REVIEW
      extraction_is_verified: false,
      total_page_count: 2,
      processed_page_count: 1, // Page 2 unprocessed!
      failed_page_count: 0,
      unprocessed_page_numbers: [2],
      failed_page_numbers: [],
      rule_findings: [
        {
          finding_id: "F-001",
          rule_id: "RULE-NETLIST-05",
          rule_name: "Destination Terminal Mismatch",
          standard_reference: "IPC/WHMA-A-620D Section 13.5.1",
          severity: "CRITICAL",
          outcome: "FAIL",
          title: "Destination Terminal Mismatch",
          reason: "Expected TB1:1 but observed J2:2",
          human_review_required: false,
        },
      ],
    };

    const sanitized = validateAndSanitizeReport(defectWithCoverageIssue, sampleHash);
    assert(
      sanitized.overall_outcome === "FAIL",
      "Confirmed defect preserves FAIL outcome despite partial coverage"
    );
  }

  // ----------------------------------------------------------------------------
  // Test 12: Cross-Tenant Job Status & Report Retrieval Denied (IDOR Protection)
  // ----------------------------------------------------------------------------
  console.log("\n[TEST 12] Cross-tenant job status & report retrieval denied (IDOR protection)");
  {
    // Create job for Spandsons
    const { job: spandsonsJob } = await createQCJob({
      tenantId: spandsonsTenantId,
      projectId: "proj-777x",
      userId: "b82954d0-7a22-4af1-a030-74ad5c0a6f00",
      fileBuffer: VALID_PDF_BYTES,
      originalFilename: "spandsons_drawing.pdf",
      autoDispatch: false,
    });

    // Acme user (Alice) tries to read Spandsons job
    const crossReq = new Request(`http://localhost:3000/api/v1/qc/jobs/${spandsonsJob.id}`, {
      method: "GET",
      headers: { Cookie: aliceCookie },
    });
    const crossRes = await getJobHandler(crossReq, { params: Promise.resolve({ jobId: spandsonsJob.id }) });
    assert(
      crossRes.status === 404,
      "Returns HTTP 404 Not Found to prevent leaking other tenant's job existence"
    );

    // Spandsons user (Pravin) reads Spandsons job
    const legitimateReq = new Request(`http://localhost:3000/api/v1/qc/jobs/${spandsonsJob.id}`, {
      method: "GET",
      headers: { Cookie: pravinCookie },
    });
    const legitimateRes = await getJobHandler(legitimateReq, {
      params: Promise.resolve({ jobId: spandsonsJob.id }),
    });
    assert(legitimateRes.status === 200, "Spandsons user receives HTTP 200 OK");
    const legitimateJson = await legitimateRes.json();
    assert(legitimateJson.job_id === spandsonsJob.id, "Returns requested job ID");
    assert(legitimateJson.is_experimental === true, "Contains experimental disclaimer");
    assert(legitimateJson.disclaimer.includes("EXPERIMENTAL"), "Disclaimer explicitly present");
  }

  // ----------------------------------------------------------------------------
  // Test 13: Durability Across Worker Restarts
  // ----------------------------------------------------------------------------
  console.log("\n[TEST 13] Durability: Persisted job records survive worker restart");
  {
    // Create job and complete it with persisted report in DB
    const { job } = await createQCJob({
      tenantId: spandsonsTenantId,
      projectId: "proj-777x",
      userId: "b82954d0-7a22-4af1-a030-74ad5c0a6f00",
      fileBuffer: VALID_PDF_BYTES,
      originalFilename: "durable_job.pdf",
      autoDispatch: false,
    });

    const mockReport: QCReport = {
      report_id: "rep-durability-test",
      document_name: "durable_job.pdf",
      sha256_hash: job.documentSha256,
      standard: "IPC/WHMA-A-620D",
      created_at: new Date().toISOString(),
      model_used: "gemma3:4b",
      overall_outcome: "REVIEW",
      specification_is_complete: false,
      extraction_is_verified: false,
      total_page_count: 1,
      processed_page_count: 1,
      failed_page_count: 0,
      unprocessed_page_numbers: [],
      failed_page_numbers: [],
      rule_findings: [
        {
          finding_id: "F-001",
          rule_id: "RULE-SPEC-00",
          rule_name: "Authoritative Expected Netlist Missing",
          standard_reference: "IPC/WHMA-A-620D Section 1.4",
          severity: "MEDIUM",
          outcome: "REVIEW",
          title: "Authoritative Expected Netlist Missing",
          reason: "No authoritative expected netlist provided for verification.",
          human_review_required: true,
        },
      ],
      candidate_observations: [],
      is_experimental: true,
      disclaimer: "EXPERIMENTAL TEST DISCLAIMER",
    };

    await db.qCJob.update({
      where: { id: job.id },
      data: {
        status: "REVIEW_REQUIRED",
        overallOutcome: "REVIEW",
        processedPageCount: 1,
        resultReportJson: JSON.stringify(mockReport),
      },
    });

    // Simulate complete process restart: read afresh from database via API
    const readReq = new Request(`http://localhost:3000/api/v1/qc/jobs/${job.id}`, {
      method: "GET",
      headers: { Cookie: gogulCookie },
    });
    const readRes = await getJobHandler(readReq, { params: Promise.resolve({ jobId: job.id }) });
    assert(readRes.status === 200, "Successfully retrieved job after simulated restart");
    const readJson = await readRes.json();
    assert(readJson.status === "REVIEW_REQUIRED", "Durable status is REVIEW_REQUIRED");
    assert(readJson.overall_outcome === "REVIEW", "Overall outcome is REVIEW");
    assert(readJson.report.report_id === "rep-durability-test", "Persisted report retrieved intact");
    assert(readJson.page_coverage.processed_pages === 1, "Page coverage retrieved intact");
  }

  // ----------------------------------------------------------------------------
  // Test 14: Recovery of a Stale PROCESSING Job
  // ----------------------------------------------------------------------------
  console.log("\n[TEST 14] Recovery of a stale PROCESSING job");
  {
    const { job } = await createQCJob({
      tenantId: spandsonsTenantId,
      projectId: "proj-777x",
      userId: "b82954d0-7a22-4af1-a030-74ad5c0a6f00",
      fileBuffer: VALID_PDF_BYTES,
      originalFilename: "stale_recovery.pdf",
      autoDispatch: false,
    });

    // Worker claims job
    const claim = await claimJob(job.id);
    assert(claim !== null, "Job was successfully claimed initially");

    // Simulate worker process died 10 minutes ago
    await db.qCJob.update({
      where: { id: job.id },
      data: {
        claimedAt: new Date(Date.now() - 600_000), // 10 minutes ago
      },
    });

    // Run recovery
    const recovery = await reclaimStaleJobs(120_000);
    assert(recovery.reclaimedCount === 1, "Exactly 1 stale job was reclaimed");

    const recoveredJob = await db.qCJob.findUniqueOrThrow({ where: { id: job.id } });
    assert(recoveredJob.status === "QUEUED", "Job returned to QUEUED status");
    assert(recoveredJob.claimToken === null, "Claim token was cleared on recovery");
    assert(recoveredJob.claimedAt === null, "Claimed timestamp was cleared on recovery");
  }

  // ----------------------------------------------------------------------------
  // Test 15: Two Workers Attempting to Claim the Same Job
  // ----------------------------------------------------------------------------
  console.log("\n[TEST 15] Two workers attempting to claim the same job concurrently");
  {
    const { job } = await createQCJob({
      tenantId: spandsonsTenantId,
      projectId: "proj-777x",
      userId: "b82954d0-7a22-4af1-a030-74ad5c0a6f00",
      fileBuffer: VALID_PDF_BYTES,
      originalFilename: "claim_contention.pdf",
      autoDispatch: false,
    });

    const [claimA, claimB] = await Promise.all([claimJob(job.id), claimJob(job.id)]);

    const oneSucceeded = (claimA !== null && claimB === null) || (claimA === null && claimB !== null);
    assert(oneSucceeded, "Exactly one worker succeeded in claiming the job");

    const winnerToken = (claimA || claimB)?.claimToken;
    assert(typeof winnerToken === "string" && winnerToken.length > 0, "Winner holds non-empty claimToken");

    const dbJob = await db.qCJob.findUniqueOrThrow({ where: { id: job.id } });
    assert(dbJob.claimToken === winnerToken, "Database record reflects the winning worker's token");
  }

  // ----------------------------------------------------------------------------
  // Test 16: Stale Worker Attempting to Overwrite a Newer Result
  // ----------------------------------------------------------------------------
  console.log("\n[TEST 16] Stale worker attempting to overwrite a newer result is rejected");
  {
    const { job } = await createQCJob({
      tenantId: spandsonsTenantId,
      projectId: "proj-777x",
      userId: "b82954d0-7a22-4af1-a030-74ad5c0a6f00",
      fileBuffer: VALID_PDF_BYTES,
      originalFilename: "stale_overwrite.pdf",
      autoDispatch: false,
    });

    // Worker 1 claims job
    const worker1Claim = await claimJob(job.id);
    assert(worker1Claim !== null, "Worker 1 claimed job");

    // Worker 1 stalls; recovery reclaims the job
    await reclaimStaleJobs(0);

    // Worker 2 claims job and completes it successfully
    const worker2Claim = await claimJob(job.id);
    assert(worker2Claim !== null, "Worker 2 claimed reclaimed job");

    await db.qCJob.updateMany({
      where: {
        id: job.id,
        status: "PROCESSING",
        claimToken: worker2Claim!.claimToken,
      },
      data: {
        status: "COMPLETED",
        overallOutcome: "PASS",
        updatedAt: new Date(),
      },
    });

    // Now Worker 1 attempts to write its stale completion
    const staleWrite = await db.qCJob.updateMany({
      where: {
        id: job.id,
        status: "PROCESSING",
        claimToken: worker1Claim!.claimToken,
      },
      data: {
        status: "FAILED",
        overallOutcome: null,
      },
    });

    assert(staleWrite.count === 0, "Stale worker update rejected (0 rows updated)");

    const currentJob = await db.qCJob.findUniqueOrThrow({ where: { id: job.id } });
    assert(currentJob.status === "COMPLETED", "Job remains COMPLETED by Worker 2");
    assert(currentJob.overallOutcome === "PASS", "Job preserves Worker 2's PASS outcome");
  }

  // ----------------------------------------------------------------------------
  // Test 17: Concurrent Duplicate Idempotency Submissions
  // ----------------------------------------------------------------------------
  console.log("\n[TEST 17] Concurrent duplicate idempotency submissions return existing job without P2002 error");
  {
    const concurrentKey = `race-idempotency-key-${Date.now()}`;
    const initialTenant = await db.tenant.findUniqueOrThrow({ where: { id: spandsonsTenantId } });
    const initialQuotaUsed = initialTenant.quotaUsed;

    const attempts = Array.from({ length: 5 }, () =>
      createQCJob({
        tenantId: spandsonsTenantId,
        projectId: "proj-777x",
        userId: "b82954d0-7a22-4af1-a030-74ad5c0a6f00",
        fileBuffer: VALID_PDF_BYTES,
        originalFilename: "concurrent_race.pdf",
        idempotencyKey: concurrentKey,
        autoDispatch: false,
      })
    );

    const results = await Promise.all(attempts);
    const uniqueJobIds = new Set(results.map((r) => r.job.id));
    assert(uniqueJobIds.size === 1, "All 5 concurrent requests returned identical job ID");

    const createdCount = results.filter((r) => !r.isDuplicate && r.quotaReserved).length;
    const duplicateCount = results.filter((r) => r.isDuplicate && !r.quotaReserved).length;
    assert(createdCount === 1, "Exactly 1 request performed the creation and reserved quota");
    assert(duplicateCount === 4, "4 concurrent requests cleanly returned duplicate job without errors");

    const finalTenant = await db.tenant.findUniqueOrThrow({ where: { id: spandsonsTenantId } });
    assert(
      finalTenant.quotaUsed === initialQuotaUsed + 1,
      "Quota used incremented by exactly 1 (no overcharge under concurrency race)"
    );
  }

  // ----------------------------------------------------------------------------
  // Test 18: Quota Reservation and Release Exactly Once
  // ----------------------------------------------------------------------------
  console.log("\n[TEST 18] Quota reservation and release exactly once");
  {
    const initialTenant = await db.tenant.findUniqueOrThrow({ where: { id: spandsonsTenantId } });
    const startingQuota = initialTenant.quotaUsed;

    const { job } = await createQCJob({
      tenantId: spandsonsTenantId,
      projectId: "proj-777x",
      userId: "b82954d0-7a22-4af1-a030-74ad5c0a6f00",
      fileBuffer: VALID_PDF_BYTES,
      originalFilename: "refund_test.pdf",
      autoDispatch: false,
    });

    const afterCreateTenant = await db.tenant.findUniqueOrThrow({ where: { id: spandsonsTenantId } });
    assert(afterCreateTenant.quotaUsed === startingQuota + 1, "Quota reserved (+1)");

    // Fire 3 parallel refunds for the same job
    const [refundA, refundB, refundC] = await Promise.all([
      reconcileQuotaOnce(job.id, spandsonsTenantId),
      reconcileQuotaOnce(job.id, spandsonsTenantId),
      reconcileQuotaOnce(job.id, spandsonsTenantId),
    ]);

    const trueCount = [refundA, refundB, refundC].filter(Boolean).length;
    assert(trueCount === 1, "Exactly 1 concurrent refund returned true");

    const finalTenant = await db.tenant.findUniqueOrThrow({ where: { id: spandsonsTenantId } });
    assert(finalTenant.quotaUsed === startingQuota, "Quota decremented exactly once (-1), restoring balance");

    // Additional subsequent refund attempt
    const secondTry = await reconcileQuotaOnce(job.id, spandsonsTenantId);
    assert(secondTry === false, "Subsequent refund attempt returned false (idempotent)");
  }

  // ----------------------------------------------------------------------------
  // Test 19: Retry Exhaustion and Terminal Failure
  // ----------------------------------------------------------------------------
  console.log("\n[TEST 19] Retry exhaustion and terminal failure handling");
  {
    const { job } = await createQCJob({
      tenantId: spandsonsTenantId,
      projectId: "proj-777x",
      userId: "b82954d0-7a22-4af1-a030-74ad5c0a6f00",
      fileBuffer: VALID_PDF_BYTES,
      originalFilename: "exhaust_test.pdf",
      autoDispatch: false,
    });

    // Simulate job reached maxRetries and stalled
    await db.qCJob.update({
      where: { id: job.id },
      data: {
        status: "PROCESSING",
        retryCount: 2,
        maxRetries: 2,
        claimToken: "stalled-worker-exhausted",
        claimedAt: new Date(Date.now() - 600_000), // 10 minutes ago
      },
    });

    const recovery = await reclaimStaleJobs(120_000);
    assert(recovery.exhaustedCount === 1, "Exactly 1 job had retries exhausted");

    const terminalJob = await db.qCJob.findUniqueOrThrow({ where: { id: job.id } });
    assert(terminalJob.status === "FAILED", "Job transitioned to terminal FAILED status");
    assert(terminalJob.quotaRefunded === true, "Quota was refunded on terminal failure");
    assert(terminalJob.errorMessage?.includes("retry attempts exhausted") === true, "Error message explains retry exhaustion");
  }

  // ----------------------------------------------------------------------------
  // Test 20: Storage Symlink Escape Defense
  // ----------------------------------------------------------------------------
  console.log("\n[TEST 20] Storage symlink escape defense");
  {
    const storageRoot = process.env.STORAGE_ROOT || path.join(process.cwd(), "storage/private");
    const tenantDir = path.resolve(storageRoot, "tenants", spandsonsTenantId, "documents");
    if (!fs.existsSync(tenantDir)) {
      fs.mkdirSync(tenantDir, { recursive: true, mode: 0o700 });
    }

    const symlinkPath = path.join(tenantDir, "malicious_symlink.pdf");
    const externalTarget = path.join(process.cwd(), "package.json");

    if (fs.existsSync(symlinkPath)) {
      fs.unlinkSync(symlinkPath);
    }

    try {
      fs.symlinkSync(externalTarget, symlinkPath);

      let symlinkBlocked = false;
      try {
        resolveSafeTenantPath(
          spandsonsTenantId,
          `tenants/${spandsonsTenantId}/documents/malicious_symlink.pdf`
        );
      } catch (e: any) {
        if (e instanceof StorageSecurityError) {
          symlinkBlocked = true;
        }
      }
      assert(symlinkBlocked, "Symlink pointing outside tenant storage is blocked by StorageSecurityError");
    } finally {
      if (fs.existsSync(symlinkPath)) {
        fs.unlinkSync(symlinkPath);
      }
    }
  }

  // ----------------------------------------------------------------------------
  // Test 21: Inconsistent Python Rule Findings Override Outcome (Precedence Enforcement)
  // ----------------------------------------------------------------------------
  console.log("\n[TEST 21] Inconsistent Python rule findings override overall outcome");
  {
    const testHash = "c".repeat(64);

    // 21A: Report claims PASS but contains a FAIL finding
    const contradictoryPassWithFail = {
      report_id: "rep-contra-1",
      document_name: "drawing.pdf",
      sha256_hash: testHash,
      standard: "IPC/WHMA-A-620D",
      overall_outcome: "PASS", // Malformed claim!
      specification_is_complete: true,
      extraction_is_verified: true,
      total_page_count: 1,
      processed_page_count: 1,
      failed_page_count: 0,
      unprocessed_page_numbers: [],
      failed_page_numbers: [],
      rule_findings: [
        {
          finding_id: "F-CONTRA-1",
          rule_id: "RULE-NETLIST-05",
          rule_name: "Destination Terminal Mismatch",
          standard_reference: "IPC/WHMA-A-620D Section 13.5.1",
          severity: "CRITICAL",
          outcome: "FAIL",
          title: "Destination Terminal Mismatch",
          reason: "Observed mismatch",
          human_review_required: false,
        },
      ],
    };

    const sanitizedA = validateAndSanitizeReport(contradictoryPassWithFail, testHash);
    assert(sanitizedA.overall_outcome === "FAIL", "Outcome overridden to FAIL due to presence of FAIL finding");

    // 21B: Report claims PASS but contains a REVIEW finding
    const contradictoryPassWithReview = {
      report_id: "rep-contra-2",
      document_name: "drawing.pdf",
      sha256_hash: testHash,
      standard: "IPC/WHMA-A-620D",
      overall_outcome: "PASS", // Malformed claim!
      specification_is_complete: true,
      extraction_is_verified: true,
      total_page_count: 1,
      processed_page_count: 1,
      failed_page_count: 0,
      unprocessed_page_numbers: [],
      failed_page_numbers: [],
      rule_findings: [
        {
          finding_id: "F-CONTRA-2",
          rule_id: "RULE-SPEC-00",
          rule_name: "Authoritative Expected Netlist Missing",
          standard_reference: "IPC/WHMA-A-620D Section 1.4",
          severity: "MEDIUM",
          outcome: "REVIEW",
          title: "Authoritative Expected Netlist Missing",
          reason: "Spec missing",
          human_review_required: true,
        },
      ],
    };

    const sanitizedB = validateAndSanitizeReport(contradictoryPassWithReview, testHash);
    assert(sanitizedB.overall_outcome === "REVIEW", "Outcome overridden to REVIEW due to presence of REVIEW finding");
  }

  // ----------------------------------------------------------------------------
  // Test 22: Service-to-service authentication secret enforcement & header transmission
  // ----------------------------------------------------------------------------
  console.log("\n[TEST 22] Service-to-service authentication secret enforcement and header transmission");
  {
    const originalEnvSecret = process.env.SPANQC_INTERNAL_SERVICE_SECRET;
    const originalEnforce = process.env.SPANQC_ENFORCE_SERVICE_SECRET;
    const originalFetch = globalThis.fetch;

    try {
      // 1. Fails closed when secret is absent and enforcement is on
      delete process.env.SPANQC_INTERNAL_SERVICE_SECRET;
      process.env.SPANQC_ENFORCE_SERVICE_SECRET = "true";

      const { job: jobA } = await createQCJob({
        tenantId: spandsonsTenantId,
        projectId: "proj-777x",
        userId: "b82954d0-7a22-4af1-a030-74ad5c0a6f00",
        fileBuffer: VALID_PDF_BYTES,
        originalFilename: "auth_enforce_test.pdf",
        autoDispatch: false,
      });

      await processQCJob(jobA.id);

      const updatedJobA = await db.qCJob.findUniqueOrThrow({ where: { id: jobA.id } });
      assert(updatedJobA.status === "FAILED", "Job failed when required secret was missing");
      assert(
        updatedJobA.errorMessage?.includes("Missing required SPANQC_INTERNAL_SERVICE_SECRET") === true,
        "Error message explicitly identifies missing required internal secret"
      );

      // 2. Transmits Authorization and X-SpanQC-Internal-Key when secret is configured
      const testSecret = "staging-secret-min-16-bytes-xyz";
      process.env.SPANQC_INTERNAL_SERVICE_SECRET = testSecret;
      process.env.SPANQC_ENFORCE_SERVICE_SECRET = "true";

      let capturedAuthHeader: string | null = null;
      let capturedCustomHeader: string | null = null;

      globalThis.fetch = (async (url: any, init: any) => {
        capturedAuthHeader = init?.headers?.["Authorization"] || null;
        capturedCustomHeader = init?.headers?.["X-SpanQC-Internal-Key"] || null;
        return new Response(
          JSON.stringify({
            report_id: "rep-auth-1",
            document_name: "auth_enforce_test.pdf",
            sha256_hash: jobA.documentSha256,
            standard: "IPC/WHMA-A-620D",
            created_at: new Date().toISOString(),
            model_used: "gemma3:4b",
            overall_outcome: "REVIEW",
            specification_is_complete: false,
            extraction_is_verified: false,
            rule_findings: [],
            candidate_observations: [],
            total_page_count: 1,
            processed_page_count: 1,
            failed_page_count: 0,
            unprocessed_page_numbers: [],
            failed_page_numbers: [],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }) as any;

      const { job: jobB } = await createQCJob({
        tenantId: spandsonsTenantId,
        projectId: "proj-777x",
        userId: "b82954d0-7a22-4af1-a030-74ad5c0a6f00",
        fileBuffer: VALID_PDF_BYTES,
        originalFilename: "auth_header_test.pdf",
        autoDispatch: false,
      });

      await processQCJob(jobB.id);

      assert(capturedAuthHeader === `Bearer ${testSecret}`, "Authorization Bearer header was transmitted");
      assert(capturedCustomHeader === testSecret, "X-SpanQC-Internal-Key header was transmitted");

      const updatedJobB = await db.qCJob.findUniqueOrThrow({ where: { id: jobB.id } });
      assert(updatedJobB.status === "REVIEW_REQUIRED", "Job succeeded and reached REVIEW_REQUIRED");
    } finally {
      globalThis.fetch = originalFetch;
      if (originalEnvSecret !== undefined) {
        process.env.SPANQC_INTERNAL_SERVICE_SECRET = originalEnvSecret;
      } else {
        delete process.env.SPANQC_INTERNAL_SERVICE_SECRET;
      }
      if (originalEnforce !== undefined) {
        process.env.SPANQC_ENFORCE_SERVICE_SECRET = originalEnforce;
      } else {
        delete process.env.SPANQC_ENFORCE_SERVICE_SECRET;
      }
    }
  }

  console.log("\n================================================================================");
  console.log(`QC JOB BRIDGE TEST SUITE COMPLETE: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("================================================================================");

  if (failedCount > 0) {
    throw new Error(`Test suite failed with ${failedCount} errors.`);
  }
}

runQCBridgeTestSuite()
  .catch((err) => {
    console.error("\n[TEST RUNNER FATAL ERROR]", err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
