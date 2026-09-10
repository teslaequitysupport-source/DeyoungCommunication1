import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { wrap, jsonOk } from "@/lib/http";
import { requireAdmin, clientMeta } from "@/lib/auth";
import { notFound } from "@/lib/errors";
import { audit } from "@/lib/audit";

export const GET = wrap(
  async () => {
    await requireAdmin();
    const alerts = await db.alert.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
    return jsonOk({ alerts });
  },
  { rule: "apiRead" }
);

export const POST = wrap(
  async (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => {
    const { id } = await ctx.params;
    const admin = await requireAdmin();
    const body = (await req.json()) as { action: "ack" | "resolve" };
    const alert = await db.alert.findUnique({ where: { id } });
    if (!alert) throw notFound("Alert not found");
    const now = new Date();
    await db.alert.update({
      where: { id },
      data: body.action === "ack" ? { status: "ACK", ackAt: now } : { status: "RESOLVED", resolvedAt: now },
    });
    const meta = await clientMeta();
    await audit({ actorId: admin.id, actorRole: "ADMIN", action: `ALERT_${body.action.toUpperCase()}`, targetType: "Alert", targetId: id, ip: meta.ip });
    return jsonOk({ ok: true });
  },
  { rule: "adminWrite" }
);
