import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { wrap, jsonOk } from "@/lib/http";
import { unauthorized } from "@/lib/errors";
import { safeEqual } from "@/lib/crypto";
import { env } from "@/lib/env";
import { meterSession } from "@/app/api/sessions/[id]/end/route";

// Internal endpoint: only the audio gateway calls it, authenticated by the
// shared gateway secret. It records measured transport metrics onto the
// session and applies metering for the elapsed period.

export const POST = wrap(
  async (req: NextRequest) => {
    const secret = req.headers.get("x-gateway-secret") || "";
    if (!secret || !safeEqual(secret, env.gatewaySecret)) {
      throw unauthorized("Gateway secret mismatch");
    }
    const body = (await req.json()) as {
      sessionId: string;
      endReason: string;
      p50Ms: number;
      p95Ms: number;
      packetsSent: number;
      packetsReceived: number;
      dropsPct: number;
    };
    if (!body.sessionId) return jsonOk({ ok: false });

    const session = await db.conversionSession.findUnique({ where: { id: body.sessionId } });
    if (!session) return jsonOk({ ok: false, note: "unknown session" });

    const audioSeconds = body.packetsReceived * (env.audioChunkMs / 1000);
    await db.conversionSession.update({
      where: { id: body.sessionId },
      data: {
        metrics: JSON.stringify({
          p50Ms: body.p50Ms,
          p95Ms: body.p95Ms,
          packetsSent: body.packetsSent,
          packetsReceived: body.packetsReceived,
          dropsPct: body.dropsPct,
        }),
        audioSeconds: Math.max(session.audioSeconds, audioSeconds),
      },
    }).catch(() => {});
    await meterSession(body.sessionId);
    return jsonOk({ ok: true });
  },
  { rule: "apiWrite", skipOriginCheck: true }
);
