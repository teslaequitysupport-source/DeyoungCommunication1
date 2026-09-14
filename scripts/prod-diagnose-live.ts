// READ-ONLY production diagnosis (no writes, no deletes, no schema changes).
// Queries the live Supabase Postgres to answer, with ground truth:
//   1. Does ClientErrorReport exist (proves commit 84bb9bd deployed + db push ran)?
//   2. What UI faults did browsers report (message, route, build)?
//   3. Are requests reaching the server at all (RequestMetric recency)?
//   4. Any server-side 5xx in the last 24h?
//   5. Site context: users, site settings, security events.
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient({ log: ["error"] });

async function safe<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    const msg = String(err instanceof Error ? err.message : err).slice(0, 300);
    console.log(`[${label}] UNAVAILABLE: ${msg}`);
    return null;
  }
}

async function main() {
  const now = Date.now();
  const dayAgo = new Date(now - 24 * 3600 * 1000);

  console.log("=== 1. ClientErrorReport (browser self-reported UI faults) ===");
  const tableExists = await safe("client-table", () =>
    db.clientErrorReport.count()
  );
  if (tableExists !== null) {
    console.log(`table EXISTS, total rows: ${tableExists}`);
    const faults = await safe("client-rows", () =>
      db.clientErrorReport.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { createdAt: true, digest: true, message: true, route: true, page: true, buildSha: true },
      })
    );
    if (faults && faults.length === 0) console.log("no fault rows yet (no fault since 84bb9bd deployed, or deploy not live)");
    for (const f of faults ?? []) {
      console.log(
        `${f.createdAt.toISOString()} route=${f.route ?? "-"} page=${f.page ?? "-"} build=${(f.buildSha ?? "-").slice(0, 8)} digest=${f.digest ?? "-"}\n   msg: ${f.message.slice(0, 220)}`
      );
    }
  }

  console.log("\n=== 2. RequestMetric recency (is traffic reaching the server?) ===");
  const lastRequests = await safe("recent-metrics", () =>
    db.requestMetric.findMany({
      orderBy: { createdAt: "desc" },
      take: 15,
      select: { createdAt: true, route: true, method: true, status: true },
    })
  );
  if (lastRequests) {
    if (lastRequests.length === 0) console.log("NO REQUEST METRICS AT ALL - server never logged traffic");
    for (const r of lastRequests) {
      const ageMin = Math.round((now - r.createdAt.getTime()) / 60000);
      console.log(`${r.createdAt.toISOString()} (${ageMin}m ago) ${r.status} ${r.method} ${r.route}`);
    }
  }

  console.log("\n=== 3. 5xx by route, last 24h ===");
  const fivexx = await safe("5xx", () =>
    db.requestMetric.groupBy({
      by: ["route", "method", "status"],
      where: { status: { gte: 500 }, createdAt: { gte: dayAgo } },
      _count: { _all: true },
    })
  );
  if (fivexx && fivexx.length === 0) console.log("zero 5xx in the last 24h");
  for (const r of fivexx ?? []) {
    console.log(`${r.status} ${r.method} ${r.route} count=${(r._count as { _all: number })._all}`);
  }

  console.log("\n=== 4. All traffic by status, last 24h ===");
  const byStatus = await safe("by-status", () =>
    db.requestMetric.groupBy({
      by: ["status"],
      where: { createdAt: { gte: dayAgo } },
      _count: { _all: true },
    })
  );
  if (byStatus && byStatus.length === 0) console.log("no traffic in the last 24h");
  for (const r of byStatus ?? []) console.log(`status ${r.status}: ${(r._count as { _all: number })._all}`);

  console.log("\n=== 5. Security events, last 24h ===");
  const sec = await safe("security", () =>
    db.securityEvent.groupBy({
      by: ["kind"],
      where: { createdAt: { gte: dayAgo } },
      _count: { _all: true },
    })
  );
  if (sec && sec.length === 0) console.log("none");
  for (const r of sec ?? []) console.log(`${r.kind}: ${(r._count as { _all: number })._all}`);

  console.log("\n=== 6. Site context ===");
  const users = await safe("users", () => db.user.count());
  console.log(`users: ${users ?? "unavailable"}`);
  const settings = await safe("settings", () =>
    db.siteSetting.findMany({ select: { key: true, updatedAt: true } })
  );
  if (settings) {
    for (const s of settings) console.log(`setting: ${s.key} updated=${s.updatedAt.toISOString()}`);
  }

  console.log("\n=== 7. Audit trail, last 15 entries (who did what to users?) ===");
  const audit = await safe("audit", () =>
    db.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 15,
      select: { createdAt: true, action: true, targetType: true, targetId: true, actorId: true },
    })
  );
  if (audit && audit.length === 0) console.log("audit log empty");
  for (const a of audit ?? []) {
    console.log(`${a.createdAt.toISOString()} action=${a.action} target=${a.targetType ?? "-"}/${a.targetId ?? "-"} actor=${a.actorId ?? "system"}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("diagnosis failed:", String(err).slice(0, 500));
    process.exit(1);
  });
