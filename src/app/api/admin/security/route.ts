import { db } from "@/lib/db";
import { wrap, jsonOk } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";

// Security events feed.

export const GET = wrap(
  async (req) => {
    await requireAdmin();
    const severity = new URL(req.url).searchParams.get("severity") || undefined;
    const [events, rateLimited] = await Promise.all([
      db.securityEvent.findMany({
        where: severity ? { severity } : {},
        orderBy: { createdAt: "desc" },
        take: 150,
      }),
      db.securityEvent.count({ where: { kind: "RATE_LIMITED", createdAt: { gte: new Date(Date.now() - 3600_000) } } }),
    ]);
    return jsonOk({ events, rateLimitedLastHour: rateLimited });
  },
  { rule: "apiRead" }
);
