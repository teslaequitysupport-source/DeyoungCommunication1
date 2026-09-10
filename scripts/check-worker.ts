import { db } from "../src/lib/db";
async function main() {
  const w = await db.worker.findUnique({ where: { id: "cmtvwzhlu000pkruoj353tpb2" }, select: { name: true, status: true, lastError: true } });
  console.log("WORKER:", JSON.stringify(w));
  const evs = await db.workerEvent.findMany({ where: { workerId: "cmtvwzhlu000pkruoj353tpb2" }, orderBy: { createdAt: "desc" }, take: 5, select: { kind: true, level: true, message: true, data: true } });
  for (const e of evs) console.log("EV:", e.level, e.kind, "|", e.message.slice(0, 200), "|", (e.data || "").slice(0, 300));
  await db.$disconnect();
}
main();
