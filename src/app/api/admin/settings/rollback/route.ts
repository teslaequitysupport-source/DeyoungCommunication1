import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { wrap, jsonOk } from "@/lib/http";
import { requireAdmin, clientMeta } from "@/lib/auth";
import { badRequest } from "@/lib/errors";
import { invalidateSiteConfig, SETTING_KEY } from "@/lib/settings";
import { audit } from "@/lib/audit";

// Rollback site settings to a previous published version.

export const POST = wrap(
  async (req: NextRequest) => {
    const admin = await requireAdmin();
    const body = (await req.json()) as { versionId?: string };
    if (!body.versionId) throw badRequest("versionId required");
    const version = await db.settingVersion.findUnique({ where: { id: body.versionId } });
    if (!version || version.key !== SETTING_KEY) throw badRequest("Unknown version");

    await db.siteSetting.upsert({
      where: { key: SETTING_KEY },
      create: { key: SETTING_KEY, value: version.value, updatedById: admin.id },
      update: { value: version.value, updatedById: admin.id },
    });
    await db.settingVersion.create({
      data: { key: SETTING_KEY, value: version.value, action: "ROLLBACK", actorId: admin.id, note: `Rolled back to version ${version.id}` },
    });
    invalidateSiteConfig();
    const meta = await clientMeta();
    await audit({ actorId: admin.id, actorRole: "ADMIN", action: "SETTINGS_ROLLBACK", targetType: "SiteSetting", targetId: SETTING_KEY, after: { restoredFrom: version.id }, ip: meta.ip });
    return jsonOk({ ok: true, config: JSON.parse(version.value) });
  },
  { rule: "adminWrite" }
);
