import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { wrap, jsonOk } from "@/lib/http";
import { heartbeatSchema } from "@/lib/validate";
import { authenticateWorker } from "@/lib/worker-auth";

// Worker heartbeat: the backend's authoritative view of fleet health. Stale
// heartbeats mark a worker UNHEALTHY (maintenance loop) which stops new
// assignments and triggers failover for its sessions.

export const POST = wrap(
  async (req: NextRequest) => {
    const identity = await authenticateWorker(req);
    const body = heartbeatSchema.parse(await req.json());

    await db.worker.update({
      where: { id: identity.id },
      data: {
        status: body.status,
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
