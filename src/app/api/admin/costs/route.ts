import { db } from "@/lib/db";
import { wrap, jsonOk } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";

// Infrastructure cost reporting: real CostRecord rows only (free providers
// contribute zero by definition and say so).

export const GET = wrap(
  async () => {
    await requireAdmin();
    const month = new Date().toISOString().slice(0, 7);
    const [byDay, byProvider, records] = await Promise.all([
      db.costRecord.groupBy({ by: ["day"], where: { month }, _sum: { costCents: true }, orderBy: { day: "asc" } }),
      db.costRecord.groupBy({ by: ["providerCode"], where: { month }, _sum: { costCents: true, gpuMilliHours: true } }),
      db.costRecord.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    ]);
    return jsonOk({
      month,
      byDay: byDay.map((d) => ({ day: d.day, costCents: d._sum.costCents ?? 0 })),
      byProvider: byProvider.map((p) => ({ provider: p.providerCode, costCents: p._sum.costCents ?? 0, gpuMilliHours: p._sum.gpuMilliHours ?? 0 })),
      records,
    });
  },
  { rule: "apiRead" }
);
