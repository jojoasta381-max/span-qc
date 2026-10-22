import { NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { extractRequestAuth, validateDBSession } from "@/lib/server/auth/session";

export async function PATCH(request: Request) {
  try {
    const auth = extractRequestAuth(request);
    if (!auth.token) {
      return NextResponse.json(
        { detail: "Authentication required." },
        { status: 401 }
      );
    }

    const session = await validateDBSession(auth.token);
    if (!session) {
      return NextResponse.json(
        { detail: "Session expired or invalid. Please sign in again." },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    if (typeof body.isGoogleAuthEnabled !== "boolean") {
      return NextResponse.json(
        { detail: "Field 'isGoogleAuthEnabled' must be a boolean." },
        { status: 400 }
      );
    }

    const updatedUser = await db.user.update({
      where: { id: session.user.id },
      data: { isGoogleAuthEnabled: body.isGoogleAuthEnabled },
    });

    return NextResponse.json({
      success: true,
      user_id: updatedUser.id,
      is_google_auth_enabled: updatedUser.isGoogleAuthEnabled,
      has_google_linked: Boolean(updatedUser.googleId),
      message: updatedUser.isGoogleAuthEnabled
        ? "Google authentication enabled for this account."
        : "Google authentication disabled. Sign-ins now require master password.",
    });
  } catch (err) {
    console.error("[SECURITY_SETTINGS_PATCH_ERROR]", err);
    return NextResponse.json(
      { detail: "Failed to update security settings." },
      { status: 500 }
    );
  }
}
