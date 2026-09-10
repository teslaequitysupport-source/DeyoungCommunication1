import { wrap, jsonOk } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { randomToken, hashToken } from "@/lib/crypto";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { audit } from "@/lib/audit";
import { clientMeta } from "@/lib/auth";

// Reissue a verification token. With EMAIL_MODE=none the token is returned
// once (dev mode). With SMTP configured it would be emailed and never shown.

export const POST = wrap(
  async () => {
    const user = await requireUser();
    const meta = await clientMeta();
    if (user.emailVerifiedAt) return jsonOk({ ok: true, verified: true });
    const raw = randomToken(24);
    await db.verificationToken.create({
      data: {
        userId: user.id,
        purpose: "EMAIL_VERIFY",
        tokenHash: hashToken(raw),
        expiresAt: new Date(Date.now() + 48 * 3600 * 1000),
      },
    });
    await audit({ actorId: user.id, actorRole: user.role, action: "AUTH_RESEND_VERIFICATION", targetType: "User", targetId: user.id, ip: meta.ip });
    return jsonOk({
      ok: true,
      devVerificationToken: env.emailMode === "none" ? raw : undefined,
      emailSent: env.emailMode !== "none",
    });
  },
  { rule: "emailResend" }
);
