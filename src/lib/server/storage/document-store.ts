import fs from "node:fs";
import path from "node:path";

export const MAX_DOCUMENT_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

export class StorageSecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageSecurityError";
  }
}

export class StorageNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageNotFoundError";
  }
}

function getStorageRoot(): string {
  const root = process.env.STORAGE_ROOT || path.join(process.cwd(), "storage/private");
  return path.resolve(root);
}

/**
 * Validates tenant identifier to prevent directory traversal or injection attacks.
 */
export function sanitizeTenantId(tenantId: string): string {
  if (!tenantId || typeof tenantId !== "string") {
    throw new StorageSecurityError("Tenant identifier is missing or invalid.");
  }
  const trimmed = tenantId.trim();
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(trimmed)) {
    throw new StorageSecurityError("Tenant identifier contains illegal characters.");
  }
  return trimmed;
}

/**
 * Validates SHA-256 hash format to prevent traversal.
 */
export function sanitizeDocumentHash(sha256: string): string {
  if (!sha256 || typeof sha256 !== "string") {
    throw new StorageSecurityError("Document hash is missing or invalid.");
  }
  const trimmed = sha256.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(trimmed)) {
    throw new StorageSecurityError("Document hash must be a valid 64-character hexadecimal SHA-256 string.");
  }
  return trimmed;
}

/**
 * Generates an opaque, canonical storage key for a document within tenant isolation boundary.
 */
export function buildDocumentStorageKey(tenantId: string, sha256: string): string {
  const cleanTenant = sanitizeTenantId(tenantId);
  const cleanHash = sanitizeDocumentHash(sha256);
  return `tenants/${cleanTenant}/documents/${cleanHash}.pdf`;
}

/**
 * Resolves and strictly bounds file path to tenant-isolated directory, preventing path traversal.
 */
export function resolveSafeTenantPath(tenantId: string, storageKey: string): string {
  const cleanTenant = sanitizeTenantId(tenantId);
  const storageRoot = getStorageRoot();
  const tenantBaseDir = path.resolve(storageRoot, "tenants", cleanTenant);

  // Normalize storage key
  const normalizedKey = path.normalize(storageKey).replace(/^(\.\.(\/|\\|$))+/, "");
  const resolvedTarget = path.resolve(storageRoot, normalizedKey);

  // Verify that resolved path begins strictly within the tenant base directory
  if (!resolvedTarget.startsWith(tenantBaseDir + path.sep)) {
    throw new StorageSecurityError("Cross-tenant access or path traversal blocked.");
  }

  // Symlink escape defense: verify real physical path does not escape tenant boundary
  if (fs.existsSync(resolvedTarget)) {
    try {
      const realTarget = fs.realpathSync(resolvedTarget);
      const realTenantDir = fs.existsSync(tenantBaseDir)
        ? fs.realpathSync(tenantBaseDir)
        : tenantBaseDir;

      if (!realTarget.startsWith(realTenantDir + path.sep) && realTarget !== realTenantDir) {
        throw new StorageSecurityError("Symlink escape or path traversal blocked.");
      }
    } catch (err: any) {
      if (err instanceof StorageSecurityError) throw err;
      throw new StorageSecurityError("Unable to verify path safety against symlink traversal.");
    }
  }

  return resolvedTarget;
}

/**
 * Securely writes a document buffer into tenant-isolated private storage.
 */
export async function storeDocument(
  tenantId: string,
  sha256: string,
  data: Buffer
): Promise<{ storageKey: string; byteCount: number }> {
  if (!Buffer.isBuffer(data) || data.length === 0) {
    throw new StorageSecurityError("Document content cannot be empty.");
  }
  if (data.length > MAX_DOCUMENT_SIZE_BYTES) {
    throw new StorageSecurityError(`Document exceeds maximum size of ${MAX_DOCUMENT_SIZE_BYTES} bytes.`);
  }

  const storageKey = buildDocumentStorageKey(tenantId, sha256);
  const targetPath = resolveSafeTenantPath(tenantId, storageKey);
  const targetDir = path.dirname(targetPath);

  // Ensure directory exists with restricted permissions (0o700)
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true, mode: 0o700 });
  }

  // Refuse to write through symlinks
  if (fs.existsSync(targetPath)) {
    const stat = fs.lstatSync(targetPath);
    if (stat.isSymbolicLink()) {
      throw new StorageSecurityError("Symlink overwrite prohibited.");
    }
  }

  // Atomically write file (avoid logging data)
  await fs.promises.writeFile(targetPath, data, { mode: 0o600 });

  return { storageKey, byteCount: data.length };
}

/**
 * Securely reads a document buffer from tenant-isolated private storage.
 * Enforces that caller tenant owns the document.
 */
export async function retrieveDocument(tenantId: string, storageKey: string): Promise<Buffer> {
  const targetPath = resolveSafeTenantPath(tenantId, storageKey);

  if (!fs.existsSync(targetPath)) {
    throw new StorageNotFoundError("Document not found in tenant storage.");
  }

  return await fs.promises.readFile(targetPath);
}

/**
 * Deletes a document from tenant-isolated storage.
 */
export async function deleteDocument(tenantId: string, storageKey: string): Promise<boolean> {
  const targetPath = resolveSafeTenantPath(tenantId, storageKey);

  if (!fs.existsSync(targetPath)) {
    return false;
  }

  await fs.promises.unlink(targetPath);
  return true;
}
