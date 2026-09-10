import { db } from "@/lib/db";
import { wrap, jsonOk } from "@/lib/http";

// Liveness + database round-trip. Used by monitoring and the admin overview.

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
    return jsonOk({
      status: dbOk ? "ok" : "degraded",
      db: { ok: dbOk, latencyMs: dbLatencyMs },
      time: new Date().toISOString(),
    });
  },
  { rule: "apiRead", skipMetrics: true }
);
