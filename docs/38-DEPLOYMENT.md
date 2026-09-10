# Deployment

Checked: 2026-09-10.

## Environments
- DEVELOPMENT: this machine. bun run dev (Next.js), gateway via
  mini-services (bun index.ts), agent via the admin provision action.
  Never treat it as production.
- STAGING: same layout on a small VM; Postgres; real email provider.
- PRODUCTION: Node runtime, managed Postgres, WSS termination at the edge,
  gateway behind the same domain (path-routed) or its own host; secrets in
  a vault; ADMIN bootstrap via env.

## Environment variables (never committed)
- DATABASE_URL, NEXTAUTH_SECRET (also gateway token secret fallback),
  GATEWAY_SECRET, BACKEND_URL (agent), EMAIL_MODE (none|smtp), PORT,
  VOXCORE_GATEWAY_PORT (3003), worker heartbeat timeout override.
- Worker agents receive BACKEND_URL and a one-time token at launch; they
  never hold other secrets.

## Start order
1. Database reachable; prisma db push; seed (scripts/seed.ts) on fresh DBs.
2. Control plane up (listens 3000).
3. Audio gateway up (listens 3003) - start via the admin test lab Services
   card or POST /api/admin/services/gateway (control-plane managed).
4. Provision at least one worker; wait for READY.
5. Smoke: admin test lab TRANSPORT + WORKER_HEALTH + CONVERSION.

## Rollback
- Keep the previous build directory; swap the symlink; DB migrations are
  additive in this milestone (db push), so rollback is a symlink swap.
