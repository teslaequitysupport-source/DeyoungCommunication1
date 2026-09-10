import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { wrap, jsonOk } from "@/lib/http";
import { requireUser, verifyPassword, hashPassword, passwordProblems, clientMeta } from "@/lib/auth";
import { z } from "zod";
import { badRequest } from "@/lib/errors";
import { audit } from "@/lib/audit";

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(10).max(200),
});

export const POST = wrap(
  async (req: NextRequest) => {
    const user = await requireUser();
    const body = schema.parse(await req.json());
    const problems = passwordProblems(body.newPassword);
    if (problems.length) throw badRequest("Password does not meet requirements", { problems });

    const row = await db.user.findUnique({ where: { id: user.id } });
    if (!row) throw badRequest("Account not found");
    const ok = await verifyPassword(body.currentPassword, row.passwordHash);
    if (!ok) throw badRequest("Current password is incorrect");

    await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(body.newPassword) } });
    // Revoke every other session for safety.
    await db.authSession.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: "PASSWORD_CHANGED" },
    });
    const meta = await clientMeta();
    await audit({ actorId: user.id, actorRole: user.role, action: "AUTH_PASSWORD_CHANGED", targetType: "User", targetId: user.id, ip: meta.ip });
    return jsonOk({ ok: true, note: "All sessions were revoked. Sign in again." });
  },
  { rule: "apiWrite" }
);
