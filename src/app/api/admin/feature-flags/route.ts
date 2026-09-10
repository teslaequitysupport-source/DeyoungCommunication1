import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { wrap, jsonOk } from "@/lib/http";
import { requireAdmin, clientMeta } from "@/lib/auth";
import { flagSchema } from "@/lib/validate";
import { audit } from "@/lib/audit";

export const GET = wrap(
  async () => {
    await requireAdmin();
    const flags = await db.featureFlag.findMany({ orderBy: { key: "asc" } });
    return jsonOk({ flags });
  },
  { rule: "apiRead" }
);

export const PUT = wrap(
  async (req: NextRequest) => {
    const admin = await requireAdmin();
    const body = flagSchema.parse(await req.json());
    const meta = await clientMeta();
    const existing = await db.featureFlag.findUnique({ where: { key: body.key } });
    await db.featureFlag.upsert({
      where: { key: body.key },
      create: { key: body.key, enabled: body.enabled, description: body.description ?? null },
      update: { enabled: body.enabled, description: body.description ?? existing?.description ?? null },
    });
    await audit({ actorId: admin.id, actorRole: "ADMIN", action: "FLAG_UPDATED", targetType: "FeatureFlag", targetId: body.key, before: { enabled: existing?.enabled ?? null }, after: { enabled: body.enabled }, ip: meta.ip });
    return jsonOk({ ok: true });
  },
  { rule: "adminWrite" }
);
