# Backend (Control Plane)

Checked: 2026-09-10.

## Stack
- Next.js (App Router, TypeScript), dev runtime bun, prod target Node.
- Prisma + SQLite in dev; Postgres-ready datasource swap for production.
- Zod validation at every API boundary (src/lib/validate.ts).
- socket.io (server) only inside the standalone gateway service.

## Layout
- src/app/api/*: REST handlers grouped by area (auth, sessions, models,
  billing, support, admin, worker, internal).
- src/lib/*: db (schema-stamp aware singleton), auth (bcrypt cost 12,
  lockout, sessions), http (wrap: validation, rate limit, metrics, errors),
  scheduler, provision, budget, credits, audit (hash chain), rate-limit,
  maintenance, worker-commands.
- instrumentation.ts: starts the maintenance loop in the Node runtime only.

## API conventions
- jsonOk / wrap: consistent envelope {ok, ...} or {error:{code,message}}.
- Every mutating admin action is audited with actor, target, before/after.
- Rate limit rules per area (see 22-SECURITY.md table).
- Request metrics recorded per route with skipMetrics opt-outs for
  heartbeats and health.

## Error taxonomy
- 401 UNAUTHORIZED, 403 FORBIDDEN, 409 typed codes (CONCURRENT_LIMIT,
  TIER_NOT_IN_PLAN, BUDGET, MODEL_UNAVAILABLE, RATE_LIMITED), 429 with
  Retry-After, 500 with a stable code and no stack traces to clients.
