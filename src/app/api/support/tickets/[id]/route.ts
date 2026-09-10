import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { wrap, jsonOk } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { ticketReplySchema } from "@/lib/validate";
import { notFound, forbidden } from "@/lib/errors";
import { notify } from "@/lib/notify";

// Reply to, and close, your own ticket. Internal notes are never exposed here.

export const GET = wrap(
  async (_req, ctx: { params: Promise<Record<string, string>> }) => {
    const { id } = await ctx.params;
    const user = await requireUser();
    const ticket = await db.supportTicket.findUnique({
      where: { id },
      include: { messages: { where: { internal: false }, orderBy: { createdAt: "asc" } } },
    });
    if (!ticket) throw notFound();
    if (ticket.userId !== user.id && user.role === "USER") throw forbidden();
    return jsonOk({
      ticket: {
        id: ticket.id,
        subject: ticket.subject,
        status: ticket.status,
        priority: ticket.priority,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
        messages: ticket.messages.map((m) => ({ id: m.id, role: m.authorRole, body: m.body, createdAt: m.createdAt })),
      },
    });
  },
  { rule: "apiRead" }
);

export const POST = wrap(
  async (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => {
    const { id } = await ctx.params;
    const user = await requireUser();
    const ticket = await db.supportTicket.findUnique({ where: { id } });
    if (!ticket) throw notFound();
    if (ticket.userId !== user.id && user.role === "USER") throw forbidden();
    const body = ticketReplySchema.parse(await req.json());

    await db.ticketMessage.create({
      data: { ticketId: id, authorId: user.id, authorRole: user.role, body: body.body, internal: false },
    });
    await db.supportTicket.update({ where: { id }, data: { status: body.status ?? "OPEN", closedAt: body.status === "CLOSED" ? new Date() : null } });

    // Notify the other side.
    if (user.role === "USER") {
      const admins = await db.user.findMany({ where: { role: { in: ["ADMIN", "SUPPORT"] } }, select: { id: true } });
      for (const a of admins) {
        await notify({ userId: a.id, kind: "SUPPORT", title: `Ticket updated: ${ticket.subject}`, body: `${user.email} replied.` });
      }
    } else {
      await notify({ userId: ticket.userId, kind: "SUPPORT", title: `Support replied: ${ticket.subject}`, body: body.body.slice(0, 140) });
    }
    return jsonOk({ ok: true });
  },
  { rule: "supportReply" }
);
