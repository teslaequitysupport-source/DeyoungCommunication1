import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { wrap, jsonOk } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { notFound, forbidden } from "@/lib/errors";

// Owner-initiated deletion of a clone request. Samples cascade with the row
// (onDelete: Cascade), so the audio bytes are removed from the database in
// the same transaction as the request record.

export const DELETE = wrap(
  async (_req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => {
    const { id } = await ctx.params;
    const user = await requireUser();

    const request = await db.voiceCloneRequest.findUnique({ where: { id } });
    if (!request) throw notFound();
    if (request.userId !== user.id) throw forbidden("This clone request belongs to another account.");

    await db.voiceCloneRequest.delete({ where: { id } });
    return jsonOk({ ok: true, message: "Clone request and its audio samples were deleted." });
  },
  { rule: "apiWrite" }
);
