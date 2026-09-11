import { db } from "../src/lib/db";
async function main() {
  const cmds = await db.workerCommand.findMany({ where: { workerId: "cmtwp0q16000hrn814vqvg9ul" }, orderBy: { createdAt: "desc" }, take: 5, select: { kind: true, status: true, createdAt: true, completedAt: true, deliveredAt: true } });
  for (const c of cmds) console.log("CMD:", c.kind, c.status, c.createdAt?.toISOString().slice(11,19), "del:", c.deliveredAt?.toISOString().slice(11,19) ?? "-", "done:", c.completedAt?.toISOString().slice(11,19) ?? "-");
  await db.$disconnect();
}
main();
