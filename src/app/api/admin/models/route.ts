import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { wrap, jsonOk } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";

// Moderation queue with report triage list.

export const GET = wrap(
  async () => {
    await requireAdmin();
    const [pending, reports] = await Promise.all([
      db.voiceModel.count({ where: { status: "PENDING_REVIEW" } }),
      db.abuseReport.findMany({
        where: { status: "OPEN" },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { model: { select: { id: true, name: true, status: true } }, reporter: { select: { email: true } } },
      }),
    ]);
    return jsonOk({ pendingCount: pending, reports });
  },
  { rule: "apiRead" }
);

export const POST = wrap(
  async (req: NextRequest) => {
    await requireAdmin();
    const body = (await req.json()) as { reportId?: string; action?: string; resolution?: string };
    if (!body.reportId || !body.action) return jsonOk({ error: { code: "BAD_REQUEST", message: "reportId and action required" } }, { status: 400 });
    const status = body.action === "dismiss" ? "DISMISSED" : body.action === "review" ? "REVIEWED" : "ACTIONED";
    await db.abuseReport.update({
      where: { id: body.reportId },
      data: { status, resolution: body.resolution ?? null, resolvedAt: new Date() },
    });
    return jsonOk({ ok: true });
  },
  { rule: "adminWrite" }
);
