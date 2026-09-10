import { db } from "@/lib/db";
import { wrap, jsonOk } from "@/lib/http";
import { requireUser } from "@/lib/auth";

export const GET = wrap(
  async () => {
    const user = await requireUser();
    const entries = await db.creditLedgerEntry.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return jsonOk({ entries });
  },
  { rule: "apiRead" }
);
