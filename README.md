# VoxCore — Real-Time AI Voice Conversion Platform

Open, honest-engineering voice conversion platform: Next.js control plane, socket.io
audio gateway, and a fleet of outbound-only GPU worker agents (local Python or
Kaggle burst capacity) coordinated through a command queue with at-least-once
delivery, heartbeats, and self-healing.

**Engineering red lines this project follows:** no fabricated metrics or prices;
compatibility matrices say SUPPORTED / PARTIAL / UNSUPPORTED / WORKAROUND; Kaggle
is burst capacity only (never 24/7); limitations are stated, not hidden.

## Architecture (one sentence per piece)

- **Control plane** — Next.js 15 App Router + Prisma/SQLite (`src/`), auth, voice
  model registry, session scheduler, admin command center, test lab.
- **Audio gateway** — socket.io server at path `/gateway` (`mini-services/audio-gateway/`).
  In production it runs **in-process with Next.js** via `server.ts` on a single port;
  in dev it can run standalone on `:3003` (admin Services card).
- **Worker agents** — `worker-agent/worker_agent.py`: outbound-only polling of a
  command queue (PING/START_SESSION/RUN_TEST_JOB/SHUTDOWN/RESTART), one-time
  registration token → persistent token (SHA-256 hashed), heartbeat, DSP pipeline.
- **Command queue semantics** — at-least-once within bounded lifetime: unacked
  commands redeliver after 30 s, expire after 10 min; handlers are idempotent
  (`docs/12-WORKER-PROTOCOL.md`).

## Quick start (dev)

Requires a PostgreSQL database (the schema provider is postgresql as of
2026-09-12; Supabase works well).

```bash
cp .env.example .env          # then edit DATABASE_URL / secrets
bun install                   # runs prisma generate
bunx prisma db push
bun scripts/seed-if-empty.ts  # seeds models + admin from ADMIN_EMAIL/ADMIN_PASSWORD
bun run dev                   # Next.js on :3000
# audio gateway (standalone dev mode): start it from the admin Services card,
# or POST /api/admin/services/gateway — it listens on VOXCORE_GATEWAY_PORT (3003)
```

There are NO default admin credentials in the codebase (deliberate). The first
admin is created by `seed-if-empty` from `ADMIN_EMAIL` / `ADMIN_PASSWORD` on an
empty database - set them before the first boot.

Provision a local worker from **Admin → capacity → provision** (LocalProvider spawns
`VOXCORE_AGENT_PYTHON worker-agent/worker_agent.py`). The agent needs:
`requests websocket-client numpy psutil python-socketio[client]`.

Then open **Admin → Test lab** and run the suite: WORKER_HEALTH, CONVERSION,
TRANSPORT, RATE_LIMIT, SCALE_TO_ZERO, FAILOVER. Every test runs against real
components and reports honest pass/fail with measured numbers.

## Deploy to Railway

`railway.toml` is committed and ready: Nixpacks build, single service,
`prisma db push → seed-if-empty → NODE_ENV=production bun server.ts`,
healthcheck `/api/models`.

1. Push this repo to GitHub → Railway "New project → Deploy from repo".
2. Set variables: `DATABASE_URL`, `GATEWAY_SECRET`, `NEXTAUTH_SECRET`,
   `APP_ORIGIN`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` (secrets: `openssl rand -base64 32`).
   For Supabase, use the session-mode pooler URL (port 5432) with
   `?sslmode=require` and URL-encode special characters in the password.
3. Deploy, then provision capacity (LOCAL in-container worker or KAGGLE_ASSISTED
   notebook) and run the test lab.

Full guide with honest limitation notes (Supabase Postgres setup, one-instance
gateway note, LocalProvider Python deps, PEP 668, Kaggle burst-only):
**`docs/38-DEPLOYMENT.md`**.

## Key docs

| Doc | Contents |
|-----|----------|
| `docs/38-DEPLOYMENT.md` | Env vars, start order, Railway walkthrough, worker deps |
| `docs/12-WORKER-PROTOCOL.md` | Registration, command queue, delivery semantics, self-healing |
| `docs/` (69 files) | Full numbered documentation set: security, scaling, billing architecture, legal |

## Known limitations (stated, not hidden)

- **One app instance**: the audio gateway and LocalProvider live in the same
  process as the web app, so run a single instance. The database is Postgres
  (Supabase in this deployment) and does not limit scaling; the gateway does.
- **Kaggle** is burst capacity only (KAGGLE_ASSISTED); it is never a 24/7 worker.
- **Billing** is architecture + credit ledger only; PSP adapters are interfaces,
  deliberately not connected.
- **LocalProvider** needs a Python with the agent deps on the server; missing deps
  fail loudly (FATAL), never silently.
