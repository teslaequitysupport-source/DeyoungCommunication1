import { db } from "@/lib/db";
import { randomToken, hashToken, hmac, safeEqual } from "@/lib/crypto";
import { env } from "@/lib/env";
import { ApiError, unauthorized } from "@/lib/errors";

// Worker authentication and command channel helpers.
//
// Registration: a one-time registration token (issued by an admin or a
// provisioning request) is exchanged for a persistent worker token. Only the
// token hash is stored. Critical worker operations may additionally carry an
// HMAC over the raw body using the raw token as the secret (x-signature).

export async function issueWorkerToken(workerId: string): Promise<string> {
  const token = env.workerTokenPrefix + randomToken(32);
  await db.worker.update({
    where: { id: workerId },
    data: { tokenHash: hashToken(token), tokenRotatedAt: new Date() },
  });
  return token;
}

export interface WorkerIdentity {
  id: string;
  name: string;
  providerCode: string;
  costKind: string;
  status: string;
  tiers: string[];
  capabilities: Record<string, unknown>;
}

export async function authenticateWorker(req: Request): Promise<WorkerIdentity> {
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) throw unauthorized("Worker token required");
  const worker = await db.worker.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!worker) {
    const { securityEvent } = await import("@/lib/audit");
    await securityEvent({ kind: "WORKER_AUTH_FAILED", severity: "WARN", detail: { tokenPrefix: token.slice(0, 8) } });
    throw unauthorized("Invalid worker token");
  }
  if (["STOPPED", "QUARANTINED"].includes(worker.status)) {
    throw new ApiError(403, "WORKER_HALTED", "Worker is stopped or quarantined");
  }
  return {
    id: worker.id,
    name: worker.name,
    providerCode: worker.providerCode,
    costKind: worker.costKind,
    status: worker.status,
    tiers: JSON.parse(worker.tiers || "[]"),
    capabilities: JSON.parse(worker.capabilities || "{}"),
  };
}

export async function verifyWorkerSignature(req: Request, rawBody: string, workerToken: string): Promise<boolean> {
  const sig = req.headers.get("x-signature") || "";
  if (!sig) return false;
  return safeEqual(sig, hmac(workerToken, rawBody));
}
