import { db } from "@/lib/db";
import { wrap, jsonOk } from "@/lib/http";
import { requireSupportOrAdmin } from "@/lib/auth";

// Support inbox for staff. Internal notes visible here are filtered out of
// every user-facing endpoint by design.

export const GET = wrap(
  async () => {
    await requireSupportOrAdmin();
    const tickets = await db.supportTicket.findMany({
      orderBy: { updatedAt: "desc" },
      take: 100,
      include: {
        user: { select: { id: true, email: true, status: true } },
        messages: { orderBy: { createdAt: "asc" } },
      },
    });
    return jsonOk({
      tickets: tickets.map((t) => ({
        id: t.id, subject: t.subject, status: t.status, priority: t.priority,
        user: t.user, createdAt: t.createdAt, updatedAt: t.updatedAt,
        messages: t.messages.map((m) => ({ id: m.id, authorRole: m.authorRole, authorId: m.authorId, body: m.body, internal: m.internal, createdAt: m.createdAt })),
      })),
    });
  },
  { rule: "apiRead" }
);
