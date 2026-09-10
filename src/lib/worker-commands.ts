import { db } from "@/lib/db";

// Command queue between the control plane and workers. Workers poll
// GET /api/worker/commands and acknowledge results. Outbound-only connectivity:
// no inbound ports are ever required from workers (Kaggle notebooks cannot
// accept inbound connections; this design assumption is documented in
// docs/12-WORKER-PROTOCOL.md).

export type CommandKind =
  | "PING"
  | "LOAD_MODEL"
  | "EVICT_MODEL"
  | "START_SESSION"
  | "STOP_SESSION"
  | "RESTART"
  | "DRAIN"
  | "SHUTDOWN"
  | "TEST_JOB";

export async function createWorkerCommand(
  workerId: string,
  kind: CommandKind,
  payload: Record<string, unknown>
): Promise<string> {
  const cmd = await db.workerCommand.create({
    data: {
      workerId,
      kind,
      payload: JSON.stringify(payload),
    },
  });
  await db.workerEvent.create({
    data: {
      workerId,
      level: "INFO",
      kind: "COMMAND_ISSUED",
      message: `${kind} command queued`,
      data: JSON.stringify({ commandId: cmd.id }),
    },
  });
  return cmd.id;
}

// Delivery semantics: at-least-once within a bounded lifetime. A command is
// DELIVERED on handoff and COMPLETED when the worker posts its result. If the
// poll response or the result POST is lost, a DELIVERED command with no
// completion is redelivered after REDELIVER_AFTER_MS. Anything unresolved
// after 10 minutes is EXPIRED so the queue can never wedge. Workers make
// command handlers idempotent (e.g. START_SESSION ignores an already-running
// session) because at-least-once delivery can repeat work.
const REDELIVER_AFTER_MS = 30_000;
const COMMAND_LIFETIME_MS = 10 * 60_000;

export async function pendingCommands(workerId: string, limit = 10) {
  const now = new Date();
  const lifetimeCutoff = new Date(now.getTime() - COMMAND_LIFETIME_MS);
  const redeliveryCutoff = new Date(now.getTime() - REDELIVER_AFTER_MS);

  // Expire commands that were never resolved within their lifetime (covers
  // both never-delivered PENDING and DELIVERED-but-never-acked).
  await db.workerCommand.updateMany({
    where: {
      workerId,
      status: { in: ["PENDING", "DELIVERED"] },
      createdAt: { lt: lifetimeCutoff },
      completedAt: null,
    },
    data: { status: "EXPIRED" },
  });

  // PENDING commands, plus DELIVERED commands whose result never arrived
  // within the redelivery window (lost response or lost ack).
  const cmds = await db.workerCommand.findMany({
    where: {
      workerId,
      OR: [
        { status: "PENDING" },
        { status: "DELIVERED", deliveredAt: { lt: redeliveryCutoff } },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  if (cmds.length > 0) {
    await db.workerCommand.updateMany({
      where: { id: { in: cmds.map((c) => c.id) } },
      data: { status: "DELIVERED", deliveredAt: now },
    });
  }
  return cmds;
}
