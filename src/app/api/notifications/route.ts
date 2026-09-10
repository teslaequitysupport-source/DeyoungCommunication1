import { db } from "@/lib/db";
import { wrap, jsonOk } from "@/lib/http";
import { requireUser } from "@/lib/auth";

export const GET = wrap(
  async () => {
    const user = await requireUser();
    const [items, unread] = await Promise.all([
      db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 50 }),
      db.notification.count({ where: { userId: user.id, readAt: null } }),
    ]);
    return jsonOk({ notifications: items, unread });
  },
  { rule: "apiRead" }
);
