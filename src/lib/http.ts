import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { db } from "@/lib/db";
import { ApiError, tooMany } from "@/lib/errors";
import { RATE_RULES, checkRateLimit, retryAfterSec, RateRuleName } from "@/lib/rate-limit";
import { assertSameOrigin } from "@/lib/auth";
import { securityEvent } from "@/lib/audit";

// Route handler wrapper: same-origin enforcement for mutations, per-rule rate
// limiting, request metrics with periodic pruning, consistent error envelope.

type Handler = (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;

interface WrapOptions {
  rule?: RateRuleName;
  // extra identity segment appended to the rate limit key
  identityExtra?: (req: NextRequest) => string;
  // mutations (non-GET) get same-origin checks by default
  skipOriginCheck?: boolean;
  // skip metrics recording (used for very hot endpoints)
  skipMetrics?: boolean;
}

let metricCount = 0;

export function wrap(handler: Handler, options: WrapOptions = {}): Handler {
  return async (req, ctx) => {
    const started = Date.now();
    const method = req.method.toUpperCase();
    const route = new URL(req.url).pathname;

    try {
      if (method !== "GET" && method !== "HEAD" && !options.skipOriginCheck) {
        await assertSameOrigin();
      }

      if (options.rule) {
        const rule = RATE_RULES[options.rule];
        const identity = await rateIdentity(req);
        const extra = options.identityExtra ? options.identityExtra(req) : "";
        const allowed = await checkRateLimit(rule, identity, extra);
        if (!allowed) {
          await securityEvent({
            kind: "RATE_LIMITED",
            severity: "INFO",
            detail: { route, rule: rule.name },
          });
          const retry = await retryAfterSec(rule, identity, extra);
          throw tooMany(`Too many requests. Retry in ${retry}s`, retry);
        }
      }

      const res = await handler(req, ctx);

      if (!options.skipMetrics) {
        void recordMetric(route, method, res.status, Date.now() - started);
      }
      return res;
    } catch (err) {
      if (err instanceof ApiError) {
        const res = NextResponse.json(
          { error: { code: err.code, message: err.message, details: err.details ?? null } },
          { status: err.status }
        );
        if (err.status === 429) {
          const retry = (err.details as { retryAfterSec?: number } | undefined)?.retryAfterSec;
          if (retry) res.headers.set("Retry-After", String(retry));
        }
        void recordMetric(route, method, err.status, Date.now() - started);
        return res;
      }
      if (err instanceof ZodError) {
        void recordMetric(route, method, 400, Date.now() - started);
        return NextResponse.json(
          { error: { code: "VALIDATION", message: "Request validation failed", details: err.issues } },
          { status: 400 }
        );
      }
      console.error(JSON.stringify({ level: "error", msg: "unhandled_route_error", route, err: String(err), stack: (err as Error)?.stack }));
      void recordMetric(route, method, 500, Date.now() - started);
      return NextResponse.json(
        { error: { code: "INTERNAL", message: "Internal server error" } },
        { status: 500 }
      );
    }
  };
}

async function rateIdentity(req: NextRequest): Promise<string> {
  // Prefer user id when a session cookie exists (cheap check without full auth),
  // otherwise fall back to IP.
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown-ip";
  const cookie = req.cookies.get("voxcore_session")?.value;
  if (cookie) {
    // Hash to avoid storing raw tokens in rate limit keys.
    const { hashToken } = await import("@/lib/crypto");
    return `u:${hashToken(cookie).slice(0, 16)}`;
  }
  return `ip:${fwd}`;
}

async function recordMetric(route: string, method: string, status: number, durationMs: number) {
  try {
    metricCount++;
    await db.requestMetric.create({
      data: { route, method, status, durationMs, userId: null },
    });
    // Opportunistic pruning keeps the table bounded without a separate cron.
    if (metricCount % 500 === 0) {
      const cutoff = new Date(Date.now() - 24 * 3600 * 1000);
      await db.requestMetric.deleteMany({ where: { createdAt: { lt: cutoff } } });
    }
  } catch {
    // metrics are best-effort
  }
}

export function jsonOk(data: unknown, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, init);
}
