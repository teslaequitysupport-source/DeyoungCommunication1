import { db } from "@/lib/db";
import { wrap, jsonOk } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";

// Command centre overview: one call powering the main dashboard. Every number
// is computed from live tables; nothing is cached or simulated.

export const GET = wrap(
  async () => {
    await requireAdmin();
    const now = new Date();
    const day = now.toISOString().slice(0, 10);
    const month = now.toISOString().slice(0, 7);

    const [
      workersAlive, workersUnhealthy, workersByProvider,
      sessionsActive, sessionsQueued, sessionsToday,
      pendingModels, openReports,
      usersTotal, usersSuspended,
      openAlerts, openTickets,
      costsToday, costsMonth,
    ] = await Promise.all([
      db.worker.count({ where: { status: { in: ["BOOTING", "LOADING_MODEL", "WARMING", "READY", "ACTIVE", "IDLE", "DRAINING"] } } }),
      db.worker.count({ where: { status: { in: ["UNHEALTHY", "FAILED"] } } }),
      db.worker.groupBy({ by: ["providerCode"], _count: true, where: { status: { notIn: ["STOPPED"] } } }),
      db.conversionSession.count({ where: { status: { in: ["CONNECTING", "ACTIVE"] } } }),
      db.queueEntry.count({ where: { status: "WAITING" } }),
      db.conversionSession.count({ where: { queuedAt: { gte: new Date(now.getTime() - 86400_000) } } }),
      db.voiceModel.count({ where: { status: "PENDING_REVIEW" } }),
      db.abuseReport.count({ where: { status: "OPEN" } }),
      db.user.count({ where: { status: { not: "DELETED" } } }),
      db.user.count({ where: { status: "SUSPENDED" } }),
      db.alert.count({ where: { status: "OPEN" } }),
      db.supportTicket.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } }),
      db.costRecord.aggregate({ where: { day }, _sum: { costCents: true } }),
      db.costRecord.aggregate({ where: { month }, _sum: { costCents: true } }),
    ]);

    // API health: p95 over the last 15 minutes from RequestMetric.
    const recent = await db.requestMetric.findMany({
      where: { createdAt: { gte: new Date(now.getTime() - 15 * 60_000) } },
      select: { durationMs: true, status: true },
    });
    const durations = recent.map((r) => r.durationMs).sort((a, b) => a - b);
    const p95 = durations.length ? durations[Math.floor(durations.length * 0.95)] : null;
    const errRate = recent.length ? recent.filter((r) => r.status >= 500).length / recent.length : 0;

    return jsonOk({
      fleet: { alive: workersAlive, unhealthy: workersUnhealthy, byProvider: workersByProvider.map((w) => ({ provider: w.providerCode, count: w._count })) },
      sessions: { active: sessionsActive, queued: sessionsQueued, last24h: sessionsToday },
      moderation: { pendingModels, openReports },
      users: { total: usersTotal, suspended: usersSuspended },
      ops: { openAlerts, openTickets, apiP95Ms: p95, apiErrorRate: Math.round(errRate * 1000) / 1000, samples: recent.length },
      costs: { todayCents: costsToday._sum.costCents ?? 0, monthCents: costsMonth._sum.costCents ?? 0 },
    });
  },
  { rule: "apiRead" }
);
