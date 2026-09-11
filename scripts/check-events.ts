import { db } from "../src/lib/db";
async function main() {
  const evs = await db.workerEvent.findMany({ where: { workerId: "cmtwp0q16000hrn814vqvg9ul" }, orderBy: { createdAt: "desc" }, take: 12, select: { kind: true, level: true, message: true, data: true, createdAt: true } });
  for (const e of evs) console.log(e.createdAt?.toISOString()?.slice(11, 19), e.level, e.kind, "|", e.message.slice(0, 110), "|", (e.data || "").slice(0, 80));
  await db.$disconnect();
}
main();
