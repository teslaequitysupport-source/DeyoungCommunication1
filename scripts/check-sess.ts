import { db } from "../src/lib/db";
async function main() {
  const sid = "cmtvx2uu00029kruohem2tkky";
  const s = await db.conversionSession.findUnique({ where: { id: sid }, select: { status: true, startedAt: true } });
  console.log("SESSION:", JSON.stringify(s));
  const cmds = await db.workerCommand.findMany({ where: { payload: { contains: sid.slice(-12) } }, orderBy: { createdAt: "desc" }, take: 3, select: { kind: true, status: true, createdAt: true, payload: true } });
  for (const c of cmds) console.log("CMD:", c.kind, c.status, c.createdAt?.toISOString(), c.payload.slice(0, 220));
  const assigns = await db.workerSessionAssignment.findMany({ where: { sessionId: sid }, select: { workerId: true, status: true } });
  console.log("ASSIGN:", JSON.stringify(assigns));
  await db.$disconnect();
}
main();
