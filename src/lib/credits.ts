import { db } from "@/lib/db";
import { conflict } from "@/lib/errors";

// Credit ledger. The backend is authoritative for balances: every mutation is a
// ledger row with a resulting balance, and optional idempotency keys make
// retries safe (no double grants, no double charges).

export async function creditBalance(userId: string): Promise<number> {
  const last = await db.creditLedgerEntry.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { balanceAfterCents: true },
  });
  return last?.balanceAfterCents ?? 0;
}

export async function applyCredits(input: {
  userId: string;
  deltaCents: number;
  reason: string;
  refType?: string;
  refId?: string;
  actorId?: string;
  note?: string;
  idempotencyKey?: string;
}): Promise<{ balanceAfterCents: number; applied: boolean }> {
  if (input.idempotencyKey) {
    const existing = await db.creditLedgerEntry.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) {
      return { balanceAfterCents: existing.balanceAfterCents, applied: false };
    }
  }
  const current = await creditBalance(input.userId);
  const balanceAfterCents = current + input.deltaCents;
  if (balanceAfterCents < 0) {
    throw conflict("Insufficient credits for this operation");
  }
  await db.creditLedgerEntry.create({
    data: {
      userId: input.userId,
      deltaCents: input.deltaCents,
      balanceAfterCents,
      reason: input.reason,
      refType: input.refType ?? null,
      refId: input.refId ?? null,
      actorId: input.actorId ?? null,
      note: input.note ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
    },
  });
  return { balanceAfterCents, applied: true };
}

// Consume usage cost from credits; tolerance: allows going to exactly zero.
export async function consumeCredits(input: {
  userId: string;
  costCents: number;
  refType: string;
  refId: string;
  idempotencyKey: string;
  note?: string;
}): Promise<{ balanceAfterCents: number; applied: boolean }> {
  if (input.costCents <= 0) {
    const balance = await creditBalance(input.userId);
    return { balanceAfterCents: balance, applied: false };
  }
  return applyCredits({
    userId: input.userId,
    deltaCents: -input.costCents,
    reason: "SESSION_USAGE",
    refType: input.refType,
    refId: input.refId,
    idempotencyKey: input.idempotencyKey,
    note: input.note,
  });
}
