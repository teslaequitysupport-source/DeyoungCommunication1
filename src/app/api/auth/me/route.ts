import { wrap, jsonOk } from "@/lib/http";
import { currentUser } from "@/lib/auth";
import { creditBalance } from "@/lib/credits";
import { db } from "@/lib/db";

// Current identity, unread notification count and credit balance. Hot endpoint;
// metrics are skipped to keep the metrics table focused on heavier routes.

export const GET = wrap(
  async () => {
    const user = await currentUser();
    if (!user) return jsonOk({ user: null });
    const [balance, unread] = await Promise.all([
      creditBalance(user.id),
      db.notification.count({ where: { userId: user.id, readAt: null } }),
    ]);
    return jsonOk({ user, creditBalanceCents: balance, unreadNotifications: unread });
  },
  { rule: "authMe", skipMetrics: true }
);
