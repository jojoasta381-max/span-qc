import { NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { hashPassword } from "@/lib/server/auth/passwords";
import { createServerSession, SESSION_COOKIE_NAME, SESSION_DURATION_SECONDS } from "@/lib/server/auth/session";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const fullName = typeof body.full_name === "string" ? body.full_name.trim() : "";
    const orgName = typeof body.organization_name === "string" && body.organization_name.trim()
      ? body.organization_name.trim()
      : `${fullName || "Workspace"}'s Organization`;

    // 1. Validation
    if (!email || !password) {
      return NextResponse.json(
        { detail: "Email and password are required." },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email) || email.length > 254) {
      return NextResponse.json(
        { detail: "Please provide a valid work email address." },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { detail: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    // 2. Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { detail: "An account with this email already exists. Please sign in." },
        { status: 409 }
      );
    }

    // 3. Generate tenant slug
    let slug = orgName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (!slug || slug.length < 2) {
      slug = `tenant-${Date.now().toString(36)}`;
    }

    // If slug exists, append random suffix
    let tenant = await db.tenant.findUnique({ where: { slug } });
    if (tenant) {
      slug = `${slug}-${Math.random().toString(36).substring(2, 6)}`;
    }

    // 4. Create Tenant
    tenant = await db.tenant.create({
      data: {
        name: orgName,
        slug,
        status: "ACTIVE",
        plan: "SUBSCRIPTION",
        checkQuota: 120,
        quotaUsed: 0,
      },
    });

    // 5. Hash password and create User as organization ADMIN
    const passwordHash = await hashPassword(password);
    const user = await db.user.create({
      data: {
        email,
        name: fullName || "Admin",
        passwordHash,
        status: "ACTIVE",
        role: "ADMIN",
        tenantId: tenant.id,
      },
      include: {
        tenant: true,
      },
    });

    // 6. Create session in database
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
    }, { status: 201 });

    // 7. Issue secure HttpOnly session cookie
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_DURATION_SECONDS,
      expires: expiresAt,
    });

    return response;
  } catch (err) {
    console.error("[AUTH_REGISTER_ERROR]", err);
    return NextResponse.json(
      { detail: "An unexpected error occurred while creating your account." },
      { status: 500 }
    );
  }
}
