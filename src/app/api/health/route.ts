import { db } from "@/lib/db";
import { wrap, jsonOk } from "@/lib/http";
import { recentRouteErrors } from "@/lib/error-ring";

// Liveness + database round-trip + honest failure counters. Used by the
// platform healthcheck (HTTP 200 always, body reports state truthfully),
// by monitoring, and by the operator: when something is failing, the
// counters here say WHERE without needing platform log access.

export const GET = wrap(
  async () => {
    const started = Date.now();
    let dbOk = false;
    let dbLatencyMs = -1;
    try {
      await db.$queryRaw`SELECT 1`;
      dbOk = true;
      dbLatencyMs = Date.now() - started;
    } catch {
      dbOk = false;
    }

    // Aggregate 500s over the last hour from request metrics. Best-effort:
    // if the DB is down this stays null and liveness is still reported.
    let errors500LastHour: number | null = null;
    let lastErrorRoute: string | null = null;
    try {
      const hourAgo = new Date(Date.now() - 3600 * 1000);
      errors500LastHour = await db.requestMetric.count({ where: { status: 500, createdAt: { gte: hourAgo } } });
      if (errors500LastHour > 0) {
        const last = await db.requestMetric.findFirst({
          where: { status: 500 },
          orderBy: { createdAt: "desc" },
          select: { route: true },
        });
        lastErrorRoute = last?.route ?? null;
      }
    } catch {
      errors500LastHour = null;
    }

    // In-process error ring (reset on restart). Published here - WITHOUT the
    // stack, which stays admin-only via the operator brief - so a user who
    // sees "Internal server error" can self-diagnose by opening /api/health:
    // it names the failing route and the exact error message.
    const ring = recentRouteErrors(3600 * 1000);
    const lastRing = ring.length > 0 ? ring[ring.length - 1] : null;

    return jsonOk({
      status: dbOk ? "ok" : "degraded",
      db: { ok: dbOk, latencyMs: dbLatencyMs },
      errors: {
        last500Count1h: errors500LastHour,
        last500Route: lastErrorRoute,
        lastRingError: lastRing
          ? { at: lastRing.at, route: lastRing.route, method: lastRing.method, message: lastRing.message }
          : null,
      },
      time: new Date().toISOString(),
    });
  },
  { rule: "apiRead", skipMetrics: true }
);
