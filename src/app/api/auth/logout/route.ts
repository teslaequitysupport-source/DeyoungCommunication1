import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { wrap, jsonOk } from "@/lib/http";
import { env } from "@/lib/env";
import { currentUser, clientMeta } from "@/lib/auth";
import { audit } from "@/lib/audit";

export const POST = wrap(
  async () => {
    const store = await cookies();
    const token = store.get(env.sessionCookieName)?.value;
    if (token) {
      const { hashToken } = await import("@/lib/crypto");
      const session = await db.authSession.findUnique({ where: { tokenHash: hashToken(token) } });
      if (session) {
        await db.authSession.update({ where: { id: session.id }, data: { revokedAt: new Date(), revokedReason: "LOGOUT" } });
        const user = await currentUser();
        const meta = await clientMeta();
        if (user) await audit({ actorId: user.id, actorRole: user.role, action: "AUTH_LOGOUT", targetType: "User", targetId: user.id, ip: meta.ip });
      }
    }
    const res = jsonOk({ ok: true });
    res.cookies.set({ name: env.sessionCookieName, value: "", expires: new Date(0), path: "/" });
    return res;
  },
  { rule: "apiWrite", skipOriginCheck: true }
);
