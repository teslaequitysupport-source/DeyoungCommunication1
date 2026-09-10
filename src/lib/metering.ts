import { db } from "@/lib/db";

// Metering: the backend is the single source of truth for usage and cost.
// UsageRecord rows power user-facing usage views and plan enforcement.
// CostRecord rows power infrastructure cost views and budget policies.

export async function recordUsage(input: {
  userId: string;
  sessionId?: string;
  workerId?: string;
  modelId?: string;
  kind: "SESSION_MINUTES" | "AUDIO_SECONDS" | "GPU_MILLI_HOURS" | "STORAGE_MB";
  quantity: number;
  rateMilliUsd: number;
}): Promise<number> {
  const costCents = Math.round((input.quantity * input.rateMilliUsd) / 10); // milli-USD * qty -> cents
  await db.usageRecord.create({
    data: {
      userId: input.userId,
      sessionId: input.sessionId ?? null,
      workerId: input.workerId ?? null,
      modelId: input.modelId ?? null,
      kind: input.kind,
      quantity: input.quantity,
      rateMilliUsd: input.rateMilliUsd,
      costCents,
    },
  });
  return costCents;
}

export async function recordInfrastructureCost(input: {
  workerId?: string;
  sessionId?: string;
  providerCode: string;
  gpuMilliHours: number;
  rateMilliUsdPerHour: number;
}): Promise<number> {
  const costCents = Math.round((input.gpuMilliHours * input.rateMilliUsdPerHour) / 1000);
  if (costCents === 0) return 0; // free providers never create cost rows
  await db.costRecord.create({
    data: {
      workerId: input.workerId ?? null,
      sessionId: input.sessionId ?? null,
      providerCode: input.providerCode,
      gpuMilliHours: input.gpuMilliHours,
      rateMilliUsdPerHour: input.rateMilliUsdPerHour,
      costCents,
      day: new Date().toISOString().slice(0, 10),
      month: new Date().toISOString().slice(0, 7),
    },
  });
  return costCents;
}

export async function usageSummary(userId: string) {
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [today, thisMonth, totals] = await Promise.all([
    db.usageRecord.aggregate({
      where: { userId, kind: "SESSION_MINUTES", createdAt: { gte: dayStart } },
      _sum: { quantity: true },
    }),
    db.usageRecord.aggregate({
      where: { userId, kind: "SESSION_MINUTES", createdAt: { gte: monthStart } },
      _sum: { quantity: true },
    }),
    db.usageRecord.aggregate({
      where: { userId },
      _sum: { quantity: true, costCents: true },
    }),
  ]);

  return {
    minutesToday: today._sum.quantity ?? 0,
    minutesThisMonth: thisMonth._sum.quantity ?? 0,
    totalMinutes: totals._sum.quantity ?? 0,
    totalCostCents: totals._sum.costCents ?? 0,
  };
}

// Plan limit checks for the dashboard and enforcement points.
export async function planLimitsFor(userId: string) {
  const sub = await db.subscription.findUnique({ where: { userId }, include: { plan: true } });
  if (!sub) return null;
  return {
    planCode: sub.plan.code,
    planName: sub.plan.name,
    maxConcurrentSessions: sub.plan.maxConcurrentSessions,
    maxMinutesPerDay: sub.plan.maxMinutesPerDay,
    maxMinutesPerMonth: sub.plan.maxMinutesPerMonth,
    maxModelUploads: sub.plan.maxModelUploads,
    monthlyFreeCreditCents: sub.plan.monthlyFreeCreditCents,
    priority: sub.plan.priority,
    allowedTiers: JSON.parse(sub.plan.allowedTiers || "[]") as string[],
    status: sub.status,
  };
}
