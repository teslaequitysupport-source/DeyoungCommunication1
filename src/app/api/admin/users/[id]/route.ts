import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { wrap, jsonOk } from "@/lib/http";
import { requireAdmin, clientMeta } from "@/lib/auth";
import { adminUserActionSchema } from "@/lib/validate";
import { notFound, badRequest } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { applyCredits, creditBalance } from "@/lib/credits";
import { endSession } from "@/lib/scheduler";
import { notify } from "@/lib/notify";
import fs from "fs/promises";

// User detail and admin actions. Destructive actions require a reason; all
// actions land in the tamper-evident audit log.

export const GET = wrap(
  async (_req, ctx: { params: Promise<Record<string, string>> }) => {
    const { id } = await ctx.params;
    await requireAdmin();
    const user = await db.user.findUnique({
      where: { id },
      include: {
        subscription: { include: { plan: true } },
        voiceModels: { select: { id: true, name: true, status: true } },
        tickets: { select: { id: true, subject: true, status: true, createdAt: true } },
      },
    });
    if (!user) throw notFound("User not found");
    const [balance, usage, sessions, security] = await Promise.all([
      creditBalance(user.id),
      db.usageRecord.aggregate({ where: { userId: id }, _sum: { quantity: true, costCents: true } }),
      db.conversionSession.findMany({ where: { userId: id }, orderBy: { queuedAt: "desc" }, take: 15 }),
      db.securityEvent.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" }, take: 15 }),
    ]);
    return jsonOk({
      user: {
        id: user.id, email: user.email, name: user.name, role: user.role, status: user.status,
        emailVerified: !!user.emailVerifiedAt, createdAt: user.createdAt, lastLoginAt: user.lastLoginAt,
        lockedUntil: user.lockedUntil, plan: user.subscription?.plan.code ?? null,
        models: user.voiceModels, tickets: user.tickets,
        creditBalanceCents: balance,
        usage: { minutes: usage._sum.quantity ?? 0, costCents: usage._sum.costCents ?? 0 },
        recentSessions: sessions,
        securityEvents: security,
      },
    });
  },
  { rule: "apiRead" }
);

export const POST = wrap(
  async (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => {
    const { id } = await ctx.params;
    const admin = await requireAdmin();
    const body = adminUserActionSchema.parse(await req.json());
    if (id === admin.id && ["suspend", "delete"].includes(body.action)) {
      throw badRequest("You cannot suspend or delete your own admin account from the panel");
    }
    const user = await db.user.findUnique({ where: { id } });
    if (!user) throw notFound("User not found");
    const meta = await clientMeta();

    switch (body.action) {
      case "suspend":
        if (!body.reason) throw badRequest("A reason is required for suspension");
        await db.user.update({ where: { id }, data: { status: "SUSPENDED" } });
        await db.authSession.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date(), revokedReason: "SUSPENDED" } });
        {
          const live = await db.conversionSession.findMany({ where: { userId: id, status: { in: ["QUEUED", "ASSIGNING", "CONNECTING", "ACTIVE"] } } });
          for (const s of live) await endSession(s.id, "ADMIN_STOP", "ADMIN");
        }
        await notify({ userId: id, kind: "SECURITY", title: "Account suspended", body: body.reason });
        break;
      case "restore":
        await db.user.update({ where: { id }, data: { status: user.emailVerifiedAt ? "ACTIVE" : "PENDING_VERIFICATION", failedLoginCount: 0, lockedUntil: null } });
        await notify({ userId: id, kind: "SYSTEM", title: "Account restored", body: "Your account was restored by an administrator." });
        break;
      case "force-logout":
        await db.authSession.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date(), revokedReason: "ADMIN_FORCE_LOGOUT" } });
        break;
      case "grant-credits": {
        if (!body.amountCents || body.amountCents === 0) throw badRequest("amountCents required");
        const result = await applyCredits({
          userId: id,
          deltaCents: body.amountCents,
          reason: body.amountCents > 0 ? "ADMIN_GRANT" : "ADJUSTMENT",
          actorId: admin.id,
          note: body.note ?? "Admin adjustment",
          idempotencyKey: `admin-grant:${admin.id}:${id}:${body.amountCents}:${Date.now()}`,
        });
        await notify({ userId: id, kind: "BILLING", title: "Credits adjusted", body: `${body.amountCents > 0 ? "Granted" : "Deducted"} ${Math.abs(body.amountCents) / 100} USD of credits. New balance: ${result.balanceAfterCents / 100}.` });
        break;
      }
      case "adjust-plan": {
        if (!body.planCode) throw badRequest("planCode required");
        const plan = await db.plan.findUnique({ where: { code: body.planCode } });
        if (!plan) throw badRequest("Unknown plan code");
        await db.subscription.upsert({
          where: { userId: id },
          create: { userId: id, planId: plan.id, status: "ACTIVE", source: "MANUAL" },
          update: { planId: plan.id, status: "ACTIVE" },
        });
        await notify({ userId: id, kind: "BILLING", title: "Plan changed", body: `Your plan is now ${plan.name}.` });
        break;
      }
      case "delete": {
        if (!body.reason) throw badRequest("A reason is required for deletion");
        const models = await db.voiceModel.findMany({ where: { ownerId: id } });
        for (const m of models) if (m.filePath) await fs.unlink(m.filePath).catch(() => {});
        const live = await db.conversionSession.findMany({ where: { userId: id, status: { in: ["QUEUED", "ASSIGNING", "CONNECTING", "ACTIVE"] } } });
        for (const s of live) await endSession(s.id, "ADMIN_STOP", "ADMIN");
        await db.voiceModel.deleteMany({ where: { ownerId: id } });
        await db.notification.deleteMany({ where: { userId: id } });
        await db.subscription.deleteMany({ where: { userId: id } });
        await db.authSession.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date(), revokedReason: "ADMIN_DELETED" } });
        await db.user.update({ where: { id }, data: { email: `deleted-${id}@invalid.local`, name: null, status: "DELETED", passwordHash: "deleted", anonymizedAt: new Date() } });
        break;
      }
    }

    await audit({ actorId: admin.id, actorRole: "ADMIN", action: `USER_${body.action.toUpperCase()}`, targetType: "User", targetId: id, before: { status: user.status }, after: { reason: body.reason ?? body.note ?? null, amountCents: body.amountCents ?? null, planCode: body.planCode ?? null }, reason: body.reason ?? body.note ?? null, ip: meta.ip });
    return jsonOk({ ok: true });
  },
  { rule: "adminWrite" }
);
