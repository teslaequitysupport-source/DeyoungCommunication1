import { db } from "@/lib/db";
import { wrap, jsonOk } from "@/lib/http";
import { requireUser } from "@/lib/auth";

// List the caller's own clone requests with sample metadata. Audio bytes are
// deliberately excluded: they are private payload, not list content.

export const GET = wrap(
  async () => {
    const user = await requireUser();
    const rows = await db.voiceCloneRequest.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        statusNote: true,
        totalBytes: true,
        totalSec: true,
        createdAt: true,
        samples: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            fileName: true,
            mimeType: true,
            sizeBytes: true,
            durationSec: true,
            sha256: true,
          },
        },
      },
    });
    return jsonOk({ requests: rows });
  },
  { rule: "apiRead" }
);
