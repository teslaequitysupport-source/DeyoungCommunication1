import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { wrap, jsonOk } from "@/lib/http";
import { authenticateWorker } from "@/lib/worker-auth";
import { pendingCommands } from "@/lib/worker-commands";

// Command poll. Workers pull pending commands over outbound connections only
// (Kaggle notebooks and most GPU sandboxes cannot accept inbound traffic).
// Commands are marked DELIVERED on handoff; results arrive via the result
// endpoint keyed by command id.

export const GET = wrap(
  async (req: NextRequest) => {
    const identity = await authenticateWorker(req);
    const cmds = await pendingCommands(identity.id);
    if (cmds.length > 0) {
      await db.workerCommand.updateMany({
        where: { id: { in: cmds.map((c) => c.id) } },
        data: { status: "DELIVERED", deliveredAt: new Date() },
      });
    }
    return jsonOk({
      commands: cmds.map((c) => ({
        id: c.id,
        kind: c.kind,
        payload: c.payload ? JSON.parse(c.payload) : {},
        createdAt: c.createdAt,
      })),
    });
  },
  { rule: "workerHeartbeat", skipMetrics: true }
);
