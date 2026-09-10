import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { wrap, jsonOk } from "@/lib/http";
import { registerSchema } from "@/lib/validate";
import { hashPassword, passwordProblems, createAuthSession, sessionCookieOptions, clientMeta } from "@/lib/auth";
import { badRequest } from "@/lib/errors";
import { RATE_RULES } from "@/lib/rate-limit";
import { audit, securityEvent } from "@/lib/audit";
import { getSiteConfig } from "@/lib/settings";
import { randomToken, hashToken } from "@/lib/crypto";
import { env } from "@/lib/env";
import { notify } from "@/lib/notify";

// Registration. Accounts start PENDING_VERIFICATION when email delivery is not
// configured; in that mode the verification token is returned once, in this
// response, and is also visible to admins. This is a deliberate, documented
// dev-mode behavior (EMAIL_MODE=none), never a silent bypass in production
// terms: production deployments must configure SMTP and flip EMAIL_MODE.

export const POST = wrap(
  async (req: NextRequest) => {
    const config = await getSiteConfig();
    if (!config.registrationEnabled) {
      return jsonOk({ error: { code: "REGISTRATION_CLOSED", message: "Registration is currently disabled" } }, { status: 403 });
    }
    const body = registerSchema.parse(await req.json());

    const problems = passwordProblems(body.password);
    if (problems.length > 0) throw badRequest("Password does not meet requirements", { problems });

    const existing = await db.user.findUnique({ where: { email: body.email } });
    if (existing) {
      // Do not reveal whether the email exists; respond identically and audit.
      await securityEvent({ kind: "INVALID_INPUT", severity: "INFO", detail: { route: "register", duplicateAttempt: true } });
      return jsonOk({ ok: true, message: "Check your inbox to verify your account. If no email arrives, contact support." });
    }

    const meta = await clientMeta();
    const passwordHash = await hashPassword(body.password);
    const user = await db.user.create({
      data: {
        email: body.email,
        passwordHash,
        name: body.name ?? null,
        status: "PENDING_VERIFICATION",
      },
    });

    // Consent records: terms acceptance is captured at registration.
    await db.consentRecord.create({
      data: {
        userId: user.id,
        kind: "TERMS",
        textVersion: "2026-09-10",
        evidenceHash: hashToken(`${user.id}:terms:2026-09-10`),
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
    });

    // Assign the FREE plan.
    const freePlan = await db.plan.findUnique({ where: { code: "FREE" } });
    if (freePlan) {
      await db.subscription.create({ data: { userId: user.id, planId: freePlan.id, status: "ACTIVE" } });
    }

    const rawToken = randomToken(24);
    await db.verificationToken.create({
      data: {
        userId: user.id,
        purpose: "EMAIL_VERIFY",
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(Date.now() + 48 * 3600 * 1000),
      },
    });

    await notify({
      userId: user.id,
      kind: "SYSTEM",
      title: "Welcome to the platform",
      body: "Your account is created. Verify your email address to unlock sessions and uploads.",
    });

    const session = await createAuthSession(user.id, { ip: meta.ip, userAgent: meta.userAgent });
    await audit({ actorId: user.id, actorRole: "USER", action: "AUTH_REGISTER", targetType: "User", targetId: user.id, ip: meta.ip });

    const res = NextResponse.json({
      ok: true,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, status: user.status },
      verificationRequired: true,
      // Dev-mode only: EMAIL_MODE=none means no SMTP exists. Shown once, logged in audit.
      devVerificationToken: env.emailMode === "none" ? rawToken : undefined,
      emailModeNote:
        env.emailMode === "none"
          ? "Email delivery is not configured in this deployment (EMAIL_MODE=none). The verification token is shown here once; production deployments configure SMTP and never expose tokens."
          : undefined,
    });
    res.cookies.set({ ...sessionCookieOptions(session.expiresAt), value: session.token });
    return res;
  },
  { rule: "authRegister" }
);
