import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { wrap, jsonOk } from "@/lib/http";
import { requireUser, clientMeta } from "@/lib/auth";
import { notFound, forbidden } from "@/lib/errors";
import { audit } from "@/lib/audit";
import fs from "fs/promises";

// Owner-initiated removal of an own model. If it was published it is taken
// down immediately (real takedown path for owners); if pending it is deleted.

export const DELETE = wrap(
  async (_req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => {
    const { id } = await ctx.params;
    const user = await requireUser();
    const model = await db.voiceModel.findUnique({ where: { id } });
    if (!model) throw notFound();
    if (model.ownerId !== user.id && user.role === "USER") throw forbidden();

    if (model.filePath) await fs.unlink(model.filePath).catch(() => {});

    if (model.kind === "RVC_UPLOAD" && model.ownerId === user.id) {
      await db.voiceModel.update({
        where: { id },
        data: model.status === "APPROVED"
          ? { status: "TAKEN_DOWN", takenDownAt: new Date(), takedownReason: "Removed by owner" }
          : { status: "REJECTED", rejectionReason: "Withdrawn by owner" },
      });
      await db.voiceModelEvent.create({ data: { modelId: id, kind: "TAKEN_DOWN", actorId: user.id, detail: "Owner removal" } });
    }
    const meta = await clientMeta();
    await audit({ actorId: user.id, actorRole: user.role, action: "MODEL_REMOVED_BY_OWNER", targetType: "VoiceModel", targetId: id, ip: meta.ip });
    return jsonOk({ ok: true });
  },
  { rule: "apiWrite" }
);
