import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { wrap, jsonOk } from "@/lib/http";
import { requireSupportOrAdmin, clientMeta } from "@/lib/auth";
import { ticketReplySchema } from "@/lib/validate";
import { notFound } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";

export const POST = wrap(
  async (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => {
    const { id } = await ctx.params;
    const staff = await requireSupportOrAdmin();
    const ticket = await db.supportTicket.findUnique({ where: { id } });
    if (!ticket) throw notFound("Ticket not found");
    const body = ticketReplySchema.parse(await req.json());
    const meta = await clientMeta();

    await db.ticketMessage.create({
      data: { ticketId: id, authorId: staff.id, authorRole: staff.role, body: body.body, internal: body.internal },
    });
    await db.supportTicket.update({
      where: { id },
      data: {
        status: body.status ?? "IN_PROGRESS",
        closedAt: body.status === "CLOSED" ? new Date() : null,
        assignedTo: ticket.assignedTo ?? staff.id,
      },
    });
    if (!body.internal) {
      await notify({ userId: ticket.userId, kind: "SUPPORT", title: `Support reply: ${ticket.subject}`, body: body.body.slice(0, 140) });
    }
    await audit({ actorId: staff.id, actorRole: staff.role, action: "TICKET_REPLIED", targetType: "SupportTicket", targetId: id, after: { internal: body.internal, status: body.status ?? "IN_PROGRESS" }, ip: meta.ip });
    return jsonOk({ ok: true });
  },
  { rule: "supportReply" }
);
