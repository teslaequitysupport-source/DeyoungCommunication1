import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { wrap, jsonOk } from "@/lib/http";
import { requireAdmin, clientMeta } from "@/lib/auth";
import { planPatchSchema } from "@/lib/validate";
import { audit } from "@/lib/audit";
import { notFound, badRequest } from "@/lib/errors";

// Billing administration: plan configuration, recorded payments, subscription
// list. No PSP is wired (deferred charging decision), so the only payment
// records are manual admin entries, clearly labeled.

export const GET = wrap(
  async () => {
    await requireAdmin();
    const [plans, subs, payments, ledger] = await Promise.all([
      db.plan.findMany({ orderBy: { sort: "asc" } }),
      db.subscription.findMany({ include: { user: { select: { email: true } }, plan: true }, orderBy: { updatedAt: "desc" }, take: 100 }),
      db.payment.findMany({ include: { user: { select: { email: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
      db.creditLedgerEntry.findMany({ include: { user: { select: { email: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
    ]);
    return jsonOk({
      plans: plans.map((p) => ({ ...p, allowedTiers: JSON.parse(p.allowedTiers || "[]") })),
      subscriptions: subs,
      payments,
      ledger,
    });
  },
  { rule: "apiRead" }
);

export const PATCH = wrap(
  async (req: NextRequest) => {
    const admin = await requireAdmin();
    const body = planPatchSchema.parse(await req.json());
    const plan = await db.plan.findUnique({ where: { code: body.code } });
    if (!plan) throw notFound("Plan not found");
    const meta = await clientMeta();
    const { code, allowedTiers, ...rest } = body;
    await db.plan.update({
      where: { code },
      data: {
        ...rest,
        ...(allowedTiers ? { allowedTiers: JSON.stringify(allowedTiers) } : {}),
      },
    });
    await audit({ actorId: admin.id, actorRole: "ADMIN", action: "PLAN_UPDATED", targetType: "Plan", targetId: code, before: { priceCents: plan.priceCents, monthlyFreeCreditCents: plan.monthlyFreeCreditCents, maxConcurrentSessions: plan.maxConcurrentSessions, allowedTiers: plan.allowedTiers }, after: body, ip: meta.ip });
    return jsonOk({ ok: true });
  },
  { rule: "adminWrite" }
);

export const POST = wrap(
  async (req: NextRequest) => {
    const admin = await requireAdmin();
    const body = (await req.json()) as { userId?: string; amountCents?: number; note?: string };
    if (!body.userId || !body.amountCents) throw badRequest("userId and amountCents required");
    const payment = await db.payment.create({
      data: {
        userId: body.userId,
        amountCents: body.amountCents,
        status: "RECORDED",
        provider: "MANUAL",
        note: body.note ?? "Manually recorded by admin (no PSP wired)",
        recordedById: admin.id,
      },
    });
    const meta = await clientMeta();
    await audit({ actorId: admin.id, actorRole: "ADMIN", action: "PAYMENT_RECORDED", targetType: "Payment", targetId: payment.id, after: body, ip: meta.ip });
    return jsonOk({ ok: true, paymentId: payment.id });
  },
  { rule: "adminWrite" }
);
