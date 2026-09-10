import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { wrap, jsonOk } from "@/lib/http";
import { loginSchema } from "@/lib/validate";
import { verifyPassword, createAuthSession, sessionCookieOptions, clientMeta } from "@/lib/auth";
import { RATE_RULES, checkRateLimit } from "@/lib/rate-limit";
import { audit, securityEvent } from "@/lib/audit";
import { tooMany, unauthorized } from "@/lib/errors";

// Login with progressive lockout: after 10 consecutive failures the account is
// locked for 15 minutes. IP-level rate limiting applies on top.

const MAX_FAILED = 10;
const LOCK_MINUTES = 15;

export const POST = wrap(
  async (req: NextRequest) => {
    const body = loginSchema.parse(await req.json());
    const meta = await clientMeta();

    const ipAllowed = await checkRateLimit(RATE_RULES.authLogin, `ip:${meta.ip ?? "unknown"}`);
    if (!ipAllowed) {
      await securityEvent({ kind: "RATE_LIMITED", severity: "WARN", detail: { route: "login", ip: meta.ip } });
      throw tooMany("Too many login attempts from this address. Retry later.");
    }

    const user = await db.user.findUnique({ where: { email: body.email } });
    if (!user || user.status === "DELETED") {
      await securityEvent({ kind: "LOGIN_FAILED", severity: "INFO", detail: { reason: "no_user" } });
      throw unauthorized("Invalid email or password");
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await securityEvent({ kind: "ACCOUNT_LOCKED", userId: user.id, severity: "WARN", detail: { until: user.lockedUntil } });
      throw tooMany("Account temporarily locked after failed attempts. Try again later.");
    }
    if (user.status === "SUSPENDED") {
      await securityEvent({ kind: "LOGIN_FAILED", userId: user.id, severity: "WARN", detail: { reason: "suspended" } });
      throw unauthorized("This account is suspended. Contact support.");
    }

    const valid = await verifyPassword(body.password, user.passwordHash);
    if (!valid) {
      const failed = user.failedLoginCount + 1;
      await db.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: failed,
          lockedUntil: failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
        },
      });
      await securityEvent({
        kind: failed >= MAX_FAILED ? "ACCOUNT_LOCKED" : "LOGIN_FAILED",
        userId: user.id,
        severity: failed >= MAX_FAILED ? "CRITICAL" : "INFO",
        detail: { failedCount: failed },
      });
      throw unauthorized("Invalid email or password");
    }

    await db.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    });
    const session = await createAuthSession(user.id, { ip: meta.ip, userAgent: meta.userAgent });
    await audit({ actorId: user.id, actorRole: user.role, action: "AUTH_LOGIN", targetType: "User", targetId: user.id, ip: meta.ip });

    const res = NextResponse.json({
      ok: true,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, status: user.status, emailVerified: !!user.emailVerifiedAt },
    });
    res.cookies.set({ ...sessionCookieOptions(session.expiresAt), value: session.token });
    return res;
  },
  { rule: "authLogin" }
);
