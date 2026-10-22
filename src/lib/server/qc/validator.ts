import { createHash } from "node:crypto";
import path from "node:path";
import { MAX_DOCUMENT_SIZE_BYTES } from "../storage/document-store";

export class DocumentValidationError extends Error {
  public statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "DocumentValidationError";
    this.statusCode = statusCode;
  }
}

export type SupportedDocumentFormat = "pdf" | "png" | "jpeg";

/**
 * Validates document buffer against magic bytes rather than trusting filename or mime-type headers.
 */
export function detectDocumentFormat(buffer: Buffer): SupportedDocumentFormat {
  if (!buffer || buffer.length < 4) {
    throw new DocumentValidationError("File is empty or corrupted (insufficient header bytes).", 400);
  }

  // PDF: starts with %PDF- (0x25, 0x50, 0x44, 0x46, 0x2D)
  if (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return "pdf";
  }

  // PNG: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "png";
  }

  // JPEG: 0xFF 0xD8 0xFF
  if (
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "jpeg";
  }

  throw new DocumentValidationError(
    "Unsupported or invalid file format. Magic byte inspection failed. Supported formats: PDF, PNG, JPEG.",
    400
  );
}

/**
 * Sanitizes original filename to prevent path traversal or header spoofing.
 */
export function sanitizeFilename(rawFilename: string | null | undefined): string {
  if (!rawFilename || typeof rawFilename !== "string") {
    return "unnamed_document.pdf";
  }
  const basename = path.basename(rawFilename).trim();
  // Strip non-printable / control characters / dangerous symbols
  const clean = basename.replace(/[^a-zA-Z0-9._-]/g, "_");
  if (clean.length === 0 || clean === "." || clean === "..") {
    return "unnamed_document.pdf";
  }
  return clean.slice(0, 128);
}

/**
 * Computes cryptographically secure SHA-256 hash of file content.
 */
export function computeDocumentSha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

/**
 * Validates uploaded file buffer completely.
 */
export function validateUploadFile(
  buffer: Buffer,
  rawFilename: string | null | undefined
): { format: SupportedDocumentFormat; sha256: string; sanitizedFilename: string } {
  if (!buffer || buffer.length === 0) {
    throw new DocumentValidationError("Uploaded document is empty (0 bytes).", 400);
  }

  if (buffer.length > MAX_DOCUMENT_SIZE_BYTES) {
    throw new DocumentValidationError(
      `File size (${(buffer.length / 1024 / 1024).toFixed(2)} MB) exceeds maximum allowed limit of 25 MB.`,
      413
    );
  }

  const format = detectDocumentFormat(buffer);
  const sha256 = computeDocumentSha256(buffer);
  const sanitizedFilename = sanitizeFilename(rawFilename);

  return { format, sha256, sanitizedFilename };
}
