import { db } from "@/lib/db";

// Budget guard: real costs accrue only from PAID providers. FREE providers
// (LOCAL, KAGGLE_ASSISTED) never create CostRecord debt, but paid worker counts
// and paid session counts are still limited. All values are admin policy
// (BudgetPolicy rows). If a threshold is hit the configured response is applied:
// WARN (allow, alert), QUEUE_ONLY (no new paid capacity), EMERGENCY_STOP.

export interface BudgetDecision {
  allowed: boolean;
  reason: string;
  policy: {
    onThreshold: string;
    emergencyStop: boolean;
    dailyBudgetCents: number | null;
    monthlyBudgetCents: number | null;
    maxConcurrentPaidWorkers: number | null;
    maxPaidSessions: number | null;
  } | null;
}

function day(): string {
  return new Date().toISOString().slice(0, 10);
}
function month(): string {
  return new Date().toISOString().slice(0, 7);
}

export async function evaluateBudget(opts: { needPaidWorker?: boolean; needPaidSession?: boolean; providerCode?: string }): Promise<BudgetDecision> {
  const globalPolicy = await db.budgetPolicy.findFirst({ where: { scope: "GLOBAL" } });
  const providerPolicy = opts.providerCode
    ? await db.budgetPolicy.findFirst({ where: { scope: "PROVIDER", providerCode: opts.providerCode } })
    : null;
  const policy = providerPolicy ?? globalPolicy;

  if (globalPolicy?.emergencyStop) {
    return {
      allowed: false,
      reason: "EMERGENCY_STOP active: an administrator has halted paid capacity",
      policy: {
        onThreshold: globalPolicy.onThreshold,
        emergencyStop: true,
        dailyBudgetCents: null,
        monthlyBudgetCents: null,
        maxConcurrentPaidWorkers: null,
        maxPaidSessions: null,
      },
    };
  }
  if (!policy) return { allowed: true, reason: "NO_POLICY", policy: null };

  const today = await db.costRecord.aggregate({ where: { day: day() }, _sum: { costCents: true } });
  const thisMonth = await db.costRecord.aggregate({ where: { month: month() }, _sum: { costCents: true } });

  if (policy.dailyBudgetCents !== null && (today._sum.costCents ?? 0) >= policy.dailyBudgetCents) {
    return respond(policy, `Daily budget reached (${today._sum.costCents ?? 0}/${policy.dailyBudgetCents} cents)`);
  }
  if (policy.monthlyBudgetCents !== null && (thisMonth._sum.costCents ?? 0) >= policy.monthlyBudgetCents) {
    return respond(policy, `Monthly budget reached (${thisMonth._sum.costCents ?? 0}/${policy.monthlyBudgetCents} cents)`);
  }

  if (opts.needPaidWorker && policy.maxConcurrentPaidWorkers !== null) {
    const activePaid = await db.worker.count({
      where: { costKind: "PAID", status: { in: ["BOOTING", "LOADING_MODEL", "WARMING", "READY", "ACTIVE", "IDLE"] } },
    });
    if (activePaid >= policy.maxConcurrentPaidWorkers) {
      return respond(policy, `Paid worker cap reached (${activePaid}/${policy.maxConcurrentPaidWorkers})`);
    }
  }
  if (opts.needPaidSession && policy.maxPaidSessions !== null) {
    const activePaidSessions = await db.conversionSession.count({
      where: { status: { in: ["QUEUED", "ASSIGNING", "CONNECTING", "ACTIVE"] }, isTest: false, assignments: { some: { worker: { costKind: "PAID" } } } },
    });
    if (activePaidSessions >= policy.maxPaidSessions) {
      return respond(policy, `Paid session cap reached (${activePaidSessions}/${policy.maxPaidSessions})`);
    }
  }
  return { allowed: true, reason: "OK", policy: null };
}

function respond(policy: { onThreshold: string; emergencyStop: boolean; dailyBudgetCents: number | null; monthlyBudgetCents: number | null; maxConcurrentPaidWorkers: number | null; maxPaidSessions: number | null }, reason: string): BudgetDecision {
  return {
    allowed: policy.onThreshold === "WARN",
    reason,
    policy,
  };
}

// Called by the metering path whenever a CostRecord is appended: raises an alert
// when spend crosses 80 percent of an active budget.
export async function checkBudgetThresholds(): Promise<void> {
  const policies = await db.budgetPolicy.findMany();
  const today = await db.costRecord.aggregate({ where: { day: day() }, _sum: { costCents: true } });
  const thisMonth = await db.costRecord.aggregate({ where: { month: month() }, _sum: { costCents: true } });
  for (const p of policies) {
    if (p.dailyBudgetCents && (today._sum.costCents ?? 0) >= p.dailyBudgetCents * 0.8) {
      await raiseBudgetAlertOnce(`daily-${day()}`, "BUDGET_THRESHOLD", `Daily spend at ${today._sum.costCents ?? 0} of ${p.dailyBudgetCents} cents`);
    }
    if (p.monthlyBudgetCents && (thisMonth._sum.costCents ?? 0) >= p.monthlyBudgetCents * 0.8) {
      await raiseBudgetAlertOnce(`monthly-${month()}`, "BUDGET_THRESHOLD", `Monthly spend at ${thisMonth._sum.costCents ?? 0} of ${p.monthlyBudgetCents} cents`);
    }
  }
}

async function raiseBudgetAlertOnce(dedupeRef: string, kind: string, title: string) {
  const existing = await db.alert.findFirst({
    where: { kind, sourceRef: dedupeRef, status: { in: ["OPEN", "ACK"] } },
  });
  if (existing) return;
  await db.alert.create({ data: { kind, severity: "WARN", title, sourceRef: dedupeRef } });
}
