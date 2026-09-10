import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { wrap, jsonOk } from "@/lib/http";
import { requireAdmin, clientMeta } from "@/lib/auth";
import { adminModelActionSchema } from "@/lib/validate";
import { notFound, badRequest } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import fs from "fs/promises";

// Moderation queue listing and actions. Every action writes a model event,
// an audit row, and (where relevant) notifies the owner. Takedown is real:
// the model leaves the catalog instantly and the file is retained only for
// the legal retention window.

export const GET = wrap(
  async (req: NextRequest) => {
    await requireAdmin();
    const status = new URL(req.url).searchParams.get("status") || "PENDING_REVIEW";
    const models = await db.voiceModel.findMany({
      where: status === "ALL" ? {} : { status },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { owner: { select: { email: true, id: true } }, reports: { where: { status: "OPEN" } }, events: { orderBy: { createdAt: "desc" }, take: 5 } },
    });
    return jsonOk({
      models: models.map((m) => ({
        id: m.id, name: m.name, kind: m.kind, engine: m.engine, status: m.status,
        description: m.description, licenseName: m.licenseName, licenseUrl: m.licenseUrl,
        licenseVerified: m.licenseVerified, rightsAttested: m.rightsAttested,
        fileName: m.fileName, fileSize: m.fileSize, fileSha256: m.fileSha256,
        owner: m.owner, openReports: m.reports.length,
        rejectionReason: m.rejectionReason, takedownReason: m.takedownReason,
        createdAt: m.createdAt, reviewedAt: m.reviewedAt,
        recentEvents: m.events,
      })),
    });
  },
  { rule: "apiRead" }
);

export const POST = wrap(
  async (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => {
    const { id } = await ctx.params;
    const admin = await requireAdmin();
    const body = adminModelActionSchema.parse(await req.json());
    const model = await db.voiceModel.findUnique({ where: { id }, include: { owner: true } });
    if (!model) throw notFound("Model not found");
    const meta = await clientMeta();

    const now = new Date();
    switch (body.action) {
      case "approve":
        if (!model.licenseName || model.licenseName === "UNVERIFIED") {
          throw badRequest("License metadata is required before approval (license fields are mandatory, UNVERIFIED blocks publication)");
        }
        await db.voiceModel.update({ where: { id }, data: { status: "APPROVED", reviewedById: admin.id, reviewedAt: now, rejectionReason: null, takedownReason: null } });
        await db.voiceModelEvent.create({ data: { modelId: id, kind: "APPROVED", actorId: admin.id, detail: body.reason } });
        if (model.ownerId) await notify({ userId: model.ownerId, kind: "SYSTEM", title: `Voice model approved: ${model.name}`, body: "It is now live in the catalog." });
        break;
      case "reject":
      case "takedown":
        await db.voiceModel.update({
          where: { id },
          data: body.action === "reject"
            ? { status: "REJECTED", reviewedById: admin.id, reviewedAt: now, rejectionReason: body.reason ?? "Rejected by moderation" }
            : { status: "TAKEN_DOWN", takenDownAt: now, takedownReason: body.reason ?? "Policy takedown" },
        });
        await db.voiceModelEvent.create({ data: { modelId: id, kind: body.action === "reject" ? "REJECTED" : "TAKEN_DOWN", actorId: admin.id, detail: body.reason } });
        if (model.ownerId) {
          await notify({
            userId: model.ownerId,
            kind: "SYSTEM",
            title: `Voice model ${body.action === "reject" ? "rejected" : "taken down"}: ${model.name}`,
            body: body.reason ?? "Contact support for details.",
          });
        }
        // Abuse reports tied to this model are actioned.
        if (body.action === "takedown") {
          await db.abuseReport.updateMany({ where: { modelId: id, status: "OPEN" }, data: { status: "ACTIONED", resolvedById: admin.id, resolvedAt: now, resolution: body.reason ?? "Model taken down" } });
        }
        break;
      case "disable":
        await db.voiceModel.update({ where: { id }, data: { status: "DISABLED" } });
        await db.voiceModelEvent.create({ data: { modelId: id, kind: "DISABLED", actorId: admin.id, detail: body.reason } });
        break;
      case "enable":
        await db.voiceModel.update({ where: { id }, data: { status: "APPROVED" } });
        await db.voiceModelEvent.create({ data: { modelId: id, kind: "ENABLED", actorId: admin.id } });
        break;
    }

    // Physical deletion only for rejects (takedowns keep the file for the
    // legal window; see docs/26-COMPLIANCE.md).
    if (body.action === "reject" && model.filePath) {
      await fs.unlink(model.filePath).catch(() => {});
    }

    await audit({ actorId: admin.id, actorRole: "ADMIN", action: `MODEL_${body.action.toUpperCase()}`, targetType: "VoiceModel", targetId: id, before: { status: model.status }, after: { reason: body.reason ?? null }, reason: body.reason ?? null, ip: meta.ip });
    return jsonOk({ ok: true });
  },
  { rule: "adminWrite" }
);
