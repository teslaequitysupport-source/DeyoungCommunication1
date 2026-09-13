import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { wrap, jsonOk } from "@/lib/http";
import { supportContactSchema } from "@/lib/validate";
import { clientMeta } from "@/lib/auth";

// Public contact intake for signed-out visitors. Creates a SupportRequest with
// a short human reference the visitor can cite. Signed-in users should prefer
// the ticket system (two-way, tracked); this endpoint exists so locked-out or
// pre-signup visitors are never stranded. Rate limited per IP, honeypot
// guarded, and no third-party services involved.

const REF_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no I/L/O/0/1: unambiguous when read aloud

function makeRef(): string {
  let s = "";
  for (let i = 0; i < 6; i++) {
    s += REF_ALPHABET[Math.floor(Math.random() * REF_ALPHABET.length)];
  }
  return `VC-${s}`;
}

export const POST = wrap(
  async (req: NextRequest) => {
    const body = supportContactSchema.parse(await req.json());
    const meta = await clientMeta();

    let ref = makeRef();
    // Collision chance is tiny, but refs are unique - retry once, then surface
    // the honest error rather than looping.
    try {
      await db.supportRequest.create({
        data: {
          ref,
          name: body.name || null,
          email: body.email,
          subject: body.subject,
          body: body.body,
          ip: meta.ip ?? null,
          userAgent: meta.userAgent ?? null,
        },
      });
    } catch {
      ref = makeRef();
      await db.supportRequest.create({
        data: {
          ref,
          name: body.name || null,
          email: body.email,
          subject: body.subject,
          body: body.body,
          ip: meta.ip ?? null,
          userAgent: meta.userAgent ?? null,
        },
      });
    }

    return jsonOk({
      ok: true,
      ref,
      message: "Message received. Keep the reference: staff reply to your email and you can cite it in any follow-up.",
    });
  },
  { rule: "supportContact" }
);
