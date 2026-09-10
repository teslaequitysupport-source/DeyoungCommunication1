# Development Guide

Checked: 2026-09-10.

## Run everything locally
1. bun install; prisma db push; bun scripts/seed.ts
2. bun run dev (Next.js on :3000; the platform may supervise this)
3. Gateway: cd mini-services/audio-gateway && bun index.ts (:3003)
   or start it from the admin panel (control-plane managed spawn).
4. Worker: admin panel -> GPU workers -> Provision (LOCAL). A real python
   process registers within seconds.
5. Studio: sign in as the seeded test user, pick a DSP model, go live.

## Seeded accounts
- admin@voxcore.local / VoxCore#2026Admin (change in any real deployment)
- test@example.com / TestPass123x

## Scripts
- scripts/e2e-audio.ts: E2E audio proof (needs user cookie at /tmp/user.jar
  or USER_JAR env, gateway + agent live).
- scripts/verify-failover.ts: drain-and-recover proof.
- scripts/cleanup-stale.ts: pre-test hygiene.
- scripts/verify-suite.sh: orchestrates the full suite in one session.
- scripts/seed.ts: plans (prices NULL), system models, budget policy, admin.

## Conventions
- No em dashes anywhere. Real data or none; empty states are honest.
- Every API mutation: Zod schema + rate rule + audit where admin.
- Python agent: stdlib + numpy + psutil + requests + python-socketio only;
  keep it dependency-light for notebook environments.

## Debugging tips (learned the hard way, 2026-09-10)
- If sessions hang CONNECTING: is the agent's worker row stale? Run
  cleanup-stale.ts; check heartbeat freshness; is the gateway up?
- Chunk loss that starts immediately: the client streamed before
  peer-ready; the gateway now rejects pre-peer chunks with ack false.
- Prisma stale-process errors after schema edits: db.ts schema-stamp forces
  a fresh client; restart dev servers if symptoms persist.
