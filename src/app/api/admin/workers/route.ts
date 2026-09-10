import { db } from "@/lib/db";
import { wrap, jsonOk } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";

// Fleet listing with heartbeat freshness computed server-side.

export const GET = wrap(
  async () => {
    await requireAdmin();
    const workers = await db.worker.findMany({
      orderBy: { registeredAt: "desc" },
      take: 200,
      include: { _count: { select: { commands: { where: { status: "PENDING" } } } } },
    });
    return jsonOk({
      workers: workers.map((w) => ({
        id: w.id,
        name: w.name,
        providerCode: w.providerCode,
        costKind: w.costKind,
        region: w.region,
        gpuName: w.gpuName,
        vramMb: w.vramMb,
        status: w.status,
        tiers: JSON.parse(w.tiers || "[]"),
        maxSessions: w.maxSessions,
        activeSessions: w.activeSessions,
        totalSessions: w.totalSessions,
        lastHeartbeatAt: w.lastHeartbeatAt,
        registeredAt: w.registeredAt,
        lastError: w.lastError,
        pendingCommands: w._count.commands,
        agentVersion: w.agentVersion,
        pythonVersion: w.pythonVersion,
        cudaVersion: w.cudaVersion,
        os: w.os,
      })),
    });
  },
  { rule: "apiRead" }
);
