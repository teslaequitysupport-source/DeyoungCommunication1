import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { wrap, jsonOk } from "@/lib/http";
import { requireAdmin, clientMeta } from "@/lib/auth";
import { adminWorkerActionSchema } from "@/lib/validate";
import { notFound } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { getProvider } from "@/lib/provision";
import { createWorkerCommand } from "@/lib/worker-commands";

// Worker detail + lifecycle actions. Actions map to the provider abstraction;
// for the assisted Kaggle provider "restart/stop" are commands the agent
// honors when it is alive, and the UI labels reflect that honestly.

export const GET = wrap(
  async (_req, ctx: { params: Promise<Record<string, string>> }) => {
    const { id } = await ctx.params;
    await requireAdmin();
    const worker = await db.worker.findUnique({
      where: { id },
      include: {
        heartbeats: { orderBy: { createdAt: "desc" }, take: 40 },
        events: { orderBy: { createdAt: "desc" }, take: 60 },
        commands: { orderBy: { createdAt: "desc" }, take: 30 },
        workerSessions: { orderBy: { assignedAt: "desc" }, take: 20, include: { session: { select: { id: true, status: true, userId: true } } } },
      },
    });
    if (!worker) throw notFound("Worker not found");
    return jsonOk({
      worker: {
        ...worker,
        tiers: JSON.parse(worker.tiers || "[]"),
        capabilities: JSON.parse(worker.capabilities || "{}"),
        loadedModels: JSON.parse(worker.loadedModels || "[]"),
        heartbeats: worker.heartbeats,
        events: worker.events,
        commands: worker.commands.map((c) => ({ ...c, payload: c.payload ? JSON.parse(c.payload) : null, result: c.result ? JSON.parse(c.result) : null })),
        assignments: worker.workerSessions,
      },
    });
  },
  { rule: "apiRead" }
);

export const POST = wrap(
  async (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => {
    const { id } = await ctx.params;
    const admin = await requireAdmin();
    const body = adminWorkerActionSchema.parse(await req.json());
    const worker = await db.worker.findUnique({ where: { id } });
    if (!worker) throw notFound("Worker not found");

    const provider = getProvider(worker.providerCode);
    const meta = await clientMeta();

    switch (body.action) {
      case "drain":
        await provider.drain(id);
        break;
      case "quarantine":
        await db.worker.update({ where: { id }, data: { status: "QUARANTINED", notes: `${worker.notes ?? ""}\nQuarantined: ${body.reason ?? "no reason given"}`.trim() } });
        break;
      case "restart":
        await provider.restart(id);
        break;
      case "stop":
        await provider.stop(id);
        break;
      case "activate":
        await db.worker.update({ where: { id }, data: { status: "IDLE" } });
        break;
      case "ping":
        await createWorkerCommand(id, "PING", {});
        break;
    }
    await audit({
      actorId: admin.id, actorRole: "ADMIN", action: `WORKER_${body.action.toUpperCase()}`,
      targetType: "Worker", targetId: id, before: { status: worker.status }, reason: body.reason ?? null, ip: meta.ip,
    });
    return jsonOk({ ok: true, action: body.action });
  },
  { rule: "adminWrite" }
);
