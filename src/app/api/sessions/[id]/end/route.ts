import { wrap, jsonOk } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { endSession } from "@/lib/scheduler";
import { notFound, forbidden } from "@/lib/errors";
import { db } from "@/lib/db";

// User-initiated session end. Metering for the elapsed period is applied here
// and by the gateway metrics endpoint when it arrives first.

export const POST = wrap(
  async (_req, ctx: { params: Promise<Record<string, string>> }) => {
    const { id } = await ctx.params;
    const user = await requireUser();
    const session = await db.conversionSession.findUnique({ where: { id } });
    if (!session) throw notFound();
    if (session.userId !== user.id && user.role === "USER") throw forbidden();

    await endSession(id, "USER_ENDED", "USER");
    await meterSession(id);
    return jsonOk({ ok: true });
  },
  { rule: "apiWrite" }
);

export async function meterSession(sessionId: string): Promise<void> {
  const session = await db.conversionSession.findUnique({ where: { id: sessionId } });
  if (!session || !session.durationSec) return;
  const minutes = session.durationSec / 60;
  const { recordUsage } = await import("@/lib/metering");
  const { consumeCredits } = await import("@/lib/credits");
  // Rate: 0 for DSP tier (no GPU cost), provider rate applies for GPU tiers.
  let rateMilli = 0;
  if (session.resolvedTier === "RVC_GPU") {
    const assignment = await db.workerSessionAssignment.findFirst({ where: { sessionId }, include: { worker: true } });
    const provider = assignment ? await db.provider.findUnique({ where: { code: assignment.worker.providerCode } }) : null;
    rateMilli = provider?.rateMilliUsdPerHour ?? 0;
  }
  const costCents = await recordUsage({
    userId: session.userId,
    sessionId,
    modelId: session.modelId,
    kind: "SESSION_MINUTES",
    quantity: Math.round(minutes * 100) / 100,
    rateMilliUsd: rateMilli / 60, // per-minute rate
  });
  if (costCents > 0) {
    await consumeCredits({
      userId: session.userId,
      costCents,
      refType: "ConversionSession",
      refId: sessionId,
      idempotencyKey: `session-minutes:${sessionId}`,
    });
  }
}
