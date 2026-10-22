import { NextResponse, type NextRequest } from "next/server";
import {
  validateDBSession,
  extractRequestAuth,
  SESSION_COOKIE_NAME,
} from "@/lib/server/auth/session";
import { validateOrigin } from "@/lib/server/auth/csrf";

/**
 * Next.js 16 Proxy (Request Guard)
 * Protects /app/* workspace routes and /api/v1/* API routes.
 *
 * Latency & Scalability Note:
 * Validating sessions against the database in the proxy provides immediate, authoritative
 * revocation when users/tenants are suspended or passwords rotate. In high-traffic or
 * multi-region deployments, this incurs a database round-trip on every matched path.
 * SQLite concurrency limits and edge routing must be evaluated before production scaling.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Always allow public authentication endpoints
  if (
    pathname === "/api/v1/auth/login" ||
    pathname === "/api/v1/auth/register" ||
    pathname === "/api/v1/auth/google"
  ) {
    return NextResponse.next();
  }

  const isApiRoute = pathname.startsWith("/api/v1/");
  const isAppRoute = pathname.startsWith("/app");

  // 2. Extract authentication credentials (supports cookies and Bearer tokens consistently)
  const auth = extractRequestAuth(request);

  // 3. CSRF Guard: Validate Origin/Referer on cookie-authenticated state-changing requests
  // Do NOT impose cookie-based CSRF checks on requests authenticated exclusively by Bearer tokens
  const isStateChangingMethod = ["POST", "PUT", "PATCH", "DELETE"].includes(request.method);
  if (auth.authType === "cookie" && isStateChangingMethod) {
    if (!validateOrigin(request)) {
      return NextResponse.json(
        { detail: "Cross-origin request blocked." },
        { status: 403 }
      );
    }
  }

  // 4. Extract and validate session against persistent DB store
  // Prevents revoked sessions, suspended accounts, or deleted users from accessing protected workspace pages
  const dbSession = auth.token ? await validateDBSession(auth.token) : null;

  // 5. Block unauthenticated, revoked, or suspended access
  if (!dbSession) {
    if (isApiRoute) {
      const response = NextResponse.json(
        { detail: "Authentication required" },
        { status: 401 }
      );
      if (auth.authType === "cookie") {
        response.cookies.delete(SESSION_COOKIE_NAME);
      }
      return response;
    }
    if (isAppRoute) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      const response = NextResponse.redirect(loginUrl);
      if (auth.authType === "cookie") {
        response.cookies.delete(SESSION_COOKIE_NAME);
      }
      return response;
    }
    return NextResponse.next();
  }

  // 6. Inject verified identity headers into request context for downstream handlers
  // Note: Outbound response headers are NOT modified to prevent internal ID leakage to clients
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-user-id", dbSession.user.id);
  requestHeaders.set("x-user-role", dbSession.user.role);
  requestHeaders.set("x-tenant-id", dbSession.tenantId);
  requestHeaders.set("x-user-email", dbSession.user.email);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    "/app/:path*",
    "/api/v1/:path*",
  ],
};
