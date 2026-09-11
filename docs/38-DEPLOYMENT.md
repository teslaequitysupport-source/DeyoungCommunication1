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
3. Database: PostgreSQL. The schema provider was switched from SQLite to
   postgresql (2026-09-12); the schema never used SQLite-only features, so the
   switch required no model changes. Verified live against Supabase: `prisma
   db push` applied the full schema and a production `bun server.ts` booted
   with /api/health reporting db.ok=true.
   Supabase notes (verified):
   - Use the SESSION-MODE pooler host, port 5432:
     postgresql://postgres.<ref>:<PASSWORD>@aws-1-<region>.pooler.supabase.com:5432/postgres?sslmode=require
   - Password special characters (# $ , ) & etc.) MUST be URL-encoded
     (# -> %23, $ -> %24, , -> %2C, ) -> %29, & -> %26) or Prisma cannot parse
     the URL - an unencoded URL crashes the container at start.
   - The direct db.<ref>.supabase.co host is IPv6-only unless the IPv4 add-on
     is purchased; the pooler host resolves over IPv4, which is why it is the
     default recommendation here.
   - Port 6543 is the TRANSACTION-mode pooler; if you switch to it, append
     &pgbouncer=true to the URL (Prisma must disable prepared statements).
   - The Supabase anon key / API key are NOT needed for a direct Postgres
     connection; never paste them into DATABASE_URL.
   - A Railway volume is no longer required (state lives in Postgres).
   - Single-instance note, restated honestly: Postgres removes the DB-side
     scaling limit, but the deployment still assumes ONE app instance because
     the audio gateway and LocalProvider live in the same process. Scale to
     multiple instances only after splitting the gateway out.
4. railway.toml (committed) sets: NIXPACKS builder; startCommand
   `NODE_ENV=production bun scripts/boot.ts` - one orchestrator that
   auto-repairs raw special characters in the DATABASE_URL password
   (idempotent), runs env-doctor fail-fast, applies the schema with
   prisma db push (3 retries), seeds best-effort (never blocks serving),
   then starts the unified server in-process. Healthcheck /api/health
   (always HTTP 200 while the process is up; the body honestly reports
   db status) and restart policy ALWAYS - a transient boot error can no
   longer leave the deployment dead after 3 retries (the old permanent-502
   failure mode). seed-if-empty seeds ONLY an empty database; the bootstrap
   admin comes from ADMIN_EMAIL/ADMIN_PASSWORD.
5. Deploy. Health check turns green when /api/health answers 200.
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

## Google sign-in (added 2026-09-12)

Optional OAuth 2.0 web flow at /api/auth/google/start -> /api/auth/google/callback.
Enabled ONLY when both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set; an
unconfigured deployment never shows the button (site config flag
googleEnabled is env-derived and recomputed, never stored).

Setup:
1. Google Cloud console -> APIs & Services -> Credentials -> Create OAuth
   client ID, type "Web application".
2. Authorized redirect URI (must match APP_ORIGIN exactly):
   https://<your-domain>/api/auth/google/callback
3. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET on the deployment.

Behavior (all verified against the flow implementation):
- Sign-in with an existing email links the accounts; Google-verified emails
  mark the platform account verified; PENDING_VERIFICATION accounts become
  ACTIVE.
- Sign-UP creates the account with a random unusable password hash (Google is
  the only sign-in path until a password reset is performed).
- Terms consent is captured honestly: the register page requires the consent
  checkbox BEFORE the Google button works, and the callback records a
  ConsentRecord with the same evidence format as password registration. Consent
  is never implied by an OAuth round trip.
- CSRF: state parameter bound to an httpOnly cookie (SameSite=Lax - required,
  because the Google redirect back is a cross-site top-level GET navigation).
- All failure paths redirect to the auth page with a specific, honest note.
