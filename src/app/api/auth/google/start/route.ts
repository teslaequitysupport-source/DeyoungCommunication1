import { NextRequest, NextResponse } from "next/server";
import { randomToken } from "@/lib/crypto";
import { env } from "@/lib/env";

// Google OAuth 2.0 web flow, step 1: redirect to Google's consent screen.
//
// Activated only when GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET are configured;
// otherwise responds 404 with an honest message (the UI hides the button via
// the googleEnabled site flag, so this is defense in depth).
//
// register mode REQUIRES terms=1: the Terms / Privacy / Voice Rights consent is
// captured honestly at sign-up, never implied by an OAuth flow. The callback
// records the ConsentRecord only for accounts created through this path.

export const GET = async (req: NextRequest) => {
  if (!env.googleEnabled) {
    return NextResponse.json(
      {
        error: {
          code: "GOOGLE_AUTH_NOT_CONFIGURED",
          message:
            "Google sign-in is not configured on this deployment (missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).",
        },
      },
      { status: 404 }
    );
  }

  const url = new URL(req.url);
  const mode = url.searchParams.get("mode") === "register" ? "register" : "login";
  const termsAccepted = url.searchParams.get("terms") === "1";

  if (mode === "register" && !termsAccepted) {
    return NextResponse.redirect(
      `${env.appOrigin}/auth/register?note=${encodeURIComponent(
        "Accept the Terms, Privacy Policy and Voice Rights Policy before creating an account with Google."
      )}`
    );
  }

  const state = randomToken(16);
  const params = new URLSearchParams({
    client_id: env.googleClientId,
    redirect_uri: `${env.appOrigin}/api/auth/google/callback`,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });

  const res = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  // SameSite=Lax is REQUIRED here: Google's redirect back is a cross-site
  // top-level GET navigation, and SameSite=strict cookies are not sent on it.
  res.cookies.set({
    name: "voxcore_oauth_state",
    value: `${state}:${mode}`,
    httpOnly: true,
    secure: env.isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
};
