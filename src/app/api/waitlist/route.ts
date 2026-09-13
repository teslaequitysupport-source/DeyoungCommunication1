import { db } from "@/lib/db";
import { wrap, jsonOk } from "@/lib/http";
import { waitlistJoinSchema } from "@/lib/validate";

// Mobile app waitlist. POST joins (idempotent per email: rejoining updates the
// platform preference and still returns the live count). GET returns the live
// count so the landing page can show the real number instead of a made-up one.
// Addresses are used for exactly one purpose: one notification when the app
// ships. Stated in the privacy policy; no marketing, no sharing.

export const GET = wrap(
  async () => {
    const count = await db.waitlistEntry.count();
    return jsonOk({ count });
  },
  { rule: "apiRead", skipMetrics: true }
);

export const POST = wrap(
  async (req) => {
    const body = waitlistJoinSchema.parse(await req.json());

    const existing = await db.waitlistEntry.findUnique({ where: { email: body.email } });
    if (existing) {
      if (existing.platform !== body.platform) {
        await db.waitlistEntry.update({ where: { id: existing.id }, data: { platform: body.platform } });
      }
    } else {
      await db.waitlistEntry.create({ data: { email: body.email, platform: body.platform } });
    }

    const count = await db.waitlistEntry.count();
    return jsonOk({ ok: true, count });
  },
  { rule: "waitlistJoin" }
);
