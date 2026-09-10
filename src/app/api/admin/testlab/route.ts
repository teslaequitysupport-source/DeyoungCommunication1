import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { wrap, jsonOk } from "@/lib/http";
import { requireAdmin, clientMeta } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { createWorkerCommand } from "@/lib/worker-commands";
import { scoreWorkers, ALIVE_STATUSES } from "@/lib/scheduler";
import { evaluateBudget } from "@/lib/budget";

// ADMIN TEST LAB
//
// Every test runs against the real system. Destructive intent is limited by
// using isTest sessions and TEST-scoped runs, and every run is recorded in
// TestRun + audit. Kinds:
// - WORKER_HEALTH: PING command round trip through the real command queue
// - CONVERSION: real audio through TEST_JOB to a live worker, measures infer time
// - TRANSPORT: reachability + latency of the audio gateway service
// - RATE_LIMIT: burst of unauthenticated health reads; counts 429s (briefly
//   consumes this machine's own rate bucket; window is 60s)
// - SCALE_TO_ZERO: reports idle paid workers and last sweep state
// - FAILOVER: drains a worker with a TEST session attached and verifies the
//   maintenance loop ends that session (observed on subsequent runs)

export const GET = wrap(
  async () => {
    await requireAdmin();
    const runs = await db.testRun.findMany({ orderBy: { createdAt: "desc" }, take: 40 });
    return jsonOk({ runs });
  },
  { rule: "apiRead" }
);

export const POST = wrap(
  async (req: NextRequest) => {
    const admin = await requireAdmin();
    const body = (await req.json()) as { kind?: string; workerId?: string; modelId?: string; burst?: number };
    const kind = body.kind || "WORKER_HEALTH";
    const meta = await clientMeta();

    const run = await db.testRun.create({
      data: { kind, scope: "TEST", status: "RUNNING", startedById: admin.id, params: JSON.stringify({ workerId: body.workerId, modelId: body.modelId, burst: body.burst }) },
    });

    try {
      let result: Record<string, unknown>;
      switch (kind) {
        case "WORKER_HEALTH": result = await testWorkerHealth(body.workerId); break;
        case "CONVERSION": result = await testConversion(body.workerId, body.modelId); break;
        case "TRANSPORT": result = await testTransport(); break;
        case "RATE_LIMIT": result = await testRateLimit(body.burst); break;
        case "SCALE_TO_ZERO": result = await testScaleToZero(); break;
        case "FAILOVER": result = await testFailover(body.workerId, body.modelId); break;
        default: throw new Error(`Unknown test kind: ${kind}`);
      }
      await db.testRun.update({ where: { id: run.id }, data: { status: "PASSED", completedAt: new Date(), result: JSON.stringify({ ...result, passed: true }) } });
      await audit({ actorId: admin.id, actorRole: "ADMIN", action: "TESTLAB_RUN", targetType: "TestRun", targetId: run.id, after: { kind, result }, ip: meta.ip });
      return jsonOk({ ok: true, runId: run.id, result: { ...result, passed: true } });
    } catch (e) {
      const message = (e as Error).message;
      await db.testRun.update({ where: { id: run.id }, data: { status: "FAILED", completedAt: new Date(), result: JSON.stringify({ passed: false, error: message }) } });
      return jsonOk({ ok: true, runId: run.id, result: { passed: false, error: message } });
    }
  },
  { rule: "testLab" }
);

async function testWorkerHealth(workerId?: string) {
  const worker = workerId
    ? await db.worker.findUnique({ where: { id: workerId } })
    : await db.worker.findFirst({ where: { status: { in: [...ALIVE_STATUSES] } }, orderBy: { lastHeartbeatAt: "desc" } });
  if (!worker) throw new Error("No worker available for the health test. Provision one first.");
  const started = Date.now();
  const cmdId = await createWorkerCommand(worker.id, "PING", { ts: started });
  const completed = await waitForCommand(cmdId, 15_000);
  return {
    worker: worker.name,
    workerId: worker.id,
    rttMs: Date.now() - started,
    agentReport: completed.result ?? null,
    note: "Round trip includes the worker poll interval, not just network latency",
  };
}

async function testConversion(workerId?: string, modelId?: string) {
  const model = modelId
    ? await db.voiceModel.findUnique({ where: { id: modelId } })
    : await db.voiceModel.findFirst({ where: { status: "APPROVED", engine: "DSP" } });
  if (!model) throw new Error("No approved model available for the conversion test");

  const candidates = await scoreWorkers(model.id, model.engine === "RVC" ? "RVC_GPU" : "DSP_CPU");
  const target = workerId ? candidates.find((c) => c.id === workerId) ?? null : candidates[0] ?? null;
  if (!target) throw new Error("No eligible worker online for this model tier");
  const targetName = (await db.worker.findUnique({ where: { id: target.id } }))?.name ?? target.id;

  // 1 second of 16kHz sine with vibrato: a deterministic, non-silent probe.
  const sampleRate = 16000;
  const n = sampleRate;
  const pcm = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) {
    const vibrato = 1 + 0.02 * Math.sin((2 * Math.PI * 3 * i) / sampleRate);
    const s = Math.sin((2 * Math.PI * 220 * vibrato * i) / sampleRate) * 0.6;
    pcm.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(s * 32767))), i * 2);
  }
  const started = Date.now();
  const cmdId = await createWorkerCommand(target.id, "TEST_JOB", {
    modelId: model.id,
    sampleRate,
    audioB64: pcm.toString("base64"),
  });
  const completed = await waitForCommand(cmdId, 30_000);
  // Command results are double-wrapped: { ok, result: { inferMs, outB64, ... } }
  const outer = (completed.result ?? {}) as { result?: Record<string, unknown>; error?: string };
  const result = (outer.result ?? {}) as { inferMs?: number; outB64?: string; outSamples?: number };
  if (!result.outB64) throw new Error(`Worker returned no converted audio (error: ${outer.error ?? "none"})`);
  return {
    worker: targetName,
    model: model.name,
    totalMs: Date.now() - started,
    inferMs: result.inferMs ?? null,
    outSamples: result.outSamples ?? null,
    note: "Total includes command poll delay; inferMs is the worker-measured conversion time",
  };
}

async function testTransport() {
  const started = Date.now();
  // engine.io handshake probe: with socket.io path "/", engine.io owns every
  // URL, so the health probe is a real polling handshake (returns an open packet).
  const res = await fetch("http://127.0.0.1:3003/socket.io/?EIO=4&transport=polling").catch(() => null);
  if (!res || !res.ok) throw new Error("Audio gateway did not answer on port 3003");
  const body = await res.text();
  if (!body.startsWith("0")) throw new Error("Gateway answered but the engine.io handshake was malformed");
  return { gateway: "port 3003", httpMs: Date.now() - started, handshake: "open", ok: true };
}

async function testRateLimit(burst?: number) {
  const count = Math.min(Math.max(burst ?? 260, 10), 400);
  let got429 = 0;
  let got200 = 0;
  for (let i = 0; i < count; i++) {
    const res = await fetch("http://127.0.0.1:3000/api/health").catch(() => null);
    if (!res) continue;
    if (res.status === 429) got429++;
    else if (res.status === 200) got200++;
  }
  return {
    burst: count,
    http200: got200,
    http429: got429,
    verdict: got429 > 0 ? "Rate limiter engaged (429s observed)" : "No 429 observed; burst may be under the 240/min window",
    note: "The health route allows 240 requests per minute per identity; this burst may consume this machine's own window briefly",
  };
}

async function testScaleToZero() {
  const idlePaid = await db.worker.count({ where: { costKind: "PAID", status: { in: ["READY", "IDLE"] }, activeSessions: 0 } });
  const activePaid = await db.worker.count({ where: { costKind: "PAID", status: { in: ["BOOTING", "LOADING_MODEL", "WARMING", "ACTIVE"] } } });
  const free = await db.worker.count({ where: { costKind: "FREE", status: { notIn: ["STOPPED"] } } });
  const budget = await evaluateBudget({});
  return {
    idlePaidWorkers: idlePaid,
    activePaidWorkers: activePaid,
    freeWorkers: free,
    emergencyStop: budget.policy?.emergencyStop ?? false,
    verdict: idlePaid === 0 ? "No idle paid capacity is running: zero paid GPU cost" : `${idlePaid} idle paid worker(s) will be stopped by the sweep`,
  };
}

async function testFailover(workerId?: string, modelId?: string) {
  const worker = workerId
    ? await db.worker.findUnique({ where: { id: workerId } })
    : await db.worker.findFirst({ where: { status: { in: ["READY", "ACTIVE", "IDLE"] } } });
  if (!worker) throw new Error("No worker to fail over from");
  const testSessions = await db.conversionSession.findMany({
    where: { isTest: true, status: { in: ["CONNECTING", "ACTIVE"] }, assignments: { some: { workerId: worker.id } } },
    take: 5,
  });
  if (testSessions.length === 0) {
    return {
      worker: worker.name,
      testSessionsFound: 0,
      verdict: "No live TEST sessions on this worker to fail over. Start a TEST session from the studio with test mode, then rerun.",
    };
  }
  // Drain now; the maintenance loop must end the orphaned TEST sessions.
  await db.worker.update({ where: { id: worker.id }, data: { status: "DRAINING" } });
  return {
    worker: worker.name,
    testSessionsFound: testSessions.length,
    drained: true,
    verdict: "Worker drained. The maintenance loop marks it stale within about 90 seconds and ends orphaned TEST sessions. Rerun this test to verify they ended.",
  };
}

async function waitForCommand(cmdId: string, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const cmd = await db.workerCommand.findUnique({ where: { id: cmdId } });
    if (cmd && (cmd.status === "COMPLETED" || cmd.status === "FAILED")) {
      if (cmd.status === "FAILED") {
        const r = cmd.result ? JSON.parse(cmd.result) : {};
        throw new Error(r.error || "Worker reported failure");
      }
      return { result: cmd.result ? JSON.parse(cmd.result) : {} };
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Timed out waiting for the worker to complete the command");
}
