import { cookies } from "next/headers";
import { wrap, jsonOk } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { hashToken } from "@/lib/crypto";
import { env } from "@/lib/env";

// Device/session management for the signed-in user.

export const GET = wrap(
  async () => {
    const user = await requireUser();
    const sessions = await db.authSession.findMany({
      where: { userId: user.id },
      orderBy: { lastSeenAt: "desc" },
      take: 50,
    });
    const store = await cookies();
    const currentCookie = store.get(env.sessionCookieName)?.value;
    const currentHash = currentCookie ? hashToken(currentCookie) : null;
    return jsonOk({
      sessions: sessions.map((s) => ({
        id: s.id,
        device: s.deviceLabel,
        ip: s.ip,
        createdAt: s.createdAt,
        lastSeenAt: s.lastSeenAt,
        expiresAt: s.expiresAt,
        revoked: !!s.revokedAt,
        current: currentHash ? s.tokenHash === currentHash : false,
      })),
    });
  },
  { rule: "apiRead" }
);
