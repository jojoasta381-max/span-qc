import { createHmac, createHash, randomBytes } from "node:crypto";
import { db } from "../db";

export const SESSION_COOKIE_NAME = "spanqc_session";
export const SESSION_DURATION_SECONDS = 86400; // 24 hours

export interface SessionPayload {
  userId: string;
  tenantId: string;
  role: string;
  email: string;
  sessionId: string;
  exp: number; // Unix timestamp in seconds
}

function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("AUTH_SECRET environment variable is missing or insufficiently long (minimum 16 chars).");
  }
  return secret;
}

/**
 * Sign a payload with HMAC-SHA256.
 * Returns raw token: "<base64url_payload>.<base64url_sig>"
 */
export function signSessionToken(payload: SessionPayload): string {
  const secret = getAuthSecret();
  const payloadJson = JSON.stringify(payload);
  const payloadB64 = Buffer.from(payloadJson).toString("base64url");
  const signature = createHmac("sha256", secret).update(payloadB64).digest("base64url");
  return `${payloadB64}.${signature}`;
}

/**
 * Verify a signed session token.
 * Returns parsed SessionPayload or null if signature/expiry is invalid.
 */
export function verifySessionToken(token: string): SessionPayload | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [payloadB64, signature] = parts;
  try {
    const secret = getAuthSecret();
    const expectedSig = createHmac("sha256", secret).update(payloadB64).digest("base64url");

    if (signature !== expectedSig) {
      return null;
    }

    const payloadJson = Buffer.from(payloadB64, "base64url").toString("utf8");
    const payload = JSON.parse(payloadJson) as SessionPayload;

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < nowSeconds) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Hash raw token for storage in database session table.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Create a persistent server-side session in the database and return the signed client token.
 */
export async function createServerSession(
  userId: string,
  tenantId: string,
  role: string,
  email: string
): Promise<{ token: string; expiresAt: Date; sessionRecordId: string }> {
  const expiresAt = new Date(Date.now() + SESSION_DURATION_SECONDS * 1000);
  const expSeconds = Math.floor(expiresAt.getTime() / 1000);
  const sessionRecordId = randomBytes(16).toString("hex");

  const payload: SessionPayload = {
    userId,
    tenantId,
    role,
    email,
    sessionId: sessionRecordId,
    exp: expSeconds,
  };

  const rawToken = signSessionToken(payload);
  const tokenHashed = hashToken(rawToken);

  // Persist session to database
  await db.session.create({
    data: {
      id: sessionRecordId,
      tokenHash: tokenHashed,
      userId,
      tenantId,
      expiresAt,
    },
  });

  return { token: rawToken, expiresAt, sessionRecordId };
}

/**
 * Validate a session token against the database session store.
 */
export async function validateDBSession(token: string) {
  const verifiedPayload = verifySessionToken(token);
  if (!verifiedPayload) return null;

  const tokenHashed = hashToken(token);
  const session = await db.session.findUnique({
    where: { tokenHash: tokenHashed },
    include: {
      user: true,
      tenant: true,
    },
  });

  if (!session) return null;
  if (session.expiresAt < new Date()) {
    // Expired - clean up
    await db.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  if (session.user.status !== "ACTIVE" || session.tenant.status !== "ACTIVE") {
    return null;
  }

  return session;
}

/**
 * Invalidate/delete a session from the database.
 */
export async function revokeServerSession(token: string): Promise<void> {
  const tokenHashed = hashToken(token);
  await db.session.deleteMany({
    where: { tokenHash: tokenHashed },
  });
}

/**
 * Revoke all active database sessions for a specific user ID (e.g. on password/role change).
 */
export async function revokeAllUserSessions(userId: string): Promise<void> {
  await db.session.deleteMany({
    where: { userId },
  });
}

/**
 * Extract session token from cookie header or NextRequest cookies.
 */
export function extractSessionTokenFromCookie(cookieHeader: string | null | undefined): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export interface RequestAuth {
  token: string | null;
  authType: "cookie" | "bearer" | null;
}

/**
 * Centrally extract session token and authentication type from cookies or Authorization header.
 * Prioritizes cookies when present, and safely handles Bearer tokens.
 * Rejects empty or malformed bearer tokens.
 */
export function extractRequestAuth(request: Request | { headers: Headers; cookies?: { get(name: string): { value: string } | undefined } }): RequestAuth {
  if ("cookies" in request && typeof request.cookies?.get === "function") {
    const cookieVal = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (cookieVal && cookieVal.trim().length > 0) {
      return { token: cookieVal.trim(), authType: "cookie" };
    }
  }

  const cookieHeader = request.headers.get("cookie");
  const cookieToken = extractSessionTokenFromCookie(cookieHeader);
  if (cookieToken && cookieToken.trim().length > 0) {
    return { token: cookieToken.trim(), authType: "cookie" };
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader) {
    const trimmed = authHeader.trim();
    if (trimmed.toLowerCase().startsWith("bearer ")) {
      const bearerToken = trimmed.slice(7).trim();
      if (bearerToken.length > 0) {
        return { token: bearerToken, authType: "bearer" };
      }
    }
  }

  return { token: null, authType: null };
}
