import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { wrap, jsonOk } from "@/lib/http";
import { heartbeatSchema } from "@/lib/validate";
import { authenticateWorker } from "@/lib/worker-auth";

// Worker heartbeat: the backend's authoritative view of fleet health. Stale
// heartbeats mark a worker UNHEALTHY (maintenance loop) which stops new
// assignments and triggers failover for its sessions.

// Control-plane-owned states. An agent heartbeat must not override these:
// DRAINING/STOPPING/QUARANTINED are admin or scheduler intent, and UNHEALTHY
// is a detection verdict that only a real recovery path may clear.
const CONTROL_OWNED = ["DRAINING", "STOPPING", "QUARANTINED", "UNHEALTHY", "STOPPED", "FAILED"];

export const POST = wrap(
  async (req: NextRequest) => {
    const identity = await authenticateWorker(req);
    const body = heartbeatSchema.parse(await req.json());
    const current = await db.worker.findUnique({ where: { id: identity.id }, select: { status: true } });

    await db.worker.update({
      where: { id: identity.id },
      data: {
        // Preserve control-plane intent while still refreshing liveness.
        status: current && CONTROL_OWNED.includes(current.status) ? current.status : body.status,
        lastHeartbeatAt: new Date(),
        activeSessions: body.activeSessions,
        loadedModels: JSON.stringify(body.loadedModels),
        lastError: body.status === "FAILED" ? "Reported FAILED by agent" : null,
      },
    });

    await db.workerHeartbeat.create({
      data: {
        workerId: identity.id,
        status: body.status,
        gpuUtilPct: body.gpuUtilPct ?? null,
        vramUsedMb: body.vramUsedMb ?? null,
        ramUsedMb: body.ramUsedMb ?? null,
        cpuUtilPct: body.cpuUtilPct ?? null,
        activeSessions: body.activeSessions,
        inferP50Ms: body.inferP50Ms ?? null,
        inferP95Ms: body.inferP95Ms ?? null,
        errorCount: body.errorCount,
        uptimeSec: body.uptimeSec ?? null,
      },
    });

    return jsonOk({ ok: true, serverTime: new Date().toISOString() });
  },
  { rule: "workerHeartbeat", skipMetrics: true }
);
