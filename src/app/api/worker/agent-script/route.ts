import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { wrap } from "@/lib/http";
import { hashToken } from "@/lib/crypto";
import { badRequest } from "@/lib/errors";
import fs from "fs";
import path from "path";

// Serves the Python worker agent source to a holder of a valid, unused
// registration token. This is how KaggleAssistedProvider notebook cells fetch
// the agent without any other credentials. The response is the raw Python
// file from worker-agent/worker_agent.py on disk.

export const GET = wrap(
  async (req: NextRequest) => {
    const token = new URL(req.url).searchParams.get("token") || "";
    if (!token) return new Response("token required", { status: 400 });
    const request = await db.provisionRequest.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!request || request.status !== "ISSUED" || request.expiresAt < new Date()) {
      return new Response("invalid or expired registration token", { status: 403 });
    }
    const file = path.join(process.cwd(), "worker-agent", "worker_agent.py");
    let code: string;
    try {
      code = fs.readFileSync(file, "utf8");
    } catch {
      return new Response("agent bundle unavailable", { status: 500 });
    }
    return new Response(code, {
      status: 200,
      headers: {
        "content-type": "text/x-python; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  },
  { rule: "workerRegister", skipOriginCheck: true }
);
