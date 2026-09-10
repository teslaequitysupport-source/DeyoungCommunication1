import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { wrap, jsonOk } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { notFound, forbidden, badRequest } from "@/lib/errors";
import { reportSchema } from "@/lib/validate";
import { audit } from "@/lib/audit";
import { clientMeta } from "@/lib/auth";

// Public abuse report on any catalog model. Feeds the moderation queue and is
// a required part of the takedown flow (Voice Rights Policy).

export const POST = wrap(
  async (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => {
    const { id } = await ctx.params;
    const user = await requireUser();
    const model = await db.voiceModel.findUnique({ where: { id } });
    if (!model || !["APPROVED", "PENDING_REVIEW"].includes(model.status)) throw notFound("Model not found");
    const body = reportSchema.parse(await req.json());
    if (model.ownerId === user.id) throw badRequest("You cannot report your own model; remove it instead");

    const report = await db.abuseReport.create({
      data: { modelId: id, reporterId: user.id, reason: body.reason, detail: body.detail ?? null },
    });
    await db.voiceModelEvent.create({
      data: { modelId: id, kind: "REPORTED", actorId: user.id, detail: `${body.reason}: ${(body.detail || "").slice(0, 200)}` },
    });
    const meta = await clientMeta();
    await audit({ actorId: user.id, actorRole: user.role, action: "MODEL_REPORTED", targetType: "VoiceModel", targetId: id, after: { reportId: report.id, reason: body.reason }, ip: meta.ip });
    return jsonOk({ ok: true, reportId: report.id, message: "Report received. Moderators will review it." });
  },
  { rule: "modelReport" }
);
