import { db } from "@/lib/db";
import { wrap, jsonOk } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { creditBalance } from "@/lib/credits";
import { usageSummary, planLimitsFor } from "@/lib/metering";

export const GET = wrap(
  async () => {
    const user = await requireUser();
    const [balance, usage, limits, recent] = await Promise.all([
      creditBalance(user.id),
      usageSummary(user.id),
      planLimitsFor(user.id),
      db.creditLedgerEntry.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 15 }),
    ]);
    return jsonOk({
      balanceCents: balance,
      usage,
      limits,
      ledger: recent.map((e) => ({
        id: e.id,
        deltaCents: e.deltaCents,
        balanceAfterCents: e.balanceAfterCents,
        reason: e.reason,
        note: e.note,
        createdAt: e.createdAt,
      })),
      // Charging is deferred by product decision: no PSP is wired. Credits are
      // administratively granted and consumed by real usage metering.
      chargingNote: "Real payment processing is not enabled in this deployment. Credits are administratively granted and consumed by measured usage. A payment provider adapter will plug into these same ledger interfaces.",
    });
  },
  { rule: "apiRead" }
);
