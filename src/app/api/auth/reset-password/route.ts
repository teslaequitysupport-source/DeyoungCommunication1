import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { wrap, jsonOk } from "@/lib/http";
import { badRequest } from "@/lib/errors";
import { hashToken } from "@/lib/crypto";
import { hashPassword, passwordProblems, clientMeta } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { z } from "zod";

const schema = z.object({ token: z.string().min(10), newPassword: z.string().min(10).max(200) });

export const POST = wrap(
  async (req: NextRequest) => {
    const body = schema.parse(await req.json());
    const row = await db.verificationToken.findUnique({ where: { tokenHash: hashToken(body.token) } });
    if (!row || row.purpose !== "PASSWORD_RESET" || row.usedAt || row.expiresAt < new Date()) {
      throw badRequest("Invalid or expired reset token");
    }
    const problems = passwordProblems(body.newPassword);
    if (problems.length) throw badRequest("Password does not meet requirements", { problems });

    await db.$transaction([
      db.user.update({ where: { id: row.userId }, data: { passwordHash: await hashPassword(body.newPassword), failedLoginCount: 0, lockedUntil: null } }),
      db.verificationToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
      db.authSession.updateMany({ where: { userId: row.userId, revokedAt: null }, data: { revokedAt: new Date(), revokedReason: "PASSWORD_RESET" } }),
    ]);
    const meta = await clientMeta();
    await audit({ actorId: row.userId, actorRole: "USER", action: "AUTH_PASSWORD_RESET", targetType: "User", targetId: row.userId, ip: meta.ip });
    return jsonOk({ ok: true });
  },
  { rule: "authPasswordReset" }
);
