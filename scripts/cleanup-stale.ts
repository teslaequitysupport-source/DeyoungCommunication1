// Pre-E2E hygiene: cancel stale sessions/queue entries/assignments so the
// scheduler and worker capacity start from a clean slate. Run before e2e-audio.
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const staleStates = ["QUEUED", "ASSIGNING", "CONNECTING", "ACTIVE"];
  const sessions = await db.conversionSession.findMany({
    where: { status: { in: staleStates } },
    select: { id: true },
  });
  for (const s of sessions) {
    await db.conversionSession.update({
      where: { id: s.id },
      data: { status: "ENDED", endedAt: new Date() },
    });
    await db.queueEntry.updateMany({ where: { sessionId: s.id, status: { in: ["WAITING", "NOTIFIED"] } }, data: { status: "CANCELLED" } });
    await db.workerSessionAssignment.updateMany({ where: { sessionId: s.id, state: { in: ["ASSIGNED", "CONNECTING", "ACTIVE"] } }, data: { state: "ENDED", endedAt: new Date() } });
  }
  // Reset worker active session counters that may be orphaned
  const workers = await db.worker.findMany({ where: { activeSessions: { gt: 0 } } });
  for (const w of workers) {
    const live = await db.workerSessionAssignment.count({ where: { workerId: w.id, state: "ACTIVE" } });
    if (live !== w.activeSessions) {
      await db.worker.update({ where: { id: w.id }, data: { activeSessions: live } });
      console.log(`worker ${w.name}: activeSessions -> ${live}`);
    }
  }
  // Mark workers whose process is demonstrably dead as UNHEALTHY immediately
  // (same semantics as the maintenance stale sweep, without the 2 min wait).
  const aliveStates = ["BOOTING", "LOADING_MODEL", "WARMING", "READY", "ACTIVE", "IDLE", "DRAINING"];
  const hbCutoff = new Date(Date.now() - 90_000);
  const stale = await db.worker.findMany({
    where: { status: { in: aliveStates }, OR: [{ lastHeartbeatAt: { lt: hbCutoff } }, { lastHeartbeatAt: null, registeredAt: { lt: hbCutoff } }] },
  });
  for (const w of stale) {
    await db.worker.update({ where: { id: w.id }, data: { status: "UNHEALTHY", lastError: "Heartbeat timeout (cleanup script)" } });
    console.log(`worker ${w.name}: marked UNHEALTHY (stale heartbeat)`);
  }
  console.log(`cleaned ${sessions.length} stale session(s)`);
}

main().finally(() => db.$disconnect());
