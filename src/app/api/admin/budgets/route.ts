import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { wrap, jsonOk } from "@/lib/http";
import { requireAdmin, clientMeta } from "@/lib/auth";
import { budgetSchema } from "@/lib/validate";
import { audit } from "@/lib/audit";

// Budget policy management. Policies are enforced live by the scheduler and
// the maintenance loop (emergency stop applies within one sweep, 30s max).

export const GET = wrap(
  async () => {
    await requireAdmin();
    const [policies, today, thisMonth] = await Promise.all([
      db.budgetPolicy.findMany({ orderBy: { createdAt: "asc" } }),
      db.costRecord.aggregate({ where: { day: new Date().toISOString().slice(0, 10) }, _sum: { costCents: true } }),
      db.costRecord.aggregate({ where: { month: new Date().toISOString().slice(0, 7) }, _sum: { costCents: true } }),
    ]);
    return jsonOk({
      policies,
      spend: { todayCents: today._sum.costCents ?? 0, monthCents: thisMonth._sum.costCents ?? 0 },
    });
  },
  { rule: "apiRead" }
);

export const PUT = wrap(
  async (req: NextRequest) => {
    const admin = await requireAdmin();
    const body = budgetSchema.parse(await req.json());
    const meta = await clientMeta();

    if (body.scope === "PROVIDER" && body.providerCode) {
      const existing = await db.budgetPolicy.findFirst({ where: { scope: "PROVIDER", providerCode: body.providerCode } });
      if (existing) {
        await db.budgetPolicy.update({ where: { id: existing.id }, data: pickBudget(body) });
      } else {
        await db.budgetPolicy.create({ data: { scope: "PROVIDER", providerCode: body.providerCode, ...pickBudget(body) } });
      }
    } else {
      const global = await db.budgetPolicy.findFirst({ where: { scope: "GLOBAL" } });
      if (global) {
        await db.budgetPolicy.update({ where: { id: global.id }, data: pickBudget(body) });
      } else {
        await db.budgetPolicy.create({ data: { scope: "GLOBAL", ...pickBudget(body) } });
      }
    }
    await audit({ actorId: admin.id, actorRole: "ADMIN", action: "BUDGET_POLICY_UPDATED", targetType: "BudgetPolicy", targetId: body.providerCode ?? "GLOBAL", after: body, ip: meta.ip });
    return jsonOk({ ok: true });
  },
  { rule: "adminWrite" }
);

function pickBudget(b: { dailyBudgetCents?: number | null; monthlyBudgetCents?: number | null; maxConcurrentPaidWorkers?: number | null; maxPaidSessions?: number | null; onThreshold?: string; emergencyStop?: boolean }) {
  return {
    dailyBudgetCents: b.dailyBudgetCents ?? null,
    monthlyBudgetCents: b.monthlyBudgetCents ?? null,
    maxConcurrentPaidWorkers: b.maxConcurrentPaidWorkers ?? null,
    maxPaidSessions: b.maxPaidSessions ?? null,
    onThreshold: b.onThreshold ?? "WARN",
    emergencyStop: b.emergencyStop ?? false,
  };
}
