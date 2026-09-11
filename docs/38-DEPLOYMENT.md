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
- VOXCORE_AGENT_PYTHON (added 2026-09-11): absolute path to the Python
  interpreter the LocalProvider should spawn. Bare "python3" resolves
  against the SERVER process PATH, which can differ from the operator
  shell PATH (observed live: the server spawned /usr/bin/python3 while
  the operator's venv python held the agent dependencies). Pin it in
  production.
- Worker agents receive BACKEND_URL and a one-time token at launch; they
  never hold other secrets.

## Worker agent dependencies (required on the agent interpreter)
- requests, websocket-client, numpy, psutil, python-socketio[client].
- Missing deps are reported honestly at startup (FATAL exit) and at
  session time (session-ready rejected with the reason), never silently.
- Debian/Ubuntu system Pythons are PEP 668 externally managed; either use
  a venv and point VOXCORE_AGENT_PYTHON at it, or install with
  --break-system-packages in disposable containers only.

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

## Railway deployment (added 2026-09-11)

Verified live before this section was written: production entry
`NODE_ENV=production bun server.ts` passed the full E2E audio flow
(30/30 chunks, RTT p50 3 ms / p95 6 ms) with a real worker agent through
the in-process gateway, and the production build (`bun run build`) compiles
clean with all routes dynamic.

Architecture on Railway: ONE service. server.ts runs Next.js and the audio
gateway in the same process on $PORT; the gateway lives at socket.io path
/gateway. Nothing needs a second port. LocalProvider workers spawned inside
the container dial ws://127.0.0.1:$PORT/gateway; Kaggle workers dial
wss://<service>.up.railway.app/gateway over outbound connections only.

Steps:
1. Push the repo to GitHub; Railway new project, deploy from repo.
   Nixpacks detects bun (bun.lock) and python (requirements.txt at root,
   which are the worker-agent dependencies for LocalProvider). If python
   detection causes trouble, delete requirements.txt and use
   KAGGLE_ASSISTED capacity only - LocalProvider will then fail loudly
   (FATAL exit on missing deps), never silently.
2. Set variables: DATABASE_URL, GATEWAY_SECRET, NEXTAUTH_SECRET,
   APP_ORIGIN (https://<service>.up.railway.app), ADMIN_EMAIL,
   ADMIN_PASSWORD. Generate secrets with `openssl rand -base64 32`.
3. SQLite: mount a Railway volume (default /data is fine), set
   DATABASE_URL=file:/data/voxcore.db. SQLite means ONE instance - scale
   horizontally later requires the Postgres provider switch documented
   above. This limitation is stated, not hidden.
4. railway.toml (committed) sets: NIXPACKS builder; startCommand
   `prisma db push --skip-generate && bun scripts/seed-if-empty.ts &&
   NODE_ENV=production bun server.ts`; healthcheck /api/models;
   restart on failure. seed-if-empty seeds ONLY an empty database;
   the bootstrap admin comes from ADMIN_EMAIL/ADMIN_PASSWORD.
5. Deploy. Health check turns green when /api/models answers 200.
6. Provision capacity: LOCAL (in-container python workers) or
   KAGGLE_ASSISTED (paste the generated cell into a Kaggle GPU notebook;
   the worker registers over outbound-only connections). Verify with the
   admin Test lab: WORKER_HEALTH, CONVERSION, TRANSPORT (in-process
   /gateway probe), RATE_LIMIT, SCALE_TO_ZERO, FAILOVER.

Mode summary (both use socket.io path /gateway):
- UNIFIED (server.ts, Railway): browser uses same origin; scheduler sends
  gatewayUrl "" + gatewayPath "/gateway"; client code resolves "" to
  window.location.origin.
- STANDALONE (next dev + admin Services card): gateway on
  VOXCORE_GATEWAY_PORT (3003) at /gateway; local browsers get
  http://<app-host>:3003 as the gateway origin; set
  VOXCORE_GATEWAY_PUBLIC_URL when the gateway is served from another host.
