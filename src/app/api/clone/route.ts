import { NextRequest } from "next/server";
import { createHash } from "crypto";
import { db } from "@/lib/db";
import { wrap, jsonOk } from "@/lib/http";
import { requireUser, clientMeta } from "@/lib/auth";
import { getSiteConfig } from "@/lib/settings";
import { sniffAudioContainer } from "@/lib/audio-sniff";
import { env } from "@/lib/env";
import { badRequest, forbidden, payloadTooLarge } from "@/lib/errors";
import { z } from "zod";

// Voice cloning from device audio uploads. A clone request is a PRIVATE
// sample set owned by the uploading user: it never enters the public catalog
// and no other account can list or read it. Samples are stored as bytea in
// Postgres so they survive redeploys on ephemeral hosts.
//
// Honest capability statement that the API itself makes in every response:
// voice TRAINING is not available in this deployment yet (no worker trains
// today). Requests are stored, consented and hashed, and stay in RECEIVED
// until a real training pipeline exists. Nothing here pretends to process.

const MAX_FILES = 3;
const MAX_ACTIVE_REQUESTS = 10;

const cloneMetaSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  totalSec: z.coerce.number().min(0).max(3600 * 4).optional(),
  attested: z.literal("true", { message: "Rights attestation is required" }),
});

function bytesToPretty(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  return `${Math.max(1, Math.round(bytes / 1024))}KB`;
}

export const POST = wrap(
  async (req: NextRequest) => {
    const user = await requireUser();
    const config = await getSiteConfig();
    if (!config.uploadsEnabled) {
      throw forbidden("Uploads are temporarily disabled by an administrator.");
    }

    // Keep the surface bounded: a hard cap on open requests per account.
    const active = await db.voiceCloneRequest.count({ where: { userId: user.id } });
    if (active >= MAX_ACTIVE_REQUESTS) {
      throw forbidden(
        `You already have ${active} clone requests. Delete one before submitting another; the cap keeps storage honest for everyone.`
      );
    }

    // Early total-size gate before buffering anything.
    const maxFileBytes = env.maxSampleUploadMb * 1024 * 1024;
    const declared = Number(req.headers.get("content-length") ?? 0);
    if (declared && declared > maxFileBytes * MAX_FILES + 1024 * 1024) {
      throw payloadTooLarge(
        `Samples are limited to ${env.maxSampleUploadMb}MB each, at most ${MAX_FILES} files.`
      );
    }

    const form = await req.formData();
    const meta = cloneMetaSchema.parse({
      name: String(form.get("name") ?? ""),
      description: String(form.get("description") ?? ""),
      totalSec: String(form.get("totalSec") ?? "") || undefined,
      attested: String(form.get("attested") ?? "false"),
    });

    const files = form.getAll("files").filter((f): f is File => f instanceof File);
    if (files.length === 0) throw badRequest("Attach at least one audio file from your device.");
    if (files.length > MAX_FILES) throw badRequest(`Attach at most ${MAX_FILES} audio files per clone request.`);

    const attestationText =
      "I confirm I have the rights or the spoken consent of the person whose voice is in these recordings, and I accept the Voice Rights Policy and immediate takedown terms.";
    const perFile: { fileName: string; mimeType: string; sizeBytes: number; sha256: string; data: Buffer; container: string }[] = [];
    const hashes: string[] = [];
    let totalBytes = 0;

    for (const file of files) {
      if (file.size > maxFileBytes) {
        throw payloadTooLarge(
          `"${file.name}" is ${bytesToPretty(file.size)}; samples are limited to ${env.maxSampleUploadMb}MB each.`
        );
      }
      const buf = Buffer.from(await file.arrayBuffer());
      if (buf.length === 0) throw badRequest(`"${file.name}" is empty.`);
      if (buf.length > maxFileBytes) {
        throw payloadTooLarge(`"${file.name}" is ${bytesToPretty(buf.length)}; samples are limited to ${env.maxSampleUploadMb}MB each.`);
      }
      const container = sniffAudioContainer(buf);
      if (!container) {
        throw badRequest(
          `"${file.name}" is not a recognizable audio file (checked by content, not extension). Use wav, mp3, m4a, ogg, flac or webm.`
        );
      }
      const sha256 = createHash("sha256").update(buf).digest("hex");
      hashes.push(sha256);
      totalBytes += buf.length;
      perFile.push({
        fileName: file.name.slice(0, 200),
        mimeType: `audio/${container}`,
        sizeBytes: buf.length,
        sha256,
        data: buf,
        container,
      });
    }

    const evidenceHash = createHash("sha256")
      .update([attestationText, user.id, meta.name, ...hashes, Date.now()].join("|"))
      .digest("hex");

    const created = await db.voiceCloneRequest.create({
      data: {
        userId: user.id,
        name: meta.name,
        description: meta.description || null,
        status: "RECEIVED",
        statusNote:
          "Stored and consent-recorded. Voice training is not available in this deployment yet; the request stays queued and private until real training capacity exists.",
        totalBytes,
        totalSec: meta.totalSec ?? null,
        samples: {
          create: perFile.map((s) => ({
            fileName: s.fileName,
            mimeType: s.mimeType,
            sizeBytes: s.sizeBytes,
            sha256: s.sha256,
            // Prisma's Bytes input wants a plain Uint8Array; copy out of Buffer.
            data: new Uint8Array(s.data),
          })),
        },
      },
      select: { id: true, createdAt: true },
    });

    const ipMeta = await clientMeta();
    await db.consentRecord.create({
      data: {
        userId: user.id,
        kind: "RIGHTS_ATTESTATION",
        textVersion: "voice-rights-2026-09",
        evidenceHash,
        ip: ipMeta.ip,
        userAgent: ipMeta.userAgent,
      },
    });

    return jsonOk({
      ok: true,
      id: created.id,
      status: "RECEIVED",
      statusNote:
        "Stored and consent-recorded. Voice training is not available in this deployment yet; the request stays queued and private until real training capacity exists.",
      totalBytes,
      message:
        "Your audio was received, verified by content and hashed. It is private to your account and you can delete it at any time. Training does not start yet: this deployment has no GPU training pipeline, and we will not pretend otherwise.",
    });
  },
  { rule: "cloneUpload" }
);
