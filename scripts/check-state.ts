import { db } from "../src/lib/db";
async function main() {
  const workers = await db.worker.findMany({ select: { name: true, status: true, tiers: true, activeSessions: true, lastHeartbeatAt: true } });
  console.log("WORKERS:", JSON.stringify(workers.map(w => `${w.name}:${w.status}`)));
  const sessions = await db.conversionSession.findMany({ where: { status: { in: ["QUEUED", "ASSIGNING", "CONNECTING", "ACTIVE"] } }, select: { id: true, status: true, kind: true, startedAt: true } });
  for (const s of sessions) console.log("LIVE:", s.id, s.kind, s.status, "since", s.startedAt?.toISOString());
  await db.$disconnect();
}
main();
