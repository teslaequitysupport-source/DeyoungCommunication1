import { db } from "@/lib/db";
import { wrap, jsonOk } from "@/lib/http";

// Public voice catalog: only APPROVED models are listed. System DSP models
// always appear; RVC uploads appear once they pass moderation. This endpoint
// is intentionally quiet about rejected/pending material (privacy of the
// moderation pipeline) while takedown history is visible per model.

export const GET = wrap(
  async () => {
    const models = await db.voiceModel.findMany({
      where: { status: "APPROVED" },
      orderBy: [{ kind: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        name: true,
        kind: true,
        engine: true,
        description: true,
        sampleRate: true,
        version: true,
        licenseName: true,
        licenseUrl: true,
        licenseVerified: true,
        engineParams: true,
        createdAt: true,
      },
    });
    return jsonOk({
      models: models.map((m) => ({
        ...m,
        engineParams: m.engineParams ? JSON.parse(m.engineParams) : null,
      })),
    });
  },
  { rule: "apiRead" }
);
