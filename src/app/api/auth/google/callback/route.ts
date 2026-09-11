import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, createAuthSession, sessionCookieOptions, clientMeta } from "@/lib/auth";
import { randomToken, hashToken } from "@/lib/crypto";
import { env } from "@/lib/env";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";

// Google OAuth 2.0 web flow, step 2: code exchange, account link-or-create,
// session creation. Every failure path redirects back to the auth page with an
// honest, specific note - never a silent fallback to a broken state.
//
// Account linking policy: an existing email is linked (Google has verified the
// address); suspended/deleted accounts are refused. A NEW account is created
// only when the flow started from the register page with terms accepted; its
// password hash is a random value that can never be used to sign in.

const TERMS_TEXT_VERSION = "2026-09-10";
const STATE_COOKIE = "voxcore_oauth_state";

function fail(origin: string, page: "login" | "register", message: string, clearState = true) {
  const res = NextResponse.redirect(
    `${origin}/auth/${page}?note=${encodeURIComponent(message)}`
  );
  if (clearState) res.cookies.set({ name: STATE_COOKIE, value: "", path: "/", maxAge: 0 });
  return res;
}

export const GET = async (req: NextRequest) => {
  const origin = env.appOrigin.replace(/\/$/, "");

  if (!env.googleEnabled) {
    return fail(origin, "login", "Google sign-in is not configured on this deployment.", false);
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");
  const stateCookie = req.cookies.get(STATE_COOKIE)?.value ?? "";
  const [stateValue, mode] = stateCookie.split(":");

  if (!code || !stateParam || !stateValue || stateParam !== stateValue) {
    return fail(origin, "login", "Google sign-in session expired or invalid. Please try again.");
  }
  const isRegister = mode === "register";

  try {
    // Code -> tokens.
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: env.googleClientId,
        client_secret: env.googleClientSecret,
        redirect_uri: `${origin}/api/auth/google/callback`,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) {
      return fail(origin, isRegister ? "register" : "login", "Google token exchange failed. Please try again.");
    }
    const tokens = (await tokenRes.json()) as { access_token?: string };
    if (!tokens.access_token) {
      return fail(origin, isRegister ? "register" : "login", "Google did not return an access token. Please try again.");
    }

    // Tokens -> verified profile.
    const uiRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!uiRes.ok) {
      return fail(origin, isRegister ? "register" : "login", "Could not read your Google profile. Please try again.");
    }
    const profile = (await uiRes.json()) as {
      email?: string;
      email_verified?: boolean;
      name?: string;
    };
    if (!profile.email || !profile.email_verified) {
      return fail(origin, isRegister ? "register" : "login", "Your Google account email is not verified; the platform requires a verified email.");
    }
    const email = profile.email.toLowerCase();

    const meta = await clientMeta();
    let user = await db.user.findUnique({ where: { email } });
    let created = false;

    if (!user) {
      if (!isRegister) {
        return fail(origin, "register", `No account exists for ${email}. Create one first (Google sign-up is on the Create account page), then Google sign-in will work.`);
      }
      // New account. Password hash is random and unusable: this account signs in
      // via Google only (or resets its password later through the normal flow).
      const passwordHash = await hashPassword(randomToken(32));
      user = await db.user.create({
        data: {
          email,
          passwordHash,
          name: profile.name?.slice(0, 80) ?? null,
          status: "ACTIVE",
          emailVerifiedAt: new Date(),
        },
      });
      created = true;
      // Consent was explicitly given before the OAuth flow started (start route
      // enforces terms=1) - recorded with the same evidence format as the
      // password registration path.
      await db.consentRecord.create({
        data: {
          userId: user.id,
          kind: "TERMS",
          textVersion: TERMS_TEXT_VERSION,
          evidenceHash: hashToken(`${user.id}:terms:${TERMS_TEXT_VERSION}`),
          ip: meta.ip,
          userAgent: meta.userAgent,
        },
      });
      const freePlan = await db.plan.findUnique({ where: { code: "FREE" } });
      if (freePlan) {
        await db.subscription.create({ data: { userId: user.id, planId: freePlan.id, status: "ACTIVE" } });
      }
      await notify({
        userId: user.id,
        kind: "SYSTEM",
        title: "Welcome to the platform",
        body: "Your account was created with Google sign-in. Verify details in your account page before uploading voice models.",
      });
    } else {
      if (user.status === "DELETED") {
        return fail(origin, "login", "This account was deleted.");
      }
      if (user.status === "SUSPENDED") {
        return fail(origin, "login", "Account suspended. Contact support.");
      }
      // Link: Google has verified the email, so the platform account can be
      // marked verified too. PENDING_VERIFICATION accounts become ACTIVE.
      if (!user.emailVerifiedAt || user.status === "PENDING_VERIFICATION") {
        await db.user.update({
          where: { id: user.id },
          data: {
            emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
            status: user.status === "PENDING_VERIFICATION" ? "ACTIVE" : user.status,
          },
        });
      }
    }

    const session = await createAuthSession(user.id, { ip: meta.ip, userAgent: meta.userAgent });
    await audit({
      actorId: user.id,
      actorRole: "USER",
      action: created ? "AUTH_REGISTER_GOOGLE" : "AUTH_LOGIN_GOOGLE",
      targetType: "User",
      targetId: user.id,
      ip: meta.ip,
    });

    const res = NextResponse.redirect(`${origin}/`);
    res.cookies.set({ ...sessionCookieOptions(session.expiresAt), value: session.token });
    res.cookies.set({ name: STATE_COOKIE, value: "", path: "/", maxAge: 0 });
    return res;
  } catch {
    return fail(origin, isRegister ? "register" : "login", "Google sign-in failed unexpectedly. Please try again or use email and password.");
  }
};
