import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { wrap, jsonOk } from "@/lib/http";
import { authenticateWorker } from "@/lib/worker-auth";
import { notFound } from "@/lib/errors";

// Worker confirms the audio gateway connection is live and the session moved
// to ACTIVE. The gateway (mini service) is the transport; this endpoint flips
// control-plane state and stamps the assignment.

export const POST = wrap(
  async (req: NextRequest) => {
    const identity = await authenticateWorker(req);
    const body = (await req.json().catch(() => ({}))) as { sessionId?: string; accepted?: boolean; error?: string };
    if (!body.sessionId) throw notFound("sessionId required");

    const session = await db.conversionSession.findUnique({ where: { id: body.sessionId } });
    if (!session) throw notFound("Session not found");
    const assignment = await db.workerSessionAssignment.findFirst({
      where: { sessionId: session.id, workerId: identity.id, state: { in: ["ASSIGNED", "CONNECTING"] } },
    });
    if (!assignment) throw notFound("No pending assignment for this worker");

    if (body.accepted === false) {
      await db.workerSessionAssignment.update({ where: { id: assignment.id }, data: { state: "FAILED", endedAt: new Date(), endReason: body.error?.slice(0, 200) || "WORKER_REJECTED" } });
      await db.worker.update({ where: { id: identity.id }, data: { activeSessions: { decrement: 1 } } });
      return jsonOk({ ok: true, rejected: true });
    }

    const now = new Date();
    await db.$transaction([
      db.workerSessionAssignment.update({ where: { id: assignment.id }, data: { state: "ACTIVE", startedAt: now } }),
      db.conversionSession.update({ where: { id: session.id }, data: { status: "ACTIVE", startedAt: now, resolvedTier: identity.tiers.includes("RVC_GPU") && session.requestedTier === "RVC_GPU" ? "RVC_GPU" : "DSP_CPU" } }),
    ]);
    return jsonOk({ ok: true });
  },
  { rule: "workerHeartbeat", skipMetrics: true }
);
