// Maintenance implementations, imported only in the Node.js runtime.

const TICK_MS = 30_000;

export function startMaintenanceLoop(tickMs = TICK_MS) {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await detectStaleWorkers();
      await failOrphanedSessions();
      await scaleToZeroSweep();
      await budgetSweep();
      await allowanceSweep();
      await retentionSweep();
    } catch (e) {
      console.error(JSON.stringify({ level: "error", msg: "maintenance_tick_failed", err: String(e) }));
    } finally {
      running = false;
    }
  };

  const timer = setInterval(tick, tickMs);
  // Do not keep the process alive purely for maintenance.
  if (typeof timer.unref === "function") timer.unref();
  void tick();
}

async function detectStaleWorkers() {
  const { db } = await import("@/lib/db");
  const cutoff = new Date(Date.now() - 60_000 * 2);
  const stale = await db.worker.findMany({
    where: {
      status: { in: ["BOOTING", "LOADING_MODEL", "WARMING", "READY", "ACTIVE", "IDLE", "DRAINING"] },
      OR: [{ lastHeartbeatAt: { lt: cutoff } }, { lastHeartbeatAt: null, registeredAt: { lt: cutoff } }],
    },
  });
  for (const w of stale) {
    await db.worker.update({ where: { id: w.id }, data: { status: "UNHEALTHY", lastError: "Heartbeat timeout" } });
    await db.workerEvent.create({
      data: { workerId: w.id, level: "ERROR", kind: "HEARTBEAT_TIMEOUT", message: "Worker marked UNHEALTHY: heartbeat missed" },
    }).catch(() => {});
    await db.alert.create({
      data: {
        kind: "WORKER_STALE",
        severity: "WARN",
        title: `Worker ${w.name} lost heartbeat`,
        detail: JSON.stringify({ provider: w.providerCode, lastSeen: w.lastHeartbeatAt }),
        sourceRef: w.id,
      },
    }).catch(() => {});
  }
}

async function failOrphanedSessions() {
  const { db } = await import("@/lib/db");
  const { endSession } = await import("@/lib/scheduler");
  const cutoff = new Date(Date.now() - 90_000);
  const stuck = await db.conversionSession.findMany({
    where: { status: { in: ["CONNECTING", "ACTIVE"] }, isTest: false, updatedAt: { lt: cutoff } },
    include: { assignments: { where: { state: { in: ["ASSIGNED", "CONNECTING", "ACTIVE"] } }, include: { worker: true } } },
  });
  for (const s of stuck) {
    const alive = s.assignments.some((a) =>
      ["READY", "ACTIVE", "IDLE"].includes(a.worker.status) &&
      a.worker.lastHeartbeatAt && Date.now() - a.worker.lastHeartbeatAt.getTime() < 120_000
    );
    if (!alive) {
      await endSession(s.id, "WORKER_LOST", "SYSTEM");
    }
  }
}

async function scaleToZeroSweep() {
  const { scaleToZero } = await import("@/lib/scheduler");
  await scaleToZero(10);
}

async function budgetSweep() {
  const { checkBudgetThresholds } = await import("@/lib/budget");
  await checkBudgetThresholds();
}

async function allowanceSweep() {
  const { db } = await import("@/lib/db");
  const month = new Date().toISOString().slice(0, 7);
  const subs = await db.subscription.findMany({
    where: { status: "ACTIVE", plan: { monthlyFreeCreditCents: { gt: 0 }, isActive: true } },
    include: { plan: true },
  });
  for (const sub of subs) {
    const idem = `allowance:${sub.userId}:${month}`;
    const exists = await db.creditLedgerEntry.findUnique({ where: { idempotencyKey: idem } });
    if (exists) continue;
    const { applyCredits } = await import("@/lib/credits");
    await applyCredits({
      userId: sub.userId,
      deltaCents: sub.plan.monthlyFreeCreditCents,
      reason: "MONTHLY_ALLOWANCE",
      idempotencyKey: idem,
      note: `${sub.plan.code} monthly allowance for ${month}`,
    }).catch(() => {});
  }
}

async function retentionSweep() {
  const { db } = await import("@/lib/db");
  const cutoff = new Date(Date.now() - 24 * 3600 * 1000);
  await db.workerHeartbeat.deleteMany({ where: { createdAt: { lt: cutoff } } }).catch(() => {});
  await db.requestMetric.deleteMany({ where: { createdAt: { lt: cutoff } } }).catch(() => {});
  await db.rateLimitCounter.deleteMany({ where: { windowStart: { lt: cutoff } } }).catch(() => {});
  const tokCutoff = new Date(Date.now() - 48 * 3600 * 1000);
  await db.verificationToken.deleteMany({ where: { expiresAt: { lt: tokCutoff } } }).catch(() => {});
  const provCutoff = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  await db.provisionRequest.deleteMany({ where: { expiresAt: { lt: provCutoff } } }).catch(() => {});
}
