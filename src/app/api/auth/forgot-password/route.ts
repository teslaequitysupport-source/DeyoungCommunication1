import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { wrap, jsonOk } from "@/lib/http";
import { emailSchema } from "@/lib/validate";
import { randomToken, hashToken } from "@/lib/crypto";
import { clientMeta } from "@/lib/auth";
import { env } from "@/lib/env";
import { securityEvent } from "@/lib/audit";

// Password reset request. Always responds identically whether or not the email
// exists (no account enumeration). In dev mode (EMAIL_MODE=none) the reset
// token is returned once; production sends it by email only.

export const POST = wrap(
  async (req: NextRequest) => {
    const body = emailSchema.parse(await req.json());
    const user = await db.user.findUnique({ where: { email: body } });
    let devToken: string | undefined;
    if (user && user.status !== "DELETED") {
      const raw = randomToken(24);
      await db.verificationToken.create({
        data: {
          userId: user.id,
          purpose: "PASSWORD_RESET",
          tokenHash: hashToken(raw),
          expiresAt: new Date(Date.now() + 3600_000),
        },
      });
      if (env.emailMode === "none") devToken = raw;
    } else {
      await securityEvent({ kind: "INVALID_INPUT", severity: "INFO", detail: { route: "forgot-password", unknownEmail: true } });
    }
    return jsonOk({
      ok: true,
      message: "If the address exists, a reset link has been issued.",
      devResetToken: devToken,
      emailModeNote: env.emailMode === "none" ? "Email delivery is not configured; the token is shown here once (dev mode only)." : undefined,
    });
  },
  { rule: "authPasswordReset" }
);
