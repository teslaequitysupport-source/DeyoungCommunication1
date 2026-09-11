import { db } from "../src/lib/db";
async function main() {
  const rows = await db.conversionSession.findMany({ where: { status: "QUEUED", isTest: false }, select: { id: true } });
  for (const s of rows) {
    await db.queueEntry.updateMany({ where: { sessionId: s.id, status: "WAITING" }, data: { status: "CANCELLED" } });
    await db.conversionSession.update({ where: { id: s.id }, data: { status: "CANCELLED", endReason: "STALE_CLEANUP" } });
    console.log("cancelled", s.id);
  }
  await db.$disconnect();
}
main();
