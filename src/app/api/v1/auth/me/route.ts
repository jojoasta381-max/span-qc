import { NextResponse } from "next/server";
import {
  extractRequestAuth,
  validateDBSession,
  SESSION_COOKIE_NAME,
} from "@/lib/server/auth/session";

export async function GET(request: Request) {
  // 1. Extract session token from HttpOnly cookie or Authorization Bearer header
  const auth = extractRequestAuth(request);

  // 2. Return 401 if token is absent or malformed
  if (!auth.token) {
    return NextResponse.json(
      { detail: "Authentication required." },
      { status: 401 }
    );
  }

  // 3. Validate session against persistent database record
  const session = await validateDBSession(auth.token);
  if (!session) {
    const response = NextResponse.json(
      { detail: "Session expired or invalid. Please log in again." },
      { status: 401 }
    );
    if (auth.authType === "cookie") {
      response.cookies.delete(SESSION_COOKIE_NAME);
    }
    return response;
  }

  // 4. Return authenticated user details (Never fallback to hardcoded admin)
  return NextResponse.json({
    id: session.user.id,
    email: session.user.email,
    full_name: session.user.name,
    role: session.user.role,
    tenant_id: session.tenantId,
    is_active: session.user.status === "ACTIVE",
    is_google_auth_enabled: session.user.isGoogleAuthEnabled,
    has_google_linked: Boolean(session.user.googleId),
    created_at: session.user.createdAt.toISOString(),
  });
}
