import { db } from "../src/lib/db";
async function main() {
  const w = await db.worker.findUnique({ where: { id: "cmtvx1e6q000vkruoucx9tnea" }, select: { name: true, status: true, lastHeartbeatAt: true, activeSessions: true } });
  console.log("WORKER:", JSON.stringify(w));
  const cmds = await db.workerCommand.findMany({ where: { workerId: "cmtvx1e6q000vkruoucx9tnea" }, orderBy: { createdAt: "desc" }, take: 8, select: { kind: true, status: true, createdAt: true, completedAt: true } });
  for (const c of cmds) console.log("CMD:", c.kind, c.status, c.createdAt?.toISOString(), "->", c.completedAt?.toISOString() ?? "pending");
  await db.$disconnect();
}
main();
