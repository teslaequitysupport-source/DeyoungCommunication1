import { db } from "../src/lib/db";
async function main() {
  const userId = "cmtvigeb70065sj80z1tsdav6";
  const rows = await db.conversionSession.groupBy({
    by: ["status"],
    where: { userId, isTest: false },
    _count: { _all: true },
  });
  console.log("BY STATUS:", JSON.stringify(rows));
  const recent = await db.conversionSession.findMany({
    where: { userId, isTest: false },
    orderBy: { startedAt: "desc" },
    take: 5,
    select: { id: true, status: true, startedAt: true, endedAt: true },
  });
  for (const r of recent) console.log("RECENT:", r.id, r.status, r.startedAt?.toISOString(), "ended:", r.endedAt?.toISOString() ?? "null");
  const plan = await db.subscription.findUnique({ where: { userId }, select: { plan: { select: { code: true, maxConcurrentSessions: true } } } });
  console.log("PLAN:", JSON.stringify(plan));
  await db.$disconnect();
}
main();
