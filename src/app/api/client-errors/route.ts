import { wrap, jsonOk } from "@/lib/http";
import { db } from "@/lib/db";
import { clientErrorSchema } from "@/lib/validate";

// Client fault intake: the browser error boundary and global error listeners
// report UI faults here so a render failure is diagnosable server-side,
// without asking the visitor to open dev tools and copy a digest.
//
// Design rules:
// - NEVER throws: a fault reporter that 500s would create error loops. Even
//   a failed DB write returns 204 (the failure is logged to the platform log).
// - skipMetrics: fault reports are not API traffic; they must not pollute
//   the RequestMetric error-rate picture.
// - Rate limited (clientError: 30 per 10 min per identity) and every field
//   size-capped; the user agent comes from the header, not the body.
// - Opportunistic pruning keeps the table bounded (reports older than 14 days).

export const POST = wrap(
  async (req) => {
    let parsedBody: unknown = null;
    try {
      parsedBody = await req.json();
    } catch {
      return new Response(null, { status: 204 });
    }

    const parsed = clientErrorSchema.safeParse(parsedBody);
    if (!parsed.success) {
      // Invalid report: drop it silently. Never discipline a faulting client
      // with a 400 storm; the rate limiter above is the only gate that counts.
      return new Response(null, { status: 204 });
    }

    const ua = (req.headers.get("user-agent") ?? "").slice(0, 300);

    try {
      await db.clientErrorReport.create({
        data: {
          digest: parsed.data.digest ?? null,
          message: parsed.data.message,
          stack: parsed.data.stack ?? null,
          route: parsed.data.route ?? null,
          page: parsed.data.page ?? null,
          buildSha: parsed.data.buildSha ?? null,
          userAgent: ua || null,
        },
      });
    } catch (err) {
      console.error(
        JSON.stringify({ level: "error", msg: "client_error_report_store_failed", err: String(err) })
      );
    }

    // About one report in fifty triggers pruning of reports older than 14
    // days (best-effort, keeps the table bounded without a cron).
    try {
      if (Math.random() < 0.02) {
        const cutoff = new Date(Date.now() - 14 * 24 * 3600 * 1000);
        await db.clientErrorReport.deleteMany({ where: { createdAt: { lt: cutoff } } });
      }
    } catch {
      // pruning is best-effort
    }

    return new Response(null, { status: 204 });
  },
  { rule: "clientError", skipMetrics: true }
);
