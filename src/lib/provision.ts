import { spawn, ChildProcess } from "child_process";
import path from "path";
import fs from "fs";
import { db } from "@/lib/db";
import { randomToken, hashToken } from "@/lib/crypto";
import { env } from "@/lib/env";
import { heartbeatFresh } from "@/lib/scheduler";
import { createWorkerCommand } from "@/lib/worker-commands";

// PROVIDER ABSTRACTION
//
// Providers are interchangeable capacity sources. The interface follows
// docs/49 (PROVIDER-ABSTRACTION.md). Two providers ship fully working:
//
// - LocalProvider: spawns the Python worker agent on this machine. Real
//   process management (provision/start/stop/terminate/restart).
// - KaggleAssistedProvider: generates a registration token and a paste-ready
//   Kaggle notebook cell that downloads and runs the same agent. Kaggle does
//   not support supported programmatic launching of interactive GPU sessions,
//   so this provider is ASSISTED, not AUTONOMOUS. That limitation is stated
//   everywhere capacity is discussed, never hidden.
//
// Adding RunPod/Modal later means implementing this same interface; no
// application code changes (docs/PROVIDER-ABSTRACTION.md describes the steps).

export type ProviderAutomation = "AUTONOMOUS" | "ASSISTED" | "MANUAL";

export interface GpuProvider {
  code: string;
  name: string;
  costKind: "FREE" | "PAID";
  automation: ProviderAutomation;
  provision(opts: { name: string; tier: string; requestedBy: string }): Promise<{ workerId?: string; artifact?: string; instructions?: string }>;
  start(workerId: string): Promise<void>;
  stop(workerId: string): Promise<void>;
  restart(workerId: string): Promise<void>;
  terminate(workerId: string): Promise<void>;
  drain(workerId: string): Promise<void>;
  healthCheck(workerId: string): Promise<{ healthy: boolean; reason: string }>;
  getCapabilities(): Promise<Record<string, unknown>>;
  getCost(): Promise<{ rateMilliUsdPerHour: number; notes: string }>;
}

const AGENT_DIR = path.join(process.cwd(), "worker-agent");
const AGENT_ENTRY = path.join(AGENT_DIR, "worker_agent.py");
const localProcesses = new Map<string, ChildProcess>();

// Interpreter is pinned by deployments via VOXCORE_AGENT_PYTHON (see docs/48-DEPLOYMENT.md).
// Bare "python3" resolves against the SERVER process PATH, which may differ from the
// operator shell PATH (e.g. a venv python with deps vs a bare system python without).
const AGENT_PYTHON = process.env.VOXCORE_AGENT_PYTHON || "python3";

class LocalProvider implements GpuProvider {
  code = "LOCAL";
  name = "Local machine";
  costKind = "FREE" as const;
  automation: ProviderAutomation = "AUTONOMOUS";

  async provision(opts: { name: string; tier: string; requestedBy: string }): Promise<{ workerId?: string; artifact?: string; instructions?: string }> {
    if (!fs.existsSync(AGENT_ENTRY)) {
      return { instructions: "Worker agent entry file missing at worker-agent/worker_agent.py" };
    }
    const regToken = randomToken(24);
    const worker = await db.worker.create({
      data: {
        name: opts.name || `local-${Date.now().toString(36)}`,
        providerCode: this.code,
        costKind: "FREE",
        status: "BOOTING",
        managedById: opts.requestedBy,
        region: "local",
        tokenHash: hashToken(randomToken(12)), // placeholder until registration issues the real token
        notes: `Provisioned locally by admin ${opts.requestedBy}`,
      },
    });
    await db.provisionRequest.create({
      data: {
        providerCode: this.code,
        status: "ISSUED",
        tokenHash: hashToken(regToken),
        payload: JSON.stringify({ workerId: worker.id, tier: opts.tier }),
        issuedById: opts.requestedBy,
        expiresAt: new Date(Date.now() + 3600_000),
      },
    });
    const backend = `http://127.0.0.1:3000`;
    const child = spawn(AGENT_PYTHON, [AGENT_ENTRY], {
      cwd: AGENT_DIR,
      env: {
        ...process.env,
        BACKEND_URL: backend,
        WORKER_REG_TOKEN: regToken,
        WORKER_NAME: worker.name,
        WORKER_TIERS: JSON.stringify(["DSP_CPU"]),
        PYTHONUNBUFFERED: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
      detached: false,
    });
    let lastOut = "";
    child.stdout?.on("data", (d) => { lastOut = String(d).slice(-400); });
    child.stderr?.on("data", (d) => { lastOut = String(d).slice(-400); });
    child.on("exit", (code) => {
      localProcesses.delete(worker.id);
      void db.workerEvent.create({
        data: { workerId: worker.id, level: code === 0 ? "INFO" : "ERROR", kind: "PROCESS_EXIT", message: `Local agent exited with code ${code}`, data: JSON.stringify({ lastOut }) },
      }).catch(() => {});
      void db.worker.update({ where: { id: worker.id }, data: { status: code === 0 ? "STOPPED" : "FAILED", lastError: code === 0 ? null : `exit code ${code}: ${lastOut}` } }).catch(() => {});
    });
    localProcesses.set(worker.id, child);
    return { workerId: worker.id, instructions: "Local agent process spawned. It will register and begin heartbeats within seconds." };
  }

  async start(workerId: string): Promise<void> {
    const worker = await db.worker.findUnique({ where: { id: workerId } });
    if (!worker) return;
    await db.worker.update({ where: { id: workerId }, data: { status: "BOOTING" } });
    await createWorkerCommand(workerId, "PING", {});
  }

  async stop(workerId: string): Promise<void> {
    await createWorkerCommand(workerId, "SHUTDOWN", { reason: "ADMIN_STOP" });
    await db.worker.update({ where: { id: workerId }, data: { status: "STOPPING" } });
  }

  async restart(workerId: string): Promise<void> {
    await createWorkerCommand(workerId, "RESTART", {});
    await db.worker.update({ where: { id: workerId }, data: { status: "RESTARTING" } });
  }

  async terminate(workerId: string): Promise<void> {
    const child = localProcesses.get(workerId);
    if (child) {
      child.kill("SIGTERM");
      localProcesses.delete(workerId);
    }
    await createWorkerCommand(workerId, "SHUTDOWN", { reason: "ADMIN_TERMINATE" });
    await db.worker.update({ where: { id: workerId }, data: { status: "STOPPING" } });
  }

  async drain(workerId: string): Promise<void> {
    await createWorkerCommand(workerId, "DRAIN", {});
    await db.worker.update({ where: { id: workerId }, data: { status: "DRAINING" } });
  }

  async healthCheck(workerId: string): Promise<{ healthy: boolean; reason: string }> {
    const worker = await db.worker.findUnique({ where: { id: workerId } });
    if (!worker) return { healthy: false, reason: "NOT_FOUND" };
    if (!heartbeatFresh(worker.lastHeartbeatAt)) return { healthy: false, reason: "HEARTBEAT_STALE" };
    if (["FAILED", "UNHEALTHY", "QUARANTINED", "STOPPED"].includes(worker.status)) {
      return { healthy: false, reason: worker.status };
    }
    return { healthy: true, reason: "OK" };
  }

  async getCapabilities(): Promise<Record<string, unknown>> {
    return { tiers: ["DSP_CPU"], canLoadModels: false, maxSessions: 2, automation: this.automation };
  }

  async getCost(): Promise<{ rateMilliUsdPerHour: number; notes: string }> {
    return { rateMilliUsdPerHour: 0, notes: "Local compute has no direct infrastructure cost; electricity and hardware wear are out of scope of metering." };
  }
}

class KaggleAssistedProvider implements GpuProvider {
  code = "KAGGLE_ASSISTED";
  name = "Kaggle notebook (assisted)";
  costKind = "FREE" as const;
  automation: ProviderAutomation = "ASSISTED";

  async provision(opts: { name: string; tier: string; requestedBy: string }): Promise<{ workerId?: string; artifact?: string; instructions?: string }> {
    const regToken = randomToken(24);
    const worker = await db.worker.create({
      data: {
        name: opts.name || `kaggle-${Date.now().toString(36)}`,
        providerCode: this.code,
        costKind: "FREE",
        status: "BOOTING",
        managedById: opts.requestedBy,
        region: "kaggle",
        tokenHash: hashToken(randomToken(12)), // placeholder until registration issues the real token
        notes: "Awaiting notebook start. Kaggle GPU sessions are capped (roughly 30h/week, sessions end after hours); termination is normal and the fleet must absorb it.",
      },
    });
    const request = await db.provisionRequest.create({
      data: {
        providerCode: this.code,
        status: "ISSUED",
        tokenHash: hashToken(regToken),
        payload: JSON.stringify({ workerId: worker.id, tier: opts.tier }),
        issuedById: opts.requestedBy,
        expiresAt: new Date(Date.now() + 24 * 3600_000),
      },
    });
    const backend = env.appOrigin.replace(/\/$/, "");
    const script = kaggleCell({ backend, regToken, workerName: worker.name });
    await db.provisionRequest.update({ where: { id: request.id }, data: { script } });
    return {
      workerId: worker.id,
      artifact: script,
      instructions:
        "Paste the generated cell into a Kaggle notebook with GPU enabled and internet on, then run it. The agent registers, heartbeats and polls for commands over outbound connections only. When Kaggle terminates the notebook the worker is marked stale automatically and capacity re-provisions elsewhere.",
    };
  }

  async start(workerId: string): Promise<void> {
    await db.worker.update({ where: { id: workerId }, data: { status: "BOOTING" } });
    await createWorkerCommand(workerId, "PING", {});
  }

  async stop(workerId: string): Promise<void> {
    await createWorkerCommand(workerId, "SHUTDOWN", { reason: "ADMIN_STOP" });
    await db.worker.update({ where: { id: workerId }, data: { status: "STOPPING" } });
  }

  async restart(workerId: string): Promise<void> {
    await createWorkerCommand(workerId, "RESTART", {});
    await db.worker.update({ where: { id: workerId }, data: { status: "RESTARTING" } });
  }

  async terminate(workerId: string): Promise<void> {
    await createWorkerCommand(workerId, "SHUTDOWN", { reason: "ADMIN_TERMINATE" });
    await db.worker.update({ where: { id: workerId }, data: { status: "STOPPING" } });
  }

  async drain(workerId: string): Promise<void> {
    await createWorkerCommand(workerId, "DRAIN", {});
    await db.worker.update({ where: { id: workerId }, data: { status: "DRAINING" } });
  }

  async healthCheck(workerId: string): Promise<{ healthy: boolean; reason: string }> {
    const worker = await db.worker.findUnique({ where: { id: workerId } });
    if (!worker) return { healthy: false, reason: "NOT_FOUND" };
    if (!heartbeatFresh(worker.lastHeartbeatAt)) return { healthy: false, reason: "HEARTBEAT_STALE (notebook likely terminated; this is normal for Kaggle)" };
    return { healthy: true, reason: "OK" };
  }

  async getCapabilities(): Promise<Record<string, unknown>> {
    return {
      tiers: ["DSP_CPU", "RVC_GPU"],
      gpuOptions: "P100 or T4x2 when enabled (subject to Kaggle quotas)",
      runtime: "session-based, not persistent",
      canLoadModels: true,
      automation: this.automation,
    };
  }

  async getCost(): Promise<{ rateMilliUsdPerHour: number; notes: string }> {
    return { rateMilliUsdPerHour: 0, notes: "Kaggle GPU time is free within quotas. Commercial-use and ToS implications for serving third-party traffic are documented as an open risk in docs/10-KAGGLE-WORKER.md; review before any commercial launch." };
  }
}

function kaggleCell(opts: { backend: string; regToken: string; workerName: string }): string {
  // The cell downloads the agent from the backend (authenticated endpoint),
  // installs deps and runs it. Outbound-only: no inbound ports needed.
  return `# VoxCore Kaggle worker cell - generated ${new Date().toISOString()}
# 1) Enable GPU and Internet in the notebook settings before running.
# 2) This token is single-use for worker "${opts.workerName}".
%pip install -q requests websocket-client numpy
import os, urllib.request
os.environ["BACKEND_URL"] = "${opts.backend}"
os.environ["WORKER_REG_TOKEN"] = "${opts.regToken}"
os.environ["WORKER_NAME"] = "${opts.workerName}"
urllib.request.urlretrieve("${opts.backend}/api/worker/agent-script?token=${opts.regToken}", "worker_agent.py")
%run worker_agent.py`;
}

// Registry ---------------------------------------------------------------

export function getProvider(code: string): GpuProvider {
  switch (code) {
    case "LOCAL":
      return new LocalProvider();
    case "KAGGLE_ASSISTED":
      return new KaggleAssistedProvider();
    default:
      throw new Error(`Unknown provider: ${code}. Providers are registered in src/lib/provision.ts and documented in docs/PROVIDER-ABSTRACTION.md.`);
  }
}

export const AVAILABLE_PROVIDERS = [
  { code: "LOCAL", name: "Local machine", costKind: "FREE", automation: "AUTONOMOUS" },
  { code: "KAGGLE_ASSISTED", name: "Kaggle notebook (assisted)", costKind: "FREE", automation: "ASSISTED" },
];

// Capacity top-up hook used by the scheduler when the queue is non-empty.
export async function requestCapacityTopUp(tier: string): Promise<void> {
  const pending = await db.queueEntry.count({ where: { status: "WAITING" } });
  if (pending === 0) return;
  const decision = await import("@/lib/budget").then((m) => m.evaluateBudget({ needPaidWorker: true }));
  if (!decision.allowed) {
    await db.alert.create({
      data: {
        kind: "QUEUE_OVERLOAD",
        severity: "WARN",
        title: "Demand waiting but capacity cannot be added",
        detail: JSON.stringify({ pending, reason: decision.reason, tier }),
      },
    });
    return;
  }
  const existing = await db.alert.findFirst({
    where: { kind: "QUEUE_OVERLOAD", status: "OPEN", sourceRef: `pending:${pending >= 10 ? "10+" : pending}` },
  });
  if (!existing) {
    await db.alert.create({
      data: {
        kind: "QUEUE_OVERLOAD",
        severity: "WARN",
        title: `${pending} session(s) waiting, no eligible worker online`,
        detail: JSON.stringify({ tier, suggestion: "Provision a worker from the admin Workers tab or start a local agent" }),
        sourceRef: `pending:${pending >= 10 ? "10+" : pending}`,
      },
    });
  }
}
