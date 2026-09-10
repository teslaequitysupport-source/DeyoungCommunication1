import { db } from "@/lib/db";

// DB-backed fixed-window rate limiter. Survives restarts and is shared by every
// route handler in this process. Layers: ip, user, endpoint, custom buckets.

export interface RateLimitRule {
  name: string; // bucket name, part of the key
  limit: number;
  windowSec: number;
}

export const RATE_RULES = {
  authLogin: { name: "auth:login", limit: 10, windowSec: 300 },
  authRegister: { name: "auth:register", limit: 5, windowSec: 3600 },
  authPasswordReset: { name: "auth:pwreset", limit: 5, windowSec: 3600 },
  authMe: { name: "auth:me", limit: 240, windowSec: 60 },
  apiRead: { name: "api:read", limit: 240, windowSec: 60 },
  apiWrite: { name: "api:write", limit: 60, windowSec: 60 },
  sessionStart: { name: "session:start", limit: 10, windowSec: 300 },
  modelUpload: { name: "model:upload", limit: 6, windowSec: 3600 },
  modelReport: { name: "model:report", limit: 10, windowSec: 3600 },
  workerRegister: { name: "worker:register", limit: 30, windowSec: 300 },
  workerHeartbeat: { name: "worker:heartbeat", limit: 30, windowSec: 60 },
  supportCreate: { name: "support:create", limit: 5, windowSec: 3600 },
  supportReply: { name: "support:reply", limit: 30, windowSec: 600 },
  adminWrite: { name: "admin:write", limit: 120, windowSec: 60 },
  testLab: { name: "admin:testlab", limit: 20, windowSec: 60 },
  emailResend: { name: "auth:email-resend", limit: 3, windowSec: 3600 },
} as const satisfies Record<string, RateLimitRule>;

export type RateRuleName = keyof typeof RATE_RULES;

// Returns true when allowed, false when the caller exceeded the limit.
// Writes are batched best-effort: on DB failure we fail-open but log via console.
export async function checkRateLimit(
  rule: RateLimitRule,
  identity: string,
  extra = ""
): Promise<boolean> {
  const windowMs = rule.windowSec * 1000;
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);
  const key = `${rule.name}:${identity}${extra ? `:${extra}` : ""}`;
  try {
    const row = await db.rateLimitCounter.upsert({
      where: { key_windowStart: { key, windowStart } },
      create: { key, windowStart, count: 1 },
      update: { count: { increment: 1 } },
    });
    return row.count <= rule.limit;
  } catch (e) {
    console.error(JSON.stringify({ level: "error", msg: "rate_limit_db_error", key, err: String(e) }));
    return true;
  }
}

export async function retryAfterSec(rule: RateLimitRule, identity: string, extra = ""): Promise<number> {
  const windowMs = rule.windowSec * 1000;
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);
  const key = `${rule.name}:${identity}${extra ? `:${extra}` : ""}`;
  try {
    const row = await db.rateLimitCounter.findUnique({
      where: { key_windowStart: { key, windowStart } },
    });
    if (!row) return 0;
    const resetAt = windowStart.getTime() + windowMs;
    return Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
  } catch {
    return rule.windowSec;
  }
}

// Cleanup old windows (called by the background maintenance loop).
export async function pruneRateLimits(): Promise<number> {
  const cutoff = new Date(Date.now() - 24 * 3600 * 1000);
  const res = await db.rateLimitCounter.deleteMany({ where: { windowStart: { lt: cutoff } } });
  return res.count;
}
