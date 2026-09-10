import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { wrap, jsonOk } from "@/lib/http";
import { badRequest } from "@/lib/errors";
import { hashToken } from "@/lib/crypto";
import { clientMeta, currentUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { RATE_RULES } from "@/lib/rate-limit";

// Email verification. Two modes:
// - token in body (from the verification link / dev-mode reveal)
// - when signed in and PENDING_VERIFICATION, accepting marks verified directly
//   ONLY in dev mode (EMAIL_MODE=none). Documented, visible, and refused in
//   production email mode.

export const POST = wrap(
  async (req: NextRequest) => {
    const body = (await req.json().catch(() => ({}))) as { token?: string };
    const meta = await clientMeta();

    if (body.token) {
      const row = await db.verificationToken.findUnique({ where: { tokenHash: hashToken(body.token) } });
      if (!row || row.purpose !== "EMAIL_VERIFY" || row.usedAt || row.expiresAt < new Date()) {
        throw badRequest("Invalid or expired verification token");
      }
      await db.$transaction([
        db.user.update({ where: { id: row.userId }, data: { emailVerifiedAt: new Date(), status: "ACTIVE" } }),
        db.verificationToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
      ]);
      await audit({ actorId: row.userId, actorRole: "USER", action: "AUTH_EMAIL_VERIFIED", targetType: "User", targetId: row.userId, ip: meta.ip });
      return jsonOk({ ok: true, verified: true });
    }

    const user = await currentUser();
    if (!user) throw badRequest("Token required");
    if (user.emailVerifiedAt) return jsonOk({ ok: true, verified: true });
    const { env } = await import("@/lib/env");
    if (env.emailMode !== "none") {
      throw badRequest("Open the verification link from your email");
    }
    await db.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date(), status: "ACTIVE" } });
    await audit({ actorId: user.id, actorRole: user.role, action: "AUTH_EMAIL_VERIFIED_DEV", targetType: "User", targetId: user.id, ip: meta.ip, reason: "EMAIL_MODE=none dev verification" });
    return jsonOk({ ok: true, verified: true, mode: "DEV" });
  },
  { rule: "apiWrite" }
);
