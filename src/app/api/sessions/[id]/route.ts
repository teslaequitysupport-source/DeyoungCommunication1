import { wrap, jsonOk } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound, forbidden } from "@/lib/errors";

export const GET = wrap(
  async (_req, ctx: { params: Promise<Record<string, string>> }) => {
    const { id } = await ctx.params;
    const user = await requireUser();
    const session = await db.conversionSession.findUnique({
      where: { id },
      include: {
        model: { select: { name: true, engine: true, kind: true } },
        assignments: { include: { worker: { select: { id: true, name: true, providerCode: true, gpuName: true } } } },
      },
    });
    if (!session) throw notFound();
    if (session.userId !== user.id && user.role === "USER") throw forbidden();
    return jsonOk({
      session: {
        id: session.id,
        status: session.status,
        endReason: session.endReason,
        requestedTier: session.requestedTier,
        resolvedTier: session.resolvedTier,
        model: session.model,
        worker: session.assignments[0]?.worker ?? null,
        queuedAt: session.queuedAt,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        durationSec: session.durationSec,
        audioSeconds: session.audioSeconds,
        metrics: session.metrics ? JSON.parse(session.metrics) : null,
      },
    });
  },
  { rule: "apiRead" }
);
