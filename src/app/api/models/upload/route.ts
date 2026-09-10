import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { wrap, jsonOk } from "@/lib/http";
import { requireUser, clientMeta } from "@/lib/auth";
import { modelUploadSchema } from "@/lib/validate";
import { badRequest, payloadTooLarge, unprocessable } from "@/lib/errors";
import { getSiteConfig } from "@/lib/settings";
import { hashToken, sha256 } from "@/lib/crypto";
import { audit } from "@/lib/audit";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";

// Voice model upload (open upload policy, per the product decision).
//
// Requirements enforced here (not just in the UI):
// - uploads enabled by site config
// - plan allows uploads (maxModelUploads)
// - a signed rights attestation (checkbox + stored consent record)
// - license metadata (name mandatory; verification flag defaults false)
// - file signature sanity check: RVC .pth files are torch archives (zip-based
//   since torch 1.6); we check the leading magic bytes and store sha256
// - rate limiting on the route (model:upload)
//
// Security note (deliberate, documented): .pth is a pickle. This platform
// NEVER unpickles uploads on the server. Inference happens on GPU workers,
// which must run agent code inside an isolated container in production
// deployments. See docs/33-THREAT-MODEL.md and docs/25-MODEL-LICENSE-AUDIT.md.

const MAGIC_ZIP = Buffer.from([0x50, 0x4b]); // "PK" - torch >= 1.6 zip archives
const MAGIC_LEGACY = Buffer.from([0x80]); // older torch legacy pickle

export const POST = wrap(
  async (req: NextRequest) => {
    const user = await requireUser();
    const config = await getSiteConfig();
    if (!config.uploadsEnabled && user.role === "USER") {
      return jsonOk({ error: { code: "UPLOADS_DISABLED", message: "Uploads are temporarily disabled by an administrator" } }, { status: 503 });
    }

    const plan = await db.subscription.findUnique({ where: { userId: user.id }, include: { plan: true } });
    if (!plan || plan.plan.maxModelUploads < 1) {
      return jsonOk({ error: { code: "PLAN_FORBID", message: "Your plan does not include voice model uploads" } }, { status: 403 });
    }
    const mineCount = await db.voiceModel.count({ where: { ownerId: user.id, status: { in: ["PENDING_REVIEW", "APPROVED"] } } });
    if (mineCount >= plan.plan.maxModelUploads) {
      return jsonOk({ error: { code: "UPLOAD_LIMIT", message: `Upload limit reached (${plan.plan.maxModelUploads}). Remove an older model or upgrade.` } }, { status: 409 });
    }

    const form = await req.formData().catch(() => null);
    if (!form) throw badRequest("multipart/form-data body required");
    const file = form.get("file");
    if (!(file instanceof File)) throw badRequest("file field missing");

    const meta = modelUploadSchema.parse({
      name: form.get("name"),
      description: form.get("description") || undefined,
      engine: form.get("engine") || "RVC",
      licenseName: form.get("licenseName"),
      licenseUrl: form.get("licenseUrl") || undefined,
      rightsAttested: form.get("rightsAttested") === "true",
      licenseVerified: form.get("licenseVerified") === "true",
    });

    const { env } = await import("@/lib/env");
    const maxBytes = env.maxModelUploadMb * 1024 * 1024;
    if (file.size > maxBytes) {
      throw payloadTooLarge(`File exceeds the ${Math.round(maxBytes / 1024 / 1024)}MB limit`);
    }
    if (!/\.pth$/i.test(file.name)) {
      throw unprocessable("Only RVC .pth model files are accepted for upload");
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const magic = buf.subarray(0, 2);
    const isZip = magic.equals(MAGIC_ZIP);
    const isLegacy = buf.subarray(0, 1).equals(MAGIC_LEGACY);
    if (!isZip && !isLegacy) {
      throw unprocessable("File does not look like a torch checkpoint (.pth). Upload rejected before any parsing. The platform never executes uploaded files.");
    }

    const digest = sha256(buf);
    const dup = await db.voiceModel.findFirst({ where: { fileSha256: digest } });
    if (dup) {
      return jsonOk({ error: { code: "DUPLICATE", message: "An identical file (same sha256) was already submitted" } }, { status: 409 });
    }

    const metaIp = await clientMeta();
    const model = await db.voiceModel.create({
      data: {
        name: meta.name,
        kind: "RVC_UPLOAD",
        engine: "RVC",
        status: "PENDING_REVIEW",
        ownerId: user.id,
        description: meta.description ?? null,
        licenseName: meta.licenseName,
        licenseUrl: meta.licenseUrl || null,
        licenseVerified: meta.licenseVerified,
        rightsAttested: true,
        attestationText:
          "I confirm I hold the rights or express permission for this voice model, that it does not impersonate a real person without authorization, and I accept the Voice Rights Policy including takedown terms.",
        sampleRate: 16000,
        fileName: path.basename(file.name).slice(0, 120),
        fileSize: buf.length,
        fileSha256: digest,
      },
    });

    const dir = path.join(process.cwd(), "db", "uploads", "models");
    await fsp.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, `${model.id}.pth`);
    fs.writeFileSync(filePath, buf);
    await db.voiceModel.update({ where: { id: model.id }, data: { filePath } });

    await db.consentRecord.create({
      data: {
        userId: user.id,
        kind: "RIGHTS_ATTESTATION",
        modelId: model.id,
        textVersion: "voice-rights-2026-09",
        evidenceHash: hashToken(`${user.id}:${model.id}:${digest}`),
        ip: metaIp.ip,
        userAgent: metaIp.userAgent,
      },
    });

    await db.voiceModelEvent.create({
      data: { modelId: model.id, kind: "SUBMITTED", actorId: user.id, detail: `sha256=${digest.slice(0, 16)} size=${buf.length}` },
    });
    await audit({ actorId: user.id, actorRole: user.role, action: "MODEL_SUBMITTED", targetType: "VoiceModel", targetId: model.id, after: { name: meta.name, sha256: digest }, ip: metaIp.ip });

    return jsonOk({
      ok: true,
      model: { id: model.id, name: model.name, status: model.status },
      message: "Submitted for moderation. It appears in the catalog only after approval.",
    });
  },
  { rule: "modelUpload" }
);
