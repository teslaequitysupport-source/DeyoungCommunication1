import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { wrap, jsonOk } from "@/lib/http";
import { requireAdmin, clientMeta } from "@/lib/auth";
import { settingsSchema } from "@/lib/validate";
import { getSiteConfig, invalidateSiteConfig, SETTING_KEY } from "@/lib/settings";
import { audit } from "@/lib/audit";

// Site settings with publish history (versioned). Every publish writes a
// SettingVersion row; rollback restores a previous version and also records
// a version entry. Nothing changes the public site without an audit trail.

export const GET = wrap(
  async () => {
    await requireAdmin();
    const [config, versions] = await Promise.all([
      getSiteConfig(true),
      db.settingVersion.findMany({ where: { key: SETTING_KEY }, orderBy: { createdAt: "desc" }, take: 30 }),
    ]);
    return jsonOk({ config, versions });
  },
  { rule: "apiRead" }
);

export const PUT = wrap(
  async (req: NextRequest) => {
    const admin = await requireAdmin();
    const body = settingsSchema.parse(await req.json());
    const meta = await clientMeta();
    const previous = await getSiteConfig(true);

    await db.siteSetting.upsert({
      where: { key: SETTING_KEY },
      create: { key: SETTING_KEY, value: JSON.stringify(body), updatedById: admin.id },
      update: { value: JSON.stringify(body), updatedById: admin.id },
    });
    await db.settingVersion.create({
      data: { key: SETTING_KEY, value: JSON.stringify(body), action: "PUBLISH", actorId: admin.id, note: `Published over ${previous.siteName} config` },
    });
    invalidateSiteConfig();
    await audit({ actorId: admin.id, actorRole: "ADMIN", action: "SETTINGS_PUBLISHED", targetType: "SiteSetting", targetId: SETTING_KEY, before: previous, after: body, ip: meta.ip });
    return jsonOk({ ok: true, config: body });
  },
  { rule: "adminWrite" }
);
