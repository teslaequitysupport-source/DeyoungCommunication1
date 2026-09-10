import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { notify } from "@/lib/notify";
import { signGatewayToken, hashToken } from "@/lib/crypto";
import { checkRateLimit, RATE_RULES } from "@/lib/rate-limit";

// Scheduler: assigns conversion sessions to workers.
//
// Selection scores candidates on: tier support, model residency, health,
// remaining capacity, provider reliability weight, and priority (plan level).
// Paid capacity is only requested when free capacity cannot serve the request
// and the budget guard allows it (FREE FIRST, PAY ONLY WHEN REQUIRED).

export const TIERS = ["DSP_CPU", "RVC_GPU"] as const;
export type Tier = (typeof TIERS)[number];

export const ALIVE_STATUSES = ["BOOTING", "LOADING_MODEL", "WARMING", "READY", "ACTIVE", "IDLE"] as const;

export interface AssignResult {
  status: "ASSIGNED" | "QUEUED" | "REJECTED";
  sessionId: string;
  workerId?: string;
  gatewayUrl?: string;
  gatewayToken?: string;
  queuePosition?: number;
  reason?: string;
}

interface Candidate {
  id: string;
  tiers: string[];
  loadedModels: string | null;
  lastHeartbeatAt: Date | null;
  status: string;
  providerCode: string;
  costKind: string;
  activeSessions: number;
  capabilities: string | null;
  score: number;
}

export function heartbeatFresh(lastHeartbeatAt: Date | null, timeoutSec = env.workerHeartbeatTimeoutSec): boolean {
  if (!lastHeartbeatAt) return false;
  return Date.now() - lastHeartbeatAt.getTime() <= timeoutSec * 1000;
}

export async function scoreWorkers(modelId: string, tier: Tier): Promise<Candidate[]> {
  const workers = await db.worker.findMany({
    where: { status: { in: [...ALIVE_STATUSES] }, activeSessions: { lt: 10_000 } },
  });
  const model = await db.voiceModel.findUnique({ where: { id: modelId } });
  const candidates: Candidate[] = [];
  for (const w of workers) {
    if (!heartbeatFresh(w.lastHeartbeatAt)) continue;
    const tiers = JSON.parse(w.tiers || "[]") as string[];
    if (!tiers.includes(tier)) continue;
    // System DSP models run everywhere; RVC models require residency or load capability.
    if (model?.kind === "RVC_UPLOAD") {
      const loaded = JSON.parse(w.loadedModels || "[]") as string[];
      const canLoad = (JSON.parse(w.capabilities || "{}") as { canLoadModels?: boolean }).canLoadModels !== false;
      if (!loaded.includes(modelId) && !canLoad) continue;
    }
    let score = 100;
    if (w.status === "ACTIVE") score += 20; // warm
    if (w.status === "READY" || w.status === "IDLE") score += 10;
    if (model?.kind === "RVC_UPLOAD") {
      const loaded = JSON.parse(w.loadedModels || "[]") as string[];
      if (loaded.includes(modelId)) score += 30; // avoids model load latency
    }
    score += Math.max(0, 20 - w.activeSessions * 10);
    if (w.costKind === "FREE") score += 15; // free-first
    candidates.push({
      id: w.id,
      tiers,
      loadedModels: w.loadedModels,
      lastHeartbeatAt: w.lastHeartbeatAt,
      status: w.status,
      providerCode: w.providerCode,
      costKind: w.costKind,
      activeSessions: w.activeSessions,
      capabilities: w.capabilities,
      score,
    });
  }
  return candidates.sort((a, b) => b.score - a.score);
}

// Request a session: enqueue or assign now. The gateway token returned to the
// client is short-lived and scoped to one session; the same token (worker role)
// is delivered to the worker via the command channel.
export async function requestSession(input: {
  userId: string;
  modelId: string;
  requestedTier: string;
  isTest?: boolean;
  clientInfo?: unknown;
}): Promise<AssignResult> {
  const planAllowed = await assertPlanAllows(input.userId, input.requestedTier as Tier);
  if (!planAllowed.ok) {
    return { status: "REJECTED", sessionId: "", reason: planAllowed.reason };
  }

  const model = await db.voiceModel.findUnique({ where: { id: input.modelId } });
  if (!model || model.status !== "APPROVED") {
    return { status: "REJECTED", sessionId: "", reason: "MODEL_UNAVAILABLE" };
  }

  const session = await db.conversionSession.create({
    data: {
      userId: input.userId,
      modelId: input.modelId,
      requestedTier: input.requestedTier,
      isTest: input.isTest ?? false,
      clientInfo: input.clientInfo ? JSON.stringify(input.clientInfo) : null,
      status: "ASSIGNING",
    },
  });

  const tier = resolveTier(model, input.requestedTier);
  const candidates = await scoreWorkers(model.id, tier);

  if (candidates.length === 0) {
    // No live capacity: enqueue and ask the provisioning layer to react.
    await db.queueEntry.create({
      data: { sessionId: session.id, priority: await userPriority(input.userId) },
    });
    await db.conversionSession.update({ where: { id: session.id }, data: { status: "QUEUED" } });
    const { requestCapacityTopUp } = await import("@/lib/provision");
    await requestCapacityTopUp(tier);
    return {
      status: "QUEUED",
      sessionId: session.id,
      queuePosition: await queuePosition(session.id),
      reason: "NO_WORKER_AVAILABLE",
    };
  }

  const chosen = candidates[0];
  return assignWorker(session.id, chosen.id, input.userId);
}

function resolveTier(model: { kind: string }, requested: string): Tier {
  if (requested === "DSP_CPU" || requested === "RVC_GPU") return requested;
  return model.kind === "RVC_UPLOAD" ? "RVC_GPU" : "DSP_CPU";
}

export async function userPriority(userId: string): Promise<number> {
  const sub = await db.subscription.findUnique({ where: { userId }, include: { plan: true } });
  return sub?.plan.priority ?? 0;
}

async function assertPlanAllows(userId: string, tier: Tier): Promise<{ ok: boolean; reason?: string }> {
  const sub = await db.subscription.findUnique({ where: { userId }, include: { plan: true } });
  if (!sub || sub.status !== "ACTIVE" || !sub.plan.isActive) {
    return { ok: false, reason: "NO_ACTIVE_PLAN" };
  }
  const allowedTiers = JSON.parse(sub.plan.allowedTiers || "[]") as string[];
  if (tier === "RVC_GPU" && !allowedTiers.includes("RVC_GPU")) {
    return { ok: false, reason: "TIER_NOT_IN_PLAN" };
  }
  const activeCount = await db.conversionSession.count({
    where: { userId, status: { in: ["QUEUED", "ASSIGNING", "CONNECTING", "ACTIVE"] }, isTest: false },
  });
  if (activeCount >= sub.plan.maxConcurrentSessions) {
    return { ok: false, reason: "CONCURRENT_LIMIT" };
  }
  // Rate limit session starts per user.
  const allowed = await checkRateLimit(RATE_RULES.sessionStart, `user:${userId}`);
  if (!allowed) return { ok: false, reason: "RATE_LIMITED" };
  return { ok: true };
}

async function queuePosition(sessionId: string): Promise<number> {
  const entries = await db.queueEntry.findMany({
    where: { status: "WAITING" },
    orderBy: [{ priority: "desc" }, { enqueuedAt: "asc" }],
  });
  return Math.max(0, entries.findIndex((e) => e.sessionId === sessionId));
}

export async function assignWorker(sessionId: string, workerId: string, userId: string): Promise<AssignResult> {
  const { createWorkerCommand } = await import("@/lib/worker-commands");
  const session = await db.conversionSession.update({
    where: { id: sessionId },
    data: { status: "CONNECTING", assignedAt: new Date() },
  });
  await db.workerSessionAssignment.create({
    data: { sessionId, workerId, state: "ASSIGNED" },
  });
  await db.worker.update({ where: { id: workerId }, data: { activeSessions: { increment: 1 }, status: "ACTIVE", totalSessions: { increment: 1 } } });
  await db.queueEntry.updateMany({ where: { sessionId, status: "WAITING" }, data: { status: "SERVED" } });

  const exp = Math.floor(Date.now() / 1000) + 3600;
  const clientToken = signGatewayToken({ sid: sessionId, uid: userId, wid: workerId, mid: session.modelId, role: "client", exp }, env.gatewaySecret);
  const workerToken = signGatewayToken({ sid: sessionId, uid: userId, wid: workerId, mid: session.modelId, role: "worker", exp }, env.gatewaySecret);
  await db.conversionSession.update({ where: { id: sessionId }, data: { gatewayTokenHash: hashToken(clientToken) } });

  await createWorkerCommand(workerId, "START_SESSION", {
    sessionId,
    modelId: session.modelId,
    // Workers on this machine reach the gateway directly; remote workers
    // (Kaggle) go through the public origin, where the Caddy gateway maps
    // XTransformPort to the gateway port.
    gatewayLocal: "ws://127.0.0.1:3003",
    gatewayRemote: env.appOrigin.replace(/^http/, "ws") + "/?XTransformPort=3003",
    gatewayToken: workerToken,
    sampleRate: env.audioSampleRate,
    chunkMs: env.audioChunkMs,
  });

  return {
    status: "ASSIGNED",
    sessionId,
    workerId,
    gatewayToken: clientToken,
    gatewayUrl: "/?XTransformPort=3003",
  };
}

// Drain a worker: no new sessions, existing sessions keep running.
export async function drainWorker(workerId: string): Promise<void> {
  const { createWorkerCommand } = await import("@/lib/worker-commands");
  await db.worker.update({ where: { id: workerId }, data: { status: "DRAINING" } });
  await createWorkerCommand(workerId, "DRAIN", {});
}

// Scale-to-zero: stop PAID workers that are idle beyond the cooldown. FREE
// workers (Kaggle, local) are left alone; they die on their own schedule and
// cost nothing. Never stops a worker with active sessions.
export async function scaleToZero(cooldownMinutes = 10): Promise<string[]> {
  const { createWorkerCommand } = await import("@/lib/worker-commands");
  const cutoff = new Date(Date.now() - cooldownMinutes * 60_000);
  const idlePaid = await db.worker.findMany({
    where: {
      costKind: "PAID",
      status: { in: ["READY", "IDLE"] },
      activeSessions: 0,
      lastHeartbeatAt: { lt: cutoff },
    },
  });
  const stopped: string[] = [];
  for (const w of idlePaid) {
    await db.worker.update({ where: { id: w.id }, data: { status: "STOPPING" } });
    await createWorkerCommand(w.id, "SHUTDOWN", { reason: "SCALE_TO_ZERO" });
    stopped.push(w.id);
  }
  return stopped;
}

export async function endSession(sessionId: string, reason: string, endedBy: "USER" | "SYSTEM" | "ADMIN"): Promise<void> {
  const session = await db.conversionSession.findUnique({ where: { id: sessionId } });
  if (!session || ["ENDED", "FAILED", "CANCELLED"].includes(session.status)) return;
  const assignment = await db.workerSessionAssignment.findFirst({
    where: { sessionId, state: { in: ["ASSIGNED", "CONNECTING", "ACTIVE"] } },
  });
  const now = new Date();
  const durationSec = session.startedAt ? (now.getTime() - session.startedAt.getTime()) / 1000 : null;

  await db.conversionSession.update({
    where: { id: sessionId },
    data: {
      status: reason === "USER_ENDED" ? "ENDED" : endedBy === "USER" ? "CANCELLED" : "ENDED",
      endReason: reason,
      endedAt: now,
      durationSec,
    },
  });
  if (assignment) {
    await db.workerSessionAssignment.update({
      where: { id: assignment.id },
      data: { state: "ENDED", endedAt: now, endReason: reason },
    });
    const worker = await db.worker.findUnique({ where: { id: assignment.workerId } });
    if (worker) {
      const nextActive = Math.max(0, worker.activeSessions - 1);
      await db.worker.update({
        where: { id: worker.id },
        data: { activeSessions: nextActive, status: worker.status === "DRAINING" && nextActive === 0 ? "STOPPING" : nextActive === 0 ? "IDLE" : "ACTIVE" },
      });
      const { createWorkerCommand } = await import("@/lib/worker-commands");
      await createWorkerCommand(worker.id, "STOP_SESSION", { sessionId, reason });
    }
  }
  // Notify the user when the end was not user-initiated.
  if (endedBy !== "USER") {
    await notify({
      userId: session.userId,
      kind: "SESSION",
      title: `Session ended: ${reason.replace(/_/g, " ").toLowerCase()}`,
      body: `Your conversion session was ended by the platform (${reason}). Open the dashboard for details.`,
    });
  }
}
