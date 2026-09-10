import { db } from "@/lib/db";
import { wrap, jsonOk } from "@/lib/http";

// Public plan listing. Prices stay null until the infrastructure cost model
// produces defensible numbers (directive 44: do not invent final prices).

export const GET = wrap(
  async () => {
    const plans = await db.plan.findMany({
      where: { isActive: true },
      orderBy: { sort: "asc" },
      select: {
        code: true, name: true, priceCents: true, currency: true, billingPeriod: true,
        maxConcurrentSessions: true, maxMinutesPerDay: true, maxMinutesPerMonth: true,
        maxModelUploads: true, monthlyFreeCreditCents: true, priority: true,
        allowedTiers: true, description: true,
      },
    });
    return jsonOk({
      plans: plans.map((p) => ({ ...p, allowedTiers: JSON.parse(p.allowedTiers || "[]") })),
      pricingNote: "Pricing is not published yet. Final prices require the measured GPU cost model (see docs/28-COST-MODEL.md). Everything else about each plan is real and enforced server-side.",
    });
  },
  { rule: "apiRead" }
);
