import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { wrap, jsonOk } from "@/lib/http";
import { workerRegisterSchema } from "@/lib/validate";
import { hashToken, randomToken } from "@/lib/crypto";
import { env } from "@/lib/env";
import { badRequest } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { issueWorkerToken } from "@/lib/worker-auth";

// Worker registration. Requires a one-time registration token that an admin
// provision request issued. Arbitrary unauthenticated registration is
// impossible by design (directive 51). The registration token is consumed and
// a persistent worker token is returned exactly once.

export const POST = wrap(
  async (req: NextRequest) => {
    const body = workerRegisterSchema.parse(await req.json());

    const request = await db.provisionRequest.findUnique({ where: { tokenHash: hashToken(body.regToken) } });
    if (!request || request.status !== "ISSUED" || request.expiresAt < new Date()) {
      throw badRequest("Invalid, expired or already-used registration token");
    }

    const payload = JSON.parse(request.payload || "{}") as { workerId?: string };
    let workerId = payload.workerId;

    if (workerId) {
      const existing = await db.worker.findUnique({ where: { id: workerId } });
      if (!existing) throw badRequest("Provisioned worker no longer exists");
      await db.worker.update({
        where: { id: workerId },
        data: {
          name: body.name || existing.name,
          region: body.region ?? existing.region,
          gpuName: body.gpuName ?? null,
          vramMb: body.vramMb ?? null,
          ramMb: body.ramMb ?? null,
          cpuCores: body.cpuCores ?? null,
          os: body.os ?? null,
          cudaVersion: body.cudaVersion ?? null,
          pythonVersion: body.pythonVersion ?? null,
          agentVersion: body.agentVersion ?? null,
          tiers: JSON.stringify(body.tiers),
          capabilities: JSON.stringify(body.capabilities),
          maxSessions: body.maxSessions,
          status: "READY",
          startedAt: new Date(),
          lastError: null,
        },
      });
    } else {
      const worker = await db.worker.create({
        data: {
          name: body.name || `worker-${randomToken(4)}`,
          providerCode: request.providerCode,
          tokenHash: hashToken(randomToken(12)), // replaced below by issueWorkerToken
          costKind: request.providerCode === "LOCAL" || request.providerCode === "KAGGLE_ASSISTED" ? "FREE" : "PAID",
          region: body.region ?? null,
          gpuName: body.gpuName ?? null,
          vramMb: body.vramMb ?? null,
          ramMb: body.ramMb ?? null,
          cpuCores: body.cpuCores ?? null,
          os: body.os ?? null,
          cudaVersion: body.cudaVersion ?? null,
          pythonVersion: body.pythonVersion ?? null,
          agentVersion: body.agentVersion ?? null,
          tiers: JSON.stringify(body.tiers),
          capabilities: JSON.stringify(body.capabilities),
          maxSessions: body.maxSessions,
          status: "READY",
          managedById: request.issuedById,
          startedAt: new Date(),
        },
      });
      workerId = worker.id;
    }

    await db.provisionRequest.update({
      where: { id: request.id },
      data: { status: "ASSUMED", assumedById: workerId, resolvedAt: new Date() },
    });
    await db.workerEvent.create({
      data: {
        workerId,
        level: "INFO",
        kind: "REGISTERED",
        message: `Worker registered via ${request.providerCode} provision request`,
        data: JSON.stringify({ tiers: body.tiers, agentVersion: body.agentVersion }),
      },
    });

    const token = await issueWorkerToken(workerId);
    await audit({ actorId: workerId, actorRole: "WORKER", action: "WORKER_REGISTERED", targetType: "Worker", targetId: workerId, after: { provider: request.providerCode, tiers: body.tiers } });

    return jsonOk({
      ok: true,
      workerId,
      workerToken: token, // shown once; only the SHA-256 hash is stored server-side
      heartbeatIntervalSec: 20,
      commandsPath: "/api/worker/commands",
      audioSampleRate: env.audioSampleRate,
      chunkMs: env.audioChunkMs,
    });
  },
  { rule: "workerRegister" }
);
