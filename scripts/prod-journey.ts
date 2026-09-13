// READ-ONLY: full-history 5xx + per-route 4xx journey reconstruction.
import { PrismaClient } from "@prisma/client";
import { normalizeDatabaseUrl } from "./boot-lib";

const repaired = normalizeDatabaseUrl(process.env.DATABASE_URL ?? "").url;
process.env.DATABASE_URL = repaired;
const db = new PrismaClient({ log: ["error"] });

async function main() {
  // 1. ALL-TIME 5xx (no time bound)
  const all5xx = await db.requestMetric.groupBy({
    by: ["route", "method", "status"],
    where: { status: { gte: 500 } },
    _count: { _all: true },
    _max: { createdAt: true },
  });
  console.log("=== ALL-TIME 5xx by route ===");
  if (all5xx.length === 0) console.log("(none recorded)");
  for (const r of all5xx)
    console.log(`${r.status} ${r.method} ${r.route} count=${(r._count as { _all: number })._all} last=${r._max.createdAt?.toISOString()}`);

  // 2. last 24h per-route detail for 4xx (journey)
  const journey = await db.requestMetric.groupBy({
    by: ["route", "method", "status"],
    where: { status: { gte: 400, lt: 500 }, createdAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) } },
    _count: { _all: true },
    _max: { createdAt: true },
    orderBy: { _max: { createdAt: "desc" } },
  });
  console.log("\n=== last 24h 4xx by route ===");
  for (const r of journey)
    console.log(`${r.status} ${r.method} ${r.route} count=${(r._count as { _all: number })._all} last=${r._max.createdAt?.toISOString()}`);

  // 3. last 20 register/login attempts (any status) with timing
  const authFlow = await db.requestMetric.findMany({
    where: { route: { in: ["/api/auth/register", "/api/auth/login", "/api/auth/verify-email", "/api/auth/me"] } },
    orderBy: { createdAt: "desc" },
    take: 25,
    select: { route: true, method: true, status: true, durationMs: true, createdAt: true },
  });
  console.log("\n=== last 25 auth-flow requests ===");
  for (const r of authFlow)
    console.log(`${r.createdAt.toISOString()} ${r.status} ${r.method} ${r.route} ${r.durationMs}ms`);

  // 4. user count + probe leftovers
  const userCount = await db.user.count();
  console.log(`\nuser count: ${userCount}`);

  // 5. security events full detail, last 24h
  const events = await db.securityEvent.findMany({
    where: { createdAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) } },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { kind: true, severity: true, detail: true, createdAt: true },
  });
  console.log("\n=== last 20 security events ===");
  for (const e of events)
    console.log(`${e.createdAt.toISOString()} ${e.severity} ${e.kind} ${JSON.stringify(e.detail)?.slice(0, 160)}`);
}

main()
  .catch((e) => {
    console.error("DIAGNOSE FAILED:", String(e)?.slice(0, 500));
    process.exit(1);
  })
  .finally(() => db.$disconnect());
