import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { wrap, jsonOk } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { z } from "zod";

const schema = z.object({ ids: z.array(z.string()).optional(), all: z.boolean().default(false) });

export const POST = wrap(
  async (req: NextRequest) => {
    const user = await requireUser();
    const body = schema.parse(await req.json().catch(() => ({})));
    if (body.all) {
      await db.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
    } else if (body.ids?.length) {
      await db.notification.updateMany({ where: { userId: user.id, id: { in: body.ids }, readAt: null }, data: { readAt: new Date() } });
    }
    return jsonOk({ ok: true });
  },
  { rule: "apiWrite" }
);
