import { db } from "@/lib/db";
import { wrap, jsonOk } from "@/lib/http";
import { requireUser } from "@/lib/auth";

export const GET = wrap(
  async () => {
    const user = await requireUser();
    const models = await db.voiceModel.findMany({
      where: { ownerId: user.id },
      orderBy: { createdAt: "desc" },
    });
    return jsonOk({
      models: models.map((m) => ({
        id: m.id,
        name: m.name,
        status: m.status,
        description: m.description,
        licenseName: m.licenseName,
        licenseVerified: m.licenseVerified,
        fileName: m.fileName,
        fileSize: m.fileSize,
        fileSha256: m.fileSha256,
        rejectionReason: m.rejectionReason,
        takedownReason: m.takedownReason,
        createdAt: m.createdAt,
        reviewedAt: m.reviewedAt,
      })),
    });
  },
  { rule: "apiRead" }
);
