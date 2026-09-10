import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { wrap, jsonOk } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { sessionMetricsSchema } from "@/lib/validate";
import { notFound, forbidden } from "@/lib/errors";
import { meterSession } from "@/app/api/sessions/[id]/end/route";

// Client-reported latency/packet metrics for a finished or ending session.
// Stored on the session row and surfaced in the dashboard and admin views.

export const POST = wrap(
  async (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => {
    const { id } = await ctx.params;
    const user = await requireUser();
    const session = await db.conversionSession.findUnique({ where: { id } });
    if (!session) throw notFound();
    if (session.userId !== user.id && user.role === "USER") throw forbidden();
    const body = sessionMetricsSchema.parse(await req.json());
    await db.conversionSession.update({
      where: { id },
      data: { metrics: JSON.stringify(body), audioSeconds: session.audioSeconds || (session.durationSec ?? 0) },
    });
    await meterSession(id);
    return jsonOk({ ok: true });
  },
  { rule: "apiWrite" }
);
