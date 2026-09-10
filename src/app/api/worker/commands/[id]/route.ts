import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { wrap, jsonOk } from "@/lib/http";
import { authenticateWorker } from "@/lib/worker-auth";
import { badRequest, notFound } from "@/lib/errors";

// Command result acknowledgement from a worker.

export const POST = wrap(
  async (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => {
    const { id } = await ctx.params;
    const identity = await authenticateWorker(req);
    const body = (await req.json().catch(() => ({}))) as { ok?: boolean; result?: unknown; error?: string };

    const cmd = await db.workerCommand.findUnique({ where: { id } });
    if (!cmd || cmd.workerId !== identity.id) throw notFound("Command not found");
    if (cmd.status === "COMPLETED") return jsonOk({ ok: true, duplicate: true });

    await db.workerCommand.update({
      where: { id },
      data: {
        status: body.ok ? "COMPLETED" : "FAILED",
        completedAt: new Date(),
        result: JSON.stringify({ ok: !!body.ok, result: body.result ?? null, error: body.error ?? null }),
      },
    });
    if (!body.ok) {
      await db.workerEvent.create({
        data: {
          workerId: identity.id,
          level: "ERROR",
          kind: `COMMAND_FAILED_${cmd.kind}`,
          message: body.error?.slice(0, 500) || "Command failed on worker",
          data: cmd.payload,
        },
      });
    }
    return jsonOk({ ok: true });
  },
  { rule: "workerHeartbeat", skipMetrics: true }
);
