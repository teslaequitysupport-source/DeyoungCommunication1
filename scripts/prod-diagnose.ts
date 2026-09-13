// READ-ONLY production diagnosis: query the live Supabase request metrics to
// find exactly which routes returned 500s (the user sees "Internal server
// error" in the UI; this pinpoints the route without platform log access).
// Absolutely no writes, deletes or schema changes here.
import { PrismaClient } from "@prisma/client";
import { normalizeDatabaseUrl } from "./boot-lib";

const repaired = normalizeDatabaseUrl(process.env.DATABASE_URL ?? "").url;
process.env.DATABASE_URL = repaired;
const db = new PrismaClient({ log: ["error"] });

async function main() {
  const since = new Date(Date.now() - 48 * 3600 * 1000);

  // 1. 500s by route, last 48h
  const fiveHundred = await db.requestMetric.groupBy({
    by: ["route", "method", "status"],
    where: { status: { gte: 500 }, createdAt: { gte: since } },
    _count: { _all: true },
    _max: { createdAt: true },
    orderBy: { _count: { route: "desc" } },
  });
  console.log("=== 5xx by route (last 48h) ===");
  for (const r of fiveHundred) {
    console.log(
      `${r.status} ${r.method} ${r.route}  count=${(r._count as { _all: number })._all}  last=${r._max.createdAt?.toISOString()}`
    );
  }

  // 2. most recent 15 individual 5xx events with timing
  const recent = await db.requestMetric.findMany({
    where: { status: { gte: 500 }, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 15,
    select: { route: true, method: true, status: true, durationMs: true, createdAt: true },
  });
  console.log("\n=== most recent 5xx events ===");
  for (const r of recent) {
    console.log(`${r.createdAt.toISOString()} ${r.status} ${r.method} ${r.route} ${r.durationMs}ms`);
  }

  // 3. overall traffic health, last 24h (context: is EVERYTHING failing or one route?)
  const byStatus = await db.requestMetric.groupBy({
    by: ["status"],
    where: { createdAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) } },
    _count: { _all: true },
  });
  console.log("\n=== all requests by status (last 24h) ===");
  for (const r of byStatus) console.log(`${r.status}: ${(r._count as { _all: number })._all}`);

  // 4. admin accounts that exist
  const admins = await db.user.findMany({
    where: { role: "ADMIN" },
    select: { email: true, status: true, createdAt: true },
    take: 10,
  });
  console.log("\n=== ADMIN users ===");
  if (admins.length === 0) console.log("NONE - no admin account exists");
  for (const a of admins) console.log(`${a.email} status=${a.status} created=${a.createdAt.toISOString()}`);

  // 5. latest users (did the user manage to register?)
  const users = await db.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 8,
    select: { email: true, role: true, status: true, createdAt: true },
  });
  console.log("\n=== latest 8 users ===");
  for (const u of users) console.log(`${u.createdAt.toISOString()} ${u.email} role=${u.role} status=${u.status}`);

  // 6. security events, last 24h (CSRF rejections etc.)
  const secEvents = await db.securityEvent.groupBy({
    by: ["kind"],
    where: { createdAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) } },
    _count: { _all: true },
    _max: { createdAt: true },
  });
  console.log("\n=== security events by kind (last 24h) ===");
  for (const e of secEvents) console.log(`${e.kind}: ${(e._count as { _all: number })._all} last=${e._max.createdAt?.toISOString()}`);
}

main()
  .catch((e) => {
    console.error("DIAGNOSE FAILED:", String(e)?.slice(0, 500));
    process.exit(1);
  })
  .finally(() => db.$disconnect());
