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

export async function pendingCommands(workerId: string, limit = 10) {
  const cmds = await db.workerCommand.findMany({
    where: { workerId, status: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  // Expire stale commands (older than 10 minutes) so the queue never wedges.
  const cutoff = new Date(Date.now() - 10 * 60_000);
  const stale = cmds.filter((c) => c.createdAt < cutoff);
  if (stale.length > 0) {
    await db.workerCommand.updateMany({
      where: { id: { in: stale.map((c) => c.id) } },
      data: { status: "EXPIRED" },
    });
  }
  return cmds.filter((c) => c.createdAt >= cutoff);
}
