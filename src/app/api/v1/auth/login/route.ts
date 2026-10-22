import { NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { verifyPassword } from "@/lib/server/auth/passwords";
import { createServerSession, isRequestSecure, SESSION_COOKIE_NAME, SESSION_DURATION_SECONDS } from "@/lib/server/auth/session";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    // 1. Enforce both email and password are provided
    if (!email || !password) {
      return NextResponse.json(
        { detail: "Email and password are required." },
        { status: 400 }
      );
    }

    // 2. Query persistent user record
    const user = await db.user.findUnique({
      where: { email },
      include: {
        tenant: true,
      },
    });

    if (!user || user.status !== "ACTIVE" || user.tenant.status !== "ACTIVE") {
      // Constant-time generic error to prevent user enumeration
      return NextResponse.json(
        { detail: "Invalid email or password." },
        { status: 401 }
      );
    }

    // 3. Cryptographically verify password against stored salted scrypt hash
    const isValidPassword = await verifyPassword(password, user.passwordHash);
    if (!isValidPassword) {
      return NextResponse.json(
        { detail: "Invalid email or password." },
        { status: 401 }
      );
    }

    // 4. Create persistent server session in database
    const { token, expiresAt } = await createServerSession(
      user.id,
      user.tenantId,
      user.role,
      user.email
    );

    const safeUser = {
      id: user.id,
      email: user.email,
      full_name: user.name,
      role: user.role,
      is_active: user.status === "ACTIVE",
      created_at: user.createdAt.toISOString(),
    };

    const safeOrg = {
      id: user.tenant.id,
      name: user.tenant.name,
      slug: user.tenant.slug,
      tier: user.tenant.plan,
      max_monthly_checks: user.tenant.checkQuota,
      used_monthly_checks: user.tenant.quotaUsed,
      created_at: user.tenant.createdAt.toISOString(),
    };

    const response = NextResponse.json({
      user: safeUser,
      organization: safeOrg,
      tokens: {
        access_token: token,
        token_type: "bearer",
        expires_in: SESSION_DURATION_SECONDS,
      },
    });

    // 5. Issue secure HttpOnly session cookie
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: isRequestSecure(request),
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_DURATION_SECONDS,
      expires: expiresAt,
    });

    return response;
  } catch (err) {
    console.error("[AUTH_LOGIN_ERROR]", err);
    return NextResponse.json(
      { detail: "An unexpected authentication error occurred." },
      { status: 500 }
    );
  }
}
