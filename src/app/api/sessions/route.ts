import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { wrap, jsonOk } from "@/lib/http";
import { requireUser, clientMeta } from "@/lib/auth";
import { sessionStartSchema } from "@/lib/validate";
import { requestSession } from "@/lib/scheduler";
import { getSiteConfig } from "@/lib/settings";

// Start a conversion session: goes through the real scheduler (worker scoring,
// queueing, budget and plan enforcement). Returns an assignment with a
// short-lived gateway token, or a queue position.

export const POST = wrap(
  async (req: NextRequest) => {
    const user = await requireUser();
    const config = await getSiteConfig();
    if (!config.studioEnabled && user.role === "USER") {
      return jsonOk({ error: { code: "STUDIO_DISABLED", message: "The studio is temporarily disabled by an administrator" } }, { status: 503 });
    }
    const body = sessionStartSchema.parse(await req.json());
    const meta = await clientMeta();
    const result = await requestSession({
      userId: user.id,
      modelId: body.modelId,
      requestedTier: body.requestedTier,
      clientInfo: { ua: meta.userAgent, ip: meta.ip },
    });
    if (result.status === "REJECTED") {
      return jsonOk({ error: { code: result.reason || "REJECTED", message: sessionRejectionMessage(result.reason || "REJECTED") } }, { status: 409 });
    }
    return jsonOk(result);
  },
  { rule: "sessionStart" }
);

function sessionRejectionMessage(code: string): string {
  switch (code) {
    case "NO_ACTIVE_PLAN": return "No active plan. Contact support or check your account status.";
    case "TIER_NOT_IN_PLAN": return "GPU-tier conversion is not included in your current plan.";
    case "CONCURRENT_LIMIT": return "You already have the maximum number of concurrent sessions for your plan.";
    case "RATE_LIMITED": return "Too many session starts. Wait a moment and retry.";
    default: return "Session request rejected.";
  }
}

export const GET = wrap(
  async () => {
    const user = await requireUser();
    const sessions = await db.conversionSession.findMany({
      where: { userId: user.id },
      orderBy: { queuedAt: "desc" },
      take: 30,
      include: { model: { select: { name: true, engine: true } }, assignments: { include: { worker: { select: { name: true, providerCode: true } } } } },
    });
    return jsonOk({
      sessions: sessions.map((s) => ({
        id: s.id,
        status: s.status,
        endReason: s.endReason,
        model: s.model.name,
        engine: s.model.engine,
        tier: s.resolvedTier,
        worker: s.assignments[0]?.worker.name ?? null,
        provider: s.assignments[0]?.worker.providerCode ?? null,
        queuedAt: s.queuedAt,
        startedAt: s.startedAt,
        endedAt: s.endedAt,
        durationSec: s.durationSec,
        audioSeconds: s.audioSeconds,
        metrics: s.metrics ? JSON.parse(s.metrics) : null,
      })),
    });
  },
  { rule: "apiRead" }
);
