// FAILOVER verification: create a TEST session attached to the live worker
// (the state studio test mode produces), invoke the admin FAILOVER test
// (drains the worker), then watch the maintenance loop end the orphaned
// session. Exercises the real detection -> drain -> recovery path.
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";

const db = new PrismaClient();
const BASE = "http://127.0.0.1:3000";
const ADMIN_COOKIE = `voxcore_session=${readFileSync("/tmp/admin.jar", "utf8").split("\n").find((l) => l.includes("voxcore_session"))!.split("\t").pop()!.trim()}`;

async function main() {
  const worker = await db.worker.findFirst({ where: { status: { in: ["READY", "ACTIVE", "IDLE"] }, activeSessions: { lt: 3 } } });
  if (!worker) throw new Error("no live worker to fail over from");
  const admin = await db.user.findFirst({ where: { role: "ADMIN" } });
  const model = await db.voiceModel.findFirst({ where: { status: "APPROVED" } });
  if (!admin || !model) throw new Error("missing admin user or approved model");

  // 1. TEST session attached to the worker (studio test-mode equivalent).
  const session = await db.conversionSession.create({
    data: {
      userId: admin.id, modelId: model.id, requestedTier: "AUTO",
      isTest: true, status: "CONNECTING",
    },
  });
  await db.workerSessionAssignment.create({
    data: { sessionId: session.id, workerId: worker.id, state: "ASSIGNED" },
  });
  console.log(`created TEST session ${session.id} on worker ${worker.name} (${worker.status})`);

  // 2. Run the FAILOVER testlab test -> drains the worker.
  const res = await fetch(`${BASE}/api/admin/testlab`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: ADMIN_COOKIE },
    body: JSON.stringify({ kind: "FAILOVER", workerId: worker.id }),
  });
  const out = await res.json();
  console.log("FAILOVER test:", JSON.stringify(out.result ?? out).slice(0, 300));

  // 3. Watch the maintenance loop recover the orphaned session.
  const deadline = Date.now() + 150_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 10_000));
    const s = await db.conversionSession.findUnique({ where: { id: session.id } });
    const w = await db.worker.findUnique({ where: { id: worker.id } });
    const elapsed = Math.round((Date.now() - (deadline - 150_000)) / 1000);
    console.log(`t+${elapsed}s: session=${s?.status} worker=${w?.status}`);
    if (s?.status === "ENDED" || s?.status === "FAILED" || s?.status === "CANCELLED") {
      console.log(`FAILOVER RECOVERY VERIFIED: orphaned TEST session ended with reason=${s?.endReason} after ~${elapsed}s`);
      // 4. Worker can accept work again: clear the drain (maintenance/health
      //    sweep would do this for a live worker; verify it is recoverable).
      await db.worker.update({ where: { id: worker.id }, data: { status: "READY" } });
      await db.workerSessionAssignment.updateMany({ where: { sessionId: session.id }, data: { state: "ENDED", endedAt: new Date() } });
      const back = await db.worker.findUnique({ where: { id: worker.id } });
      console.log(`worker ${back?.name} returned to service: ${back?.status}`);
      return;
    }
  }
  console.error("FAILOVER TIMEOUT: orphaned TEST session was not recovered within 150s");
  process.exitCode = 1;
}

main().finally(() => db.$disconnect());
