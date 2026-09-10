import { NextRequest } from "next/server";
import { wrap, jsonOk } from "@/lib/http";
import { requireUser, clientMeta } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound, forbidden } from "@/lib/errors";
import { audit } from "@/lib/audit";

// Revoke one of your own sessions (sign out a device).

export const DELETE = wrap(
  async (_req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => {
    const { id } = await ctx.params;
    const user = await requireUser();
    const session = await db.authSession.findUnique({ where: { id } });
    if (!session || session.userId !== user.id) {
      if (session) {
        // Session exists but belongs to someone else: permission probe.
        throw forbidden();
      }
      throw notFound("Session not found");
    }
    await db.authSession.update({ where: { id }, data: { revokedAt: new Date(), revokedReason: "USER_REVOKED" } });
    const meta = await clientMeta();
    await audit({ actorId: user.id, actorRole: user.role, action: "AUTH_SESSION_REVOKED", targetType: "AuthSession", targetId: id, ip: meta.ip });
    return jsonOk({ ok: true });
  },
  { rule: "apiWrite" }
);
