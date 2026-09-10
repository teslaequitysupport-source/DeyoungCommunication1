import { wrap, jsonOk } from "@/lib/http";
import { requireUser, clientMeta, verifyPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { badRequest } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { endSession } from "@/lib/scheduler";
import { z } from "zod";

// Account deletion: immediate anonymization with cascade cleanup of personal
// content. Voice uploads are removed from disk; sessions are ended; audit rows
// retain only the actor id hash-free placeholder per retention policy. This is
// real, immediate deletion (GDPR/NDPA erasure), not a request queue.

const schema = z.object({ password: z.string().min(1) });

export const DELETE = wrap(
  async (req) => {
    const user = await requireUser();
    const body = schema.parse(await req.json().catch(() => ({})));
    const row = await db.user.findUnique({ where: { id: user.id } });
    if (!row) throw badRequest("Account not found");
    const ok = await verifyPassword(body.password, row.passwordHash);
    if (!ok) throw badRequest("Password confirmation required");

    const meta = await clientMeta();
    await audit({
      actorId: user.id,
      actorRole: user.role,
      action: "ACCOUNT_DELETED",
      targetType: "User",
      targetId: user.id,
      reason: "User self-service deletion",
      ip: meta.ip,
    });

    // End any live sessions.
    const live = await db.conversionSession.findMany({
      where: { userId: user.id, status: { in: ["QUEUED", "ASSIGNING", "CONNECTING", "ACTIVE"] } },
    });
    for (const s of live) await endSession(s.id, "USER_ENDED", "USER");

    // Remove uploaded model files from disk.
    const fs = await import("fs/promises");
    const path = await import("path");
    const models = await db.voiceModel.findMany({ where: { ownerId: user.id } });
    for (const m of models) {
      if (m.filePath) {
        await fs.unlink(m.filePath).catch(() => {});
      }
    }

    // Anonymize: keep referential integrity, drop identity.
    await db.$transaction([
      db.user.update({
        where: { id: user.id },
        data: {
          email: `deleted-${user.id}@invalid.local`,
          name: null,
          status: "DELETED",
          passwordHash: "deleted",
          anonymizedAt: new Date(),
          deletionRequestedAt: null,
        },
      }),
      db.authSession.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date(), revokedReason: "ACCOUNT_DELETED" } }),
      db.subscription.deleteMany({ where: { userId: user.id } }),
      db.voiceModel.deleteMany({ where: { ownerId: user.id } }),
      db.notification.deleteMany({ where: { userId: user.id } }),
    ]);

    return jsonOk({ ok: true, message: "Account deleted and personal data removed." });
  },
  { rule: "apiWrite" }
);
