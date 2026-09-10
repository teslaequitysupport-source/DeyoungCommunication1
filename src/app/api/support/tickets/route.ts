import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { wrap, jsonOk } from "@/lib/http";
import { requireUser, clientMeta } from "@/lib/auth";
import { ticketCreateSchema } from "@/lib/validate";
import { getSiteConfig } from "@/lib/settings";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";

export const POST = wrap(
  async (req: NextRequest) => {
    const user = await requireUser();
    const config = await getSiteConfig();
    if (!config.supportEnabled) {
      return jsonOk({ error: { code: "SUPPORT_DISABLED", message: "Support intake is temporarily closed" } }, { status: 503 });
    }
    const body = ticketCreateSchema.parse(await req.json());
    const meta = await clientMeta();
    const ticket = await db.supportTicket.create({
      data: { userId: user.id, subject: body.subject, priority: body.priority },
    });
    await db.ticketMessage.create({
      data: { ticketId: ticket.id, authorId: user.id, authorRole: user.role, body: body.body },
    });
    await audit({ actorId: user.id, actorRole: user.role, action: "TICKET_CREATED", targetType: "SupportTicket", targetId: ticket.id, ip: meta.ip });
    return jsonOk({ ok: true, ticket: { id: ticket.id, subject: ticket.subject, status: ticket.status } });
  },
  { rule: "supportCreate" }
);

export const GET = wrap(
  async () => {
    const user = await requireUser();
    const tickets = await db.supportTicket.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: { messages: { where: { internal: false }, orderBy: { createdAt: "asc" } } },
    });
    return jsonOk({
      tickets: tickets.map((t) => ({
        id: t.id,
        subject: t.subject,
        status: t.status,
        priority: t.priority,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        messages: t.messages.map((m) => ({ id: m.id, role: m.authorRole, body: m.body, createdAt: m.createdAt })),
      })),
    });
  },
  { rule: "apiRead" }
);
