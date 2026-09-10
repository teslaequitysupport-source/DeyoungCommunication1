import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { wrap, jsonOk } from "@/lib/http";
import { authenticateWorker } from "@/lib/worker-auth";
import { workerEventSchema } from "@/lib/validate";

// Worker log/event shipping for the admin fleet view.

export const POST = wrap(
  async (req: NextRequest) => {
    const identity = await authenticateWorker(req);
    const body = workerEventSchema.parse(await req.json());
    await db.workerEvent.create({
      data: {
        workerId: identity.id,
        level: body.level,
        kind: body.kind,
        message: body.message,
        data: body.data ? JSON.stringify(body.data) : null,
      },
    });
    return jsonOk({ ok: true });
  },
  { rule: "workerHeartbeat", skipMetrics: true }
);
