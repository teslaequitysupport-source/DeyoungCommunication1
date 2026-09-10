import { db } from "@/lib/db";
import { wrap, jsonOk } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { usageSummary } from "@/lib/metering";

export const GET = wrap(
  async () => {
    const user = await requireUser();
    const [summary, records] = await Promise.all([
      usageSummary(user.id),
      db.usageRecord.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 50 }),
    ]);
    return jsonOk({ summary, records });
  },
  { rule: "apiRead" }
);
